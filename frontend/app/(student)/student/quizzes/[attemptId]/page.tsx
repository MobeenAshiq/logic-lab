"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock, EyeOff, XCircle } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { quizInfoKey } from "@/components/assessments/quiz-panel";
import { WriteOnlyEditor } from "@/components/assessments/write-only-editor";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState, LoadingRows, StatusBadge } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api, ApiError } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { formatClock, learningKeys } from "@/lib/learning";
import { cn } from "@/lib/utils";
import type { AttemptView, SavedAnswer, TypingEvent } from "@/types/api";

const tq = t.assessments.quiz;
type Question = AttemptView["questions"][number];

const attemptKey = (id: string) => ["learn", "attempt", id] as const;

export default function AttemptPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const attempt = useQuery({
    queryKey: attemptKey(attemptId),
    queryFn: async () => {
      const data = await api<AttemptView>(`/learn/attempts/${attemptId}`);
      // Server clock minus ours, so the countdown follows the server deadline.
      return { ...data, clockOffset: Date.parse(data.serverNow) - Date.now() };
    },
    staleTime: 0,
    refetchOnWindowFocus: true,
  });

  if (attempt.isError)
    return <ErrorState error={attempt.error} onRetry={() => attempt.refetch()} />;
  if (!attempt.data) return <LoadingRows rows={5} />;
  const a = attempt.data;
  return a.status === "in_progress" ? (
    <TakeQuiz key={a.id} attempt={a} clockOffset={a.clockOffset} />
  ) : (
    <Result attempt={a} />
  );
}

function useCountdown(deadline: string, offset: number) {
  const remaining = () => Math.max(0, Date.parse(deadline) - (Date.now() + offset));
  const [ms, setMs] = useState(remaining);
  useEffect(() => {
    const timer = setInterval(() => setMs(remaining()), 500);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadline, offset]);
  return ms;
}

