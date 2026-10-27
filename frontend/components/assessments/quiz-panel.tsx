"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, ListChecks, ShieldAlert, Target } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState, LoadingRows, Spinner, StatusBadge } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { AttemptView, QuizInfo } from "@/types/api";

const tq = t.assessments.quiz;

export const quizInfoKey = (lessonId: string) => ["learn", "quiz", lessonId] as const;

/** Quiz rules, past attempts and the start/resume button (on the lesson page). */
export function QuizPanel({ lessonId, isStaff }: { lessonId: string; isStaff: boolean }) {
  const router = useRouter();
  const info = useQuery({
    queryKey: quizInfoKey(lessonId),
    queryFn: () => api<QuizInfo>(`/learn/lessons/${lessonId}/quiz`),
    staleTime: 0,
  });
  const start = useMutation({
    mutationFn: () =>
      api<AttemptView>(`/learn/lessons/${lessonId}/quiz/attempts`, { method: "POST" }),
    onSuccess: (attempt) => router.push(`/student/quizzes/${attempt.id}`),
    onError: toastError,
  });

  if (info.isLoading) return <LoadingRows rows={3} />;
  if (!info.data) return null;
  const q = info.data;
  if (!q.ready) return <EmptyState icon={ListChecks} title={tq.notReady} />;

  const left = Math.max(0, q.maxAttempts - q.attempts.length);
  const window = tq.window(
    q.startsAt ? formatDateTime(q.startsAt) : null,
    q.endsAt ? formatDateTime(q.endsAt) : null,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {tq.rules}
            {q.passed && (
              <StatusBadge tone="success">
                <CheckCircle2 className="size-3" /> {tq.passedBadge}
              </StatusBadge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-3 text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <Clock className="text-primary size-4" />
              {tq.timeLimit(Math.round(q.timeLimitSeconds / 60))}
            </li>
            <li className="flex items-center gap-2">
              <ListChecks className="text-primary size-4" />
              {tq.questions(q.questionCount)} · {tq.points(q.totalPoints)}
            </li>
            <li className="flex items-center gap-2">
              <Target className="text-primary size-4" />
              {tq.passMark(q.passMark)}
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle2 className="text-primary size-4" />
              {tq.attemptsLeft(left, q.maxAttempts)}
            </li>
          </ul>
          {window && <p className="text-muted-foreground text-sm">{window}</p>}
          <Alert>
            <ShieldAlert />
            <AlertDescription>{tq.fairPlay}</AlertDescription>
          </Alert>
          {isStaff ? (
            <p className="text-muted-foreground text-sm">{t.learning.lesson.preview}</p>
          ) : q.activeAttemptId ? (
            <Button asChild>
              <Link href={`/student/quizzes/${q.activeAttemptId}`}>{tq.resume}</Link>
            </Button>
          ) : q.canStart ? (
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              {start.isPending && <Spinner />}
              {tq.start}
            </Button>
          ) : (
            q.blockedReason && (
              <p className="text-muted-foreground text-sm">{tq.blocked[q.blockedReason]}</p>
            )
          )}
        </CardContent>
      </Card>

      {q.attempts.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium">{tq.yourAttempts}</h3>
          <ul className="divide-y rounded-xl border">
            {q.attempts.map((a, i) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="font-medium">{tq.attempt(i + 1)}</span>
                <span className="text-muted-foreground">{formatDateTime(a.startedAt)}</span>
                {a.status === "in_progress" && (
                  <StatusBadge tone="primary">{tq.inProgress}</StatusBadge>
                )}
                {a.status === "submitted" && (
                  <StatusBadge tone="warning">{tq.pendingReview}</StatusBadge>
                )}
                {a.status === "graded" && (
                  <StatusBadge tone={a.passed ? "success" : "danger"}>
                    {a.percent}% · {a.passed ? tq.passed : tq.notPassed}
                  </StatusBadge>
                )}
                <Button size="sm" variant="ghost" className="ml-auto" asChild>
                  <Link href={`/student/quizzes/${a.id}`}>{tq.view}</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
