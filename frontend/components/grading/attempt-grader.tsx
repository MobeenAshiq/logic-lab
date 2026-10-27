"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Circle, MonitorX, Timer, XCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { IntegrityFlagsList } from "@/components/assessments/integrity-flags";
import { TypingReplay } from "@/components/assessments/typing-replay";
import { ErrorState, Field, LoadingRows, Spinner, StatusBadge } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AttemptForGrader } from "@/types/api";

const a = t.grading.attempt;
const c = t.grading.common;
const v = t.grading.validation;

export const attemptKey = (id: string) => ["teach", "attempt", id] as const;

type Question = AttemptForGrader["questions"][number];

function scoreSchema(max: number) {
  return z
    .string()
    .trim()
    .min(1, v.required)
    .regex(/^\d+$/, v.whole)
    .transform(Number)
    .refine((n) => n <= max, v.tooHigh(max));
}

export function AttemptGrader({ attemptId, backHref }: { attemptId: string; backHref: string }) {
  const attempt = useQuery({
    queryKey: attemptKey(attemptId),
    queryFn: () => api<AttemptForGrader>(`/teach/attempts/${attemptId}`),
  });
  if (attempt.isError)
    return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />;
  if (!attempt.data) return <LoadingRows rows={6} />;
  return <Grader key={attempt.data.id} attempt={attempt.data} backHref={backHref} />;
}

