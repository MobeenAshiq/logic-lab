"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, ImagePlus, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MAX_UPLOAD_BYTES, uploadFile } from "@/lib/upload";
import type { AdminCourse, AdminTrack } from "@/types/api";
import { type CourseForm, courseFormSchema, LEVELS } from "./schemas";

const s = t.adminContent.course;
const COVER_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function CourseDetailsCard({ course }: { course: AdminCourse }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(course.coverImageUrl);

  const tracks = useQuery({
    queryKey: ["admin", "tracks"],
    queryFn: () => api<AdminTrack[]>("/admin/content/tracks"),
  });

  const form = useForm<CourseForm>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: toForm(course),
  });

  useEffect(() => {
    form.reset(toForm(course));
    setPreview(course.coverImageUrl);
  }, [course, form]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "course", course.id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "tracks"] });
  };

  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api<AdminCourse>(`/admin/content/courses/${course.id}`, { method: "PATCH", body }),
    onSuccess: (updated) => {
      queryClient.setQueryData(["admin", "course", course.id], updated);
      refresh();
    },
  });

  function save(values: CourseForm) {
    patch.mutate(values, {
      onSuccess: () => toast.success(t.adminContent.saved),
      onError: (err) => applyFormErrors(err, form.setError),
    });
  }

  function setPublished(isPublished: boolean) {
    patch.mutate(
      { isPublished },
      {
        onSuccess: () =>
          toast.success(
            isPublished ? t.adminContent.publishedToast : t.adminContent.unpublishedToast,
          ),
        onError: toastError,
      },
    );
  }

  async function onCoverSelected(file: File | undefined) {
    if (!file) return;
    if (!COVER_TYPES.includes(file.type)) return toast.error(t.adminContent.editor.imageType);
    if (file.size > MAX_UPLOAD_BYTES) return toast.error(t.adminContent.editor.imageSize);
    setUploading(true);
    try {
      const key = await uploadFile("/admin/uploads", file, { purpose: "course-cover" });
      setPreview(URL.createObjectURL(file));
      await patch.mutateAsync({ coverImageKey: key });
      toast.success(t.adminContent.saved);
    } catch (err) {
      toastError(err);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeCover() {
    try {
      await patch.mutateAsync({ coverImageKey: null });
      setPreview(null);
    } catch (err) {
      toastError(err);
    }
  }

  async function deleteCourse() {
    try {
      await api(`/admin/content/courses/${course.id}`, { method: "DELETE" });
      toast.success(t.adminContent.deleted);
      void queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "tracks"] });
      router.push("/admin/content");
    } catch (err) {
      toastError(err);
    }
  }

  const f = s.fields;
  const { errors } = form.formState;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">{s.details}</CardTitle>
        {course.isPublished && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/courses/${course.slug}`} target="_blank">
              <ExternalLink /> {s.viewPublic}
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-6">
        <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
          <div>
            <Label htmlFor="course-published">{f.published}</Label>
            <p className="text-muted-foreground mt-0.5 text-xs">{f.publishedHint}</p>
          </div>
          <Switch
            id="course-published"
            checked={course.isPublished}
            disabled={patch.isPending}
            onCheckedChange={setPublished}
          />
        </div>

        <div className="grid gap-2">
          <Label>{f.cover}</Label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="bg-muted grid aspect-video w-full max-w-60 place-items-center overflow-hidden rounded-xl border">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed R2 URL
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="text-muted-foreground size-6" />
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept={COVER_TYPES.join(",")}
                className="hidden"
                onChange={(e) => void onCoverSelected(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? <Spinner /> : <ImagePlus />}
                {uploading ? s.uploading : preview ? f.changeCover : f.uploadCover}
              </Button>
              {preview && !uploading && (
                <Button type="button" variant="ghost" size="sm" onClick={() => void removeCover()}>
                  <X /> {f.removeCover}
                </Button>
              )}
            </div>
          </div>
          <p className="text-muted-foreground text-xs">{f.coverHint}</p>
        </div>

        <form onSubmit={form.handleSubmit(save)} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={f.title} htmlFor="c-title" error={errors.title?.message}>
              <Input id="c-title" {...form.register("title")} />
            </Field>
            <Field label={f.slug} htmlFor="c-slug" error={errors.slug?.message}>
              <Input id="c-slug" {...form.register("slug")} />
            </Field>
            <Field label={f.track} error={errors.trackId?.message}>
              <Controller
                control={form.control}
                name="trackId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(tracks.data ?? [course.track]).map((tr) => (
                        <SelectItem key={tr.id} value={tr.id}>
                          {tr.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label={f.level} error={errors.level?.message}>
              <Controller
                control={form.control}
                name="level"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LEVELS.map((l) => (
                        <SelectItem key={l} value={l}>
                          {t.common.levels[l]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </div>
          <Field
            label={f.shortDescription}
            htmlFor="c-short"
            error={errors.shortDescription?.message}
            hint={f.shortDescriptionHint}
          >
            <Textarea id="c-short" rows={2} {...form.register("shortDescription")} />
          </Field>
          <Field label={f.description} htmlFor="c-desc" error={errors.description?.message}>
            <Textarea id="c-desc" rows={6} {...form.register("description")} />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <ConfirmDialog
              title={s.deleteTitle}
              description={s.deleteBody}
              confirmLabel={t.common.actions.delete}
              destructive
              onConfirm={deleteCourse}
            >
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={course.isPublished}
                title={course.isPublished ? s.deleteDisabled : undefined}
              >
                <Trash2 /> {t.common.actions.delete}
              </Button>
            </ConfirmDialog>
            <Button type="submit" disabled={patch.isPending || !form.formState.isDirty}>
              {patch.isPending ? t.common.actions.saving : t.common.actions.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function toForm(c: AdminCourse): CourseForm {
  return {
    title: c.title,
    slug: c.slug,
    trackId: c.trackId,
    level: c.level,
    shortDescription: c.shortDescription,
    description: c.description,
  };
}
