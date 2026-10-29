import { HttpStatus, Injectable } from '@nestjs/common';
import { ChallengeDifficulty, Prisma, Role } from '@prisma/client';
import { getQuickJS } from 'quickjs-emscripten';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { pktDay } from '../learning/study-time';
import { runPythonHiddenTests } from './python-hidden-runner';
import { CreateChallengeInput, SubmitChallengeInput } from './challenge.schemas';

type TestCase = { input: unknown[]; expected: unknown };
const PKT_DAY_MS = 86_400_000;

function isTestCase(value: unknown): value is TestCase {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as TestCase).input) && 'expected' in value);
}

function jsonEqual(actual: unknown, expected: unknown) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

async function runJavaScript(code: string, test: TestCase): Promise<boolean> {
  const quickjs = await getQuickJS();
  const vm = quickjs.newContext();
  try {
    const result = vm.evalCode(
      `(() => { const solution = (${code}); const result = solution(...${JSON.stringify(test.input)}); return JSON.stringify(result); })()`,
      { executionTimeout: 250 },
    );
    if (result.error) {
      vm.dump(result.error);
      result.error.dispose();
      return false;
    }
    const output = vm.dump(result.value);
    result.value.dispose();
    if (typeof output !== 'string') return false;
    const parsed: unknown = JSON.parse(output);
    return jsonEqual(parsed, test.expected);
  } catch {
    return false;
  } finally {
    vm.dispose();
  }
}

