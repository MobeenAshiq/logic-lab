import { BookOpen, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TRACK_ART, TRACK_THEMES } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CourseLevel } from "@/types/api";

export interface CourseCardProps {
  course: {
    id: string;
    slug: string;
    title: string;
    shortDescription?: string;
    level: CourseLevel;
    track: { slug: string; title: string };
    coverImageUrl?: string | null;
    lessonCount?: number;
    durationMinutes?: number;
    mentor?: { name: string; avatarUrl?: string | null };
    progress?: number; // 0 to 100 if enrolled
  };
  href?: string;
  className?: string;
}

export function CourseCard({ course, href, className }: CourseCardProps) {
  const trackTheme = TRACK_THEMES[course.track.slug] ?? {
    badge: "bg-primary/10 text-primary border-primary/20",
    color: "text-primary",
  };
  const art = TRACK_ART[course.track.slug];

  return (
    <Link href={href ?? `/courses/${course.slug}`} className={cn("group block h-full", className)}>
      <Card className="card-hover border-border bg-card group-hover:border-primary/50 flex h-full flex-col overflow-hidden rounded-xl pt-0 transition-all">
        {/* Course Thumbnail */}
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
          {course.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.coverImageUrl}
              alt={course.title}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : art ? (
            <Image
              src={art.src}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="from-primary/15 to-primary/5 flex size-full items-center justify-center bg-gradient-to-br">
              <span className="font-heading text-lg font-bold text-primary">
                {course.title.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        <CardContent className="flex flex-1 flex-col p-5">
          {/* Tags row: Track tag with track-specific color + level badge */}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                trackTheme.badge,
              )}
            >
              {course.track.title}
            </span>
            <Badge variant="outline" className="border-border text-muted-foreground text-xs font-medium">
              {t.common.levels[course.level]}
            </Badge>
          </div>

          {/* Title */}
          <h3 className="font-heading text-foreground group-hover:text-primary mt-3 text-base font-bold tracking-tight transition-colors line-clamp-1">
            {course.title}
          </h3>

          {/* Short description */}
          {course.shortDescription && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed">
              {course.shortDescription}
            </p>
          )}

          <div className="mt-auto pt-4">
            {/* Mentor info (if provided) */}
            {course.mentor && (
              <div className="mb-3 flex items-center gap-2">
                <Avatar className="size-6">
                  {course.mentor.avatarUrl && <AvatarImage src={course.mentor.avatarUrl} />}
                  <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                    {course.mentor.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-muted-foreground truncate text-xs font-medium">
                  {course.mentor.name}
                </span>
              </div>
            )}

            {/* Progress bar (if enrolled) */}
            {typeof course.progress === "number" && (
              <div className="mb-3">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="text-primary font-semibold">{Math.round(course.progress)}%</span>
                </div>
                <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, Math.max(0, course.progress))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Lesson count & duration */}
            <div className="border-border text-muted-foreground flex items-center justify-between border-t pt-3 text-xs">
              <span className="flex items-center gap-1.5">
                <BookOpen className="size-3.5" />
                {t.site.catalog.lessons(course.lessonCount ?? 8)}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                {course.durationMinutes ? t.site.catalog.minutes(course.durationMinutes * 60) : "2–4 hrs"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