function TakeQuiz({ attempt, clockOffset }: { attempt: AttemptView; clockOffset: number }) {
  const queryClient = useQueryClient();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, SavedAnswer>>(() =>
    Object.fromEntries(attempt.questions.flatMap((q) => (q.answer ? [[q.id, q.answer]] : []))),
  );
  const [leftTab, setLeftTab] = useState(false);
  const pendingText = useRef<Record<string, number>>({});
  const remaining = useCountdown(attempt.deadlineAt, clockOffset);
  const finished = useRef(false);

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: attemptKey(attempt.id) });
    await queryClient.invalidateQueries({ queryKey: quizInfoKey(attempt.lessonId) });
    await queryClient.invalidateQueries({ queryKey: learningKeys.lesson(attempt.lessonId) });
  }, [attempt.id, attempt.lessonId, queryClient]);

  /** Time is up or already closed on the server: show the result. */
  const onClosed = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.code === "ATTEMPT_CLOSED") {
        if (!finished.current) toast.message(tq.timeUp);
        finished.current = true;
        void refresh();
        return true;
      }
      return false;
    },
    [refresh],
  );

  const save = useCallback(
    async (questionId: string, value: SavedAnswer) => {
      try {
        await api(`/learn/attempts/${attempt.id}/answers/${questionId}`, {
          method: "PUT",
          body: value,
        });
      } catch (err) {
        if (!onClosed(err)) toastError(err);
      }
    },
    [attempt.id, onClosed],
  );

  const sendTyping = useCallback(
    (questionId: string) => async (events: TypingEvent[]) => {
      try {
        await api(`/learn/attempts/${attempt.id}/typing`, {
          method: "POST",
          body: { questionId, events },
        });
      } catch (err) {
        onClosed(err);
      }
    },
    [attempt.id, onClosed],
  );

  const submit = useMutation({
    mutationFn: async () => {
      // Make sure the latest written answers are stored first.
      await Promise.all(
        Object.keys(pendingText.current).map((id) => save(id, answers[id] ?? { text: "" })),
      );
      return api<AttemptView>(`/learn/attempts/${attempt.id}/submit`, { method: "POST" });
    },
    onSuccess: () => {
      finished.current = true;
      void refresh();
    },
    onError: (err) => !onClosed(err) && toastError(err),
  });

  // Auto-submit when the server deadline passes (the server enforces it anyway).
  useEffect(() => {
    if (remaining <= 0 && !finished.current && !submit.isPending) {
      finished.current = true;
      toast.message(tq.timeUp);
      submit.mutate();
    }
  }, [remaining, submit]);

  // Leaving the tab is recorded on the attempt.
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden" && !finished.current) {
        setLeftTab(true);
        void api(`/learn/attempts/${attempt.id}/tab-switch`, { method: "POST" }).catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [attempt.id]);

  // Written answers: save ~1.5 s after the last keystroke.
  const setText = (questionId: string, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { text } }));
    window.clearTimeout(pendingText.current[questionId]);
    pendingText.current[questionId] = window.setTimeout(() => {
      delete pendingText.current[questionId];
      void save(questionId, { text });
    }, 1500);
  };

  const setOptions = (q: Question, optionIds: string[]) => {
    setAnswers((prev) => ({ ...prev, [q.id]: { optionIds } }));
    void save(q.id, { optionIds });
  };

  const isAnswered = (q: Question) => {
    const a = answers[q.id];
    return q.type === "mcq" ? (a?.optionIds?.length ?? 0) > 0 : Boolean(a?.text?.trim());
  };
  const unanswered = attempt.questions.filter((q) => !isAnswered(q)).length;
  const q = attempt.questions[index];
  const urgent = remaining < 60_000;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="bg-background/95 sticky top-14 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        <span className="text-sm font-medium">
          {tq.question(index + 1, attempt.questions.length)}
        </span>
        <span
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-semibold tabular-nums",
            urgent ? "bg-destructive/10 text-destructive" : "bg-muted",
          )}
          role="timer"
          aria-label={tq.timeLeft}
        >
          <Clock className="size-4" /> {formatClock(remaining / 1000)}
        </span>
      </div>

      {leftTab && (
        <Alert>
          <EyeOff />
          <AlertDescription>{tq.tabWarning}</AlertDescription>
        </Alert>
      )}

      <nav className="flex flex-wrap gap-1.5" aria-label={tq.questions(attempt.questions.length)}>
        {attempt.questions.map((item, i) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? "step" : undefined}
            className={cn(
              "size-8 rounded-lg border text-xs font-medium transition-colors",
              i === index && "border-primary ring-primary ring-1",
              isAnswered(item) ? "bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <Card>
        <CardHeader>
          <CardTitle className="text-base leading-7 font-medium whitespace-pre-line">
            {q.prompt}
          </CardTitle>
          <p className="text-muted-foreground text-xs">
            {tq.points(q.points)}
            {q.type === "mcq" && ` · ${q.allowMultiple ? tq.chooseMany : tq.chooseOne}`}
          </p>
        </CardHeader>
        <CardContent>
          {q.type === "mcq" ? (
            q.allowMultiple ? (
              <div className="grid gap-2">
                {q.options.map((o) => {
                  const selected = answers[q.id]?.optionIds ?? [];
                  const checked = selected.includes(o.id);
                  return (
                    <Label
                      key={o.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal",
                        checked && "border-primary bg-primary/5",
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setOptions(
                            q,
                            v ? [...selected, o.id] : selected.filter((x) => x !== o.id),
                          )
                        }
                      />
                      {o.text}
                    </Label>
                  );
                })}
              </div>
            ) : (
              <RadioGroup
                value={answers[q.id]?.optionIds?.[0] ?? ""}
                onValueChange={(v) => setOptions(q, [v])}
                className="grid gap-2"
              >
                {q.options.map((o) => (
                  <Label
                    key={o.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal",
                      answers[q.id]?.optionIds?.[0] === o.id && "border-primary bg-primary/5",
                    )}
                  >
                    <RadioGroupItem value={o.id} />
                    {o.text}
                  </Label>
                ))}
              </RadioGroup>
            )
          ) : (
            <WriteOnlyEditor
              key={q.id}
              value={answers[q.id]?.text ?? ""}
              onChange={(text) => setText(q.id, text)}
              onEvents={sendTyping(q.id)}
              code={q.type === "code"}
              rows={q.type === "code" ? 14 : 8}
              aria-label={q.prompt}
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          <ArrowLeft /> {tq.previous}
        </Button>
        <div className="flex gap-2">
          {index < attempt.questions.length - 1 && (
            <Button variant="outline" onClick={() => setIndex((i) => i + 1)}>
              {tq.next} <ArrowRight />
            </Button>
          )}
          <ConfirmDialog
            title={tq.submit}
            description={`${tq.submitConfirm}${unanswered ? ` ${tq.unanswered(unanswered)}` : ""}`}
            confirmLabel={tq.submit}
            onConfirm={() => submit.mutateAsync()}
          >
            <Button disabled={submit.isPending}>{tq.submit}</Button>
          </ConfirmDialog>
        </div>
      </div>
    </div>
  );
}

function Result({ attempt }: { attempt: AttemptView }) {
  const r = attempt.result!;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/student/lessons/${attempt.lessonId}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {tq.backToLesson}
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>{tq.resultTitle}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {r.pendingReview ? (
            <>
              <StatusBadge tone="warning">{tq.pendingReview}</StatusBadge>
              <p className="text-muted-foreground text-sm">
                {tq.autoScore(r.autoScore, r.maxScore)}
              </p>
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-3xl font-semibold">{r.percent}%</span>
              <span className="text-muted-foreground">{tq.score(r.score ?? 0, r.maxScore)}</span>
              <StatusBadge tone={r.passed ? "success" : "danger"}>
                {r.passed ? tq.passed : tq.notPassed}
              </StatusBadge>
            </div>
          )}
          {attempt.autoSubmitted && (
            <p className="text-muted-foreground text-xs">{tq.autoSubmitted}</p>
          )}
          {r.feedback && (
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
              <p className="mb-1 font-medium">{tq.feedback}</p>
              <p className="whitespace-pre-line">{r.feedback}</p>
            </div>
          )}
          {!attempt.reveal && <p className="text-muted-foreground text-sm">{tq.answersLater}</p>}
        </CardContent>
      </Card>

      {attempt.reveal &&
        attempt.questions.map((q, i) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle className="text-sm font-medium whitespace-pre-line">
                {i + 1}. {q.prompt}
              </CardTitle>
              {q.earned !== undefined && (
                <p className="text-muted-foreground text-xs">
                  {q.earned === null ? tq.pendingReview : tq.earned(q.earned, q.points)}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {q.type === "mcq" ? (
                <ul className="grid gap-1.5">
                  {q.options.map((o) => {
                    const chosen = q.answer?.optionIds?.includes(o.id) ?? false;
                    const correct = q.correctOptionIds?.includes(o.id) ?? false;
                    return (
                      <li
                        key={o.id}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-3 py-2",
                          correct && "border-success/50 bg-success/5",
                          chosen && !correct && "border-destructive/50 bg-destructive/5",
                        )}
                      >
                        {correct ? (
                          <CheckCircle2 className="text-success size-4" />
                        ) : chosen ? (
                          <XCircle className="text-destructive size-4" />
                        ) : (
                          <span className="size-4" />
                        )}
                        {o.text}
                        {chosen && (
                          <span className="text-muted-foreground ml-auto text-xs">
                            {tq.yourAnswer}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <pre
                  className={cn(
                    "bg-muted/40 overflow-auto rounded-lg border p-3 whitespace-pre-wrap",
                    q.type === "code" ? "font-mono text-[13px]" : "font-sans",
                  )}
                >
                  {q.answer?.text || "—"}
                </pre>
              )}
              {q.explanation && (
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">{tq.explanation}: </span>
                  {q.explanation}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