@Injectable()
export class ChallengeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionsService,
    private readonly points: PointsService,
  ) {}

  async create(auth: AuthUser, input: CreateChallengeInput) {
    const track = await this.prisma.track.findFirst({ where: { id: input.trackId, isPublished: true }, select: { id: true } });
    if (!track) throw new AppException(HttpStatus.NOT_FOUND, 'TRACK_NOT_FOUND');
    return this.prisma.challenge.create({
      data: {
        trackId: input.trackId,
        title: input.title,
        difficulty: input.difficulty as ChallengeDifficulty,
        statement: input.statement,
        starterCode: input.starterCode,
        testCases: input.tests as Prisma.InputJsonValue,
        hiddenTests: input.hiddenTests as Prisma.InputJsonValue,
        publishDate: new Date(`${input.publishDate}T00:00:00.000Z`),
        createdBy: auth.id,
      },
      select: { id: true, trackId: true, title: true, difficulty: true, publishDate: true },
    });
  }

  async daily(auth: AuthUser, trackSlug: string, requestedDate?: string) {
    if (auth.role !== Role.student) throw new AppException(HttpStatus.FORBIDDEN, 'STUDENT_ONLY');
    const track = await this.prisma.track.findFirst({ where: { slug: trackSlug, isPublished: true }, select: { id: true, slug: true, title: true } });
    if (!track) throw new AppException(HttpStatus.NOT_FOUND, 'TRACK_NOT_FOUND');
    if (!(await this.subscriptions.hasTrackAccess(auth.id, track.id))) {
      throw new AppException(HttpStatus.FORBIDDEN, 'SUBSCRIPTION_REQUIRED');
    }
    const day = requestedDate ? new Date(`${requestedDate}T00:00:00.000Z`) : pktDay();
    if (!Number.isFinite(day.getTime()) || day > pktDay() || day < new Date(pktDay().getTime() - 365 * PKT_DAY_MS)) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'CHALLENGE_DATE_INVALID');
    }
    const challenge = await this.prisma.challenge.findUnique({
      where: { trackId_publishDate: { trackId: track.id, publishDate: day } },
    });
    if (!challenge) return { track, challenge: null, submission: null, streak: await this.streak(auth.id, track.id) };
    const [submission, streak] = await Promise.all([
      this.prisma.challengeSubmission.findUnique({ where: { challengeId_userId: { challengeId: challenge.id, userId: auth.id } } }),
      this.streak(auth.id, track.id),
    ]);
    return {
      track,
      challenge: {
        id: challenge.id,
        title: challenge.title,
        difficulty: challenge.difficulty,
        statement: challenge.statement,
        starterCode: challenge.starterCode,
        tests: Array.isArray(challenge.testCases) ? challenge.testCases : [],
        publishDate: challenge.publishDate,
      },
      submission: submission && {
        language: submission.language,
        code: submission.code,
        passed: submission.passed,
        passedTests: submission.passedTests,
        totalTests: submission.totalTests,
        attempts: submission.attempts,
        solvedAt: submission.solvedAt,
      },
      streak,
    };
  }

  async submit(auth: AuthUser, challengeId: string, input: SubmitChallengeInput) {
    if (auth.role !== Role.student) throw new AppException(HttpStatus.FORBIDDEN, 'STUDENT_ONLY');
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new AppException(HttpStatus.NOT_FOUND, 'CHALLENGE_NOT_FOUND');
    const today = pktDay();
    if (challenge.publishDate.getTime() > today.getTime() || challenge.publishDate.getTime() < today.getTime() - 365 * PKT_DAY_MS) {
      throw new AppException(HttpStatus.FORBIDDEN, 'CHALLENGE_NOT_OPEN');
    }
    if (!(await this.subscriptions.hasTrackAccess(auth.id, challenge.trackId))) {
      throw new AppException(HttpStatus.FORBIDDEN, 'SUBSCRIPTION_REQUIRED');
    }
    const visibleTests = (Array.isArray(challenge.testCases) ? challenge.testCases : []).filter(isTestCase);
    const hiddenTests = (Array.isArray(challenge.hiddenTests) ? challenge.hiddenTests : []).filter(isTestCase);
    const total = visibleTests.length + hiddenTests.length;
    if (!total || total > 80) throw new AppException(HttpStatus.INTERNAL_SERVER_ERROR, 'CHALLENGE_TESTS_INVALID');
    let passedTests = 0;
    const allTests = [...visibleTests, ...hiddenTests];
    if (input.language === 'python') {
      try {
        passedTests = (await runPythonHiddenTests(input.code, allTests)).filter(Boolean).length;
      } catch {
        passedTests = 0;
      }
    } else {
      const start = Date.now();
      for (const test of allTests) {
        if (Date.now() - start > 5_000) break;
        try {
          if (await runJavaScript(input.code, test)) passedTests++;
        } catch {
          // A runtime error or timeout is a failed case, never a successful submission.
        }
      }
    }
    const passed = passedTests === total;
    const existing = await this.prisma.challengeSubmission.findUnique({ where: { challengeId_userId: { challengeId, userId: auth.id } } });
    const firstSolve = passed && !existing?.solvedAt;
    await this.prisma.challengeSubmission.upsert({
      where: { challengeId_userId: { challengeId, userId: auth.id } },
      create: {
        challengeId, userId: auth.id, language: input.language, code: input.code,
        passed, passedTests, totalTests: total, attempts: 1, solvedAt: passed ? new Date() : null,
      },
      update: {
        language: input.language, code: input.code, passed, passedTests, totalTests: total,
        attempts: { increment: 1 }, ...(firstSolve ? { solvedAt: new Date() } : {}),
      },
    });
    if (firstSolve) await this.points.award(auth.id, 'challenge_solved', challenge.id, { trackId: challenge.trackId });
    return { passed, passedTests, totalTests: total, visibleTests: visibleTests.length, hiddenTests: hiddenTests.length, firstSolve };
  }

  private async streak(userId: string, trackId: string) {
    const solves = await this.prisma.challengeSubmission.findMany({
      where: { userId, passed: true, solvedAt: { not: null }, challenge: { trackId } },
      select: { solvedAt: true },
      orderBy: { solvedAt: 'desc' },
    });
    const days = new Set(solves.map((solve) => pktDay(solve.solvedAt!).getTime()));
    let cursor = pktDay().getTime();
    if (!days.has(cursor)) cursor -= PKT_DAY_MS;
    let streak = 0;
    while (days.has(cursor)) { streak++; cursor -= PKT_DAY_MS; }
    return streak;
  }
}
