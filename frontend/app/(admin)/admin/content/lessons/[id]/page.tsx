"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  LESSON_TYPES,
  type LessonForm,
  lessonFormSchema,
} from "@/components/admin/content/schemas";
import { LessonMediaEditor } from "@/components/learning/lesson-media-editor";
import { LessonEditor } from "@/components/rich-text/lesson-editor";
import { AssignmentBuilder } from "@/components/teaching/assignment-builder";
import { QuizBuilder } from "@/components/teaching/quiz-builder";
import {
  ErrorState,
  Field,
  LoadingRows,
  PageHeader,
  PublishedBadge,
  StatusBadge,
} from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { api } from "@/lib/api/client";
import { applyFormErrors, toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { toStorageDoc } from "@/lib/tiptap";
import type { AdminLesson, TiptapNode } from "@/types/api";

const s = t.adminContent.lesson;

function toForm(l: AdminLesson): LessonForm {
  return {
    title: l.title,
    type: l.type,
    durationMinutes: l.durationSeconds == null ? "" : String(Math.round(l.durationSeconds / 60)),
  };
}

function LessonEditorForm({ lesson }: { lesson: AdminLesson }) {
  const queryClient = useQueryClient();
  const [doc, setDoc] = useState<TiptapNode | null>(null);
  const form = useForm<LessonForm>({
    resolver: zodResolver(lessonFormSchema),
    defaultValues: toForm(lesson),
  });
  const type = form.watch("type");
  const dirty = form.formState.isDirty || doc !== null;

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (ev: BeforeUnloadEvent) => ev.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<AdminLesson>(`/admin/content/lessons/${lesson.id}`, { method: "PATCH", body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin", "lesson", lesson.id], updated);
      void queryClient.invalidateQueries({ queryKey: ["admin", "course"] });
    },
  });

  function save(v: LessonForm) {
    const body: Record<string, unknown> = { title: v.title, type: v.type };
    // Uploading a video sets the exact duration; only send it when edited here.
    if (form.getFieldState("durationMinutes").isDirty) {
      body.durationSeconds = v.durationMinutes === "" ? null : Number(v.durationMinutes) * 60;
    }
    if (v.type !== "article") {
      // Only articles have content; clear any old article text when the type changes.
      if (lesson.content) body.content = null;
    } else if (doc) {
      body.content = toStorageDoc(doc);
    }
    patch.mutate(body, {
      onSuccess: (updated) => {
        form.reset(toForm(updated));
        setDoc(null);
        toast.success(t.adminContent.saved);
      },
      onError: (err) => applyFormErrors(err, form.setError),
    });
  }

  const { errors } = form.formState;
  return (
    <form onSubmit={form.handleSubmit(save)} className="grid gap-6">
      <Card>
        <CardContent className="grid gap-4">
          <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
            <Label htmlFor="lesson-published">{s.fields.published}</Label>
            <Switch
              id="lesson-published"
              checked={lesson.isPublished}
              disabled={patch.isPending}
              onCheckedChange={(isPublished) =>
                patch.mutate(
                  { isPublished },
                  {
                    onSuccess: () =>
                      toast.success(
                        isPublished
                          ? t.adminContent.publishedToast
                          : t.adminContent.unpublishedToast,
                      ),
                    onError: toastError,
                  },
                )
              }
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_12rem_10rem]">
            <Field label={s.fields.title} htmlFor="lesson-title" error={errors.title?.message}>
              <Input id="lesson-title" {...form.register("title")} />
            </Field>
            <Field label={s.fields.type} error={errors.type?.message}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LESSON_TYPES.map((lt) => (
                        <SelectItem key={lt} value={lt}>
                          {t.common.lessonTypes[lt]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field
              label={s.fields.duration}
              htmlFor="lesson-duration"
              error={errors.durationMinutes?.message}
            >
              <Input
                id="lesson-duration"
                inputMode="numeric"
                {...form.register("durationMinutes")}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-2">
        <h2 className="text-base font-semibold">{s.content}</h2>
        {type === "article" ? (
          <LessonEditor content={lesson.content} assetUrls={lesson.assetUrls} onChange={setDoc} />
        ) : (
          <Alert>
            <AlertDescription>{s.nonArticle}</AlertDescription>
          </Alert>
        )}
      </section>

      <div className="bg-background/95 sticky bottom-0 -mx-4 flex items-center justify-end gap-3 border-t px-4 py-3 backdrop-blur lg:-mx-8 lg:px-8">
        {dirty && <StatusBadge tone="warning">{s.unsaved}</StatusBadge>}
        <Button type="submit" disabled={patch.isPending || !dirty}>
          {patch.isPending ? t.common.actions.saving : s.saveLesson}
        </Button>
      </div>
    </form>
  );
}

export default function LessonEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const lesson = useQuery({
    queryKey: ["admin", "lesson", id],
    queryFn: () => api<AdminLesson>(`/admin/content/lessons/${id}`),
    // Signed image URLs expire after 10 minutes; don't refetch mid-edit.
    staleTime: Infinity,
  });

  if (lesson.isLoading) return <LoadingRows rows={6} />;
  if (lesson.isError || !lesson.data) {
    return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  }

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-2 -ml-2" onClick={() => router.back()}>
        <ArrowLeft /> {s.back}
      </Button>
      <PageHeader
        title={lesson.data.title}
        description={t.common.lessonTypes[lesson.data.type]}
        actions={<PublishedBadge published={lesson.data.isPublished} />}
      />
      <LessonEditorForm key={lesson.data.id} lesson={lesson.data} />
      {lesson.data.type === "quiz" && (
        <section className="mt-10 grid gap-3">
          <h2 className="text-base font-semibold">{t.teaching.quiz.title}</h2>
          <QuizBuilder
            lessonId={lesson.data.id}
            bankHref={(c) => `/admin/content/courses/${c}/questions`}
          />
        </section>
      )}
      {lesson.data.type === "assignment" && (
        <section className="mt-10 grid gap-3">
          <h2 className="text-base font-semibold">{t.teaching.assignment.title}</h2>
          <AssignmentBuilder lessonId={lesson.data.id} />
        </section>
      )}
      <section className="mt-10 grid gap-3">
        <h2 className="text-base font-semibold">{t.learning.media.title}</h2>
        <LessonMediaEditor lessonId={lesson.data.id} />
      </section>
    </>
  );
}
