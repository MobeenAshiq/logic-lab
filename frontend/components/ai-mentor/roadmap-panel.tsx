"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClock, CheckCircle2, Circle, Flame, Lock, Target } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/student/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { formatDuration } from "@/lib/learning";
import { cn } from "@/lib/utils";
import type { CourseOutline, LearningDashboard } from "@/types/api";

export type Outline = CourseOutline;

/** The module a student should be on: the first unlocked one with unfinished lessons. */
export function currentModule(outline: CourseOutline) {
  return (
    outline.modules.find((m) => !m.locked && m.lessons.some((l) => !l.completed)) ??
    outline.modules.find((m) => !m.locked) ??
    null
  );
}

/** Left panel: course picker, weekly stats, module roadmap and today's targets. */
export function RoadmapPanel({
  courseSlug,
  moduleId,
  onCourseChange,
  onModuleChange,
}: {
  courseSlug: string | null;
  moduleId: string | null;
  onCourseChange: (slug: string | null) => void;
  onModuleChange: (outline: CourseOutline, moduleId: string | null) => void;
}) {
  const dashboard = useQuery({ queryKey: ["student", "learning"], queryFn: () => api<LearningDashboard>("/student/learning") });
  const outline = useQuery({
    queryKey: ["learn", "course", courseSlug],
    queryFn: () => api<CourseOutline>(`/learn/courses/${courseSlug}`),
    enabled: !!courseSlug,
  });
  const courses = dashboard.data?.courses ?? [];
  const selected = outline.data?.modules.find((m) => m.id === moduleId) ?? null;
  const targets = (selected ?? (outline.data ? currentModule(outline.data) : null))?.lessons.filter((l) => !l.completed).slice(0, 3) ?? [];

  return (
    <aside className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border bg-card p-4" aria-label="Module roadmap">
      <div>
        <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Course</p>
        {dashboard.isLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : courses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Enrol in a course to get module-aware help. <Link href="/student/courses" className="text-primary underline">Browse courses</Link>
          </p>
        ) : (
          <Select value={courseSlug ?? "none"} onValueChange={(v) => onCourseChange(v === "none" ? null : v)}>
            <SelectTrigger className="w-full" aria-label="Course for this chat"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No course (general help)</SelectItem>
              {courses.map((c) => <SelectItem key={c.courseId} value={c.slug}>{c.title}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {dashboard.data && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={Flame} label="Streak" value={`${dashboard.data.streakDays}d`} />
          <Stat icon={CalendarClock} label="This week" value={formatDuration(dashboard.data.weekSeconds)} />
          <Stat icon={Target} label="Today" value={formatDuration(dashboard.data.todaySeconds)} />
        </div>
      )}

      {courseSlug && outline.isLoading && <Skeleton className="h-40 w-full" />}
      {outline.data && (
        <>
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="font-semibold">Progress</span>
              <span className="text-muted-foreground">{outline.data.completedLessons}/{outline.data.totalLessons} lessons</span>
            </div>
            <Progress value={outline.data.percent} />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Today&apos;s targets</p>
            {targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">All caught up in this module. 🎉</p>
            ) : (
              <ul className="space-y-1.5">
                {targets.map((l) => (
                  <li key={l.id}>
                    <Link href={`/student/lessons/${l.id}`} className="flex items-start gap-2 rounded-md p-1.5 text-sm hover:bg-muted">
                      <Circle className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span className="line-clamp-2">{l.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Roadmap</p>
            <button
              type="button"
              onClick={() => onModuleChange(outline.data, null)}
              className={cn("mb-1 w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", !moduleId && "bg-primary/10 font-medium text-primary")}
            >
              Whole course
            </button>
            <ol className="space-y-1">
              {outline.data.modules.map((m, i) => {
                const done = m.lessons.filter((l) => l.completed).length;
                const complete = m.lessons.length > 0 && done === m.lessons.length;
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      disabled={m.locked}
                      onClick={() => onModuleChange(outline.data, m.id)}
                      title={m.locked && m.unlockAfterTitle ? `Unlocks after ${m.unlockAfterTitle}` : undefined}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50",
                        moduleId === m.id && "bg-primary/10 font-medium text-primary",
                      )}
                    >
                      {m.locked ? <Lock className="mt-0.5 size-3.5 shrink-0" /> : complete ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" /> : <span className="mt-0.5 grid size-3.5 shrink-0 place-items-center text-[10px] font-bold">{i + 1}</span>}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2">{m.title}</span>
                        <span className="text-xs font-normal text-muted-foreground">{done}/{m.lessons.length} done</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </>
      )}
    </aside>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <Icon className="mx-auto mb-1 size-3.5 text-primary" />
      <p className="text-sm font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
