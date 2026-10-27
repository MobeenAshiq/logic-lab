"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, ListChecks, Pencil, Plus, ScrollText, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
import type { AdminModule, LessonType } from "@/types/api";
import {
  LESSON_TYPES,
  type ModuleForm,
  moduleFormSchema,
  type NewLessonForm,
  newLessonSchema,
} from "./schemas";
import { DragHandle, SortableList } from "./sortable-list";

const s = t.adminContent;
const NO_UNLOCK = "none";

export const LESSON_ICONS: Record<LessonType, React.ComponentType<{ className?: string }>> = {
  video: Video,
  article: FileText,
  quiz: ListChecks,
  assignment: ScrollText,
};

function useCourseRefresh(courseId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "course", courseId] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
  };
}

function ModuleEditForm({ module, onDone }: { module: AdminModule; onDone: () => void }) {
  const refresh = useCourseRefresh(module.courseId);
  const form = useForm<ModuleForm>({
    resolver: zodResolver(moduleFormSchema),
    defaultValues: { title: module.title, description: module.description },
  });
  const save = useMutation({
    mutationFn: (v: ModuleForm) =>
      api(`/admin/content/modules/${module.id}`, { method: "PATCH", body: v }),
    onSuccess: () => {
      toast.success(s.saved);
      refresh();
      onDone();
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });
  const { errors } = form.formState;
  return (
    <form onSubmit={form.handleSubmit((v) => save.mutate(v))} className="grid gap-3">
      <Field
        label={s.modules.fields.title}
        htmlFor={`m-title-${module.id}`}
        error={errors.title?.message}
      >
        <Input id={`m-title-${module.id}`} {...form.register("title")} />
      </Field>
      <Field
        label={s.modules.fields.description}
        htmlFor={`m-desc-${module.id}`}
        error={errors.description?.message}
      >
        <Textarea id={`m-desc-${module.id}`} rows={2} {...form.register("description")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          {t.common.actions.cancel}
        </Button>
        <Button type="submit" size="sm" disabled={save.isPending}>
          {save.isPending ? t.common.actions.saving : t.common.actions.save}
        </Button>
      </div>
    </form>
  );
}

function NewLessonDialog({ module }: { module: AdminModule }) {
  const [open, setOpen] = useState(false);
  const refresh = useCourseRefresh(module.courseId);
  const form = useForm<NewLessonForm>({
    resolver: zodResolver(newLessonSchema),
    defaultValues: { title: "", type: "article" },
  });
  const create = useMutation({
    mutationFn: (v: NewLessonForm) =>
      api(`/admin/content/modules/${module.id}/lessons`, { method: "POST", body: v }),
    onSuccess: () => {
      toast.success(s.saved);
      refresh();
      setOpen(false);
      form.reset();
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });
  const { errors } = form.formState;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus /> {s.lessons.new}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{s.lessons.newTitle}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit((v) => create.mutate(v))} className="grid gap-4">
          <Field
            label={s.lessons.fields.title}
            htmlFor={`l-new-${module.id}`}
            error={errors.title?.message}
          >
            <Input id={`l-new-${module.id}`} {...form.register("title")} />
          </Field>
          <Field label={s.lessons.fields.type} error={errors.type?.message}>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LESSON_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {t.common.lessonTypes[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? t.common.actions.saving : t.common.actions.create}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** One module of the course editor: settings + its lessons (drag to reorder). */
export function ModuleCard({
  module,
  allModules,
  handle,
}: {
  module: AdminModule;
  allModules: AdminModule[];
  handle: React.HTMLAttributes<HTMLButtonElement>;
}) {
  const [editing, setEditing] = useState(false);
  const refresh = useCourseRefresh(module.courseId);

  const patchModule = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api(`/admin/content/modules/${module.id}`, { method: "PATCH", body }),
    onSuccess: () => toast.success(s.saved),
    onError: toastError,
    onSettled: refresh,
  });

  const patchLesson = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api(`/admin/content/lessons/${id}`, { method: "PATCH", body: { isPublished } }),
    onSuccess: (_d, v) => toast.success(v.isPublished ? s.publishedToast : s.unpublishedToast),
    onError: toastError,
    onSettled: refresh,
  });

  const reorderLessons = useMutation({
    mutationFn: (ids: string[]) =>
      api(`/admin/content/modules/${module.id}/lessons/order`, { method: "PUT", body: { ids } }),
    onSuccess: () => toast.success(s.reordered),
    onError: toastError,
    onSettled: refresh,
  });

  async function remove(path: string) {
    try {
      await api(path, { method: "DELETE" });
      toast.success(s.deleted);
      refresh();
    } catch (err) {
      toastError(err);
    }
  }

  const others = allModules.filter((m) => m.id !== module.id);

  return (
    <div className="bg-card rounded-xl border">
      <div className="flex items-start gap-2 p-3">
        <DragHandle {...handle} />
        <div className="min-w-0 flex-1">
          {editing ? (
            <ModuleEditForm module={module} onDone={() => setEditing(false)} />
          ) : (
            <>
              <p className="font-medium">{module.title}</p>
              {module.description && (
                <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                  {module.description}
                </p>
              )}
              <p className="text-muted-foreground mt-1 text-xs">
                {s.modules.lessons(module.lessons.length)}
              </p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex shrink-0 items-center gap-1">
            <Switch
              checked={module.isPublished}
              aria-label={t.common.published}
              onCheckedChange={(isPublished) => patchModule.mutate({ isPublished })}
            />
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t.common.actions.edit}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
            <ConfirmDialog
              title={s.modules.deleteTitle}
              description={s.modules.deleteBody}
              confirmLabel={t.common.actions.delete}
              destructive
              onConfirm={() => remove(`/admin/content/modules/${module.id}`)}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t.common.actions.delete}
                disabled={module.isPublished}
              >
                <Trash2 />
              </Button>
            </ConfirmDialog>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5 border-t px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-muted-foreground text-xs font-medium">
          {s.modules.fields.unlockAfter}
        </span>
        <Select
          value={module.unlockAfterModuleId ?? NO_UNLOCK}
          onValueChange={(v) =>
            patchModule.mutate({ unlockAfterModuleId: v === NO_UNLOCK ? null : v })
          }
        >
          <SelectTrigger size="sm" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_UNLOCK}>{s.modules.fields.unlockNone}</SelectItem>
            {others.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-t p-3">
        {module.lessons.length === 0 ? (
          <p className="text-muted-foreground py-2 text-center text-sm">{s.lessons.empty}</p>
        ) : (
          <SortableList
            items={module.lessons}
            onReorder={(ids) => reorderLessons.mutate(ids)}
            className="gap-1.5"
            renderItem={(lesson, lessonHandle) => {
              const Icon = LESSON_ICONS[lesson.type];
              return (
                <div className="bg-background flex items-center gap-2 rounded-lg border p-1.5 pr-2">
                  <DragHandle {...lessonHandle} />
                  <Icon className="text-muted-foreground size-4 shrink-0" />
                  <Link
                    href={`/admin/content/lessons/${lesson.id}`}
                    className="hover:text-primary min-w-0 flex-1 truncate text-sm"
                  >
                    {lesson.title}
                  </Link>
                  <span className="text-muted-foreground hidden text-xs sm:inline">
                    {t.common.lessonTypes[lesson.type]}
                  </span>
                  <Switch
                    size="sm"
                    checked={lesson.isPublished}
                    aria-label={t.common.published}
                    onCheckedChange={(isPublished) =>
                      patchLesson.mutate({ id: lesson.id, isPublished })
                    }
                  />
                  <Button variant="ghost" size="icon-xs" asChild aria-label={s.lessons.edit}>
                    <Link href={`/admin/content/lessons/${lesson.id}`}>
                      <Pencil />
                    </Link>
                  </Button>
                  <ConfirmDialog
                    title={s.lessons.deleteTitle}
                    description={s.lessons.deleteBody}
                    confirmLabel={t.common.actions.delete}
                    destructive
                    onConfirm={() => remove(`/admin/content/lessons/${lesson.id}`)}
                  >
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label={t.common.actions.delete}
                      disabled={lesson.isPublished}
                    >
                      <Trash2 />
                    </Button>
                  </ConfirmDialog>
                </div>
              );
            }}
          />
        )}
        <div className="mt-2.5">
          <NewLessonDialog module={module} />
        </div>
      </div>
    </div>
  );
}
