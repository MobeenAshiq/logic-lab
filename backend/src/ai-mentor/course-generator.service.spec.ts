import { aiMarks } from '../assessments/assignments.service';
import { tiptapDocSchema } from '../content/tiptap';
import { CourseGeneratorService, toTiptap } from './course-generator.service';

describe('lecture blocks → article document', () => {
  it('produces a document the lesson editor accepts, ending with the task', () => {
    const doc = toTiptap(
      [
        { type: 'heading', text: 'Loops' },
        { type: 'paragraph', text: 'A loop repeats work.' },
        { type: 'list', items: ['for', 'while'] },
        {
          type: 'code',
          language: 'python',
          code: 'for i in range(3):\n    print(i)',
        },
      ],
      'Print 1 to 10.',
    );
    expect(tiptapDocSchema.safeParse(doc).success).toBe(true);
    expect(doc.content?.at(-1)?.content?.[0].text).toBe('Print 1 to 10.');
  });
});

describe('AI marks', () => {
  const rubric = [
    { id: 'c1', title: 'Works', description: '', maxPoints: 6 },
    { id: 'c2', title: 'Clean', description: '', maxPoints: 4 },
  ];

  it('clamps each criterion and treats missing ones as 0', () => {
    expect(aiMarks(rubric, 10, { c1: 99, c3: 5 })).toEqual({
      grade: 6,
      rubricScores: { c1: 6, c2: 0 },
    });
    expect(aiMarks(rubric, 10, { c1: -3, c2: 2.6 })).toEqual({
      grade: 3,
      rubricScores: { c1: 0, c2: 3 },
    });
  });

  it('uses one overall score when there is no rubric', () => {
    expect(aiMarks([], 50, { overall: 70 })).toEqual({
      grade: 50,
      rubricScores: {},
    });
  });
});

describe('course generator', () => {
  it('builds locked modules in order and keeps going when one lecture fails', async () => {
    let n = 0;
    const created: Record<string, any[]> = {};
    const model = (name: string) => ({
      create: jest.fn(async ({ data }: { data: any }) => {
        (created[name] ??= []).push(data);
        return { id: `${name}-${++n}` };
      }),
      findUnique: jest.fn(async () => null),
      aggregate: jest.fn(async () => ({ _max: { position: null } })),
    });
    const prisma: any = {};
    for (const m of [
      'track',
      'course',
      'module',
      'lesson',
      'quiz',
      'question',
      'quizQuestion',
      'assignment',
      'rubric',
    ]) {
      prisma[m] = model(m);
    }
    prisma.$transaction = (fn: (tx: unknown) => unknown) => fn(prisma);

    const outline = {
      track: { title: 'Python', description: 'd' },
      course: {
        title: 'Python Basics',
        shortDescription: 's',
        description: 'd',
        level: 'beginner',
      },
      modules: [
        {
          title: 'Variables',
          description: 'd',
          lectures: ['What is a variable', 'Types'],
        },
        { title: 'Project', description: 'd', lectures: ['Plan', 'Build'] },
      ],
    };
    const lecture = {
      blocks: [
        { type: 'paragraph', text: 'x' },
        { type: 'paragraph', text: 'y' },
        { type: 'paragraph', text: 'z' },
      ],
      task: 'Do it',
    };
    const assessment = {
      quiz: [0, 1, 2].map((i) => ({
        prompt: `Q${i}`,
        options: ['a', 'b', 'c', 'd'],
        correctIndex: 1,
        explanation: 'e',
        tags: ['vars'],
      })),
      assignment: {
        title: 'Task',
        instructions: 'Write code',
        rubric: [
          { title: 'Works', description: '', maxPoints: 7 },
          { title: 'Style', description: '', maxPoints: 3 },
        ],
      },
    };
    const agents = {
      run: jest.fn(
        async ({ agent, prompt }: { agent: string; prompt: string }) => {
          if (agent === 'course') return outline;
          if (agent === 'lecture') {
            if (prompt.includes('Types')) throw new Error('AI down');
            return lecture;
          }
          return assessment;
        },
      ),
    };

    const gen = new CourseGeneratorService(prisma, agents as never);
    const { courseId } = await gen.start({ id: 'admin-1' } as never, {
      prompt: 'Teach Python from zero',
    });
    for (let i = 0; i < 50 && gen.status(courseId).status === 'running'; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }

    const job = gen.status(courseId) as {
      status: string;
      modulesDone: number;
      problems: string[];
    };
    expect(job.status).toBe('done');
    expect(job.modulesDone).toBe(2);
    expect(job.problems).toHaveLength(1);
    // Module 2 unlocks only after module 1 (its quiz) is done.
    expect(created.module.map((m) => m.unlockAfterModuleId)).toEqual([
      null,
      'module-3',
    ]);
    // The failed lecture still exists as an empty draft to write by hand.
    expect(
      created.lesson.find((l) => l.title === 'Types').content,
    ).toBeUndefined();
    expect(created.question[0]).toMatchObject({
      correctOptionIds: ['b'],
      tags: ['vars'],
    });
    expect(created.assignment[0]).toMatchObject({
      maxMarks: 10,
      autoGrade: true,
    });
    // Nothing is published until a person reviews it.
    expect(created.course[0].isPublished).toBeUndefined();
  });
});
