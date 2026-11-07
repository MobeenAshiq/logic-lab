"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Code2,
  FileCode,
  GraduationCap,
  HelpCircle,
  Loader2,
  RotateCcw,
  Send,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/community/markdown";
import { ErrorState, LoadingRows } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import type { StudentArticleListItem, StudentDailyArticle } from "@/lib/ai-mentor";

interface QuizResult {
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  review: Array<{
    questionIndex: number;
    question: string;
    studentAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
    explanation: string;
  }>;
}

interface AssignmentResult {
  submissionId: string;
  score: number;
  status: "graded" | "needs_revision";
  feedback: string;
  passed: boolean;
}

export default function StudentDailyPage() {
  const queryClient = useQueryClient();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"article" | "quiz" | "assignment">("article");

  // Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);

  // Coding assignment state
  const [code, setCode] = useState<string>("");
  const [assignmentResult, setAssignmentResult] = useState<AssignmentResult | null>(null);

  // Fetch all published days list
  const listQuery = useQuery({
    queryKey: ["student", "autonomous", "articles"],
    queryFn: () => api<StudentArticleListItem[]>("/student/autonomous/articles"),
  });

  // Fetch current or selected day lesson
  const articleQuery = useQuery({
    queryKey: ["student", "autonomous", "article", selectedDay],
    queryFn: () =>
      selectedDay
        ? api<StudentDailyArticle>(`/student/autonomous/articles/day/${selectedDay}`)
        : api<StudentDailyArticle>("/student/autonomous/today"),
  });

  const article = articleQuery.data;

  // Initialize state when article changes
  useEffect(() => {
    if (article) {
      if (!selectedDay) {
        setSelectedDay(article.dayIndex);
      }
      setQuizAnswers({});
      setQuizResult(null);
      if (article.assignment) {
        setCode(article.assignment.submission?.submittedCode || article.assignment.starterCode || "");
        if (article.assignment.submission) {
          setAssignmentResult({
            submissionId: article.assignment.submission.id,
            score: article.assignment.submission.score,
            status: article.assignment.submission.status === "graded" ? "graded" : "needs_revision",
            feedback: article.assignment.submission.aiFeedback,
            passed: article.assignment.submission.score >= 60,
          });
        } else {
          setAssignmentResult(null);
        }
      }
    }
  }, [article, selectedDay]);

  // Submit Quiz Mutation
  const submitQuizMutation = useMutation({
    mutationFn: () => {
      if (!article?.quiz) throw new Error("No quiz found");
      return api<QuizResult>(`/student/autonomous/quizzes/${article.quiz.id}/submit`, {
        method: "POST",
        body: { answers: quizAnswers },
      });
    },
    onSuccess: (res) => {
      setQuizResult(res);
      if (res.passed) {
        toast.success(`Passed! You scored ${res.score}% on today's quiz.`);
      } else {
        toast.error(`You scored ${res.score}%. Review the explanations below and try again.`);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to submit quiz.";
      toast.error(msg);
    },
  });

  // Submit Assignment Mutation
  const submitAssignmentMutation = useMutation({
    mutationFn: () => {
      if (!article?.assignment) throw new Error("No assignment found");
      return api<AssignmentResult>(
        `/student/autonomous/assignments/${article.assignment.id}/submit`,
        {
          method: "POST",
          body: { code },
        },
      );
    },
    onSuccess: (res) => {
      setAssignmentResult(res);
      void queryClient.invalidateQueries({
        queryKey: ["student", "autonomous", "article", selectedDay],
      });
      if (res.passed) {
        toast.success(`Assignment Graded! Score: ${res.score}/100.`);
      } else {
        toast.warning(`Score: ${res.score}/100. Review the mentor's feedback and revise.`);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to submit code.";
      toast.error(msg);
    },
  });

  const daysList = listQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-3.5" /> Autonomous AI Curriculum
            </span>
            {article && (
              <Badge variant="outline" className="capitalize text-xs">
                {article.module.targetStack}
              </Badge>
            )}
          </div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            {article ? `Day ${article.dayIndex}: ${article.title}` : "Today's Daily Lesson"}
          </h1>
          {article && (
            <p className="text-muted-foreground mt-1 text-sm">
              {article.module.moduleName} • Week {article.module.weekNumber}
            </p>
          )}
        </div>

        {/* Day Navigator */}
        {daysList.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={selectedDay ? String(selectedDay) : undefined}
              onValueChange={(val) => {
                setSelectedDay(parseInt(val, 10));
                setActiveTab("article");
              }}
            >
              <SelectTrigger className="w-[190px] h-9 text-xs">
                <SelectValue placeholder="Select day..." />
              </SelectTrigger>
              <SelectContent>
                {daysList.map((d) => (
                  <SelectItem key={d.id} value={String(d.dayIndex)}>
                    Day {d.dayIndex} {d.submissionScore !== null ? `✓ (${d.submissionScore}%)` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {articleQuery.isLoading ? (
        <LoadingRows rows={6} />
      ) : articleQuery.isError ? (
        <ErrorState error={articleQuery.error} onRetry={() => void articleQuery.refetch()} />
      ) : !article ? (
        <Card className="text-center p-12">
          <Sparkles className="size-12 text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold">Your Mentor is Preparing the Next Mission</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
            New lessons, quizzes, and coding challenges are published daily. Check back shortly or review earlier completed lessons.
          </p>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "article" | "quiz" | "assignment")} className="space-y-4">
          <TabsList className="grid grid-cols-3 max-w-md">
            <TabsTrigger value="article" className="flex items-center gap-1.5">
              <BookOpen className="size-4" /> Lesson
            </TabsTrigger>
            <TabsTrigger value="quiz" className="flex items-center gap-1.5">
              <HelpCircle className="size-4" /> 5-Q Quiz
              {quizResult?.passed && <CheckCircle2 className="size-3 text-success ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="assignment" className="flex items-center gap-1.5">
              <Code2 className="size-4" /> Challenge
              {assignmentResult?.passed && <CheckCircle2 className="size-3 text-success ml-1" />}
            </TabsTrigger>
          </TabsList>

          {/* 1. ARTICLE TAB */}
          <TabsContent value="article" className="space-y-6">
            <Card className="p-6 md:p-8">
              <Markdown>{article.markdownContent}</Markdown>

              <div className="mt-8 pt-6 border-t flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Finished reading? Test your understanding with today&apos;s auto-graded quiz.
                </div>
                <Button onClick={() => setActiveTab("quiz")}>
                  Take Daily Quiz <ArrowRight className="ml-1.5 size-4" />
                </Button>
              </div>
            </Card>
          </TabsContent>

          {/* 2. QUIZ TAB */}
          <TabsContent value="quiz" className="space-y-6">
            {!article.quiz ? (
              <p className="text-muted-foreground text-sm">No quiz attached to this lesson.</p>
            ) : (
              <div className="space-y-6">
                {quizResult && (
                  <Card
                    className={`p-5 border ${
                      quizResult.passed
                        ? "bg-success/10 border-success/30"
                        : "bg-warning/10 border-warning/30"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {quizResult.passed ? (
                          <CheckCircle2 className="size-8 text-success" />
                        ) : (
                          <AlertCircle className="size-8 text-warning" />
                        )}
                        <div>
                          <h4 className="font-semibold text-base text-foreground">
                            {quizResult.passed
                              ? `Congratulations! Quiz Passed (${quizResult.score}%)`
                              : `Score: ${quizResult.score}% (Pass mark is 60%)`}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {quizResult.correctCount} of {quizResult.totalQuestions} questions correct.
                            {quizResult.passed && " Points have been awarded to your profile!"}
                          </p>
                        </div>
                      </div>
                      {quizResult.passed && (
                        <Button size="sm" onClick={() => setActiveTab("assignment")}>
                          Continue to Challenge <ArrowRight className="ml-1.5 size-4" />
                        </Button>
                      )}
                    </div>
                  </Card>
                )}

                <div className="space-y-4">
                  {article.quiz.questions.map((q, qIdx) => {
                    const reviewItem = quizResult?.review[qIdx];
                    return (
                      <Card key={qIdx} className="p-5">
                        <div className="flex items-start gap-2.5 mb-3">
                          <span className="flex items-center justify-center size-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0 mt-0.5">
                            {qIdx + 1}
                          </span>
                          <p className="font-medium text-sm text-foreground pt-0.5">
                            {q.question}
                          </p>
                        </div>

                        <div className="space-y-2 pl-8">
                          {q.options.map((option, optIdx) => {
                            const isSelected = quizAnswers[qIdx] === optIdx;
                            const isReviewMode = !!reviewItem;
                            const isCorrectOpt = reviewItem?.correctAnswer === optIdx;
                            const isWrongSelection = isReviewMode && isSelected && !reviewItem.isCorrect;

                            return (
                              <button
                                key={optIdx}
                                type="button"
                                disabled={submitQuizMutation.isPending}
                                onClick={() =>
                                  setQuizAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))
                                }
                                className={`w-full flex items-center justify-between text-left p-3 rounded-lg border text-xs transition-all ${
                                  isReviewMode
                                    ? isCorrectOpt
                                      ? "bg-success/15 border-success/40 text-success font-medium"
                                      : isWrongSelection
                                      ? "bg-destructive/15 border-destructive/40 text-destructive font-medium"
                                      : "bg-muted/30 border-muted opacity-60"
                                    : isSelected
                                    ? "bg-primary/10 border-primary font-medium text-primary shadow-xs"
                                    : "bg-card hover:bg-muted/40 border-border text-foreground"
                                }`}
                              >
                                <span className="flex items-center gap-2.5">
                                  <span className="font-mono text-xs uppercase opacity-70">
                                    {String.fromCharCode(65 + optIdx)}.
                                  </span>
                                  <span>{option}</span>
                                </span>
                                {isReviewMode && isCorrectOpt && (
                                  <CheckCircle2 className="size-4 text-success shrink-0" />
                                )}
                                {isReviewMode && isWrongSelection && (
                                  <XCircle className="size-4 text-destructive shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {reviewItem && reviewItem.explanation && (
                          <div className="mt-3 ml-8 p-3 rounded-md bg-muted/50 text-xs text-muted-foreground border">
                            <strong>Explanation:</strong> {reviewItem.explanation}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuizAnswers({});
                      setQuizResult(null);
                    }}
                  >
                    <RotateCcw className="mr-1.5 size-3.5" /> Reset Answers
                  </Button>
                  <Button
                    onClick={() => submitQuizMutation.mutate()}
                    disabled={
                      submitQuizMutation.isPending ||
                      Object.keys(quizAnswers).length < (article.quiz?.questions.length ?? 0)
                    }
                  >
                    {submitQuizMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" /> Auto-Grading...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 size-4" /> Submit Quiz
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* 3. ASSIGNMENT TAB */}
          <TabsContent value="assignment" className="space-y-6">
            {!article.assignment ? (
              <p className="text-muted-foreground text-sm">No assignment for this lesson.</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Left: Problem statement & Test cases */}
                <div className="space-y-4">
                  <Card className="p-6">
                    <div className="flex items-center gap-2 mb-3 text-primary font-semibold text-sm">
                      <GraduationCap className="size-4" /> Challenge Instructions
                    </div>
                    <div className="text-sm prose-lesson leading-relaxed whitespace-pre-wrap">
                      {article.assignment.promptInstructions}
                    </div>

                    <div className="mt-6 pt-4 border-t">
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                        Sample Verification Tests
                      </p>
                      <div className="space-y-2">
                        {article.assignment.testCases.map((tc, idx) => (
                          <div
                            key={idx}
                            className="p-2.5 rounded bg-muted/40 border text-xs font-mono"
                          >
                            <span className="text-primary font-semibold">{tc.description || `Test ${idx + 1}`}</span>
                            <div className="text-muted-foreground mt-0.5">
                              Input: <span className="text-foreground">{JSON.stringify(tc.input)}</span> → Expected: <span className="text-foreground">{JSON.stringify(tc.expected)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* AI Review Result Card */}
                  {assignmentResult && (
                    <Card
                      className={`p-5 border ${
                        assignmentResult.passed
                          ? "bg-success/5 border-success/30"
                          : "bg-warning/5 border-warning/30"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="size-5 text-primary" />
                          <h4 className="font-semibold text-sm">Senior AI Mentor Review</h4>
                        </div>
                        <Badge variant={assignmentResult.passed ? "default" : "secondary"}>
                          Score: {assignmentResult.score}/100
                        </Badge>
                      </div>
                      <div className="text-xs leading-relaxed whitespace-pre-wrap font-sans text-muted-foreground bg-card p-3 rounded border">
                        {assignmentResult.feedback}
                      </div>
                    </Card>
                  )}
                </div>

                {/* Right: Code Workspace */}
                <Card className="p-4 flex flex-col min-h-[500px]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                      <FileCode className="size-3.5 text-primary" /> Code Solution
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setCode(article.assignment?.starterCode || "")}
                    >
                      Reset to Starter
                    </Button>
                  </div>

                  <Textarea
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="// Write your solution here..."
                    className="flex-1 font-mono text-xs leading-relaxed resize-none bg-muted/20"
                    rows={18}
                  />

                  <div className="mt-4 pt-3 border-t flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">
                      Submitting triggers an automated line-by-line code review by your Senior AI Mentor.
                    </p>
                    <Button
                      size="sm"
                      onClick={() => submitAssignmentMutation.mutate()}
                      disabled={submitAssignmentMutation.isPending || !code.trim()}
                    >
                      {submitAssignmentMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1.5 size-4 animate-spin" /> Reviewing Code...
                        </>
                      ) : (
                        <>
                          <Send className="mr-1.5 size-4" /> Submit to Mentor
                        </>
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
