"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useDebounced } from "@/components/admin/use-debounced";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingRows,
  Spinner,
  StatusBadge,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors, toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { BankQuestion, Difficulty, QuestionType } from "@/types/api";

const tb = t.teaching.bank;
const tf = t.teaching.form;

export const QUESTION_TYPES: QuestionType[] = ["mcq", "short", "code"];
export const DIFFICULTIES: Difficulty[] = ["easy", "medium", "hard"];

export const difficultyTone = {
  easy: "success",
  medium: "warning",
  hard: "danger",
} as const;

export const bankKey = (courseId: string, filters?: Record<string, string>) =>
  filters
    ? (["teach", "bank", courseId, filters] as const)
    : (["teach", "bank", courseId] as const);

export function fetchBank(courseId: string, filters: Record<string, string> = {}) {
  return api<BankQuestion[]>(`/teach/courses/${courseId}/questions`, { query: filters });
}

/** Full question bank for one course: filters, list, create/edit/delete. */
export function QuestionBank({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState("all");
  const [difficulty, setDifficulty] = useState("all");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounced(search.trim());
  const debouncedTag = useDebounced(tag.trim());
  const [editing, setEditing] = useState<BankQuestion | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filters: Record<string, string> = {
    ...(type !== "all" && { type }),
    ...(difficulty !== "all" && { difficulty }),
    ...(debouncedTag && { tag: debouncedTag }),
    ...(debouncedSearch && { search: debouncedSearch }),
  };
  const filtered = Object.keys(filters).length > 0;

  const questions = useQuery({
    queryKey: bankKey(courseId, filters),
    queryFn: () => fetchBank(courseId, filters),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api(`/teach/questions/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      toast.success(tb.deleted);
      await queryClient.invalidateQueries({ queryKey: bankKey(courseId) });
    },
    onError: toastError,
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative sm:w-64">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tb.searchPlaceholder}
            aria-label={tb.searchPlaceholder}
            className="pl-8"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="w-full sm:w-40" aria-label={tf.type}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tb.allTypes}</SelectItem>
              {QUESTION_TYPES.map((q) => (
                <SelectItem key={q} value={q}>
                  {t.teaching.types[q]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={difficulty} onValueChange={setDifficulty}>
            <SelectTrigger className="w-full sm:w-40" aria-label={tf.difficulty}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{tb.allDifficulties}</SelectItem>
              {DIFFICULTIES.map((d) => (
                <SelectItem key={d} value={d}>
                  {t.teaching.difficulties[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          value={tag}
          onChange={(e) => setTag(e.target.value)}
          placeholder={tb.tagPlaceholder}
          aria-label={tb.tagPlaceholder}
          maxLength={30}
          className="sm:w-32"
        />
        <Button className="sm:ml-auto" onClick={openNew}>
          <Plus /> {tb.newQuestion}
        </Button>
      </div>

      {questions.isError ? (
        <ErrorState error={questions.error} onRetry={() => questions.refetch()} />
      ) : !questions.data ? (
        <LoadingRows rows={4} />
      ) : questions.data.length === 0 ? (
        <EmptyState
          title={filtered ? tb.emptyFiltered : tb.empty}
          action={
            !filtered && (
              <Button onClick={openNew}>
                <Plus /> {tb.newQuestion}
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y rounded-xl border">
          {questions.data.map((q) => (
            <li key={q.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1 space-y-2">
                <p className="line-clamp-3 text-sm whitespace-pre-line">{q.prompt}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="secondary">{t.teaching.types[q.type]}</Badge>
                  <StatusBadge tone={difficultyTone[q.difficulty]}>
                    {t.teaching.difficulties[q.difficulty]}
                  </StatusBadge>
                  <Badge variant="outline">{tb.points(q.points)}</Badge>
                  {q.allowMultiple && <Badge variant="outline">{tb.multiple}</Badge>}
                  {q.tags.map((tg) => (
                    <Badge key={tg} variant="outline" className="text-muted-foreground">
                      #{tg}
                    </Badge>
                  ))}
                  {(q.usedInQuizzes ?? 0) > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {tb.usedIn(q.usedInQuizzes ?? 0)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 self-end sm:self-start">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={tb.editQuestion}
                  onClick={() => {
                    setEditing(q);
                    setDialogOpen(true);
                  }}
                >
                  <Pencil />
                </Button>
                <ConfirmDialog
                  title={tb.deleteTitle}
                  description={tb.deleteBody}
                  destructive
                  confirmLabel={t.common.actions.delete}
                  onConfirm={() => remove.mutateAsync(q.id).catch(() => {})}
                >
                  <Button size="icon-sm" variant="ghost" aria-label={t.common.actions.delete}>
                    <Trash2 />
                  </Button>
                </ConfirmDialog>
              </div>
            </li>
          ))}
        </ul>
      )}

      <QuestionDialog
        courseId={courseId}
        question={editing}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}

// ------------------------------------------------------------------ dialog

const LETTERS = "abcdefghij";

function nextOptionId(existing: { id: string }[]) {
  const used = new Set(existing.map((o) => o.id));
  return [...LETTERS].find((l) => !used.has(l)) ?? Math.random().toString(36).slice(2, 8);
}

const questionFormSchema = z
  .object({
    type: z.enum(["mcq", "short", "code"]),
    difficulty: z.enum(["easy", "medium", "hard"]),
    points: z.coerce.number<string>().int().min(1).max(100),
    tags: z.string().max(400),
    prompt: z.string().trim().min(3).max(5_000),
    options: z.array(z.object({ id: z.string(), text: z.string().trim().max(500) })).max(8),
    correctIds: z.array(z.string()),
    allowMultiple: z.boolean(),
    explanation: z.string().max(5_000),
    sampleAnswer: z.string().max(20_000),
    codeLanguage: z.enum(["javascript", "python"]),
  })
  .superRefine((v, ctx) => {
    const tags = splitTags(v.tags);
    if (tags.length > 10 || tags.some((tg) => tg.length > 30)) {
      ctx.addIssue({ code: "custom", path: ["tags"], message: tf.errors.tags });
    }
    if (v.type !== "mcq") return;
    if (v.options.length < 2) {
      ctx.addIssue({ code: "custom", path: ["options"], message: tf.errors.minOptions });
    }
    if (v.options.some((o) => !o.text)) {
      ctx.addIssue({ code: "custom", path: ["options"], message: tf.errors.optionText });
    }
    const ids = new Set(v.options.map((o) => o.id));
    const correct = v.correctIds.filter((c) => ids.has(c));
    if (correct.length === 0) {
      ctx.addIssue({ code: "custom", path: ["correctIds"], message: tf.errors.correct });
    } else if (!v.allowMultiple && correct.length > 1) {
      ctx.addIssue({ code: "custom", path: ["correctIds"], message: tf.errors.oneCorrect });
    }
  });

type QuestionFormIn = z.input<typeof questionFormSchema>;
type QuestionFormOut = z.output<typeof questionFormSchema>;

function splitTags(s: string) {
  return [
    ...new Set(
      s
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean),
    ),
  ];
}

function defaults(q: BankQuestion | null): QuestionFormIn {
  return {
    type: q?.type ?? "mcq",
    difficulty: q?.difficulty ?? "medium",
    points: String(q?.points ?? 1),
    tags: q?.tags.join(", ") ?? "",
    prompt: q?.prompt ?? "",
    options:
      q && q.options.length > 0
        ? q.options
        : [
            { id: "a", text: "" },
            { id: "b", text: "" },
          ],
    correctIds: q?.correctOptionIds ?? [],
    allowMultiple: q?.allowMultiple ?? false,
    explanation: q?.explanation ?? "",
    sampleAnswer: q?.sampleAnswer ?? "",
    codeLanguage: q?.codeLanguage ?? "javascript",
  };
}

function QuestionDialog({
  courseId,
  question,
  open,
  onOpenChange,
}: {
  courseId: string;
  question: BankQuestion | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const form = useForm<QuestionFormIn, unknown, QuestionFormOut>({
    resolver: zodResolver(questionFormSchema),
    defaultValues: defaults(question),
  });
  const options = useFieldArray({ control: form.control, name: "options" });

  useEffect(() => {
    if (open) form.reset(defaults(question));
  }, [open, question, form]);

  const type = form.watch("type");
  const allowMultiple = form.watch("allowMultiple");
  const correctIds = form.watch("correctIds");
  const isMcq = type === "mcq";

  const save = useMutation({
    mutationFn: (v: QuestionFormOut) => {
      const body = {
        type: v.type,
        difficulty: v.difficulty,
        points: v.points,
        tags: splitTags(v.tags),
        prompt: v.prompt,
        ...(v.type === "mcq"
          ? {
              options: v.options,
              correctOptionIds: v.correctIds.filter((c) => v.options.some((o) => o.id === c)),
              allowMultiple: v.allowMultiple,
            }
          : { sampleAnswer: v.sampleAnswer }),
        ...(v.type === "code" && { codeLanguage: v.codeLanguage }),
        explanation: v.explanation,
      };
      return question
        ? api<BankQuestion>(`/teach/questions/${question.id}`, { method: "PATCH", body })
        : api<BankQuestion>(`/teach/courses/${courseId}/questions`, { method: "POST", body });
    },
    onSuccess: async () => {
      toast.success(question ? tb.saved : tb.created);
      await queryClient.invalidateQueries({ queryKey: bankKey(courseId) });
      onOpenChange(false);
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  const toggleCorrect = (id: string, checked: boolean) => {
    const current = form.getValues("correctIds");
    form.setValue(
      "correctIds",
      allowMultiple
        ? checked
          ? [...current, id]
          : current.filter((c) => c !== id)
        : checked
          ? [id]
          : [],
      { shouldValidate: form.formState.isSubmitted },
    );
  };

  const errors = form.formState.errors;
  const optionsError = errors.options?.message ?? errors.options?.root?.message;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? tb.editQuestion : tb.newQuestion}</DialogTitle>
        </DialogHeader>
        <form
          id="question-form"
          className="grid gap-4"
          onSubmit={form.handleSubmit((v) => save.mutate(v))}
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={tf.type}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {QUESTION_TYPES.map((q) => (
                        <SelectItem key={q} value={q}>
                          {t.teaching.types[q]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label={tf.difficulty}>
              <Controller
                control={form.control}
                name="difficulty"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DIFFICULTIES.map((d) => (
                        <SelectItem key={d} value={d}>
                          {t.teaching.difficulties[d]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label={tf.points} htmlFor="q-points" error={errors.points?.message}>
              <Input id="q-points" inputMode="numeric" {...form.register("points")} />
            </Field>
          </div>

          <Field label={tf.prompt} htmlFor="q-prompt" error={errors.prompt?.message}>
            <Textarea id="q-prompt" rows={4} maxLength={5_000} {...form.register("prompt")} />
          </Field>

          {isMcq ? (
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-2">
                <Label>{tf.options}</Label>
                <Controller
                  control={form.control}
                  name="allowMultiple"
                  render={({ field }) => (
                    <Label className="flex items-center gap-2 text-sm font-normal">
                      <Switch
                        checked={field.value}
                        onCheckedChange={(v) => {
                          field.onChange(v);
                          if (!v)
                            form.setValue("correctIds", form.getValues("correctIds").slice(0, 1));
                        }}
                      />
                      {tf.allowMultiple}
                    </Label>
                  )}
                />
              </div>
              <p className="text-muted-foreground text-xs">
                {allowMultiple ? tf.correctHintMulti : tf.correctHintSingle}
              </p>
              <ul className="grid gap-2">
                {options.fields.map((opt, i) => {
                  const isCorrect = correctIds.includes(opt.id);
                  return (
                    <li key={opt.id} className="flex items-center gap-2">
                      {allowMultiple ? (
                        <Checkbox
                          checked={isCorrect}
                          onCheckedChange={(v) => toggleCorrect(opt.id, v === true)}
                          aria-label={tf.markCorrect}
                        />
                      ) : (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isCorrect}
                          aria-label={tf.markCorrect}
                          onClick={() => toggleCorrect(opt.id, true)}
                          className={cn(
                            "grid size-5 shrink-0 place-items-center rounded-full border",
                            isCorrect && "border-success bg-success text-white",
                          )}
                        >
                          {isCorrect && <Check className="size-3" />}
                        </button>
                      )}
                      <Input
                        {...form.register(`options.${i}.text`)}
                        placeholder={tf.optionPlaceholder(i + 1)}
                        maxLength={500}
                        className={cn(isCorrect && "border-success/60")}
                      />
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={tf.removeOption}
                        disabled={options.fields.length <= 2}
                        onClick={() => {
                          form.setValue(
                            "correctIds",
                            form.getValues("correctIds").filter((c) => c !== opt.id),
                          );
                          options.remove(i);
                        }}
                      >
                        <X />
                      </Button>
                    </li>
                  );
                })}
              </ul>
              {options.fields.length < 8 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="w-fit"
                  onClick={() =>
                    options.append({ id: nextOptionId(form.getValues("options")), text: "" })
                  }
                >
                  <Plus /> {tf.addOption}
                </Button>
              )}
              {(optionsError || errors.correctIds?.message) && (
                <p className="text-destructive text-xs">
                  {optionsError ?? errors.correctIds?.message}
                </p>
              )}
            </div>
          ) : (
            <>
              {type === "code" && (
                <Field label={tf.codeLanguage} className="sm:max-w-48">
                  <Controller
                    control={form.control}
                    name="codeLanguage"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="javascript">
                            {t.teaching.languages.javascript}
                          </SelectItem>
                          <SelectItem value="python">{t.teaching.languages.python}</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              )}
              <Field
                label={tf.sampleAnswer}
                htmlFor="q-sample"
                hint={tf.sampleAnswerHint}
                error={errors.sampleAnswer?.message}
              >
                <Textarea
                  id="q-sample"
                  rows={type === "code" ? 6 : 3}
                  className={cn(type === "code" && "font-mono text-[13px]")}
                  {...form.register("sampleAnswer")}
                />
              </Field>
            </>
          )}

          <Field
            label={tf.explanation}
            htmlFor="q-explanation"
            hint={tf.explanationHint}
            error={errors.explanation?.message}
          >
            <Textarea id="q-explanation" rows={2} {...form.register("explanation")} />
          </Field>
          <Field label={tf.tags} htmlFor="q-tags" hint={tf.tagsHint} error={errors.tags?.message}>
            <Input id="q-tags" {...form.register("tags")} />
          </Field>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.actions.cancel}
          </Button>
          <Button type="submit" form="question-form" disabled={save.isPending}>
            {save.isPending && <Spinner />}
            {t.common.actions.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
