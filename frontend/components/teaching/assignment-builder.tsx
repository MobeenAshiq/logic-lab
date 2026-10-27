"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { DragHandle, SortableList } from "@/components/admin/content/sortable-list";
import { ErrorState, Field, LoadingRows, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AssignmentBuilder as AssignmentData, SubmissionStatus } from "@/types/api";
import { fromLocalInput, toLocalInput } from "./datetime";

const ta = t.teaching.assignment;

export const assignmentKey = (lessonId: string) => ["teach", "assignment", lessonId] as const;

const schema = z
  .object({
    instructions: z.string().max(20_000),
    dueAt: z.string(),
    maxMarks: z.coerce.number<string>().int().min(1).max(1_000),
    rubric: z
      .array(
        z.object({
          id: z.string().min(1).max(40),
          title: z.string().trim().min(1).max(120),
          description: z.string().max(1_000),
          maxPoints: z.coerce.number<string>().int().min(1).max(1_000),
        }),
      )
      .max(20),
  })
  .refine(
    (v) => v.rubric.length === 0 || v.rubric.reduce((s, c) => s + c.maxPoints, 0) === v.maxMarks,
    { path: ["rubric"], message: ta.mismatch },
  );
type FormIn = z.input<typeof schema>;
type FormOut = z.output<typeof schema>;

function defaults(a: AssignmentData): FormIn {
  return {
    instructions: a.instructions,
    dueAt: toLocalInput(a.dueAt),
    maxMarks: String(a.maxMarks),
    rubric: a.rubric.map((c) => ({ ...c, maxPoints: String(c.maxPoints) })),
  };
}

function newId() {
  return Math.random().toString(36).slice(2, 10);
}

/** Instructions, due date, marks and rubric of an assignment lesson. */
export function AssignmentBuilder({ lessonId }: { lessonId: string }) {
  const assignment = useQuery({
    queryKey: assignmentKey(lessonId),
    queryFn: () => api<AssignmentData>(`/teach/lessons/${lessonId}/assignment`),
  });
  if (assignment.isError) {
    return <ErrorState error={assignment.error} onRetry={() => assignment.refetch()} />;
  }
  if (!assignment.data) return <LoadingRows rows={4} />;
  return <AssignmentForm key={assignment.data.id} assignment={assignment.data} />;
}

const COUNT_TONE: Record<SubmissionStatus, "neutral" | "warning" | "success"> = {
  draft: "neutral",
  submitted: "warning",
  returned: "success",
};

