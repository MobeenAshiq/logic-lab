import { HttpStatus, Injectable } from '@nestjs/common';
import { ChallengeDifficulty, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { SubscriptionsService } from '../billing/subscriptions.service';
import { PrismaService } from '../prisma/prisma.service';
import { PointsService } from '../points/points.service';
import { pktDay } from '../learning/study-time';
import { runJavaScriptHiddenTests } from './javascript-hidden-runner';
import { runPythonHiddenTests } from './python-hidden-runner';
import { CreateChallengeInput, SubmitChallengeInput } from './challenge.schemas';

type TestCase = { input: unknown[]; expected: unknown };
const PKT_DAY_MS = 86_400_000;

function isTestCase(value: unknown): value is TestCase {
  return Boolean(value && typeof value === 'object' && Array.isArray((value as TestCase).input) && 'expected' in value);
}

function testCasesOf(value: Prisma.JsonValue): TestCase[] {
  if (!Array.isArray(value)) return [];
  const tests: TestCase[] = [];
  for (const item of value) if (isTestCase(item)) tests.push(item);
  return tests;
}

function jsonEqual(actual: unknown, expected: unknown) {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, normalize(item)]));
    }
    return value;
  };
  return JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected));
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
        graded: input.graded,
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
        graded: challenge.graded,
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
    const challengeDay = new Date(Date.UTC(challenge.publishDate.getUTCFullYear(), challenge.publishDate.getUTCMonth(), challenge.publishDate.getUTCDate()));
    if (challengeDay.getTime() > today.getTime() || challengeDay.getTime() < today.getTime() - 365 * PKT_DAY_MS) {
      throw new AppException(HttpStatus.FORBIDDEN, 'CHALLENGE_NOT_OPEN');
    }
    if (!(await this.subscriptions.hasTrackAccess(auth.id, challenge.trackId))) {
      throw new AppException(HttpStatus.FORBIDDEN, 'SUBSCRIPTION_REQUIRED');
    }
    const visibleTests = testCasesOf(challenge.testCases);
    const hiddenTests = testCasesOf(challenge.hiddenTests);
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
      try {
        passedTests = (await runJavaScriptHiddenTests(input.code, allTests)).filter(Boolean).length;
      } catch {
        passedTests = 0;
      }
    }
    const passed = passedTests === total;
    const existing = await this.prisma.challengeSubmission.findUnique({ where: { challengeId_userId: { challengeId, userId: auth.id } } });
    const firstSolve = passed && !existing?.solvedAt;
    const effectivePassed = Boolean(existing?.solvedAt) || passed;
    const effectivePassedTests = existing?.solvedAt
      ? Math.max(existing.passedTests, passedTests)
      : passedTests;
    await this.prisma.challengeSubmission.upsert({
      where: { challengeId_userId: { challengeId, userId: auth.id } },
      create: {
        challengeId, userId: auth.id, language: input.language, code: input.code,
        passed: effectivePassed, passedTests: effectivePassedTests, totalTests: total, attempts: 1, solvedAt: passed ? new Date() : null,
      },
      update: {
        language: input.language, code: input.code, passed: effectivePassed,
        passedTests: effectivePassedTests,
        totalTests: existing?.solvedAt ? existing.totalTests : total,
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
