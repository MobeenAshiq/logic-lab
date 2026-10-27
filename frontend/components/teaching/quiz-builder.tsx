"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpen, Plus, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DragHandle, SortableList } from "@/components/admin/content/sortable-list";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingRows,
  Spinner,
  StatusBadge,
} from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { applyFormErrors, toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { BankQuestion, QuizBuilder as QuizBuilderData } from "@/types/api";
import { fromLocalInput, toLocalInput } from "./datetime";
import { bankKey, difficultyTone, fetchBank, QUESTION_TYPES } from "./question-bank";

const tq = t.teaching.quiz;

export const quizKey = (lessonId: string) => ["teach", "quiz", lessonId] as const;

/** Quiz settings and question list for a quiz lesson (mentor portal and admin lesson editor). */
/** `bankHref` builds the question bank link for the quiz's course (mentor or admin path). */
export function QuizBuilder({
  lessonId,
  bankHref,
}: {
  lessonId: string;
  bankHref: (courseId: string) => string;
}) {
  const quiz = useQuery({
    queryKey: quizKey(lessonId),
    queryFn: () => api<QuizBuilderData>(`/teach/lessons/${lessonId}/quiz`),
  });

  if (quiz.isError) return <ErrorState error={quiz.error} onRetry={() => quiz.refetch()} />;
  if (!quiz.data) return <LoadingRows rows={4} />;
  const q = quiz.data;

  return (
    <div className="space-y-6">
      {q.attemptCount > 0 && (
        <Alert>
          <AlertTriangle />
          <AlertDescription>{tq.attemptsWarning(q.attemptCount)}</AlertDescription>
        </Alert>
      )}
      <QuizSettings quiz={q} />
      <QuizQuestions quiz={q} bankHref={bankHref(q.courseId)} />
    </div>
  );
}

const settingsSchema = z
  .object({
    timeLimitMinutes: z.coerce.number<string>().int().min(1).max(600),
    startsAt: z.string(),
    endsAt: z.string(),
    passMark: z.coerce.number<string>().int().min(0).max(100),
    maxAttempts: z.coerce.number<string>().int().min(1).max(20),
  })
  .refine((v) => !v.startsAt || !v.endsAt || new Date(v.startsAt) < new Date(v.endsAt), {
    path: ["endsAt"],
    message: tq.endAfterStart,
  });
type SettingsIn = z.input<typeof settingsSchema>;
type SettingsOut = z.output<typeof settingsSchema>;

function settingsDefaults(q: QuizBuilderData): SettingsIn {
  return {
    timeLimitMinutes: String(Math.max(1, Math.round(q.timeLimitSeconds / 60))),
    startsAt: toLocalInput(q.startsAt),
    endsAt: toLocalInput(q.endsAt),
    passMark: String(q.passMark),
    maxAttempts: String(q.maxAttempts),
  };
}

function QuizSettings({ quiz }: { quiz: QuizBuilderData }) {
  const queryClient = useQueryClient();
  const form = useForm<SettingsIn, unknown, SettingsOut>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settingsDefaults(quiz),
  });

  const save = useMutation({
    mutationFn: (v: SettingsOut) =>
      api<QuizBuilderData>(`/teach/lessons/${quiz.lessonId}/quiz`, {
        method: "PUT",
        body: {
          timeLimitMinutes: v.timeLimitMinutes,
          startsAt: fromLocalInput(v.startsAt),
          endsAt: fromLocalInput(v.endsAt),
          passMark: v.passMark,
          maxAttempts: v.maxAttempts,
        },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(quizKey(quiz.lessonId), updated);
      form.reset(settingsDefaults(updated));
      toast.success(tq.settingsSaved);
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  const e = form.formState.errors;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{tq.settings}</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={tq.timeLimit} htmlFor="quiz-time" error={e.timeLimitMinutes?.message}>
              <Input id="quiz-time" inputMode="numeric" {...form.register("timeLimitMinutes")} />
            </Field>
            <Field
              label={tq.passMark}
              htmlFor="quiz-pass"
              hint={tq.passMarkHint}
              error={e.passMark?.message}
            >
              <Input id="quiz-pass" inputMode="numeric" {...form.register("passMark")} />
            </Field>
            <Field label={tq.maxAttempts} htmlFor="quiz-attempts" error={e.maxAttempts?.message}>
              <Input id="quiz-attempts" inputMode="numeric" {...form.register("maxAttempts")} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={tq.opensAt}
              htmlFor="quiz-start"
              hint={tq.optional}
              error={e.startsAt?.message}
            >
              <Input id="quiz-start" type="datetime-local" {...form.register("startsAt")} />
            </Field>
            <Field
              label={tq.closesAt}
              htmlFor="quiz-end"
              hint={tq.optional}
              error={e.endsAt?.message}
            >
              <Input id="quiz-end" type="datetime-local" {...form.register("endsAt")} />
            </Field>
          </div>
          <Button
            type="submit"
            className="w-fit"
            disabled={save.isPending || !form.formState.isDirty}
          >
            {save.isPending && <Spinner />}
            {tq.saveSettings}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function QuizQuestions({ quiz, bankHref }: { quiz: QuizBuilderData; bankHref: string }) {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const setQuestions = useMutation({
    mutationFn: (questionIds: string[]) =>
      api<QuizBuilderData>(`/teach/lessons/${quiz.lessonId}/quiz/questions`, {
        method: "PUT",
        body: { questionIds },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(quizKey(quiz.lessonId), updated);
      void queryClient.invalidateQueries({ queryKey: bankKey(quiz.courseId) });
      toast.success(tq.questionsSaved);
    },
    onError: (err) => {
      toastError(err);
      void queryClient.invalidateQueries({ queryKey: quizKey(quiz.lessonId) });
    },
  });

  const ids = quiz.questions.map((q) => q.id);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
        <div>
          <CardTitle>{tq.questions}</CardTitle>
          <CardDescription>{tq.totalPoints(quiz.totalPoints)}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild>
            <Link href={bankHref}>
              <BookOpen /> {tq.openBank}
            </Link>
          </Button>
          <Button size="sm" onClick={() => setAdding(true)}>
            <Plus /> {tq.addQuestions}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {quiz.questions.length === 0 ? (
          <EmptyState title={tq.noQuestions} />
        ) : (
          <SortableList
            items={quiz.questions}
            onReorder={(order) => setQuestions.mutate(order)}
            renderItem={(q, handle) => (
              <div className="bg-background flex items-start gap-2 rounded-lg border p-3">
                <DragHandle {...handle} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="line-clamp-2 text-sm">{q.prompt}</p>
                  <QuestionBadges q={q} />
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={tq.remove}
                  disabled={setQuestions.isPending}
                  onClick={() => setQuestions.mutate(ids.filter((id) => id !== q.id))}
                >
                  <X />
                </Button>
              </div>
            )}
          />
        )}
      </CardContent>
      <AddQuestionsDialog
        open={adding}
        onOpenChange={setAdding}
        courseId={quiz.courseId}
        existing={ids}
        saving={setQuestions.isPending}
        onAdd={(newIds) =>
          setQuestions.mutate([...ids, ...newIds], { onSuccess: () => setAdding(false) })
        }
      />
    </Card>
  );
}

function QuestionBadges({ q }: { q: BankQuestion }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge variant="secondary">{t.teaching.types[q.type]}</Badge>
      <StatusBadge tone={difficultyTone[q.difficulty]}>
        {t.teaching.difficulties[q.difficulty]}
      </StatusBadge>
      <Badge variant="outline">{t.teaching.bank.points(q.points)}</Badge>
    </div>
  );
}

function AddQuestionsDialog({
  open,
  onOpenChange,
  courseId,
  existing,
  saving,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  existing: string[];
  saving: boolean;
  onAdd: (ids: string[]) => void;
}) {
  const [type, setType] = useState("all");
  const [selected, setSelected] = useState<string[]>([]);
  const bank = useQuery({
    queryKey: bankKey(courseId, {}),
    queryFn: () => fetchBank(courseId),
    enabled: open,
  });

  useEffect(() => {
    if (open) setSelected([]);
  }, [open]);

  const available = useMemo(
    () =>
      (bank.data ?? []).filter(
        (q) => !existing.includes(q.id) && (type === "all" || q.type === type),
      ),
    [bank.data, existing, type],
  );
  const bankEmpty = bank.data?.length === 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{tq.addQuestions}</DialogTitle>
        </DialogHeader>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-48" aria-label={t.teaching.form.type}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.teaching.bank.allTypes}</SelectItem>
            {QUESTION_TYPES.map((q) => (
              <SelectItem key={q} value={q}>
                {t.teaching.types[q]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {bank.isError ? (
          <ErrorState error={bank.error} onRetry={() => bank.refetch()} />
        ) : !bank.data ? (
          <LoadingRows rows={3} />
        ) : available.length === 0 ? (
          <EmptyState title={bankEmpty ? tq.bankEmpty : tq.allInQuiz} />
        ) : (
          <ul className="divide-y rounded-lg border">
            {available.map((q) => {
              const checked = selected.includes(q.id);
              return (
                <li key={q.id}>
                  <label className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 p-3">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) =>
                        setSelected((s) =>
                          v === true ? [...s, q.id] : s.filter((x) => x !== q.id),
                        )
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1 space-y-1.5">
                      <span className="line-clamp-2 block text-sm">{q.prompt}</span>
                      <QuestionBadges q={q} />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.actions.cancel}
          </Button>
          <Button disabled={selected.length === 0 || saving} onClick={() => onAdd(selected)}>
            {saving && <Spinner />}
            {tq.addSelected(selected.length)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
