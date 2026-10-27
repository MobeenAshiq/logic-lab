"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { IntegrityFlagsList } from "@/components/assessments/integrity-flags";
import { TypingReplay } from "@/components/assessments/typing-replay";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState, Field, LoadingRows, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { IntegrityFlags, SubmissionForGrader } from "@/types/api";

const s = t.grading.submission;
const c = t.grading.common;
const v = t.grading.validation;

export const submissionKey = (id: string) => ["teach", "submission", id] as const;

/** "" | "3" → number | null, with a max check. */
function scoreSchema(max: number) {
  return z
    .string()
    .trim()
    .min(1, v.required)
    .regex(/^\d+$/, v.whole)
    .transform(Number)
    .refine((n) => n <= max, v.tooHigh(max));
}

function asFlags(f: SubmissionForGrader["flags"]): Partial<IntegrityFlags> | null {
  return "burst" in f ? f : null;
}

export function SubmissionGrader({
  submissionId,
  backHref,
}: {
  submissionId: string;
  backHref: string;
}) {
  const sub = useQuery({
    queryKey: submissionKey(submissionId),
    queryFn: () => api<SubmissionForGrader>(`/teach/submissions/${submissionId}`),
  });
  if (sub.isError) return <ErrorState error={sub.error} onRetry={() => sub.refetch()} />;
  if (!sub.data) return <LoadingRows rows={6} />;
  return <Grader key={sub.data.id} sub={sub.data} backHref={backHref} />;
}

function Grader({ sub, backHref }: { sub: SubmissionForGrader; backHref: string }) {
  const queryClient = useQueryClient();
  const hasRubric = sub.rubric.length > 0;
  const returned = sub.status === "returned";
  const [scores, setScores] = useState<Record<string, string>>(() =>
    Object.fromEntries(sub.rubric.map((r) => [r.id, sub.rubricScores[r.id]?.toString() ?? ""])),
  );
  const [grade, setGrade] = useState(sub.grade?.toString() ?? "");
  const [feedback, setFeedback] = useState(sub.feedback);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const total = hasRubric
    ? sub.rubric.reduce((sum, r) => sum + (Number(scores[r.id]) || 0), 0)
    : Number(grade) || 0;

  const save = useMutation({
    mutationFn: (body: {
      rubricScores: Record<string, number>;
      grade?: number;
      feedback: string;
    }) => api<SubmissionForGrader>(`/teach/submissions/${sub.id}/grade`, { method: "POST", body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(submissionKey(sub.id), updated);
      void queryClient.invalidateQueries({ queryKey: ["teach", "grading"] });
      toast.success(s.returned);
    },
    onError: toastError,
  });

  /** Validates the form; returns the request body or null (and shows field errors). */
  const validate = () => {
    const next: Record<string, string> = {};
    const rubricScores: Record<string, number> = {};
    let single: number | undefined;
    if (hasRubric) {
      for (const r of sub.rubric) {
        const parsed = scoreSchema(r.maxPoints).safeParse(scores[r.id] ?? "");
        if (parsed.success) rubricScores[r.id] = parsed.data;
        else next[r.id] = parsed.error.issues[0].message;
      }
    } else {
      const parsed = scoreSchema(sub.maxMarks).safeParse(grade);
      if (parsed.success) single = parsed.data;
      else next.grade = parsed.error.issues[0].message;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return null;
    return { rubricScores, grade: single, feedback: feedback.trim() };
  };

  const flags = asFlags(sub.flags);

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" asChild>
        <Link href={backHref}>
          <ArrowLeft /> {c.back}
        </Link>
      </Button>

      <div className="mb-6">
        <p className="text-muted-foreground text-sm">
          {sub.course.title} › {sub.lesson.title}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {sub.student.fullName || sub.student.email}
        </h1>
        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{sub.student.email}</span>
          <span>·</span>
          <span>
            {sub.submittedAt ? c.submitted(formatDateTime(sub.submittedAt)) : c.notSubmitted}
          </span>
          {sub.late && (
            <StatusBadge tone="danger">
              <Clock className="size-3" /> {c.late}
            </StatusBadge>
          )}
          {returned && (
            <StatusBadge tone="success">
              <CheckCircle2 className="size-3" /> {c.graded}
            </StatusBadge>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {sub.instructions && (
            <details className="group rounded-xl border px-4 py-3">
              <summary className="cursor-pointer text-sm font-medium">{s.instructions}</summary>
              <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">
                {sub.instructions}
              </p>
            </details>
          )}

          <Card>
            <CardHeader>
              <CardTitle>{s.answer}</CardTitle>
            </CardHeader>
            <CardContent>
              {sub.content ? (
                <p className="text-sm leading-7 break-words whitespace-pre-wrap">{sub.content}</p>
              ) : (
                <p className="text-muted-foreground text-sm">{s.emptyAnswer}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{c.integrity}</CardTitle>
            </CardHeader>
            <CardContent>
              <IntegrityFlagsList flags={flags} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{c.replay}</CardTitle>
            </CardHeader>
            <CardContent>
              <TypingReplay events={sub.typingEvents} />
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-20 lg:col-span-2">
          <CardHeader>
            <CardTitle>{hasRubric ? s.rubric : s.grade}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {hasRubric ? (
              sub.rubric.map((r) => (
                <Field
                  key={r.id}
                  label={`${r.title} (${s.outOf(r.maxPoints)})`}
                  htmlFor={`criterion-${r.id}`}
                  hint={r.description || undefined}
                  error={errors[r.id]}
                >
                  <Input
                    id={`criterion-${r.id}`}
                    inputMode="numeric"
                    value={scores[r.id] ?? ""}
                    aria-invalid={Boolean(errors[r.id])}
                    onChange={(e) => setScores((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  />
                </Field>
              ))
            ) : (
              <Field
                label={`${s.grade} (${s.outOf(sub.maxMarks)})`}
                htmlFor="grade"
                error={errors.grade}
              >
                <Input
                  id="grade"
                  inputMode="numeric"
                  value={grade}
                  aria-invalid={Boolean(errors.grade)}
                  onChange={(e) => setGrade(e.target.value)}
                />
              </Field>
            )}

            <p className="text-sm font-semibold tabular-nums">{s.total(total, sub.maxMarks)}</p>

            <Field label={c.feedback} htmlFor="feedback">
              <Textarea
                id="feedback"
                rows={5}
                maxLength={10_000}
                value={feedback}
                placeholder={c.feedbackPlaceholder}
                onChange={(e) => setFeedback(e.target.value)}
              />
            </Field>

            {returned && sub.returnedAt && (
              <p className="text-muted-foreground text-xs">
                {s.returnedOn(formatDateTime(sub.returnedAt))}
              </p>
            )}

            <ConfirmDialog
              title={s.confirmTitle}
              description={s.confirmBody}
              confirmLabel={returned ? s.update : s.returnToStudent}
              onConfirm={async () => {
                const body = validate();
                if (body) await save.mutateAsync(body).catch(() => {});
              }}
            >
              <Button disabled={save.isPending || sub.status === "draft"}>
                {save.isPending && <Spinner />}
                {returned ? s.update : s.returnToStudent}
              </Button>
            </ConfirmDialog>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
