import { HttpStatus, Injectable } from '@nestjs/common';
import { Question, QuestionType } from '@prisma/client';
import { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateQuestionInput,
  ListQuestionsInput,
  mergedQuestionSchema,
  UpdateQuestionInput,
} from './assessments.schemas';
import { StaffAccessService } from './staff-access.service';

export interface McqOption {
  id: string;
  text: string;
}

export function optionsOf(q: Pick<Question, 'options'>): McqOption[] {
  return Array.isArray(q.options) ? (q.options as unknown as McqOption[]) : [];
}

/** Only MCQs keep options/correct answers; only short/code keep a sample answer. */
function normalize<T extends Partial<CreateQuestionInput>>(input: T) {
  const isMcq = input.type === QuestionType.mcq;
  return {
    ...input,
    options: isMcq ? (input.options ?? []) : [],
    correctOptionIds: isMcq ? (input.correctOptionIds ?? []) : [],
    allowMultiple: isMcq ? (input.allowMultiple ?? false) : false,
    sampleAnswer: isMcq ? '' : (input.sampleAnswer ?? ''),
    codeLanguage:
      input.type === QuestionType.code ? (input.codeLanguage ?? null) : null,
  };
}

@Injectable()
export class QuestionBankService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly staff: StaffAccessService,
  ) {}

  async list(auth: AuthUser, courseId: string, q: ListQuestionsInput) {
    await this.staff.assertCourse(auth, courseId);
    const questions = await this.prisma.question.findMany({
      where: {
        courseId,
        type: q.type,
        difficulty: q.difficulty,
        ...(q.tag && { tags: { has: q.tag } }),
        ...(q.search && {
          prompt: { contains: q.search, mode: 'insensitive' },
        }),
      },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { quizQuestions: true } } },
    });
    return questions.map(({ _count, ...question }) => ({
      ...question,
      usedInQuizzes: _count.quizQuestions,
    }));
  }

  async create(auth: AuthUser, courseId: string, input: CreateQuestionInput) {
    await this.staff.assertCourse(auth, courseId);
    const data = normalize(input);
    return this.prisma.question.create({
      data: {
        ...data,
        options: data.options,
        courseId,
        createdBy: auth.id,
      },
    });
  }

  async update(auth: AuthUser, id: string, input: UpdateQuestionInput) {
    const existing = await this.find(auth, id);
    const merged = mergedQuestionSchema.safeParse({
      type: existing.type,
      difficulty: existing.difficulty,
      tags: existing.tags,
      prompt: existing.prompt,
      options: optionsOf(existing),
      correctOptionIds: existing.correctOptionIds,
      allowMultiple: existing.allowMultiple,
      explanation: existing.explanation,
      sampleAnswer: existing.sampleAnswer,
      codeLanguage: existing.codeLanguage as 'javascript' | 'python' | null,
      points: existing.points,
      ...input,
    });
    if (!merged.success) {
      throw new AppException(HttpStatus.BAD_REQUEST, 'VALIDATION_FAILED', {
        errors: merged.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
    }
    const data = normalize(merged.data);
    return this.prisma.question.update({
      where: { id },
      data: { ...data, options: data.options },
    });
  }

  async remove(auth: AuthUser, id: string) {
    await this.find(auth, id);
    const used = await this.prisma.quizQuestion.count({
      where: { questionId: id },
    });
    if (used > 0)
      throw new AppException(HttpStatus.CONFLICT, 'QUESTION_IN_USE');
    await this.prisma.question.delete({ where: { id } });
  }

  private async find(auth: AuthUser, id: string) {
    const question = await this.prisma.question.findUnique({ where: { id } });
    if (!question)
      throw new AppException(HttpStatus.NOT_FOUND, 'BANK_QUESTION_NOT_FOUND');
    await this.staff.assertCourse(auth, question.courseId);
    return question;
  }
}
