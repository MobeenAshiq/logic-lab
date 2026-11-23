"use client";

import { useQuery } from "@tanstack/react-query";
import { Code2 } from "lucide-react";
import { DailyChallenge } from "@/components/challenges/daily-challenge";
import { ErrorState, LoadingRows } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import type { PublicCourseListItem, PublicTrack, StudentBilling } from "@/types/api";

export default function DailyChallengesPage() {
  const billing = useQuery({ queryKey: ["student-billing"], queryFn: () => api<StudentBilling>("/student/billing") });
  const tracks = useQuery({ queryKey: ["tracks"], queryFn: () => api<PublicTrack[]>("/tracks") });
  const courses = useQuery({ queryKey: ["courses"], queryFn: () => api<PublicCourseListItem[]>("/courses") });
  if (billing.isError) return <ErrorState error={billing.error} onRetry={() => void billing.refetch()} />;
  if (tracks.isError) return <ErrorState error={tracks.error} onRetry={() => void tracks.refetch()} />;
  if (!billing.data || !tracks.data || !courses.data) return <LoadingRows rows={4} />;
  const b = billing.data;
  // A track's challenges open with a plan for the track, or a plan / free period on any of its courses.
  const myCourseIds = new Set([...b.access.flatMap((a) => a.courseIds), ...b.freeCourses.map((f) => f.courseId)]);
  const courseTracks = new Set(courses.data.filter((c) => myCourseIds.has(c.id)).map((c) => c.track.slug));
  const available = tracks.data.filter(
    (track) => courseTracks.has(track.slug) || b.access.some((a) => a.allTracks || a.trackIds.includes(track.id)),
  );
  if (available.length === 0) return <Card><CardContent className="p-8 text-center"><Code2 className="mx-auto size-8 text-primary" /><h1 className="mt-3 font-semibold">Challenges unlock with track access</h1><p className="text-muted-foreground mt-1 text-sm">Start any course (the first 14 days are free) to practice its daily challenges.</p></CardContent></Card>;
  return <DailyChallenge tracks={available} />;
}
