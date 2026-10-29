"use client";

import { useQuery } from "@tanstack/react-query";
import { ErrorState, LoadingRows } from "@/components/shared";
import { PythonNotebook } from "@/components/challenges/python-notebook";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import type { PublicTrack, StudentBilling } from "@/types/api";

export default function PythonNotebookPage() {
  const billing = useQuery({ queryKey: ["student-billing"], queryFn: () => api<StudentBilling>("/student/billing") });
  const tracks = useQuery({ queryKey: ["tracks"], queryFn: () => api<PublicTrack[]>("/tracks") });
  if (billing.isError) return <ErrorState error={billing.error} onRetry={() => void billing.refetch()} />;
  if (tracks.isError) return <ErrorState error={tracks.error} onRetry={() => void tracks.refetch()} />;
  if (!billing.data || !tracks.data) return <LoadingRows rows={3} />;
  const aiTrack = tracks.data.find((track) => track.slug === "ai-ml-data-science");
  const hasAccess = Boolean(aiTrack && billing.data.access.some((access) => access.allTracks || access.trackIds.includes(aiTrack.id)));
  if (!hasAccess) return <Card><CardContent className="p-8 text-center"><h1 className="font-semibold">AI/ML notebook requires track access</h1><p className="text-muted-foreground mt-1 text-sm">Select the AI/ML & Data Science track in your plan or trial to use this notebook.</p></CardContent></Card>;
  return <PythonNotebook />;
}
