"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/shared";
import { CourseCard } from "@/components/site/course-card";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PublicCourseListItem, PublicTrack } from "@/types/api";

/** Course list inside the student portal; cards open the student course page. */
export default function StudentCoursesPage() {
  const [track, setTrack] = useState<string | null>(null);
  const tracks = useQuery({
    queryKey: ["tracks"],
    queryFn: () => api<PublicTrack[]>("/tracks"),
  });
  const courses = useQuery({
    queryKey: ["courses", track],
    queryFn: () =>
      api<PublicCourseListItem[]>("/courses", { query: track ? { track } : undefined }),
  });

  const chip = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
    );

  return (
    <>
      <PageHeader title={t.site.catalog.title} description={t.site.catalog.subtitle} />

      <div className="mb-6 flex flex-wrap gap-2">
        <button type="button" className={chip(!track)} onClick={() => setTrack(null)}>
          {t.site.catalog.allTracks}
        </button>
        {(tracks.data ?? []).map((tr) => (
          <button
            key={tr.id}
            type="button"
            className={chip(track === tr.slug)}
            onClick={() => setTrack(tr.slug)}
          >
            {tr.title}
          </button>
        ))}
      </div>

      {courses.isLoading ? (
        <LoadingRows rows={4} />
      ) : courses.isError ? (
        <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
      ) : !courses.data?.length ? (
        <EmptyState title={t.site.catalog.empty} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.data.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              href={`/student/courses/${course.slug}`}
            />
          ))}
        </div>
      )}
    </>
  );
}
