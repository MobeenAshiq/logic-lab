import { CalendarClock, Flame, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Progress } from "@/components/student/progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { t } from "@/lib/i18n";
import { formatClock, formatDuration } from "@/lib/learning";
import type { LearningDashboard } from "@/types/api";

const td = t.learning.dashboard;

/** Continue-learning card, streak, weekly time and per-course progress. */
export function LearningOverview({ data }: { data: LearningDashboard }) {
  const c = data.continueLearning;
  return (
    <section className="mb-8 space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        {c ? (
          <Card className="border-primary/40 md:col-span-2">
            <CardHeader>
              <CardDescription>{td.continueTitle}</CardDescription>
              <CardTitle>{c.lessonTitle}</CardTitle>
              <CardDescription>{c.courseTitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href={`/student/lessons/${c.lessonId}`}>
                  <PlayCircle />
                  {c.positionSeconds > 5 && !c.completed
                    ? td.continueAt(formatClock(c.positionSeconds))
                    : t.learning.course.continue}
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardDescription>{td.continueTitle}</CardDescription>
              <CardTitle className="text-muted-foreground text-base font-normal">
                {td.noProgress}
              </CardTitle>
            </CardHeader>
          </Card>
        )}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-1">
          <Stat icon={Flame} label={td.streak} value={td.streakDays(data.streakDays)} />
          <Stat
            icon={CalendarClock}
            label={td.week}
            value={formatDuration(data.weekSeconds)}
            hint={`${td.today}: ${formatDuration(data.todaySeconds)}`}
          />
        </div>
      </div>

      {data.courses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{td.progressTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.courses.map((course) => (
              <Link
                key={course.courseId}
                href={`/student/courses/${course.slug}`}
                className="hover:bg-muted/50 -mx-2 block space-y-1.5 rounded-lg p-2 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="font-medium">{course.title}</span>
                  <span className="text-muted-foreground">{course.percent}%</span>
                </div>
                <Progress value={course.percent} />
                <p className="text-muted-foreground text-xs">
                  {t.learning.course.progress(course.completedLessons, course.totalLessons)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </section>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Icon className="text-primary size-3.5" /> {label}
        </p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
        {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
      </CardContent>
    </Card>
  );
}
