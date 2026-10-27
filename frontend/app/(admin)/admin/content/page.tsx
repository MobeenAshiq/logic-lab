"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { NewCourseDialog } from "@/components/admin/content/new-course-dialog";
import { DragHandle, SortableList } from "@/components/admin/content/sortable-list";
import { TrackDialog } from "@/components/admin/content/track-dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PublishedBadge,
  StatusBadge,
} from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AdminCourseListItem, AdminTrack } from "@/types/api";

const s = t.adminContent;

export default function ContentPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ open: boolean; track: AdminTrack | null }>({
    open: false,
    track: null,
  });

  const tracks = useQuery({
    queryKey: ["admin", "tracks"],
    queryFn: () => api<AdminTrack[]>("/admin/content/tracks"),
  });
  const selected = tracks.data?.find((tr) => tr.id === selectedId) ?? tracks.data?.[0] ?? null;

  const courses = useQuery({
    queryKey: ["admin", "courses", selected?.id],
    queryFn: () =>
      api<AdminCourseListItem[]>("/admin/content/courses", { query: { trackId: selected!.id } }),
    enabled: !!selected,
  });

  const refreshTracks = () => queryClient.invalidateQueries({ queryKey: ["admin", "tracks"] });
  const refreshCourses = () => queryClient.invalidateQueries({ queryKey: ["admin", "courses"] });

  const reorderTracks = useMutation({
    mutationFn: (ids: string[]) =>
      api("/admin/content/tracks/order", { method: "PUT", body: { ids } }),
    onSuccess: () => toast.success(s.reordered),
    onError: toastError,
    onSettled: () => refreshTracks(),
  });

  const reorderCourses = useMutation({
    mutationFn: (ids: string[]) =>
      api(`/admin/content/tracks/${selected!.id}/courses/order`, { method: "PUT", body: { ids } }),
    onSuccess: () => toast.success(s.reordered),
    onError: toastError,
    onSettled: () => refreshCourses(),
  });

  const publishTrack = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api(`/admin/content/tracks/${id}`, { method: "PATCH", body: { isPublished } }),
    onSuccess: (_d, v) => toast.success(v.isPublished ? s.publishedToast : s.unpublishedToast),
    onError: toastError,
    onSettled: () => refreshTracks(),
  });

  const publishCourse = useMutation({
    mutationFn: ({ id, isPublished }: { id: string; isPublished: boolean }) =>
      api(`/admin/content/courses/${id}`, { method: "PATCH", body: { isPublished } }),
    onSuccess: (_d, v) => toast.success(v.isPublished ? s.publishedToast : s.unpublishedToast),
    onError: toastError,
    onSettled: () => refreshCourses(),
  });

  async function deleteTrack(id: string) {
    try {
      await api(`/admin/content/tracks/${id}`, { method: "DELETE" });
      toast.success(s.deleted);
      if (selectedId === id) setSelectedId(null);
      await refreshTracks();
    } catch (err) {
      toastError(err);
    }
  }

  return (
    <>
      <PageHeader
        title={s.tracks.title}
        description={s.tracks.description}
        actions={
          <Button onClick={() => setDialog({ open: true, track: null })}>
            <Plus /> {s.tracks.new}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section>
          <h2 className="text-muted-foreground mb-3 text-sm font-semibold">{s.tracks.heading}</h2>
          {tracks.isLoading ? (
            <LoadingRows rows={3} />
          ) : tracks.isError ? (
            <ErrorState error={tracks.error} onRetry={() => tracks.refetch()} />
          ) : !tracks.data?.length ? (
            <EmptyState title={s.tracks.empty} />
          ) : (
            <SortableList
              items={tracks.data}
              onReorder={(ids) => reorderTracks.mutate(ids)}
              renderItem={(track, handle) => (
                <div
                  className={cn(
                    "bg-card flex items-center gap-2 rounded-xl border p-2 pr-3 transition-colors",
                    selected?.id === track.id && "border-primary/50 bg-primary/5",
                  )}
                >
                  <DragHandle {...handle} />
                  <button
                    type="button"
                    onClick={() => setSelectedId(track.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate text-sm font-medium">{track.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {s.tracks.courseCount(track._count.courses)}
                    </p>
                  </button>
                  <Switch
                    checked={track.isPublished}
                    aria-label={t.common.published}
                    onCheckedChange={(isPublished) =>
                      publishTrack.mutate({ id: track.id, isPublished })
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t.common.actions.edit}
                    onClick={() => setDialog({ open: true, track })}
                  >
                    <Pencil />
                  </Button>
                  <ConfirmDialog
                    title={s.tracks.deleteTitle}
                    description={s.tracks.deleteBody}
                    confirmLabel={t.common.actions.delete}
                    destructive
                    onConfirm={() => deleteTrack(track.id)}
                  >
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t.common.actions.delete}
                      disabled={track._count.courses > 0}
                    >
                      <Trash2 />
                    </Button>
                  </ConfirmDialog>
                </div>
              )}
            />
          )}
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">
              {selected ? s.courses.heading(selected.title) : s.courses.selectTrack}
            </CardTitle>
            {selected && <NewCourseDialog trackId={selected.id} />}
          </CardHeader>
          <CardContent>
            {!selected ? null : courses.isLoading ? (
              <LoadingRows rows={3} />
            ) : courses.isError ? (
              <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
            ) : !courses.data?.length ? (
              <EmptyState title={s.courses.empty} />
            ) : (
              <SortableList
                items={courses.data}
                onReorder={(ids) => reorderCourses.mutate(ids)}
                renderItem={(course, handle) => (
                  <div className="bg-background flex items-center gap-2 rounded-xl border p-2 pr-3">
                    <DragHandle {...handle} />
                    <Link
                      href={`/admin/content/courses/${course.id}`}
                      className="group min-w-0 flex-1"
                    >
                      <p className="group-hover:text-primary truncate text-sm font-medium">
                        {course.title}
                      </p>
                      <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                        <StatusBadge>{t.common.levels[course.level]}</StatusBadge>
                        <span>{s.courses.modules(course._count.modules)}</span>
                        <span aria-hidden>·</span>
                        <span>{s.courses.mentors(course._count.mentors)}</span>
                      </div>
                    </Link>
                    <div className="hidden sm:block">
                      <PublishedBadge published={course.isPublished} />
                    </div>
                    <Switch
                      checked={course.isPublished}
                      aria-label={t.common.published}
                      onCheckedChange={(isPublished) =>
                        publishCourse.mutate({ id: course.id, isPublished })
                      }
                    />
                    <Button variant="ghost" size="icon-sm" asChild aria-label={s.courses.open}>
                      <Link href={`/admin/content/courses/${course.id}`}>
                        <ChevronRight />
                      </Link>
                    </Button>
                  </div>
                )}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <TrackDialog
        open={dialog.open}
        track={dialog.track}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
      />
    </>
  );
}
