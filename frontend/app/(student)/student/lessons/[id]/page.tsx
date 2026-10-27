"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  Lock,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { AssignmentPanel } from "@/components/assessments/assignment-panel";
import { QuizPanel } from "@/components/assessments/quiz-panel";
import { QuestionPanel } from "@/components/learning/question-panel";
import { VideoPlayer, type VideoPlayerHandle } from "@/components/learning/video-player";
import { LessonViewer } from "@/components/rich-text/lesson-viewer";
import { EmptyState, ErrorState, LoadingRows, Spinner, StatusBadge } from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { learningKeys, useProgressReporter } from "@/lib/learning";
import type { LearnLesson, LessonProgress } from "@/types/api";

const tl = t.learning.lesson;

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const lesson = useQuery({
    queryKey: learningKeys.lesson(id),
    queryFn: () => api<LearnLesson>(`/learn/lessons/${id}`),
    // Signed media URLs are short-lived: never show a cached one from long ago.
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  if (lesson.error instanceof ApiError) {
    const body = lesson.error.body;
    const courseSlug = body.courseSlug as string | undefined;
    if (lesson.error.code === "SUBSCRIPTION_REQUIRED") {
      return (
        <Blocked
          title={t.student.lesson.paywallTitle}
          body={t.student.lesson.paywallBody}
          primary={{
            href: (body.paywallUrl as string | undefined) ?? "/student/billing",
            label: t.student.lesson.paywallCta,
          }}
          courseSlug={courseSlug}
        />
      );
    }
    if (lesson.error.code === "MODULE_LOCKED") {
      return (
        <Blocked
          title={tl.lockedTitle}
          body={tl.lockedBody((body.unlockAfter as string | null) ?? null)}
          primary={
            courseSlug
              ? { href: `/student/courses/${courseSlug}`, label: tl.viewCourse }
              : undefined
          }
        />
      );
    }
  }
  if (lesson.isError) return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  if (!lesson.data) return <LoadingRows rows={6} />;
  return <LessonView key={lesson.data.id} lesson={lesson.data} />;
}

function Blocked({
  title,
  body,
  primary,
  courseSlug,
}: {
  title: string;
  body: string;
  primary?: { href: string; label: string };
  courseSlug?: string;
}) {
  return (
    <Card className="mx-auto mt-8 max-w-lg text-center">
      <CardHeader>
        <Lock className="text-primary mx-auto size-8" />
        <CardTitle className="mt-2">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col justify-center gap-2 sm:flex-row">
        {primary && (
          <Button asChild>
            <Link href={primary.href}>{primary.label}</Link>
          </Button>
        )}
        {courseSlug && (
          <Button variant="outline" asChild>
            <Link href={`/courses/${courseSlug}`}>{t.student.lesson.backToCourse}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function LessonView({ lesson: l }: { lesson: LearnLesson }) {
  const queryClient = useQueryClient();
  const player = useRef<VideoPlayerHandle>(null);
  const readSeconds = useRef(0);
  const isVideo = l.type === "video";
  const tracking = l.progress !== null;

  // Articles: count the time the page is actually visible.
  useEffect(() => {
    if (!tracking || isVideo) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") readSeconds.current += 1;
    }, 1000);
    return () => clearInterval(timer);
  }, [tracking, isVideo]);

  useProgressReporter(
    l.id,
    tracking,
    () => {
      if (isVideo) {
        return player.current?.takeProgress() ?? { positionSeconds: 0, watchedDelta: 0 };
      }
      const delta = readSeconds.current;
      readSeconds.current = 0;
      return { positionSeconds: 0, watchedDelta: delta };
    },
    l.course.slug,
  );

  const complete = useMutation({
    mutationFn: () => api<LessonProgress>(`/learn/lessons/${l.id}/complete`, { method: "POST" }),
    onSuccess: (progress) => {
      queryClient.setQueryData<LearnLesson>(learningKeys.lesson(l.id), (old) =>
        old ? { ...old, progress } : old,
      );
      void queryClient.invalidateQueries({ queryKey: learningKeys.outline(l.course.slug) });
      void queryClient.invalidateQueries({ queryKey: learningKeys.dashboard });
    },
    onError: toastError,
  });

  const done = l.progress?.completed ?? false;

  return (
    <article className="mx-auto max-w-4xl">
      <Link
        href={`/student/courses/${l.course.slug}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {l.course.title}
      </Link>
      <p className="text-muted-foreground mt-6 text-sm">{l.module.title}</p>
      <div className="mt-1 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{l.title}</h1>
        <Badge variant="secondary">{t.common.lessonTypes[l.type]}</Badge>
        {done && (
          <StatusBadge tone="success">
            <CheckCircle2 className="size-3" /> {tl.completed}
          </StatusBadge>
        )}
      </div>

      {l.isStaff && (
        <Alert className="mt-4">
          <AlertDescription>{tl.preview}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6">
        {isVideo &&
          (l.video ? (
            <VideoPlayer
              ref={player}
              lessonId={l.id}
              media={l.video}
              startAt={l.progress?.positionSeconds ?? 0}
              watermark={l.watermark}
            />
          ) : (
            <div className="bg-muted/40 text-muted-foreground grid aspect-video place-items-center rounded-xl border text-center text-sm">
              <div>
                <PlayCircle className="mx-auto mb-2 size-10" />
                {t.learning.player.noVideo}
              </div>
            </div>
          ))}
        {l.type === "article" &&
          (l.content ? (
            <LessonViewer content={l.content} assetUrls={l.assetUrls} />
          ) : (
            <EmptyState title={t.student.lesson.empty} />
          ))}
        {l.type === "quiz" && <QuizPanel lessonId={l.id} isStaff={l.isStaff} />}
        {l.type === "assignment" && (
          <AssignmentPanel lessonId={l.id} courseSlug={l.course.slug} isStaff={l.isStaff} />
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 border-y py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          {tracking && !done && isVideo && (
            <span className="text-muted-foreground">{tl.autoComplete}</span>
          )}
          {tracking && !done && l.type === "article" && (
            <Button size="sm" onClick={() => complete.mutate()} disabled={complete.isPending}>
              {complete.isPending ? <Spinner /> : <CheckCircle2 />}
              {tl.markComplete}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {l.previousLessonId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/student/lessons/${l.previousLessonId}`}>
                <ArrowLeft /> {tl.previous}
              </Link>
            </Button>
          )}
          {l.nextLessonId && (
            <Button size="sm" asChild>
              <Link href={`/student/lessons/${l.nextLessonId}`}>
                {tl.next} <ArrowRight />
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="questions" className="mt-6">
        <TabsList>
          <TabsTrigger value="questions">{tl.questions}</TabsTrigger>
          <TabsTrigger value="notes">{tl.notes}</TabsTrigger>
          <TabsTrigger value="resources">
            {tl.resources}
            {l.attachments.length > 0 && ` (${l.attachments.length})`}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="pt-4">
          <QuestionPanel
            lessonId={l.id}
            currentTime={isVideo && l.video ? () => player.current?.currentTime() ?? 0 : undefined}
            onSeek={isVideo && l.video ? (s) => player.current?.seek(s) : undefined}
          />
        </TabsContent>
        <TabsContent value="notes" className="pt-4">
          {l.notes ? (
            <p className="text-sm leading-7 whitespace-pre-line">{l.notes}</p>
          ) : (
            <p className="text-muted-foreground text-sm">{tl.noNotes}</p>
          )}
        </TabsContent>
        <TabsContent value="resources" className="pt-4">
          <Resources lesson={l} />
        </TabsContent>
      </Tabs>
    </article>
  );
}

function Resources({ lesson }: { lesson: LearnLesson }) {
  if (lesson.attachments.length === 0) {
    return <p className="text-muted-foreground text-sm">{tl.noResources}</p>;
  }
  const download = async (attachmentId: string) => {
    try {
      const { url } = await api<{ url: string }>(`/learn/attachments/${attachmentId}`);
      window.location.assign(url);
    } catch (err) {
      toastError(err);
    }
  };
  return (
    <ul className="divide-y rounded-xl border">
      {lesson.attachments.map((a) => (
        <li key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
          <FileText className="text-muted-foreground size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{a.filename}</span>
          <Button size="sm" variant="outline" onClick={() => void download(a.id)}>
            <Download /> {t.common.actions.download}
          </Button>
        </li>
      ))}
    </ul>
  );
}
