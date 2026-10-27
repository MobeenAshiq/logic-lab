"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileDown, Paperclip, Trash2, Upload, Video, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState, LoadingRows, Spinner } from "@/components/shared";
import { Progress } from "@/components/student/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { api, putToStorage } from "@/lib/api/client";
import { errorMessage, toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { formatClock } from "@/lib/learning";
import {
  ATTACHMENT_ACCEPT,
  attachmentContentType,
  MAX_ATTACHMENT_BYTES,
  MAX_VIDEO_BYTES,
  uploadLessonVideo,
  VIDEO_TYPES,
} from "@/lib/video-upload";
import type { TeachLesson, UploadTicket } from "@/types/api";

const tm = t.learning.media;

export const teachLessonKey = (id: string) => ["teach", "lesson", id] as const;

function formatBytes(n: number) {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

/** Video, notes and downloads of one lesson. Used by mentors and in the admin lesson editor. */
export function LessonMediaEditor({ lessonId }: { lessonId: string }) {
  const lesson = useQuery({
    queryKey: teachLessonKey(lessonId),
    queryFn: () => api<TeachLesson>(`/teach/lessons/${lessonId}`),
  });

  if (lesson.isError) return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  if (!lesson.data) return <LoadingRows rows={3} />;
  return (
    <div className="space-y-6">
      <VideoCard lesson={lesson.data} />
      <NotesCard lesson={lesson.data} />
      <AttachmentsCard lesson={lesson.data} />
    </div>
  );
}

function useLessonUpdater(lessonId: string) {
  const queryClient = useQueryClient();
  return (updated: TeachLesson) => {
    queryClient.setQueryData(teachLessonKey(lessonId), updated);
    void queryClient.invalidateQueries({ queryKey: ["teach", "courses"] });
  };
}

function VideoCard({ lesson }: { lesson: TeachLesson }) {
  const setLesson = useLessonUpdater(lesson.id);
  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isVideoLesson = lesson.type === "video";

  const remove = useMutation({
    mutationFn: () => api<TeachLesson>(`/teach/lessons/${lesson.id}/video`, { method: "DELETE" }),
    onSuccess: setLesson,
    onError: toastError,
  });

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    setError(null);
    if (!VIDEO_TYPES.includes(file.type)) return setError(tm.wrongType);
    if (file.size > MAX_VIDEO_BYTES) return setError(tm.tooBig);
    abort.current = new AbortController();
    setProgress(0);
    try {
      const updated = await uploadLessonVideo(lesson.id, file, {
        onProgress: setProgress,
        signal: abort.current.signal,
      });
      setLesson(updated);
      toast.success(tm.uploaded);
    } catch (err) {
      if (abort.current?.signal.aborted) toast.message(tm.cancelled);
      else setError(errorMessage(err));
    } finally {
      setProgress(null);
      abort.current = null;
    }
  };

  const uploading = progress !== null;
  const pct = Math.round((progress ?? 0) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="size-4" /> {tm.videoTitle}
        </CardTitle>
        <CardDescription>{tm.videoHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isVideoLesson && (
          <Alert>
            <AlertDescription>{tm.videoOnlyForVideoLessons}</AlertDescription>
          </Alert>
        )}
        {lesson.video && !uploading && (
          <div className="space-y-2">
            <video
              src={lesson.video.url}
              controls
              preload="metadata"
              className="aspect-video w-full rounded-lg border bg-black"
            />
            <p className="text-muted-foreground text-xs">
              {lesson.durationSeconds ? tm.duration(formatClock(lesson.durationSeconds)) : null}
              {lesson.video.size ? ` · ${formatBytes(lesson.video.size)}` : null}
            </p>
          </div>
        )}
        {uploading && (
          <div className="space-y-2">
            <p className="text-sm">{pct >= 100 ? tm.finishing : tm.uploading(pct)}</p>
            <Progress value={pct} />
            <Button size="sm" variant="outline" onClick={() => abort.current?.abort()}>
              <X /> {tm.cancel}
            </Button>
          </div>
        )}
        {error && <p className="text-destructive text-sm">{error}</p>}
        {isVideoLesson && !uploading && (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              type="file"
              accept={VIDEO_TYPES.join(",")}
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <Button size="sm" onClick={() => input.current?.click()}>
              <Upload /> {lesson.video ? tm.replaceVideo : tm.chooseVideo}
            </Button>
            {lesson.video && (
              <ConfirmDialog
                title={tm.deleteVideo}
                description={tm.deleteVideoConfirm}
                destructive
                confirmLabel={t.common.actions.remove}
                onConfirm={() => remove.mutateAsync()}
              >
                <Button size="sm" variant="destructive">
                  <Trash2 /> {tm.deleteVideo}
                </Button>
              </ConfirmDialog>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function NotesCard({ lesson }: { lesson: TeachLesson }) {
  const setLesson = useLessonUpdater(lesson.id);
  const [notes, setNotes] = useState(lesson.notes);
  const save = useMutation({
    mutationFn: () =>
      api<TeachLesson>(`/teach/lessons/${lesson.id}`, { method: "PATCH", body: { notes } }),
    onSuccess: (updated) => {
      setLesson(updated);
      toast.success(tm.notesSaved);
    },
    onError: toastError,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tm.notesTitle}</CardTitle>
        <CardDescription>{tm.notesHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={6}
          maxLength={20_000}
        />
        <Button
          size="sm"
          disabled={save.isPending || notes === lesson.notes}
          onClick={() => save.mutate()}
        >
          {save.isPending && <Spinner />}
          {tm.saveNotes}
        </Button>
      </CardContent>
    </Card>
  );
}

function AttachmentsCard({ lesson }: { lesson: TeachLesson }) {
  const setLesson = useLessonUpdater(lesson.id);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const remove = useMutation({
    mutationFn: (attachmentId: string) =>
      api<TeachLesson>(`/teach/lessons/${lesson.id}/attachments/${attachmentId}`, {
        method: "DELETE",
      }),
    onSuccess: setLesson,
    onError: toastError,
  });

  const onFile = async (file: File | undefined) => {
    if (input.current) input.current.value = "";
    if (!file) return;
    const contentType = attachmentContentType(file);
    if (!contentType) return toast.error(tm.fileType);
    if (file.size > MAX_ATTACHMENT_BYTES) return toast.error(tm.fileTooBig);
    setBusy(true);
    try {
      const ticket = await api<UploadTicket>(`/teach/lessons/${lesson.id}/attachments/upload-url`, {
        method: "POST",
        body: { filename: file.name, contentType, size: file.size },
      });
      await putToStorage(ticket, file);
      setLesson(
        await api<TeachLesson>(`/teach/lessons/${lesson.id}/attachments`, {
          method: "POST",
          body: { key: ticket.key, filename: file.name },
        }),
      );
      toast.success(tm.fileAdded);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Paperclip className="size-4" /> {tm.attachmentsTitle}
        </CardTitle>
        <CardDescription>{tm.attachmentsHint}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {lesson.attachments.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {lesson.attachments.map((a) => (
              <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <FileDown className="text-muted-foreground size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{a.filename}</span>
                <span className="text-muted-foreground text-xs">{formatBytes(a.size)}</span>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={tm.deleteFile}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(a.id)}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <input
          ref={input}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          className="sr-only"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <Button size="sm" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Spinner /> : <Upload />} {tm.addFile}
        </Button>
      </CardContent>
    </Card>
  );
}