function AssignmentForm({ assignment }: { assignment: AssignmentData }) {
  const queryClient = useQueryClient();
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(schema),
    defaultValues: defaults(assignment),
  });
  const rubric = useFieldArray({ control: form.control, name: "rubric", keyName: "key" });

  const save = useMutation({
    mutationFn: (v: FormOut) =>
      api<AssignmentData>(`/teach/lessons/${assignment.lessonId}/assignment`, {
        method: "PUT",
        body: {
          instructions: v.instructions,
          dueAt: fromLocalInput(v.dueAt),
          maxMarks: v.maxMarks,
          rubric: v.rubric,
        },
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(assignmentKey(assignment.lessonId), updated);
      form.reset(defaults(updated));
      toast.success(ta.saved);
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  const watched = form.watch("rubric");
  const maxMarks = Number(form.watch("maxMarks")) || 0;
  const total = watched.reduce((s, c) => s + (Number(c.maxPoints) || 0), 0);
  const e = form.formState.errors;
  const rubricError = e.rubric?.message ?? e.rubric?.root?.message;
  const counts = assignment.submissionCounts;

  const reorder = (keys: string[]) => {
    const values = form.getValues("rubric");
    const byKey = new Map(rubric.fields.map((f, i) => [f.key, values[i]]));
    rubric.replace(keys.flatMap((k) => byKey.get(k) ?? []));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ta.title}</CardTitle>
        <CardDescription className="flex flex-wrap gap-2 pt-1">
          {(["submitted", "returned", "draft"] as SubmissionStatus[]).map((s) => (
            <StatusBadge key={s} tone={COUNT_TONE[s]}>
              {ta.counts[s]}: {counts[s] ?? 0}
            </StatusBadge>
          ))}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={form.handleSubmit((v) => save.mutate(v))} noValidate>
          <Field label={ta.instructions} htmlFor="as-instructions" error={e.instructions?.message}>
            <Textarea
              id="as-instructions"
              rows={6}
              maxLength={20_000}
              placeholder={ta.instructionsPlaceholder}
              {...form.register("instructions")}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={ta.dueAt} htmlFor="as-due" hint={ta.noDueDate} error={e.dueAt?.message}>
              <Input id="as-due" type="datetime-local" {...form.register("dueAt")} />
            </Field>
            <Field label={ta.maxMarks} htmlFor="as-max" error={e.maxMarks?.message}>
              <Input id="as-max" inputMode="numeric" {...form.register("maxMarks")} />
            </Field>
          </div>

          <div className="grid gap-3">
            <div>
              <Label>{ta.rubric}</Label>
              <p className="text-muted-foreground mt-1 text-xs">{ta.rubricHint}</p>
            </div>
            {rubric.fields.length > 0 && (
              <SortableList
                items={rubric.fields.map((f) => ({ id: f.key }))}
                onReorder={reorder}
                renderItem={(item, handle) => {
                  const i = rubric.fields.findIndex((f) => f.key === item.id);
                  const ce = e.rubric?.[i];
                  return (
                    <div className="bg-background flex items-start gap-2 rounded-lg border p-3">
                      <DragHandle {...handle} className="mt-1" />
                      <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_6rem]">
                        <Input
                          placeholder={ta.criterionTitle}
                          aria-label={ta.criterionTitle}
                          maxLength={120}
                          aria-invalid={Boolean(ce?.title)}
                          {...form.register(`rubric.${i}.title`)}
                        />
                        <Input
                          placeholder={ta.criterionPoints}
                          aria-label={ta.criterionPoints}
                          inputMode="numeric"
                          aria-invalid={Boolean(ce?.maxPoints)}
                          {...form.register(`rubric.${i}.maxPoints`)}
                        />
                        <Textarea
                          placeholder={ta.criterionDescription}
                          aria-label={ta.criterionDescription}
                          rows={2}
                          maxLength={1_000}
                          className="sm:col-span-2"
                          {...form.register(`rubric.${i}.description`)}
                        />
                      </div>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={ta.removeCriterion}
                        onClick={() => rubric.remove(i)}
                      >
                        <X />
                      </Button>
                    </div>
                  );
                }}
              />
            )}
            <div className="flex flex-wrap items-center gap-2">
              {rubric.fields.length < 20 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    rubric.append({ id: newId(), title: "", description: "", maxPoints: "" })
                  }
                >
                  <Plus /> {ta.addCriterion}
                </Button>
              )}
              {rubric.fields.length > 0 && (
                <>
                  <span
                    className={cn(
                      "text-sm",
                      total === maxMarks ? "text-success" : "text-warning font-medium",
                    )}
                  >
                    {ta.rubricTotal(total, maxMarks)}
                  </span>
                  {total !== maxMarks && total > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        form.setValue("maxMarks", String(total), {
                          shouldDirty: true,
                          shouldValidate: form.formState.isSubmitted,
                        })
                      }
                    >
                      {ta.useRubricTotal}
                    </Button>
                  )}
                </>
              )}
            </div>
            {rubricError && <p className="text-destructive text-xs">{rubricError}</p>}
          </div>

          <Button
            type="submit"
            className="w-fit"
            disabled={save.isPending || !form.formState.isDirty}
          >
            {save.isPending && <Spinner />}
            {ta.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
