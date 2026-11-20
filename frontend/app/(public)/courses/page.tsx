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
      aria-current={active ? "page" : undefined}
      className={cn(
        "block rounded-[4px] px-3 py-2 text-sm whitespace-nowrap transition-colors",
        active ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-muted",
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

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Filters: a left menu on desktop, scrollable rows on phones */}
        <aside className="shrink-0 lg:w-60">
          <nav aria-label="Filter courses" className="grid gap-6 lg:sticky lg:top-20">
            <div>
              <p className="text-muted-foreground mb-2 px-3 text-xs font-bold tracking-wider uppercase">
                Tracks
              </p>
              <div className="flex gap-1 overflow-x-auto lg:flex-col">
                <Chip href={chipHref({ level: validLevel })} active={!track}>
                  {t.site.catalog.allTracks}
                </Chip>
                {(tracks ?? []).map((tr) => (
                  <Chip
                    key={tr.id}
                    href={chipHref({ track: tr.slug, level: validLevel })}
                    active={track === tr.slug}
                  >
                    <span className="lg:whitespace-normal">{tr.title}</span>
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-muted-foreground mb-2 px-3 text-xs font-bold tracking-wider uppercase">
                Level
              </p>
              <div className="flex gap-1 overflow-x-auto lg:flex-col">
                <Chip href={chipHref({ track })} active={!validLevel}>
                  {t.site.catalog.allLevels}
                </Chip>
                {LEVELS.map((l) => (
                  <Chip key={l} href={chipHref({ track, level: l })} active={validLevel === l}>
                    {t.common.levels[l]}
                  </Chip>
                ))}
              </div>
            </div>
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {courses && courses.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          ) : (
            <EmptyState title={t.site.catalog.empty} />
          )}
        </div>
      </div>
    </div>
  );
}
