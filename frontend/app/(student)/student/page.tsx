"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  Flame,
  GraduationCap,
  Lock,
  Play,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ErrorState, LoadingRows, StatusBadge } from "@/components/shared";
import { Progress } from "@/components/student/progress";
import { TrackIcon } from "@/components/site/track-icon";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { useMe } from "@/lib/auth";
import { TRACK_ART, TRACK_THEMES } from "@/lib/brand";
import { toastError } from "@/lib/errors";
import { daysLeft, formatDate } from "@/lib/format";
import { formatClock, formatDuration, learningKeys } from "@/lib/learning";
import { BILLING_KEY } from "@/lib/student";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type {
  CourseLevel,
  LearningDashboard,
  LiveSession,
  PublicCourseListItem,
  PublicTrack,
  StudentBilling,
} from "@/types/api";

type CourseTab = "all" | "in-progress" | "completed";

export default function StudentDashboard() {
  const { data: me } = useMe();
  const [courseTab, setCourseTab] = useState<CourseTab>("all");

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
  const liveSessions = useQuery({
    queryKey: ["student-live-sessions"],
    queryFn: () => api<LiveSession[]>("/student/live-sessions"),
    enabled: Boolean(billing.data?.hasAccess),
    refetchInterval: 30000,
  });

  if (billing.isError)
    return <ErrorState error={billing.error} onRetry={() => billing.refetch()} />;
  if (!billing.data || !tracks.data) return <LoadingRows rows={4} />;

  const b = billing.data;
  const trackById = new Map((tracks.data ?? []).map((tr) => [tr.id, tr]));

  const allTracks = b.access.some((a) => a.allTracks);
  const myTrackIds = new Set(b.access.flatMap((a) => a.trackIds));
  const myTrackSlugs = new Set([...myTrackIds].map((id) => trackById.get(id)?.slug));

  const myCourses = (courses.data ?? []).filter((c) => allTracks || myTrackSlugs.has(c.track.slug));

  const courseProgressMap = new Map<
    string,
    { percent: number; completedLessons: number; totalLessons: number }
  >();
  for (const c of learning.data?.courses ?? []) {
    courseProgressMap.set(c.slug, {
      percent: c.percent,
      completedLessons: c.completedLessons,
      totalLessons: c.totalLessons,
    });
  }

  const filteredCourses = (() => {
    if (courseTab === "in-progress") {
      return myCourses.filter((c) => {
        const prog = courseProgressMap.get(c.slug);
        return prog && prog.percent > 0 && prog.percent < 100;
      });
    }
    if (courseTab === "completed") {
      return myCourses.filter((c) => {
        const prog = courseProgressMap.get(c.slug);
        return prog && prog.percent === 100;
      });
    }
    return myCourses;
  })();

  const now = Date.now();
  const upcomingLive = (liveSessions.data ?? [])
    .filter((s) => {
      const end = new Date(s.startsAt).getTime() + s.durationMinutes * 60 * 1000;
      return end >= now;
    })
    .slice(0, 3);

  const pendingPayment = b.payments.find((p) => p.status === "pending");
  const primaryAccess = b.access[0];
  const trialDaysRemaining = primaryAccess ? daysLeft(primaryAccess.endsAt) : 0;
  const firstName = me?.user.fullName ? me.user.fullName.split(" ")[0] : "Student";
  const continueItem = learning.data?.continueLearning;

  return (
    <div className="space-y-8 pb-12">
      {/* 1. Hero Welcome Banner (inspired by toko & Virtus designs) */}
      <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/10 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 size-48 rounded-full bg-accent/10 blur-2xl" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          {/* Left Greeting & Headline */}
          <div className="max-w-xl space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="size-3.5" />
              <span>
                {primaryAccess?.status === "trial"
                  ? `7-Day Free Trial · ${trialDaysRemaining} days remaining`
                  : primaryAccess?.plan?.name ?? "Student Portal"}
              </span>
            </div>

            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              Hello, {firstName}!
            </h1>

            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {continueItem
                ? `You're currently learning "${continueItem.courseTitle}". Keep up the momentum today!`
                : "Welcome to your personal learning dashboard. Continue lessons, solve assignments, and attend live classes."}
            </p>

            {continueItem ? (
              <div className="pt-2">
                <Button asChild size="default" className="gap-2 font-semibold shadow-sm">
                  <Link href={`/student/lessons/${continueItem.lessonId}`}>
                    <PlayCircle className="size-4 fill-current" />
                    <span>
                      {continueItem.positionSeconds > 5 && !continueItem.completed
                        ? `Resume: ${continueItem.lessonTitle} (${formatClock(continueItem.positionSeconds)})`
                        : `Continue: ${continueItem.lessonTitle}`}
                    </span>
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            ) : b.needsTrackChoice ? (
              <div className="pt-2">
                <Button asChild size="default" className="gap-2 font-semibold shadow-sm">
                  <a href="#trial-picker">
                    <Sparkles className="size-4" />
                    <span>Pick Your Free Trial Track</span>
                    <ArrowRight className="size-4" />
                  </a>
                </Button>
              </div>
            ) : null}
          </div>

          {/* Right Metrics Pills (toko / Virtus style) */}
          <div className="flex flex-wrap gap-3 sm:flex-nowrap lg:flex-col lg:items-end">
            {/* Streak Card */}
            <div className="flex min-w-[140px] items-center gap-3 rounded-xl border border-border/80 bg-surface/80 px-4 py-3 shadow-xs backdrop-blur">
              <span className="grid size-10 place-items-center rounded-lg bg-accent/15 text-accent">
                <Flame className="size-5 fill-current" />
              </span>
              <div>
                <p className="font-heading text-lg font-bold text-foreground">
                  {learning.data?.streakDays ?? 0} {learning.data?.streakDays === 1 ? "day" : "days"}
                </p>
                <p className="text-muted-foreground text-xs font-medium">Daily Streak</p>
              </div>
            </div>

            {/* Weekly Study Time */}
            <div className="flex min-w-[140px] items-center gap-3 rounded-xl border border-border/80 bg-surface/80 px-4 py-3 shadow-xs backdrop-blur">
              <span className="grid size-10 place-items-center rounded-lg bg-primary/15 text-primary">
                <Clock className="size-5" />
              </span>
              <div>
                <p className="font-heading text-lg font-bold text-foreground">
                  {formatDuration(learning.data?.weekSeconds ?? 0)}
                </p>
                <p className="text-muted-foreground text-xs font-medium">Study this week</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Trial Picker (if first login / track selection needed) */}
      {b.needsTrackChoice && (
        <div id="trial-picker">
          <TrialPicker tracks={tracks.data} />
        </div>
      )}

      {/* Pending Payment Notification */}
      {pendingPayment && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-warning">
              <Clock className="size-5" /> {t.student.dashboard.pendingTitle}
            </CardTitle>
            <CardDescription>{t.student.dashboard.pendingBody}</CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* 3. Main Dashboard 2-Column Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column (8 cols): Active Learning & Courses */}
        <div className="space-y-8 lg:col-span-8">
          {/* Active Lesson Spotlight Card (inspired by toko Module progress) */}
          {continueItem && (
            <Card className="overflow-hidden border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border/60 bg-muted/20 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      In Progress
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Course: <strong>{continueItem.courseTitle}</strong>
                    </span>
                  </div>
                  <Link
                    href={`/student/courses/${continueItem.courseSlug}`}
                    className="text-primary text-xs font-medium hover:underline flex items-center gap-1"
                  >
                    View Syllabus <ArrowRight className="size-3" />
                  </Link>
                </div>
              </CardHeader>

              <CardContent className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <h3 className="font-heading text-lg font-bold text-foreground">
                      {continueItem.lessonTitle}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {continueItem.positionSeconds > 5
                        ? `Last stopped at ${formatClock(continueItem.positionSeconds)}`
                        : "Ready to start this lecture"}
                    </p>
                  </div>

                  <Button asChild className="gap-2 font-semibold shrink-0">
                    <Link href={`/student/lessons/${continueItem.lessonId}`}>
                      <Play className="size-4 fill-current" />
                      Resume Lesson
                    </Link>
                  </Button>
                </div>

                {/* Progress bar for course */}
                {(() => {
                  const prog = courseProgressMap.get(continueItem.courseSlug);
                  if (!prog) return null;
                  return (
                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-muted-foreground">Course Completion</span>
                        <span className="text-primary font-bold">{prog.percent}%</span>
                      </div>
                      <Progress value={prog.percent} />
                      <p className="text-muted-foreground text-[11px]">
                        {prog.completedLessons} of {prog.totalLessons} lessons completed
                      </p>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          )}

          {/* My Courses Section with Tabs (inspired by Mia Lore) */}
          <section className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold tracking-tight text-foreground">
                  My Courses
                </h2>
                <p className="text-muted-foreground text-xs mt-0.5">
                  Pick up right where you left off or explore new modules
                </p>
              </div>

              {/* Tabs: All / In Progress / Completed */}
              <div className="inline-flex rounded-xl border border-border bg-surface p-1 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setCourseTab("all")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition-colors font-medium",
                    courseTab === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  All ({myCourses.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCourseTab("in-progress")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition-colors font-medium",
                    courseTab === "in-progress"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  In Progress
                </button>
                <button
                  type="button"
                  onClick={() => setCourseTab("completed")}
                  className={cn(
                    "rounded-lg px-3 py-1.5 transition-colors font-medium",
                    courseTab === "completed"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Completed
                </button>
              </div>
            </div>

            {filteredCourses.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {filteredCourses.map((c) => {
                  const prog = courseProgressMap.get(c.slug);
                  const percent = prog?.percent ?? 0;
                  const trackTheme = TRACK_THEMES[c.track.slug] ?? {
                    badge: "bg-primary/10 text-primary border-primary/20",
                  };
                  const art = TRACK_ART[c.track.slug];

                  return (
                    <Link
                      key={c.id}
                      href={`/student/courses/${c.slug}`}
                      className="group block h-full"
                    >
                      <Card className="card-hover border-border bg-card group-hover:border-primary/50 flex h-full flex-col overflow-hidden rounded-xl transition-all shadow-xs">
                        {/* Cover image or track art */}
                        <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
                          {c.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={c.coverImageUrl}
                              alt={c.title}
                              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : art ? (
                            <Image
                              src={art.src}
                              alt=""
                              fill
                              sizes="(min-width: 1024px) 33vw, 50vw"
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center bg-gradient-to-br from-primary/15 to-primary/5">
                              <span className="font-heading text-lg font-bold text-primary">
                                {c.title.slice(0, 2).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>

                        <CardContent className="flex flex-1 flex-col p-5">
                          {/* Track Tag + Level */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                                trackTheme.badge,
                              )}
                            >
                              {c.track.title}
                            </span>
                            <Badge
                              variant="outline"
                              className="border-border text-muted-foreground text-xs"
                            >
                              {t.common.levels[c.level]}
                            </Badge>
                          </div>

                          <h3 className="font-heading text-foreground group-hover:text-primary mt-3 text-base font-bold tracking-tight transition-colors line-clamp-1">
                            {c.title}
                          </h3>

                          {c.shortDescription && (
                            <p className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-relaxed">
                              {c.shortDescription}
                            </p>
                          )}

                          <div className="mt-auto pt-4 space-y-3">
                            {/* Progress bar */}
                            <div>
                              <div className="flex items-center justify-between text-xs font-medium">
                                <span className="text-muted-foreground">
                                  {prog
                                    ? `${prog.completedLessons} of ${prog.totalLessons} lessons`
                                    : "Not started"}
                                </span>
                                <span className="text-primary font-bold">{percent}%</span>
                              </div>
                              <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                                <div
                                  className="bg-primary h-full rounded-full transition-all duration-300"
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>

                            <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
                              <span className="text-muted-foreground flex items-center gap-1">
                                <BookOpen className="size-3.5" />
                                {prog?.totalLessons ?? 8} lessons
                              </span>
                              <span className="text-primary font-semibold group-hover:underline flex items-center gap-1">
                                {percent > 0 ? "Resume" : "Start"} <ArrowRight className="size-3" />
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-10 text-center">
                <GraduationCap className="mx-auto size-8 text-muted-foreground/60" />
                <h4 className="font-heading text-sm font-semibold text-foreground mt-3">
                  {courseTab === "completed"
                    ? "No completed courses yet"
                    : courseTab === "in-progress"
                      ? "No courses currently in progress"
                      : "No courses found"}
                </h4>
                <p className="text-muted-foreground text-xs mt-1">
                  Browse the course catalog to start your learning journey.
                </p>
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <Link href="/courses">Browse Catalog</Link>
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* Right Column (4 cols): Live Schedule, Study Stats & Plan Status */}
        <div className="space-y-6 lg:col-span-4">
          {/* Upcoming Schedule / Live Classes (inspired by toko & Mia Lore) */}
          <Card className="border-border bg-card shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                  <Video className="size-4 text-primary" />
                  Upcoming Classes
                </CardTitle>
                <Link
                  href="/student/live"
                  className="text-primary text-xs font-semibold hover:underline flex items-center gap-1"
                >
                  View all <ArrowRight className="size-3" />
                </Link>
              </div>
              <CardDescription className="text-xs">
                Interactive mentor Q&As and live coding
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-1">
              {upcomingLive.length > 0 ? (
                upcomingLive.map((session) => {
                  const date = new Date(session.startsAt);
                  const isToday = new Date().toDateString() === date.toDateString();
                  const timeStr = date.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={session.id}
                      className="rounded-xl border border-border/80 bg-surface/60 p-3 transition-colors hover:border-primary/40 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-primary">
                          {isToday ? "Today" : formatDate(session.startsAt)} · {timeStr}
                        </span>
                        <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">
                          {session.durationMinutes} min
                        </Badge>
                      </div>

                      <h4 className="font-heading text-sm font-bold text-foreground line-clamp-1">
                        {session.title}
                      </h4>

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-2">
                          <Avatar className="size-5">
                            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                              {session.mentor.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground text-xs truncate max-w-[120px]">
                            {session.mentor.fullName}
                          </span>
                        </div>

                        <Button asChild size="xs" variant="secondary" className="h-7 text-xs font-semibold">
                          <Link href={`/student/live`}>
                            Join <ExternalLink className="size-3 ml-1" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center">
                  <Calendar className="mx-auto size-6 text-muted-foreground/60" />
                  <p className="font-heading text-xs font-semibold text-foreground mt-2">
                    No Live Sessions Scheduled Today
                  </p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Check the schedule for upcoming weekly mentor office hours.
                  </p>
                  <Button asChild size="xs" variant="outline" className="mt-3">
                    <Link href="/student/live">Check Live Schedule</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Plan & Subscription Status Card (inspired by toko Level Up card) */}
          {b.hasAccess ? (
            <Card className="border-border bg-gradient-to-br from-card to-surface shadow-xs">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                    <ShieldCheck className="size-4 text-success" />
                    Subscription Status
                  </CardTitle>
                  <StatusBadge tone={primaryAccess?.status === "trial" ? "primary" : "success"}>
                    {primaryAccess?.status === "trial" ? "Trial" : "Active"}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div>
                  <p className="font-heading text-sm font-bold text-foreground">
                    {primaryAccess?.plan?.name ?? "7-Day Free Trial"}
                  </p>
                  <p className="text-muted-foreground text-xs mt-0.5">
                    {primaryAccess?.allTracks
                      ? "Full access to all tracks"
                      : primaryAccess?.trackIds
                        .map((id) => trackById.get(id)?.title)
                        .filter(Boolean)
                        .join(", ")}
                  </p>
                </div>

                <div className="rounded-xl bg-surface border border-border/80 p-3 space-y-1">
                  <div className="flex items-center justify-between text-xs font-medium">
                    <span className="text-muted-foreground">Expires on</span>
                    <span className="text-foreground font-semibold">
                      {formatDate(primaryAccess?.endsAt ?? "")}
                    </span>
                  </div>
                  <p className={cn("text-xs font-semibold", trialDaysRemaining <= 3 ? "text-warning" : "text-primary")}>
                    {trialDaysRemaining} day{trialDaysRemaining === 1 ? "" : "s"} remaining
                  </p>
                </div>

                <Button asChild variant="outline" className="w-full text-xs font-semibold">
                  <Link href="/student/billing">
                    {primaryAccess?.status === "trial" ? "Upgrade to Full Plan" : "Manage Billing"}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            !b.needsTrackChoice &&
            !pendingPayment && (
              <Card className="border-primary/40 bg-primary/5 shadow-xs">
                <CardHeader className="pb-3">
                  <CardTitle className="font-heading text-base font-bold flex items-center gap-2 text-foreground">
                    <Lock className="size-4 text-primary" />
                    Access Required
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Choose a plan to unlock all lessons, assignments, and mentor office hours.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button asChild className="w-full font-semibold">
                    <Link href="/student/billing">
                      Choose a Plan <ArrowRight className="size-4 ml-1" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            )
          )}
        </div>
      </div>
    </div>
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
    <Card className="border-primary/40 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <CardTitle className="font-heading text-lg font-bold">
              {t.student.dashboard.chooseTrackTitle}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {t.student.dashboard.chooseTrackBody}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div role="radiogroup" className="grid gap-4 md:grid-cols-3">
          {tracks.map((track) => {
            const isSelected = selected === track.id;
            return (
              <button
                key={track.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(track.id)}
                className={cn(
                  "hover:border-primary/50 relative flex flex-col rounded-xl border p-5 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/40 shadow-sm"
                    : "border-border bg-surface/50",
                )}
              >
                <div className="flex items-center justify-between">
                  <TrackIcon name={track.icon} className="text-primary size-6" />
                  {isSelected && (
                    <span className="grid size-5 place-items-center rounded-full bg-primary text-primary-foreground">
                      <CheckCircle2 className="size-3.5" />
                    </span>
                  )}
                </div>
                <p className="font-heading mt-4 font-bold text-base text-foreground">{track.title}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed line-clamp-3">
                  {track.description}
                </p>
                <div className="mt-4 pt-3 border-t border-border/60 text-xs text-muted-foreground">
                  <span>{track._count?.courses ?? 0} courses included</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-border/80 pt-4">
          <p className="text-muted-foreground text-xs">
            No credit card or payment needed. Instant 7-day access.
          </p>
          <Button
            size="default"
            className="font-semibold px-6"
            disabled={!selected || start.isPending}
            onClick={() => selected && start.mutate(selected)}
          >
            {start.isPending ? "Starting trial..." : t.student.dashboard.startTrial}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

