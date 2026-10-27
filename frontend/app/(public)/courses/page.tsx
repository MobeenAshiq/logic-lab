import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared";
import { CourseCard } from "@/components/site/course-card";
import { serverApi } from "@/lib/api/server";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CourseLevel, PublicCourseListItem, PublicTrack } from "@/types/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: t.site.catalog.title };

const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];

function chipHref(params: { track?: string; level?: string }) {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  ).toString();
  return `/courses${qs ? `?${qs}` : ""}`;
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors",
        active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}

export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; level?: string }>;
}) {
  const { track, level } = await searchParams;
  const validLevel = LEVELS.includes(level as CourseLevel) ? level : undefined;
  const query = new URLSearchParams(
    Object.entries({ track, level: validLevel }).filter((e): e is [string, string] =>
      Boolean(e[1]),
    ),
  ).toString();
  const [tracks, courses] = await Promise.all([
    serverApi<PublicTrack[]>("/tracks"),
    serverApi<PublicCourseListItem[]>(`/courses${query ? `?${query}` : ""}`),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">{t.site.catalog.title}</h1>
      <p className="text-muted-foreground mt-2">{t.site.catalog.subtitle}</p>

      <div className="mt-8 flex flex-wrap gap-2">
        <Chip href={chipHref({ level: validLevel })} active={!track}>
          {t.site.catalog.allTracks}
        </Chip>
        {(tracks ?? []).map((tr) => (
          <Chip
            key={tr.id}
            href={chipHref({ track: tr.slug, level: validLevel })}
            active={track === tr.slug}
          >
            {tr.title}
          </Chip>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip href={chipHref({ track })} active={!validLevel}>
          {t.site.catalog.allLevels}
        </Chip>
        {LEVELS.map((l) => (
          <Chip key={l} href={chipHref({ track, level: l })} active={validLevel === l}>
            {t.common.levels[l]}
          </Chip>
        ))}
      </div>

      {courses && courses.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        <div className="mt-8">
          <EmptyState title={t.site.catalog.empty} />
        </div>
      )}
    </div>
  );
}
