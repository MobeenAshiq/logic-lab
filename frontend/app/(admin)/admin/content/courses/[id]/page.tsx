"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Library, Plus } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CourseDetailsCard } from "@/components/admin/content/course-details-card";
import { MentorsCard } from "@/components/admin/content/mentors-card";
import { ModuleCard } from "@/components/admin/content/module-card";
import { type ModuleForm, moduleFormSchema } from "@/components/admin/content/schemas";
import { SortableList } from "@/components/admin/content/sortable-list";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingRows,
  PageHeader,
  PublishedBadge,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { applyFormErrors, toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { AdminCourse } from "@/types/api";

const s = t.adminContent;

function NewModuleForm({ courseId, onDone }: { courseId: string; onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useForm<ModuleForm>({
    resolver: zodResolver(moduleFormSchema),
    defaultValues: { title: "", description: "" },
  });
  const create = useMutation({
    mutationFn: (v: ModuleForm) =>
      api(`/admin/content/courses/${courseId}/modules`, { method: "POST", body: v }),
    onSuccess: () => {
      toast.success(s.saved);
      void queryClient.invalidateQueries({ queryKey: ["admin", "course", courseId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      onDone();
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });
  return (
    <form
      onSubmit={form.handleSubmit((v) => create.mutate(v))}
      className="grid gap-3 rounded-xl border border-dashed p-3 sm:flex sm:items-end"
    >
      <Field
        label={s.modules.fields.title}
        htmlFor="new-module"
        error={form.formState.errors.title?.message}
        className="flex-1"
      >
        <Input id="new-module" autoFocus {...form.register("title")} />
      </Field>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onDone}>
          {t.common.actions.cancel}
        </Button>
        <Button type="submit" disabled={create.isPending}>
          {t.common.actions.add}
        </Button>
      </div>
    </form>
  );
}

export default function CourseEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);

  const course = useQuery({
    queryKey: ["admin", "course", id],
    queryFn: () => api<AdminCourse>(`/admin/content/courses/${id}`),
  });

  const reorderModules = useMutation({
    mutationFn: (ids: string[]) =>
      api(`/admin/content/courses/${id}/modules/order`, { method: "PUT", body: { ids } }),
    onSuccess: () => toast.success(s.reordered),
    onError: toastError,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["admin", "course", id] }),
  });

  if (course.isLoading) return <LoadingRows rows={6} />;
  if (course.isError || !course.data) {
    return <ErrorState error={course.error} onRetry={() => course.refetch()} />;
  }
  const c = course.data;

  return (
    <>
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/content">
          <ArrowLeft /> {s.course.back}
        </Link>
      </Button>
      <PageHeader
        title={c.title}
        description={`${c.track.title} · ${t.common.levels[c.level]}`}
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/admin/content/courses/${c.id}/questions`}>
                <Library /> {t.teaching.nav.questionBank}
              </Link>
            </Button>
            <PublishedBadge published={c.isPublished} />
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="grid content-start gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{s.modules.heading}</h2>
            {!adding && (
              <Button size="sm" onClick={() => setAdding(true)}>
                <Plus /> {s.modules.new}
              </Button>
            )}
          </div>
          {adding && <NewModuleForm courseId={id} onDone={() => setAdding(false)} />}
          {c.modules.length === 0 && !adding ? (
            <EmptyState title={s.modules.empty} />
          ) : (
            <SortableList
              items={c.modules}
              onReorder={(ids) => reorderModules.mutate(ids)}
              className="gap-3"
              renderItem={(m, handle) => (
                <ModuleCard module={m} allModules={c.modules} handle={handle} />
              )}
            />
          )}
        </section>

        <aside className="grid content-start gap-6">
          <CourseDetailsCard course={c} />
          <MentorsCard course={c} />
        </aside>
      </div>
    </>
  );
}
