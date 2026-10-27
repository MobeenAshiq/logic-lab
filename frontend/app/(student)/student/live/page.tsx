"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle,
  Clock,
  ExternalLink,
  Lock,
  Play,
  Video,
} from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { LiveSession } from "@/types/api";

export default function StudentLiveClassesPage() {
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["student-live-sessions"],
    queryFn: () => api<LiveSession[]>("/student/live-sessions"),
    refetchInterval: 30000,
  });

  const now = new Date();
  const upcoming = sessions.filter((s) => {
    const end = new Date(s.startsAt).getTime() + s.durationMinutes * 60 * 1000;
    return end >= now.getTime();
  });
  const past = sessions.filter((s) => {
    const end = new Date(s.startsAt).getTime() + s.durationMinutes * 60 * 1000;
    return end < now.getTime();
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2.5">
          <Video className="size-7 text-primary" />
          {t.live.title}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t.live.subtitle}
        </p>
      </div>

      {/* Upcoming Classes */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="size-4 text-primary" />
          <h2 className="text-base font-bold uppercase tracking-wider text-muted-foreground">
            {t.live.upcoming} ({upcoming.length})
          </h2>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-44 rounded-xl" />
            <Skeleton className="h-44 rounded-xl" />
          </div>
        ) : upcoming.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center text-sm text-muted-foreground">
              {t.live.noSessions}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((session) => {
              const starts = new Date(session.startsAt);
              return (
                <Card
                  key={session.id}
                  className={cn(
                    "relative overflow-hidden transition-all hover:shadow-md",
                    session.canJoin && "border-emerald-500/50 bg-emerald-500/5 shadow-emerald-500/5",
                  )}
                >
                  {session.canJoin && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl">
                      LIVE NOW
                    </div>
                  )}

                  <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {session.course.title}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <Clock className="size-3" />
                          {session.durationMinutes} min
                        </Badge>
                        {session.attended && (
                          <Badge className="bg-emerald-500 text-white text-[10px] gap-1">
                            <CheckCircle className="size-3" />
                            {t.live.attendedBadge}
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-bold">{session.title}</h3>
                      {session.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {session.description}
                        </p>
                      )}
                    </div>

                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="size-5">
                            <AvatarImage src={session.mentor.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[9px]">
                              {session.mentor.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span>{session.mentor.fullName}</span>
                        </div>
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

                      {session.canJoin ? (
                        <Button asChild className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                          <Link href={`/student/live/${session.id}`}>
                            <Video className="size-4 animate-pulse" />
                            {t.live.joinRoom}
                          </Link>
                        </Button>
                      ) : (
                        <div className="space-y-1 text-center">
                          <Button disabled variant="outline" className="w-full gap-2 text-xs">
                            <Lock className="size-3.5" />
                            {t.live.joinRoom}
                          </Button>
                          <p className="text-[11px] text-muted-foreground italic">
                            {t.live.roomOpensNotice}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Past Sessions */}
      {past.length > 0 && (
        <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <h2 className="text-base font-bold uppercase tracking-wider text-muted-foreground">
              {t.live.past} ({past.length})
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {past.map((session) => (
              <Card key={session.id} className="bg-muted/20">
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <Badge variant="outline" className="text-[10px]">
                      {session.course.title}
                    </Badge>
                    <h4 className="text-sm font-semibold truncate">{session.title}</h4>
                    <p className="text-xs text-muted-foreground">
                      {new Date(session.startsAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    {session.attended && (
                      <Badge variant="secondary" className="text-[10px] text-emerald-600">
                        Attended
                      </Badge>
                    )}
                    {session.recordingUrl ? (
                      <Button size="sm" variant="outline" asChild className="gap-1.5 text-xs">
                        <a href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                          <Play className="size-3.5 fill-current" />
                          {t.live.watchRecording}
                        </a>
                      </Button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground italic">
                        No recording
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
