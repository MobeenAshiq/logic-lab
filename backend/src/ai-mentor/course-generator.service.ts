import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { LessonType, QuestionType } from '@prisma/client';
import { z } from 'zod';
import { AgentRunnerService } from '../ai/agent-runner.service';
import type { AuthUser } from '../auth/auth.types';
import { AppException } from '../common/app-exception';
import { uniqueSlug } from '../common/slug';
import { nextPosition } from '../content/ordering';
import type { TiptapNode } from '../content/tiptap';
import { PrismaService } from '../prisma/prisma.service';

const text = (max: number) => z.string().trim().min(1).max(max);

const outlineSchema = z.object({
  track: z.object({ title: text(120), description: text(1000) }),
  course: z.object({
    title: text(150),
    shortDescription: text(300),
    description: text(3000),
    level: z.enum(['beginner', 'intermediate', 'advanced']),
  }),
  modules: z
    .array(
      z.object({
        title: text(150),
        description: text(1000),
        lectures: z.array(text(150)).min(2).max(4),
      }),
    )
    .min(3)
    .max(8),
});
type Outline = z.infer<typeof outlineSchema>;

const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: text(200) }),
  z.object({ type: z.literal('paragraph'), text: text(3000) }),
  z.object({
    type: z.literal('list'),
    items: z.array(text(500)).min(1).max(12),
  }),
  z.object({
    type: z.literal('code'),
    language: z.string().max(20).default(''),
    code: text(4000),
  }),
]);
export type Block = z.infer<typeof blockSchema>;

const lectureSchema = z.object({
  blocks: z.array(blockSchema).min(3).max(40),
  task: text(1500),
});

const assessmentSchema = z.object({
  quiz: z
    .array(
      z.object({
        prompt: text(1000),
        options: z.array(text(300)).length(4),
        correctIndex: z.number().int().min(0).max(3),
        explanation: text(1000),
        tags: z.array(text(30)).max(3).default([]),
      }),
    )
    .min(3)
    .max(6),
  assignment: z.object({
    title: text(150),
    instructions: text(6000),
    rubric: z
      .array(
        z.object({
          title: text(120),
          description: z.string().max(500).default(''),
          maxPoints: z.number().int().min(1).max(50),
        }),
      )
      .min(1)
      .max(5),
  }),
});

/** Lecture blocks → the article editor's document format (Tiptap JSON). */
export function toTiptap(blocks: Block[], task: string): TiptapNode {
  const para = (t: string): TiptapNode => ({
    type: 'paragraph',
    content: [{ type: 'text', text: t }],
  });
  const content: TiptapNode[] = blocks.map((b) => {
    switch (b.type) {
      case 'heading':
        return {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: b.text }],
        };
      case 'paragraph':
        return para(b.text);
      case 'list':
        return {
          type: 'bulletList',
          content: b.items.map((i) => ({
            type: 'listItem',
            content: [para(i)],
          })),
        };
      case 'code':
        return {
          type: 'codeBlock',
          attrs: { language: b.language || null },
          content: [{ type: 'text', text: b.code }],
        };
    }
  });
  content.push(
    {
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text: 'Try it yourself' }],
    },
    para(task),
  );
  return { type: 'doc', content };
}

export interface GenerationJob {
  status: 'running' | 'done' | 'failed';
  modulesDone: number;
  modulesTotal: number;
  /** Lectures or quizzes the AI could not write; left as empty drafts to fill by hand. */
  problems: string[];
}

/**
 * Course agent: one paragraph → a draft track, course, modules (basic →
 * advanced), lectures with examples and a task, a quiz and a code assignment
 * per module, and a final project. Nothing is published; a mentor or admin
 * reviews it in the course editor first.
 */