function Grader({ attempt, backHref }: { attempt: AttemptForGrader; backHref: string }) {
  const queryClient = useQueryClient();
  const written = attempt.questions.filter((q) => q.type !== "mcq");
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(written.map((q) => [q.id, q.manualScore?.toString() ?? ""])),
  );
  const [feedback, setFeedback] = useState(attempt.feedback);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: (body: { questionScores: Record<string, number>; feedback: string }) =>
      api<AttemptForGrader>(`/teach/attempts/${attempt.id}/grade`, { method: "POST", body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(attemptKey(attempt.id), updated);
      void queryClient.invalidateQueries({ queryKey: ["teach", "grading"] });
      toast.success(a.saved);
    },
    onError: toastError,
  });

  const submit = () => {
    const next: Record<string, string> = {};
    const questionScores: Record<string, number> = {};
    for (const q of written) {
      const parsed = scoreSchema(q.points).safeParse(scores[q.id] ?? "");
      if (parsed.success) questionScores[q.id] = parsed.data;
      else next[q.id] = parsed.error.issues[0].message;
    }
    setErrors(next);
    if (Object.keys(next).length === 0) save.mutate({ questionScores, feedback: feedback.trim() });
  };

  const graded = attempt.status === "graded";

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
        <Link href={backHref}>
          <ArrowLeft /> {c.back}
        </Link>
      </Button>

      <div className="mb-6">
        <p className="text-muted-foreground text-sm">
          {attempt.course.title} › {attempt.lesson.title}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {attempt.student.fullName || attempt.student.email}
        </h1>
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{attempt.student.email}</span>
          <span>·</span>
          <span>{c.started(formatDateTime(attempt.startedAt))}</span>
          {attempt.submittedAt && (
            <>
              <span>·</span>
              <span>{c.submitted(formatDateTime(attempt.submittedAt))}</span>
            </>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {attempt.autoSubmitted && (
            <StatusBadge tone="warning">
              <Timer className="size-3" /> {a.autoSubmitted}
            </StatusBadge>
          )}
          {attempt.tabSwitches > 0 && (
            <StatusBadge tone="warning">
              <MonitorX className="size-3" /> {a.tabSwitches(attempt.tabSwitches)}
            </StatusBadge>
          )}
          <StatusBadge>{a.autoScore(attempt.autoScore)}</StatusBadge>
          <StatusBadge>{a.passMark(attempt.passMark)}</StatusBadge>
        </div>
      </div>

      <div className="space-y-4">
        {attempt.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            q={q}
            index={i + 1}
            score={scores[q.id] ?? ""}
            error={errors[q.id]}
            onScore={(value) => setScores((prev) => ({ ...prev, [q.id]: value }))}
          />
        ))}
      </div>

      <Card className="mt-6">
        <CardContent className="grid gap-4">
          {graded && attempt.score !== null && attempt.percent !== null && (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-lg font-semibold tabular-nums">
                {a.result(attempt.score, attempt.maxScore, attempt.percent)}
              </p>
              <StatusBadge tone={attempt.passed ? "success" : "danger"}>
                {attempt.passed ? a.passed : a.notPassed}
              </StatusBadge>
            </div>
          )}
          {!graded && <p className="text-muted-foreground text-sm">{a.pending}</p>}
          <Field label={c.feedback} htmlFor="feedback">
            <Textarea
              id="feedback"
              rows={4}
              maxLength={10_000}
              value={feedback}
              placeholder={c.feedbackPlaceholder}
              onChange={(e) => setFeedback(e.target.value)}
            />
          </Field>
          <div>
            <Button onClick={submit} disabled={save.isPending || attempt.status === "in_progress"}>
              {save.isPending && <Spinner />}
              {a.save}
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function QuestionCard({
  q,
  index,
  score,
  error,
  onScore,
}: {
  q: Question;
  index: number;
  score: string;
  error?: string;
  onScore: (value: string) => void;
}) {
  const chosen = q.answer?.optionIds ?? [];
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-sm">{a.question(index)}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{a.types[q.type]}</Badge>
            {q.type === "mcq" ? (
              <StatusBadge tone={q.autoCorrect ? "success" : "danger"}>
                {a.earned(q.autoCorrect ? q.points : 0, q.points)}
              </StatusBadge>
            ) : (
              <StatusBadge>{a.points(q.points)}</StatusBadge>
            )}
          </div>
        </div>
        <p className="mt-2 text-sm whitespace-pre-line">{q.prompt}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {q.type === "mcq" ? (
          <ul className="space-y-2">
            {q.options.map((o) => {
              const picked = chosen.includes(o.id);
              const correct = q.correctOptionIds.includes(o.id);
              return (
                <li
                  key={o.id}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
                    correct && "border-success/40 bg-success/5",
                    picked && !correct && "border-destructive/40 bg-destructive/5",
                  )}
                >
                  {correct ? (
                    <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                  ) : picked ? (
                    <XCircle className="text-destructive mt-0.5 size-4 shrink-0" />
                  ) : (
                    <Circle className="text-muted-foreground/50 mt-0.5 size-4 shrink-0" />
                  )}
                  <span className="flex-1">{o.text}</span>
                  {picked && (
                    <span className="text-muted-foreground text-xs">{a.studentChoice}</span>
                  )}
                </li>
              );
            })}
            {chosen.length === 0 && <li className="text-muted-foreground text-sm">{a.noAnswer}</li>}
          </ul>
        ) : (
          <>
            {q.answer?.text ? (
              <pre
                className={cn(
                  "bg-muted/40 overflow-x-auto rounded-lg border p-3 text-sm whitespace-pre-wrap",
                  q.type === "code" ? "font-mono text-[13px]" : "font-sans",
                )}
              >
                {q.answer.text}
              </pre>
            ) : (
              <p className="text-muted-foreground text-sm">{a.noAnswer}</p>
            )}
            {q.sampleAnswer && (
              <details className="rounded-lg border px-3 py-2">
                <summary className="cursor-pointer text-sm font-medium">{a.reference}</summary>
                <pre
                  className={cn(
                    "text-muted-foreground mt-2 text-sm whitespace-pre-wrap",
                    q.type === "code" ? "font-mono text-[13px]" : "font-sans",
                  )}
                >
                  {q.sampleAnswer}
                </pre>
              </details>
            )}
            <div className="rounded-lg border p-3">
              <p className="mb-2 text-sm font-medium">{c.integrity}</p>
              <IntegrityFlagsList flags={q.flags} />
            </div>
            <details className="rounded-lg border px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium">{c.showReplay}</summary>
              <div className="mt-3">
                <TypingReplay events={q.typingEvents} code={q.type === "code"} />
              </div>
            </details>
            <Field label={`${a.score} (0–${q.points})`} htmlFor={`score-${q.id}`} error={error}>
              <Input
                id={`score-${q.id}`}
                inputMode="numeric"
                className="max-w-32"
                value={score}
                aria-invalid={Boolean(error)}
                onChange={(e) => onScore(e.target.value)}
              />
            </Field>
          </>
        )}
      </CardContent>
    </Card>
  );
}
