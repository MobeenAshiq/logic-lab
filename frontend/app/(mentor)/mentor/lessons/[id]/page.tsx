"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LessonMediaEditor, teachLessonKey } from "@/components/learning/lesson-media-editor";
import { QuestionPanel } from "@/components/learning/question-panel";
import { ErrorState, LoadingRows, PageHeader, PublishedBadge } from "@/components/shared";
import { AssignmentBuilder } from "@/components/teaching/assignment-builder";
import { AiQuestionDrafts } from "@/components/teaching/ai-question-drafts";
import { QuizBuilder } from "@/components/teaching/quiz-builder";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { TeachLesson } from "@/types/api";

export default function MentorLessonPage() {
  const { id } = useParams<{ id: string }>();
  const lesson = useQuery({
    queryKey: teachLessonKey(id),
    queryFn: () => api<TeachLesson>(`/teach/lessons/${id}`),
  });

  if (lesson.isError) return <ErrorState error={lesson.error} onRetry={() => lesson.refetch()} />;
  if (!lesson.data) return <LoadingRows rows={4} />;
  const l = lesson.data;

  return (
    <>
      <Link
        href="/mentor"
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm"
      >
        <ArrowLeft className="size-4" /> {l.course.title}
      </Link>
      <PageHeader
        title={l.title}
        description={l.module.title}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{t.common.lessonTypes[l.type]}</Badge>
            <PublishedBadge published={l.isPublished} />
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <AiQuestionDrafts lessonId={l.id} courseId={l.course.id} />
          {l.type === "quiz" && (
            <QuizBuilder lessonId={l.id} bankHref={(c) => `/mentor/courses/${c}/questions`} />
          )}
          {l.type === "assignment" && <AssignmentBuilder lessonId={l.id} />}
          <LessonMediaEditor lessonId={l.id} />
        </div>
        <Card className="h-fit lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.learning.lesson.questions}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionPanel lessonId={l.id} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