@Injectable()
export class CourseGeneratorService {
  private readonly logger = new Logger(CourseGeneratorService.name);
  // shortcut: progress lives in memory, so a restart mid-run loses the status (the course itself is saved); move to a table if runs get long.
  private readonly jobs = new Map<string, GenerationJob>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentRunnerService,
  ) {}

  status(courseId: string): GenerationJob | { status: 'unknown' } {
    return this.jobs.get(courseId) ?? { status: 'unknown' };
  }

  async start(auth: AuthUser, input: { prompt: string; trackId?: string }) {
    // One at a time: each run makes ~30 AI calls on a small server and free AI limits.
    if ([...this.jobs.values()].some((j) => j.status === 'running')) {
      throw new AppException(HttpStatus.CONFLICT, 'COURSE_GENERATION_RUNNING');
    }
    if (
      input.trackId &&
      !(await this.prisma.track.findUnique({ where: { id: input.trackId } }))
    ) {
      throw new AppException(HttpStatus.NOT_FOUND, 'TRACK_NOT_FOUND');
    }

    const outline = await this.agents.run({
      agent: 'course',
      userId: auth.id,
      schema: outlineSchema,
      maxOutputTokens: 2000,
      system: [
        'You design programming courses for LogicLab, an online academy for students in Pakistan.',
        'From the request, plan ONE course that goes from basics to advanced in 3-8 modules.',
        'Each module has 2-4 lecture titles in teaching order. The last module must be a final project module.',
        'Return JSON only: {"track":{"title","description"},"course":{"title","shortDescription","description","level":"beginner"|"intermediate"|"advanced"},"modules":[{"title","description","lectures":["..."]}]}',
      ].join('\n'),
      prompt: input.prompt,
    });

    const course = await this.createCourse(input.trackId, outline);
    const job: GenerationJob = {
      status: 'running',
      modulesDone: 0,
      modulesTotal: outline.modules.length,
      problems: [],
    };
    this.jobs.set(course.id, job);
    void this.buildModules(auth, course.id, outline, job);
    return { courseId: course.id, ...job };
  }

  private async createCourse(trackId: string | undefined, outline: Outline) {
    const track =
      trackId ??
      (
        await this.prisma.track.create({
          data: {
            title: outline.track.title,
            description: outline.track.description,
            slug: await uniqueSlug(
              outline.track.title,
              async (s) =>
                !!(await this.prisma.track.findUnique({ where: { slug: s } })),
            ),
            position: nextPosition(
              await this.prisma.track.aggregate({ _max: { position: true } }),
            ),
          },
        })
      ).id;
    return this.prisma.course.create({
      data: {
        trackId: track,
        title: outline.course.title,
        shortDescription: outline.course.shortDescription,
        description: outline.course.description,
        level: outline.course.level,
        slug: await uniqueSlug(
          outline.course.title,
          async (s) =>
            !!(await this.prisma.course.findUnique({ where: { slug: s } })),
        ),
        position: nextPosition(
          await this.prisma.course.aggregate({
            where: { trackId: track },
            _max: { position: true },
          }),
        ),
      },
    });
  }

  private async buildModules(
    auth: AuthUser,
    courseId: string,
    outline: Outline,
    job: GenerationJob,
  ) {
    try {
      let previous: string | null = null;
      for (const [i, m] of outline.modules.entries()) {
        const isProject = i === outline.modules.length - 1;
        const mod: { id: string } = await this.prisma.module.create({
          data: {
            courseId,
            title: m.title,
            description: m.description,
            position: i + 1,
            // Each module stays locked until the previous module's quiz is passed.
            unlockAfterModuleId: previous,
          },
        });
        previous = mod.id;

        let position = 1;
        for (const title of m.lectures) {
          const content = await this.lecture(
            auth,
            outline,
            m.title,
            title,
          ).catch((err) => {
            job.problems.push(`Lecture "${title}": ${String(err)}`);
            return null;
          });
          await this.prisma.lesson.create({
            data: {
              moduleId: mod.id,
              title,
              type: LessonType.article,
              position: position++,
              content: content ?? undefined,
            },
          });
        }

        try {
          await this.assessment(
            auth,
            courseId,
            outline,
            m,
            mod.id,
            position,
            isProject,
          );
        } catch (err) {
          job.problems.push(`Quiz/assignment for "${m.title}": ${String(err)}`);
        }
        job.modulesDone++;
      }
      job.status = 'done';
    } catch (err) {
      this.logger.error(
        `course generation failed for ${courseId}: ${String(err)}`,
      );
      job.status = 'failed';
      job.problems.push(String(err));
    }
  }

  private async lecture(
    auth: AuthUser,
    outline: Outline,
    moduleTitle: string,
    title: string,
  ) {
    const lecture = await this.agents.run({
      agent: 'lecture',
      userId: auth.id,
      schema: lectureSchema,
      maxOutputTokens: 3000,
      temperature: 0.4,
      system: [
        'You write one lecture of a LogicLab programming course for beginners to advanced learners.',
        'Explain simply, then go deeper. Use 1-3 small, correct code examples. Short paragraphs.',
        'End with a small practice task the student can do in 10-20 minutes (do not give its solution).',
        'Return JSON only: {"blocks":[{"type":"heading","text"}|{"type":"paragraph","text"}|{"type":"list","items":[]}|{"type":"code","language","code"}],"task":"..."}',
      ].join('\n'),
      prompt: `Course: ${outline.course.title} (${outline.course.level})\nModule: ${moduleTitle}\nLecture: ${title}`,
    });
    return toTiptap(lecture.blocks, lecture.task) as object;
  }

  private async assessment(
    auth: AuthUser,
    courseId: string,
    outline: Outline,
    m: Outline['modules'][number],
    moduleId: string,
    position: number,
    isProject: boolean,
  ) {
    const a = await this.agents.run({
      agent: 'examiner',
      userId: auth.id,
      schema: assessmentSchema,
      maxOutputTokens: 2500,
      system: [
        'You write the assessment for one module of a LogicLab programming course.',
        'Quiz: 5 multiple-choice questions with exactly 4 options, one correct, testing understanding (not trivia). Tag each with 1-3 short topic words.',
        isProject
          ? 'Assignment: a final PROJECT that combines the whole course into one small program.'
          : 'Assignment: one practical coding exercise for this module.',
        'The student answers with code only, typed by hand. Give a rubric whose points add up to the total.',
        'Return JSON only: {"quiz":[{"prompt","options":["","","",""],"correctIndex":0,"explanation","tags":[]}],"assignment":{"title","instructions","rubric":[{"title","description","maxPoints"}]}}',
      ].join('\n'),
      prompt: `Course: ${outline.course.title}\nModule: ${m.title}\nLectures: ${m.lectures.join('; ')}`,
    });

    const letters = ['a', 'b', 'c', 'd'];
    await this.prisma.$transaction(async (tx) => {
      const quizLesson = await tx.lesson.create({
        data: {
          moduleId,
          title: `${m.title}: Quiz`,
          type: LessonType.quiz,
          position,
        },
      });
      const quiz = await tx.quiz.create({
        data: { lessonId: quizLesson.id, passMark: 60, maxAttempts: 3 },
      });
      for (const [i, q] of a.quiz.entries()) {
        const question = await tx.question.create({
          data: {
            courseId,
            type: QuestionType.mcq,
            prompt: q.prompt,
            options: q.options.map((t, j) => ({ id: letters[j], text: t })),
            correctOptionIds: [letters[q.correctIndex]],
            explanation: q.explanation,
            tags: q.tags,
            createdBy: auth.id,
          },
        });
        await tx.quizQuestion.create({
          data: { quizId: quiz.id, questionId: question.id, position: i + 1 },
        });
      }

      const assignmentLesson = await tx.lesson.create({
        data: {
          moduleId,
          title: a.assignment.title,
          type: LessonType.assignment,
          position: position + 1,
        },
      });
      const criteria = a.assignment.rubric.map((c, i) => ({
        id: `c${i + 1}`,
        ...c,
      }));
      const assignment = await tx.assignment.create({
        data: {
          lessonId: assignmentLesson.id,
          instructions: a.assignment.instructions,
          maxMarks: criteria.reduce((s, c) => s + c.maxPoints, 0),
          autoGrade: true,
        },
      });
      await tx.rubric.create({
        data: { assignmentId: assignment.id, criteria },
      });
    });
  }
}
