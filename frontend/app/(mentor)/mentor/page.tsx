"use client";

import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  HelpCircle,
  Library,
  MessageSquare,
  NotebookPen,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { QuestionItem } from "@/components/learning/question-panel";
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHeader,
  PublishedBadge,
  StatusBadge,
} from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useMe } from "@/lib/auth";
import { t } from "@/lib/i18n";
import type { InboxQuestion, LessonType, TeachCourse } from "@/types/api";

const tm = t.learning.mentor;
const icons: Record<LessonType, typeof FileText> = {
  video: PlayCircle,
  article: FileText,
  quiz: HelpCircle,
  assignment: NotebookPen,
};

export default function MentorDashboard() {
  const { data: me } = useMe();
  const courses = useQuery({
    queryKey: ["teach", "courses"],
    queryFn: () => api<TeachCourse[]>("/teach/courses"),
  });
  const inbox = useQuery({
    queryKey: ["teach", "questions"],
    queryFn: () => api<InboxQuestion[]>("/teach/questions"),
  });

  return (
    <>
      <PageHeader
        title={t.student.dashboard.greeting(me?.user.fullName ?? "")}
        description={tm.subtitle}
      />
      <div className="grid gap-8 lg:grid-cols-5">
        <section className="space-y-4 lg:col-span-3">
          <h2 className="text-lg font-semibold">{tm.coursesTitle}</h2>
          {courses.isError && (
            <ErrorState error={courses.error} onRetry={() => courses.refetch()} />
          )}
          {courses.isLoading && <LoadingRows rows={3} />}
          {courses.data?.length === 0 && <EmptyState title={tm.noCourses} />}
          {courses.data?.map((course) => (
            <Card key={course.id}>
              <CardHeader>
                <CardTitle className="flex flex-wrap items-center gap-2">
                  {course.title} <PublishedBadge published={course.isPublished} />
                </CardTitle>
                <CardDescription>{course.trackTitle}</CardDescription>
                <Link
                  href={`/mentor/courses/${course.id}/questions`}
                  className="text-primary inline-flex w-fit items-center gap-1 text-sm font-medium hover:underline"
                >
                  <Library className="size-4" /> {t.teaching.nav.questionBank}
                </Link>
              </CardHeader>
              <CardContent className="space-y-4">
                {course.modules.map((m) => (
                  <div key={m.id}>
                    <p className="text-muted-foreground mb-1 text-xs font-medium">{m.title}</p>
                    <ul className="divide-y rounded-lg border">
                      {m.lessons.map((l) => {
                        const Icon = icons[l.type];
                        return (
                          <li key={l.id}>
                            <Link
                              href={`/mentor/lessons/${l.id}`}
                              className="hover:bg-muted/50 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm"
                            >
                              <Icon className="text-muted-foreground size-4 shrink-0" />
                              <span className="min-w-0 flex-1">{l.title}</span>
                              {l.type === "video" && (
                                <StatusBadge tone={l.hasVideo ? "success" : "warning"}>
                                  {l.hasVideo ? tm.hasVideo : tm.noVideo}
                                </StatusBadge>
                              )}
                              {l.attachmentCount > 0 && (
                                <span className="text-muted-foreground text-xs">
                                  {tm.files(l.attachmentCount)}
                                </span>
                              )}
                              {l.questionCount > 0 && (
                                <span className="text-muted-foreground text-xs">
                                  {tm.questions(l.questionCount)}
                                </span>
                              )}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-4 lg:col-span-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageSquare className="size-4" /> {tm.inboxTitle}
            {inbox.data && inbox.data.length > 0 && (
              <StatusBadge tone="warning">{inbox.data.length}</StatusBadge>
            )}
          </h2>
          {inbox.isLoading && <LoadingRows rows={2} />}
          {inbox.data?.length === 0 && <EmptyState title={tm.inboxEmpty} />}
          <ul className="space-y-4">
            {inbox.data?.map((q) => (
              <div key={q.id} className="space-y-1">
                <Link
                  href={`/mentor/lessons/${q.lesson.id}`}
                  className="text-muted-foreground hover:text-foreground block text-xs"
                >
                  {q.course.title} · {q.lesson.title}
                </Link>
                <QuestionItem question={q} lessonId={q.lesson.id} />
              </div>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
