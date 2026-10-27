"use client";

import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Circle,
  FileText,
  HelpCircle,
  Lock,
  NotebookPen,
  PlayCircle,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ErrorState, LoadingRows, PageHeader } from "@/components/shared";
import { Progress } from "@/components/student/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { formatDuration, learningKeys } from "@/lib/learning";
import { cn } from "@/lib/utils";
import type { CourseOutline, LessonType } from "@/types/api";

const tc = t.learning.course;
const icons: Record<LessonType, typeof FileText> = {
  video: PlayCircle,
  article: FileText,
  quiz: HelpCircle,
  assignment: NotebookPen,
};

export default function CourseProgressPage() {
  const { slug } = useParams<{ slug: string }>();
  const outline = useQuery({
    queryKey: learningKeys.outline(slug),
    queryFn: () => api<CourseOutline>(`/learn/courses/${slug}`),
  });

  if (outline.isError)
    return <ErrorState error={outline.error} onRetry={() => outline.refetch()} />;
  if (!outline.data) return <LoadingRows rows={5} />;
  const c = outline.data;
  // The first lesson that is open and not done yet.
  const next = c.modules
    .filter((m) => !m.locked)
    .flatMap((m) => m.lessons)
    .find((l) => !l.completed);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={c.title}
        description={c.track.title}
        actions={
          c.hasAccess && next ? (
            <Button asChild>
              <Link href={`/student/lessons/${next.id}`}>
                {next.positionSeconds > 0 ? tc.continue : tc.start}
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="mb-8 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">
            {tc.progress(c.completedLessons, c.totalLessons)}
          </span>
          <span className="font-medium">{c.percent}%</span>
        </div>
        <Progress value={c.percent} />
      </div>

      {!c.hasAccess && (
        <Alert className="mb-6">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            {tc.noAccess}
            <Button size="sm" asChild>
              <Link href="/student/billing">{tc.seePlans}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {c.modules.map((m, i) => (
          <section key={m.id} className={cn("rounded-xl border", m.locked && "bg-muted/30")}>
            <header className="flex items-center justify-between gap-2 border-b px-5 py-3">
              <p className="text-sm font-medium">
                {i + 1}. {m.title}
              </p>
              {m.locked && (
                <span className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Lock className="size-3" /> {tc.locked(m.unlockAfterTitle)}
                </span>
              )}
            </header>
            <ul className="divide-y">
              {m.lessons.map((l) => {
                const Icon = icons[l.type];
                const disabled = m.locked || !c.hasAccess;
                const row = (
                  <>
                    {l.completed ? (
                      <CheckCircle2 className="text-success size-4 shrink-0" />
                    ) : (
                      <Circle className="text-muted-foreground/50 size-4 shrink-0" />
                    )}
                    <Icon className="text-muted-foreground size-4 shrink-0" />
                    <span className="flex-1">{l.title}</span>
                    {l.durationSeconds ? (
                      <span className="text-muted-foreground text-xs">
                        {formatDuration(l.durationSeconds)}
                      </span>
                    ) : null}
                  </>
                );
                return (
                  <li key={l.id}>
                    {disabled ? (
                      <div className="text-muted-foreground flex items-center gap-3 px-5 py-3 text-sm">
                        {row}
                      </div>
                    ) : (
                      <Link
                        href={`/student/lessons/${l.id}`}
                        className="hover:bg-muted/50 flex items-center gap-3 px-5 py-3 text-sm transition-colors"
                      >
                        {row}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
