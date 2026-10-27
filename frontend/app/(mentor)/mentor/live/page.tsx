"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  Clock,
  ExternalLink,
  Users,
  Video,
} from "lucide-react";
import Link from "next/link";
import { ScheduleLiveDialog } from "@/components/live/schedule-live-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { LiveSession } from "@/types/api";

export default function MentorLiveClassesPage() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["mentor-live-sessions"],
    queryFn: () => api<LiveSession[]>("/teach/live-sessions"),
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2.5">
            <Video className="size-7 text-primary" />
            Mentor Live Classes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule live interactive video masterclasses for your enrolled students.
          </p>
        </div>
        <ScheduleLiveDialog />
      </div>

      {/* Sessions list */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-44 rounded-xl" />
          <Skeleton className="h-44 rounded-xl" />
        </div>
      ) : sessions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <Video className="size-10 stroke-1 text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold text-base">No live classes scheduled</h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              Schedule interactive Q&A or masterclass sessions for students in your courses.
            </p>
            <ScheduleLiveDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {sessions.map((session) => {
            const starts = new Date(session.startsAt);
            const isPast = starts.getTime() < Date.now();

            return (
              <Card
                key={session.id}
                className="overflow-hidden transition-all hover:shadow-md flex flex-col justify-between"
              >
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {session.course.title}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Clock className="size-3" />
                        {session.durationMinutes} min
                      </Badge>
                      <Badge variant="outline" className="text-[10px] gap-1 text-muted-foreground">
                        <Users className="size-3" />
                        {session.attendanceCount ?? 0} attended
                      </Badge>
                    </div>

                    <h3 className="text-lg font-bold">{session.title}</h3>
                    {session.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {session.description}
                      </p>
                    )}
                  </div>

                  <div className="space-y-3 pt-3 border-t">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Scheduled time:</span>
                      <span className="font-semibold text-foreground">
                        {starts.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button asChild size="sm" className="gap-1.5 text-xs">
                        <Link href={`/mentor/live/${session.id}`}>
                          <Video className="size-3.5" />
                          {isPast ? "View Details" : "Start / Enter"}
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                      >
                        <Link href={`/mentor/live/${session.id}?tab=attendance`}>
                          <Users className="size-3.5" />
                          Attendance ({session.attendanceCount ?? 0})
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
