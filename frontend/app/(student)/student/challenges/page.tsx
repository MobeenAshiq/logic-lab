"use client";

import { useQuery } from "@tanstack/react-query";
import { Code2 } from "lucide-react";
import { DailyChallenge } from "@/components/challenges/daily-challenge";
import { ErrorState, LoadingRows } from "@/components/shared";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import type { PublicTrack, StudentBilling } from "@/types/api";

export default function DailyChallengesPage() {
  const billing = useQuery({ queryKey: ["student-billing"], queryFn: () => api<StudentBilling>("/student/billing") });
  const tracks = useQuery({ queryKey: ["tracks"], queryFn: () => api<PublicTrack[]>("/tracks") });
  if (billing.isError) return <ErrorState error={billing.error} onRetry={() => void billing.refetch()} />;
  if (tracks.isError) return <ErrorState error={tracks.error} onRetry={() => void tracks.refetch()} />;
  if (!billing.data || !tracks.data) return <LoadingRows rows={4} />;
  const available = tracks.data.filter((track) => billing.data?.access.some((access) => access.allTracks || access.trackIds.includes(track.id)));
  if (available.length === 0) return <Card><CardContent className="p-8 text-center"><Code2 className="mx-auto size-8 text-primary" /><h1 className="mt-3 font-semibold">Challenges unlock with track access</h1><p className="text-muted-foreground mt-1 text-sm">Start a trial or choose a plan to practice daily challenges.</p></CardContent></Card>;
  return <DailyChallenge tracks={available} />;
}
