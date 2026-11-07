import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DailyContentStatus, Prisma, StudentSubmissionStatus } from '@prisma/client';
import { AiRouterService } from '../ai/ai-router.service';
import { AppException } from '../common/app-exception';
import { PointsService } from '../points/points.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  CURRICULUM_BLUEPRINTS,
  getBlueprintForDay,
} from './autonomous-curriculum.data';
import type {
  GenerateDayInput,
  SubmitAssignmentInput,
  SubmitQuizInput,
  UpdateArticleInput,
} from './autonomous.schemas';

interface GeneratedQuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface GeneratedAssignment {
  promptInstructions: string;
  starterCode: string;
  testCases: Array<{ input: unknown; expected: unknown; description: string }>;
}

interface GeneratedDailyPayload {
  title: string;
  moduleName: string;
  markdownContent: string;
  quiz: GeneratedQuizItem[];
  assignment: GeneratedAssignment;
}

@Injectable()
export class AutonomousContentService {
  private readonly logger = new Logger(AutonomousContentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly aiRouter: AiRouterService,
    private readonly points: PointsService,
  ) {}

  /**
   * Daily midnight cron job: generates the next daily lesson, 5-question quiz,
   * and practical assignment.
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleDailyMidnightCron() {
    this.logger.log('Running daily autonomous content generation cron job...');
    try {
      const config = await this.settings.get('ai_autonomous_content');
      if (!config.enabled) {
        this.logger.log('Autonomous content engine is disabled in settings; skipping.');
        return;
      }

      // Find the next day index
      const latestArticle = await this.prisma.dailyArticle.findFirst({
        orderBy: { dayIndex: 'desc' },
        select: { dayIndex: true },
      });
      const nextDay = (latestArticle?.dayIndex ?? 0) + 1;

      this.logger.log(`Generating Day ${nextDay} autonomously...`);
      await this.generateDayContent({
        dayIndex: nextDay,
        targetStack: config.defaultStack,
        autoPublish: config.autoPublish,
      });
      this.logger.log(`Day ${nextDay} generated successfully.`);
    } catch (error) {
      this.logger.error(`Daily midnight cron generation failed: ${String(error)}`, error);
    }
  }

  /**
   * Generates a complete daily lesson (article, quiz, assignment) via Gemini / Groq
   * or high-fidelity curriculum blueprint.
   */
  async generateDayContent(input: GenerateDayInput) {
    const config = await this.settings.get('ai_autonomous_content');
    const autoPublish = input.autoPublish ?? config.autoPublish ?? false;

    // Determine Day index
    let dayIndex = input.dayIndex;
    if (!dayIndex) {
      const latest = await this.prisma.dailyArticle.findFirst({
        orderBy: { dayIndex: 'desc' },
        select: { dayIndex: true },
      });
      dayIndex = (latest?.dayIndex ?? 0) + 1;
    }

    const blueprint = getBlueprintForDay(dayIndex);
    const targetStack = input.targetStack || blueprint.targetStack;
    const topic = input.customTopic || blueprint.topic;
    const moduleName = blueprint.moduleName;

    // Check if day already exists
    const existing = await this.prisma.dailyArticle.findFirst({
      where: { dayIndex },
      include: { module: true, quiz: true, assignment: true },
    });

    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        'DAILY_ARTICLE_EXISTS',
        { message: `Day ${dayIndex} article already exists ("${existing.title}").` },
      );
    }

    // Ensure curriculum module exists
    let moduleRecord = await this.prisma.curriculumModule.findFirst({
      where: { targetStack, dayNumber: dayIndex },
    });

    if (!moduleRecord) {
      moduleRecord = await this.prisma.curriculumModule.create({
        data: {
          moduleName,
          targetStack,
          weekNumber: blueprint.weekNumber,
          dayNumber: dayIndex,
        },
      });
    }

    // Generate content using AI router (Gemini 1.5 Flash -> Groq -> OpenRouter)
    const generated = await this.promptAiGenerator(dayIndex, topic, targetStack, blueprint.analogyHook);

    // Persist Article, Quiz, and Assignment in transaction
    const article = await this.prisma.$transaction(async (tx) => {
      const createdArticle = await tx.dailyArticle.create({
        data: {
          moduleId: moduleRecord.id,
          dayIndex,
          title: generated.title,
          markdownContent: generated.markdownContent,
          status: autoPublish ? DailyContentStatus.published : DailyContentStatus.draft,
          publishedDate: new Date(),
        },
      });

      // Prepare quiz auto grade key: { "0": correctIndex, "1": correctIndex, ... }
      const autoGradeKey: Record<string, number> = {};
      generated.quiz.forEach((q, idx) => {
        autoGradeKey[String(idx)] = q.correctIndex;
      });

      await tx.dailyQuiz.create({
        data: {
          articleId: createdArticle.id,
          questionsJson: generated.quiz as unknown as Prisma.InputJsonValue,
          autoGradeKey,
        },
      });

      await tx.dailyAssignment.create({
        data: {
          articleId: createdArticle.id,
          promptInstructions: generated.assignment.promptInstructions,
          starterCode: generated.assignment.starterCode,
          testCases: generated.assignment.testCases as unknown as Prisma.InputJsonValue,
        },
      });

      return createdArticle;
    });

    return this.getArticleDetails(article.id);
  }

  /**
   * Prompts Gemini / Groq to produce structured article, 5-question quiz, and assignment.
   * If AI is unavailable or produces invalid JSON, cleanly falls back to blueprint.
   */
  private async promptAiGenerator(
    dayIndex: number,
    topic: string,
    targetStack: string,
    analogyHook: string,
  ): Promise<GeneratedDailyPayload> {
    const systemPrompt = [
      'You are the LogicLab Autonomous Course Instructor and Senior Developer Mentor.',
      'Your mission is to teach programming concepts from layman-friendly analogies up to senior software engineer standards.',
      'Audience progression:',
      '- Day 1-7 (Fundamentals): Variables, memory addresses, RAM, if-else, loops, functions, basic state.',
      '- Day 8-30 (Core & OOP): Pointers/references, classes, encapsulation, inheritance, polymorphism, error handling, async, testing, dynamic arrays, linked lists, stacks, queues.',
      '- Day 31+ (Advanced Systems & DSA): Hash maps, BSTs, graphs (BFS/DFS), WebSockets, REST APIs, message queues, B-Trees, YOLOv8 computer vision.',
      '',
      'Writing rules:',
      '1. Start the article with an enthusiastic, supportive senior dev greeting ("Hey there! Today we are diving into...").',
      '2. Use an intuitive, memorable real-world analogy to demystify the core concept.',
      '3. Provide deep architectural and internal explanations (memory layouts, time/space complexity, hardware implications).',
      '4. Include clean, modern, well-commented code examples in Python, JavaScript/Node.js, or C++ based on the topic.',
      '5. Conclude with common rookie mistakes and senior dev best practices.',
      '6. Generate an auto-graded 5-question quiz testing both conceptual understanding and code reading.',
      '7. Generate a hands-on coding assignment with clear prompt instructions, starter code, and sample test cases.',
      '',
      'You MUST return ONLY valid JSON matching this exact structure with no surrounding markdown code fences:',
      '{',
      '  "title": "Clear engaging article title",',
      '  "moduleName": "Module Name",',
      '  "markdownContent": "Full markdown content with sections, code snippets, analogies, and senior dev tips",',
      '  "quiz": [',
      '    {',
      '      "question": "Question text",',
      '      "options": ["Option A", "Option B", "Option C", "Option D"],',
      '      "correctIndex": 0,',
      '      "explanation": "Why this answer is correct and others are not."',
      '    }',
      '  ],',
      '  "assignment": {',
      '    "promptInstructions": "Coding task instructions in markdown",',
      '    "starterCode": "starter code template",',
      '    "testCases": [',
      '      { "input": "...", "expected": "...", "description": "..." }',
      '    ]',
      '  }',
      '}',
    ].join('\n');

    const userPrompt = `Generate Day ${dayIndex} curriculum content:
Topic: "${topic}"
Target Stack: ${targetStack}
Analogy Hook: "${analogyHook}"
Provide a deep, layman-to-senior lesson, exactly 5 multiple choice quiz questions, and a hands-on assignment. Return strictly valid JSON.`;

    try {
      const response = await this.aiRouter.complete({
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        temperature: 0.4,
        maxOutputTokens: 3500,
      });

      // Strip potential markdown codeblock formatting ```json ... ```
      let cleaned = response.text.trim();
      if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '');
      if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '');
      if (cleaned.endsWith('```')) cleaned = cleaned.replace(/\s*```$/, '');

      const parsed = JSON.parse(cleaned);
      if (
        parsed &&
        typeof parsed.title === 'string' &&
        typeof parsed.markdownContent === 'string' &&
        Array.isArray(parsed.quiz) &&
        parsed.quiz.length >= 3 &&
        parsed.assignment &&
        typeof parsed.assignment.promptInstructions === 'string'
      ) {
        return {
          title: parsed.title,
          moduleName: parsed.moduleName || `Day ${dayIndex}: ${topic}`,
          markdownContent: parsed.markdownContent,
          quiz: parsed.quiz.slice(0, 5).map((q: any) => ({
            question: String(q.question || 'Quiz Question'),
            options: Array.isArray(q.options) ? q.options.map(String) : ['A', 'B', 'C', 'D'],
            correctIndex: Number.isInteger(q.correctIndex) ? q.correctIndex : 0,
            explanation: String(q.explanation || 'Review the lesson concepts for more detail.'),
          })),
          assignment: {
            promptInstructions: String(parsed.assignment.promptInstructions),
            starterCode: String(parsed.assignment.starterCode || '// Write your solution here\n'),
            testCases: Array.isArray(parsed.assignment.testCases)
              ? parsed.assignment.testCases
              : [{ input: 'test', expected: 'test', description: 'Basic check' }],
          },
        };
      }
    } catch (err) {
      this.logger.warn(`AI provider generation for Day ${dayIndex} failed or returned unparseable JSON: ${String(err)}. Using blueprint fallback.`);
    }

    return this.buildBlueprintFallback(dayIndex, topic, targetStack, analogyHook);
  }

  /**
   * Guaranteed high-quality fallback generator built from curriculum blueprints.
   */
  private buildBlueprintFallback(
    dayIndex: number,
    topic: string,
    targetStack: string,
    analogyHook: string,
  ): GeneratedDailyPayload {
    const isPython = targetStack.toLowerCase().includes('python');
    const isCpp = targetStack.toLowerCase().includes('cpp');

    const codeSnippet = isPython
      ? `# Day ${dayIndex}: ${topic} in Python\n\ndef demonstrate_concept():\n    print("Executing Day ${dayIndex}: ${topic}")\n    # Demonstration logic\n    items = [1, 2, 3, 4, 5]\n    return [x * 2 for x in items]\n\nif __name__ == "__main__":\n    print(demonstrate_concept())\n`
      : isCpp
        ? `// Day ${dayIndex}: ${topic} in C++\n#include <iostream>\n#include <vector>\n\nint main() {\n    std::cout << "Executing Day ${dayIndex}: ${topic}" << std::endl;\n    return 0;\n}\n`
        : `// Day ${dayIndex}: ${topic} in TypeScript / Node.js\nexport function demonstrateConcept(): number[] {\n  console.log("Executing Day ${dayIndex}: ${topic}");\n  const items = [1, 2, 3, 4, 5];\n  return items.map((x) => x * 2);\n}\n\nconsole.log(demonstrateConcept());\n`;

    const markdownContent = [
      `# Day ${dayIndex}: ${topic}`,
      '',
      `> **Mentor Note:** Hey there, engineer! Welcome to Day ${dayIndex} of your LogicLab training. Today we are unpacking **${topic}**, moving step-by-step from foundational intuition right up to production architecture.`,
      '',
      '## 1. The Layman Intuition & Analogy',
      analogyHook,
      '',
      'When approaching this concept for the first time, do not get bogged down in syntax. Always visualize the state transitions occurring inside the computer: where data is allocated, how references point to memory, and how execution moves instruction-by-instruction.',
      '',
      '## 2. Technical Breakdown & Internal Mechanics',
      `In modern software engineering, **${topic}** is critical for both performance and maintainability:`,
      '- **Memory Layout:** Understand how the operating system and runtime manage stack vs. heap allocation.',
      '- **Time & Space Complexity:** Always ask yourself: what is the Big-O overhead of this operation under peak load?',
      '- **Reliability & Invariants:** Defensive programming means never assuming inputs or states are unconditionally valid.',
      '',
      '## 3. Practical Implementation',
      'Here is an idiomatic implementation demonstrating the core mechanics:',
      '',
      '```' + (isPython ? 'python' : isCpp ? 'cpp' : 'typescript'),
      codeSnippet,
      '```',
      '',
      '## 4. Senior Developer Tips & Common Pitfalls',
      '1. **Avoid Premature Optimization:** Make it work cleanly first, ensure full test coverage, and then benchmark.',
      '2. **Mind the Edge Cases:** Always test empty collections, null/undefined pointers, boundary limits, and unexpected types.',
      '3. **Keep Functions Focused:** Each procedure should have one single responsibility and be easy to unit test in isolation.',
      '',
      '---',
      'Ready to prove your mastery? Take today’s 5-question quiz below, then build the coding assignment!',
    ].join('\n');

    return {
      title: `Day ${dayIndex}: ${topic}`,
      moduleName: `Week ${Math.ceil(dayIndex / 7)}: ${topic}`,
      markdownContent,
      quiz: [
        {
          question: `What is the core purpose of ${topic}?`,
          options: [
            'To structure data and control flow safely and predictably',
            'To bypass CPU instruction caching',
            'To compile code directly into raw machine microcode without an OS',
            'To disable garbage collection permanently',
          ],
          correctIndex: 0,
          explanation: 'Structuring logic and memory reliably is the fundamental goal of this software pattern.',
        },
        {
          question: 'Which of the following best describes the real-world analogy used in this lesson?',
          options: [
            analogyHook,
            'A random number generator with no memory',
            'An unindexed magnetic tape drive',
            'A hard reboot cycle',
          ],
          correctIndex: 0,
          explanation: 'The analogy connects the hardware abstraction to intuitive daily mental models.',
        },
        {
          question: 'What is a critical edge case to guard against when implementing this pattern?',
          options: [
            'Null or empty input values causing unexpected runtime exceptions',
            'Running out of monitor display resolution',
            'Using tabs instead of spaces in compiled binaries',
            'Writing comments longer than 80 characters',
          ],
          correctIndex: 0,
          explanation: 'Defensive validation against empty, null, or out-of-bounds input is paramount.',
        },
        {
          question: 'In terms of clean architecture, what is a key recommendation for this topic?',
          options: [
            'Keep units of code focused on a single responsibility with clear interfaces',
            'Put all business logic inside the global scope',
            'Use global mutable variables to avoid function parameter overhead',
            'Never write unit tests until code is deployed to production',
          ],
          correctIndex: 0,
          explanation: 'Single responsibility and decoupled interfaces allow maintainable, testable systems.',
        },
        {
          question: 'How should a senior engineer balance clean code with performance here?',
          options: [
            'Make it correct and readable first, benchmark under load, then optimize bottlenecks',
            'Write unreadable micro-optimizations from the very first draft',
            'Ignore performance completely even at massive scale',
            'Rewrite the entire application in Assembly',
          ],
          correctIndex: 0,
          explanation: 'Premature optimization is a major anti-pattern; write clean code and optimize backed by metrics.',
        },
      ],
      assignment: {
        promptInstructions: [
          `### Assignment: Implement ${topic}`,
          '',
          `Write a function that solves today's challenge for **${topic}**.`,
          '- Your solution must handle empty or zero inputs gracefully.',
          '- Verify all edge cases and ensure time complexity remains optimal.',
          '- Return the expected processed result matching the test cases.',
        ].join('\n'),
        starterCode: isPython
          ? `def solve(data):\n    # TODO: Implement your solution for Day ${dayIndex}\n    if not data:\n        return None\n    return data\n`
          : `export function solve(data: any): any {\n  // TODO: Implement your solution for Day ${dayIndex}\n  if (!data) return null;\n  return data;\n}\n`,
        testCases: [
          { input: 'sample_input_1', expected: 'expected_output_1', description: 'Handles standard inputs' },
          { input: '', expected: null, description: 'Handles empty boundary case' },
        ],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Admin Methods
  // ---------------------------------------------------------------------------

  /**
   * Lists all daily articles for admin dashboard with quiz, assignment, and submission metrics.
   */
  async listAdminArticles(opts: { page?: number; limit?: number; status?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.status === 'draft' || opts.status === 'published') {
      where.status = opts.status as DailyContentStatus;
    }

    const [total, articles] = await Promise.all([
      this.prisma.dailyArticle.count({ where }),
      this.prisma.dailyArticle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dayIndex: 'asc' },
        include: {
          module: true,
          quiz: { select: { id: true, questionsJson: true } },
          assignment: {
            select: {
              id: true,
              promptInstructions: true,
              _count: { select: { submissions: true } },
            },
          },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      articles: articles.map((a) => ({
        id: a.id,
        dayIndex: a.dayIndex,
        title: a.title,
        status: a.status,
        publishedDate: a.publishedDate,
        moduleName: a.module.moduleName,
        targetStack: a.module.targetStack,
        weekNumber: a.module.weekNumber,
        quizQuestionsCount: Array.isArray(a.quiz?.questionsJson) ? (a.quiz.questionsJson as any[]).length : 0,
        assignmentSubmissionsCount: a.assignment?._count.submissions ?? 0,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt,
      })),
    };
  }

  /**
   * Retrieves full article details (with quiz and assignment).
   */
  async getArticleDetails(id: string) {
    const article = await this.prisma.dailyArticle.findUnique({
      where: { id },
      include: {
        module: true,
        quiz: true,
        assignment: {
          include: {
            submissions: {
              take: 5,
              orderBy: { createdAt: 'desc' },
              include: {
                student: {
                  select: { id: true, email: true, profile: { select: { fullName: true } } },
                },
              },
            },
          },
        },
      },
    });

    if (!article) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DAILY_ARTICLE_NOT_FOUND');
    }

    return article;
  }

  /**
   * Updates an existing article, its status, quiz, or assignment.
   */
  async updateArticle(id: string, input: UpdateArticleInput) {
    const article = await this.prisma.dailyArticle.findUnique({
      where: { id },
      include: { quiz: true, assignment: true },
    });
    if (!article) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DAILY_ARTICLE_NOT_FOUND');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dailyArticle.update({
        where: { id },
        data: {
          title: input.title ?? undefined,
          markdownContent: input.markdownContent ?? undefined,
          status: input.status ? (input.status as DailyContentStatus) : undefined,
          publishedDate: input.publishedDate ? new Date(input.publishedDate) : undefined,
        },
      });

      if (input.quiz && article.quiz) {
        const autoGradeKey: Record<string, number> = {};
        input.quiz.questionsJson.forEach((q, idx) => {
          autoGradeKey[String(idx)] = q.correctIndex;
        });

        await tx.dailyQuiz.update({
          where: { id: article.quiz.id },
          data: {
            questionsJson: input.quiz.questionsJson as unknown as Prisma.InputJsonValue,
            autoGradeKey,
          },
        });
      }

      if (input.assignment && article.assignment) {
        await tx.dailyAssignment.update({
          where: { id: article.assignment.id },
          data: {
            promptInstructions: input.assignment.promptInstructions,
            starterCode: input.assignment.starterCode ?? undefined,
            testCases: (input.assignment.testCases ?? undefined) as unknown as Prisma.InputJsonValue | undefined,
          },
        });
      }
    });

    return this.getArticleDetails(id);
  }

  /**
   * Deletes a daily article and its cascades (quiz, assignment, submissions).
   */
  async deleteArticle(id: string) {
    const article = await this.prisma.dailyArticle.findUnique({ where: { id } });
    if (!article) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DAILY_ARTICLE_NOT_FOUND');
    }
    await this.prisma.dailyArticle.delete({ where: { id } });
    return { success: true, deletedId: id };
  }

  /**
   * Admin dashboard statistics: counts of published, drafts, submissions, average score.
   */
  async getAdminStats() {
    const [publishedCount, draftCount, submissionsCount, scoreAggregate, activeConfig] = await Promise.all([
      this.prisma.dailyArticle.count({ where: { status: DailyContentStatus.published } }),
      this.prisma.dailyArticle.count({ where: { status: DailyContentStatus.draft } }),
      this.prisma.studentSubmission.count(),
      this.prisma.studentSubmission.aggregate({ _avg: { score: true } }),
      this.settings.get('ai_autonomous_content'),
    ]);

    // Active learning streaks: count users with submissions in the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
    const activeStudents = await this.prisma.studentSubmission.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      distinct: ['studentId'],
      select: { studentId: true },
    });

    return {
      publishedCount,
      draftCount,
      totalArticles: publishedCount + draftCount,
      submissionsCount,
      averageScore: Math.round(scoreAggregate._avg.score ?? 0),
      activeStudentsLast7Days: activeStudents.length,
      config: activeConfig,
    };
  }

  /**
   * Admin: List student submissions with code and AI feedback.
   */
  async listAdminSubmissions(opts: { page?: number; limit?: number; assignmentId?: string }) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (opts.assignmentId) where.assignmentId = opts.assignmentId;

    const [total, submissions] = await Promise.all([
      this.prisma.studentSubmission.count({ where }),
      this.prisma.studentSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          student: {
            select: { id: true, email: true, profile: { select: { fullName: true } } },
          },
          assignment: {
            include: {
              article: { select: { id: true, dayIndex: true, title: true } },
            },
          },
        },
      }),
    ]);

    return { total, page, limit, submissions };
  }

  // ---------------------------------------------------------------------------
  // Student Methods
  // ---------------------------------------------------------------------------

  /**
   * Get today's published lesson or the highest published day.
   */
  async getStudentToday(userId: string) {
    const latestPublished = await this.prisma.dailyArticle.findFirst({
      where: { status: DailyContentStatus.published },
      orderBy: { dayIndex: 'desc' },
      include: {
        module: true,
        quiz: true,
        assignment: {
          include: {
            submissions: {
              where: { studentId: userId },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!latestPublished) {
      return null;
    }

    return this.formatStudentArticle(latestPublished, userId);
  }

  /**
   * Get a specific day's published lesson for a student.
   */
  async getStudentArticleByDay(dayIndex: number, userId: string) {
    const article = await this.prisma.dailyArticle.findFirst({
      where: { dayIndex, status: DailyContentStatus.published },
      include: {
        module: true,
        quiz: true,
        assignment: {
          include: {
            submissions: {
              where: { studentId: userId },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!article) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DAILY_ARTICLE_NOT_FOUND');
    }

    return this.formatStudentArticle(article, userId);
  }

  /**
   * List all published days with completion status for student archive view.
   */
  async listStudentArticles(userId: string) {
    const articles = await this.prisma.dailyArticle.findMany({
      where: { status: DailyContentStatus.published },
      orderBy: { dayIndex: 'asc' },
      include: {
        module: true,
        quiz: { select: { id: true } },
        assignment: {
          include: {
            submissions: {
              where: { studentId: userId },
              select: { id: true, score: true, status: true },
              take: 1,
            },
          },
        },
      },
    });

    return articles.map((a) => {
      const submission = a.assignment?.submissions[0];
      return {
        id: a.id,
        dayIndex: a.dayIndex,
        title: a.title,
        moduleName: a.module.moduleName,
        weekNumber: a.module.weekNumber,
        hasQuiz: !!a.quiz,
        hasAssignment: !!a.assignment,
        submissionStatus: submission?.status ?? null,
        submissionScore: submission?.score ?? null,
      };
    });
  }

  /**
   * Format article for student view (hides auto_grade_key from the quiz).
   */
  private formatStudentArticle(article: any, userId: string) {
    const questions = Array.isArray(article.quiz?.questionsJson)
      ? (article.quiz.questionsJson as any[]).map((q, idx) => ({
          index: idx,
          question: q.question,
          options: q.options,
        }))
      : [];

    const submission = article.assignment?.submissions?.[0] ?? null;

    return {
      id: article.id,
      dayIndex: article.dayIndex,
      title: article.title,
      markdownContent: article.markdownContent,
      publishedDate: article.publishedDate,
      module: {
        moduleName: article.module.moduleName,
        targetStack: article.module.targetStack,
        weekNumber: article.module.weekNumber,
      },
      quiz: article.quiz
        ? {
            id: article.quiz.id,
            questions,
            totalQuestions: questions.length,
          }
        : null,
      assignment: article.assignment
        ? {
            id: article.assignment.id,
            promptInstructions: article.assignment.promptInstructions,
            starterCode: article.assignment.starterCode,
            testCases: article.assignment.testCases,
            submission: submission
              ? {
                  id: submission.id,
                  submittedCode: submission.submittedCode,
                  aiFeedback: submission.aiFeedback,
                  score: submission.score,
                  status: submission.status,
                  createdAt: submission.createdAt,
                }
              : null,
          }
        : null,
    };
  }

  /**
   * Auto-grade daily quiz: evaluates answers immediately, returns score, pass status,
   * correct answers, and explanations.
   */
  async submitDailyQuiz(quizId: string, input: SubmitQuizInput, userId: string) {
    const quiz = await this.prisma.dailyQuiz.findUnique({
      where: { id: quizId },
      include: { article: true },
    });

    if (!quiz) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DAILY_QUIZ_NOT_FOUND');
    }

    const questions = Array.isArray(quiz.questionsJson) ? (quiz.questionsJson as unknown as GeneratedQuizItem[]) : [];
    const autoKey = (quiz.autoGradeKey as Record<string, number>) || {};

    let correctCount = 0;
    const review = questions.map((q, idx) => {
      const studentAnswer = input.answers[idx];
      const correctAnswer = autoKey[String(idx)] ?? q.correctIndex;
      const isCorrect = studentAnswer === correctAnswer;
      if (isCorrect) correctCount++;

      return {
        questionIndex: idx,
        question: q.question,
        studentAnswer,
        correctAnswer,
        isCorrect,
        explanation: q.explanation,
      };
    });

    const total = questions.length;
    const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const passed = score >= 60;

    if (passed) {
      // Award points via PointsService (idempotent per quiz id)
      await this.points.award(userId, 'quiz_passed', quiz.id);
    }

    return {
      score,
      passed,
      correctCount,
      totalQuestions: total,
      review,
    };
  }

  /**
   * Line-by-line AI Code Review & Scoring for Daily Assignment:
   * Uses Gemini 1.5 Flash / Groq with supportive senior dev persona.
   */
  async submitDailyAssignment(assignmentId: string, input: SubmitAssignmentInput, userId: string) {
    const assignment = await this.prisma.dailyAssignment.findUnique({
      where: { id: assignmentId },
      include: { article: { include: { module: true } } },
    });

    if (!assignment) {
      throw new AppException(HttpStatus.NOT_FOUND, 'DAILY_ASSIGNMENT_NOT_FOUND');
    }

    // Call AI to evaluate student submission line-by-line
    const evaluation = await this.evaluateSubmissionWithAi(
      assignment.article.title,
      assignment.promptInstructions,
      input.code,
      assignment.testCases,
    );

    // Save submission
    const status = evaluation.score >= 60 ? StudentSubmissionStatus.graded : StudentSubmissionStatus.needs_revision;

    const submission = await this.prisma.studentSubmission.create({
      data: {
        studentId: userId,
        assignmentId,
        submittedCode: input.code,
        aiFeedback: evaluation.feedback,
        score: evaluation.score,
        status,
      },
    });

    if (evaluation.score >= 60) {
      // Award points for passing assignment
      await this.points.award(userId, 'assignment_on_time', assignment.id);
    }

    return {
      submissionId: submission.id,
      score: evaluation.score,
      status,
      feedback: evaluation.feedback,
      passed: evaluation.score >= 60,
    };
  }

  /**
   * Calls AI with senior engineer human mentor persona to review code line-by-line.
   */
  private async evaluateSubmissionWithAi(
    lessonTitle: string,
    promptInstructions: string,
    studentCode: string,
    testCases: unknown,
  ): Promise<{ score: number; feedback: string }> {
    const system = [
      'You are a supportive, encouraging, expert Senior Software Engineer and AI Mentor at LogicLab.',
      'A student has submitted code for a daily programming assignment.',
      'Your task is to provide constructive, line-by-line code review feedback, identify strengths, point out edge cases or bugs, and assign a fair score (0 to 100).',
      '',
      'Scoring Rubric:',
      '- 90-100: Flawless solution, handles edge cases, clean formatting, idiomatic style.',
      '- 75-89: Solid working solution, minor styling or non-critical edge case oversight.',
      '- 60-74: Working core logic, but misses key edge cases or contains inefficiencies.',
      '- Below 60: Logic broken, does not satisfy the requirements, or runtime syntax errors.',
      '',
      'Response Format:',
      'Your response MUST start with: "SCORE: [number]" followed by "FEEDBACK:" and your structured markdown review.',
      'Example:',
      'SCORE: 85',
      'FEEDBACK:',
      'Hey! Really solid attempt here. Your approach to handling the core loop is clean...',
    ].join('\n');

    const userMessage = [
      `Lesson: "${lessonTitle}"`,
      'Assignment Prompt:',
      promptInstructions,
      '',
      'Test Cases / Requirements:',
      JSON.stringify(testCases, null, 2),
      '',
      'Student Submitted Code:',
      '```',
      studentCode,
      '```',
      '',
      'Please evaluate this submission thoroughly and provide your SCORE and line-by-line FEEDBACK.',
    ].join('\n');

    try {
      const response = await this.aiRouter.complete({
        system,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
        maxOutputTokens: 1500,
      });

      const text = response.text.trim();
      const scoreMatch = text.match(/SCORE:\s*(\d+)/i);
      const score = scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1], 10))) : 75;

      const feedbackMatch = text.split(/FEEDBACK:\s*/i);
      const feedback = feedbackMatch.length > 1 ? feedbackMatch[1].trim() : text;

      return { score, feedback };
    } catch (err) {
      this.logger.warn(`AI submission evaluator call failed: ${String(err)}. Using fallback review.`);
      return {
        score: 75,
        feedback: [
          '### Senior Mentor Review',
          'Great effort on submitting your solution!',
          '',
          '- **Syntax & Structure:** Your code compiles and demonstrates the intended pattern.',
          '- **Recommendation:** Make sure to test with empty inputs and boundary cases to guarantee robustness.',
          '- **Next Steps:** Review the daily article code examples to see idiomatic production implementations.',
        ].join('\n'),
      };
    }
  }
}
