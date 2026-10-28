"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Clock, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { LearningOverview } from "@/components/learning/learning-overview";
import { ErrorState, LoadingRows, PageHeader, StatusBadge } from "@/components/shared";
import { CourseCard } from "@/components/site/course-card";
import { TrackIcon } from "@/components/site/track-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useMe } from "@/lib/auth";
import { toastError } from "@/lib/errors";
import { daysLeft, formatDate } from "@/lib/format";
import { learningKeys } from "@/lib/learning";
import { BILLING_KEY } from "@/lib/student";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  LearningDashboard,
  PublicCourseListItem,
  PublicTrack,
  StudentBilling,
} from "@/types/api";

export default function StudentDashboard() {
  const { data: me } = useMe();
  const billing = useQuery({
    queryKey: BILLING_KEY,
    queryFn: () => api<StudentBilling>("/student/billing"),
  });
  const tracks = useQuery({ queryKey: ["tracks"], queryFn: () => api<PublicTrack[]>("/tracks") });
  const courses = useQuery({
    queryKey: ["courses"],
    queryFn: () => api<PublicCourseListItem[]>("/courses"),
  });
  const learning = useQuery({
    queryKey: learningKeys.dashboard,
    queryFn: () => api<LearningDashboard>("/student/learning"),
  });

  if (billing.isError)
    return <ErrorState error={billing.error} onRetry={() => billing.refetch()} />;
  if (!billing.data || !tracks.data) return <LoadingRows rows={3} />;

  const b = billing.data;
  const trackById = new Map(tracks.data.map((tr) => [tr.id, tr]));
  const allTracks = b.access.some((a) => a.allTracks);
  const myTrackIds = new Set(b.access.flatMap((a) => a.trackIds));
  const myTrackSlugs = new Set([...myTrackIds].map((id) => trackById.get(id)?.slug));
  const myCourses = (courses.data ?? []).filter((c) => allTracks || myTrackSlugs.has(c.track.slug));
  const pendingPayment = b.payments.find((p) => p.status === "pending");

  return (
    <>
      <PageHeader
        title={t.student.dashboard.greeting(me?.user.fullName ?? "")}
        description={t.student.dashboard.subtitle}
      />

      {b.needsTrackChoice && <TrialPicker tracks={tracks.data} />}

      {pendingPayment && (
        <Card className="border-warning/40 bg-warning/5 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="text-warning size-4" /> {t.student.dashboard.pendingTitle}
            </CardTitle>
            <CardDescription>{t.student.dashboard.pendingBody}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {b.hasAccess ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {b.access.map((a) => {
            const left = daysLeft(a.endsAt);
            return (
              <Card key={a.id}>
                <CardHeader>
                  <CardDescription>{t.student.dashboard.accessTitle}</CardDescription>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {a.plan?.name ?? t.common.subscriptionStatus.trial}
                    <StatusBadge tone={a.status === "trial" ? "primary" : "success"}>
                      {t.common.subscriptionStatus[a.status]}
                    </StatusBadge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className={cn("font-medium", left <= 3 && "text-warning")}>
                    {t.student.dashboard.endsIn(left)}{" "}
                    <span className="text-muted-foreground font-normal">
                      {t.student.dashboard.endsOn(formatDate(a.endsAt))}
                    </span>
                  </p>
                  <p className="text-muted-foreground">
                    {a.allTracks
                      ? t.student.dashboard.allTracks
                      : a.trackIds
                          .map((id) => trackById.get(id)?.title)
                          .filter(Boolean)
                          .join(", ")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        !b.needsTrackChoice &&
        !pendingPayment && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="size-4" /> {t.student.dashboard.noAccessTitle}
              </CardTitle>
              <CardDescription>{t.student.dashboard.noAccessBody}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/student/billing">
                  {t.student.dashboard.choosePlan} <ArrowRight />
                </Link>
              </Button>
            </CardContent>
          </Card>
        )
      )}

      {learning.data && <LearningOverview data={learning.data} />}

      {b.hasAccess && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t.student.dashboard.yourCourses}</h2>
            <Link href="/courses" className="text-primary text-sm hover:underline">
              {t.student.dashboard.browse}
            </Link>
          </div>
          {myCourses.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myCourses.map((c) => (
                <CourseCard key={c.id} course={c} href={`/student/courses/${c.slug}`} />
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">{t.student.dashboard.noCourses}</p>
          )}
        </section>
      )}
    </>
  );
}

function TrialPicker({ tracks }: { tracks: PublicTrack[] }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const start = useMutation({
    mutationFn: (trackId: string) => api("/student/trial", { method: "POST", body: { trackId } }),
    onSuccess: async () => {
      toast.success(t.student.dashboard.trialStarted);
      await queryClient.invalidateQueries({ queryKey: BILLING_KEY });
    },
    onError: toastError,
  });

  return (
    <Card className="border-primary/40 mb-8">
      <CardHeader>
        <CardTitle>{t.student.dashboard.chooseTrackTitle}</CardTitle>
        <CardDescription>{t.student.dashboard.chooseTrackBody}</CardDescription>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" className="grid gap-3 md:grid-cols-3">
          {tracks.map((track) => (
            <button
              key={track.id}
              type="button"
              role="radio"
              aria-checked={selected === track.id}
              onClick={() => setSelected(track.id)}
              className={cn(
                "hover:border-primary/50 rounded-xl border p-4 text-left transition-colors",
                selected === track.id && "border-primary bg-primary/5 ring-primary ring-1",
              )}
            >
              <TrackIcon name={track.icon} className="text-primary size-5" />
              <p className="mt-3 font-medium">{track.title}</p>
              <p className="text-muted-foreground mt-1 text-sm">{track.description}</p>
            </button>
          ))}
        </div>
        <Button
          className="mt-4"
          disabled={!selected || start.isPending}
          onClick={() => selected && start.mutate(selected)}
        >
          {t.student.dashboard.startTrial}
        </Button>
      </CardContent>
    </Card>
  );
}
