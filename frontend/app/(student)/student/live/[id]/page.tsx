"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, ShieldAlert, Video } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { JitsiEmbed } from "@/components/live/jitsi-embed";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { LiveSessionRoom } from "@/types/api";

export default function StudentLiveRoomPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const {
    data: room,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["live-room", id],
    queryFn: () => api<LiveSessionRoom>(`/live-sessions/${id}/room`),
    retry: false,
  });

  const handleJoin = async () => {
    try {
      await api(`/live-sessions/${id}/join`, { method: "POST" });
      toast.success(t.live.pointsAwardedNotice);
    } catch {
      // ignore
    }
  };

  const handleLeave = async () => {
    try {
      await api(`/live-sessions/${id}/leave`, { method: "POST" });
    } catch {
      // ignore
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[500px] flex-col items-center justify-center gap-3">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Checking room access...</p>
      </div>
    );
  }

  if (error || !room) {
    const err = error as any;
    const isEarly = err?.code === "TOO_EARLY_FOR_LIVE_SESSION";
    const isSub = err?.code === "SUBSCRIPTION_REQUIRED";

    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Card className="max-w-md w-full text-center border-amber-500/30">
          <CardContent className="p-8 space-y-4">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <ShieldAlert className="size-6" />
            </div>
            <h2 className="text-lg font-bold">Room Access Unavailable</h2>
            <p className="text-sm text-muted-foreground">
              {isEarly
                ? t.live.tooEarly
                : isSub
                  ? t.live.accessRequired
                  : err?.message || "You cannot access this live class right now."}
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button asChild variant="outline" size="sm">
                <Link href="/student/live">
                  <ArrowLeft className="size-4 mr-1.5" />
                  Back to Schedule
                </Link>
              </Button>
              {isSub && (
                <Button asChild size="sm">
                  <Link href="/student/billing">Choose Plan</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="size-8">
            <Link href="/student/live">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Video className="size-5 text-emerald-500" />
              {room.title}
            </h1>
            <p className="text-xs text-muted-foreground">
              LogicLab Live Classroom • Attendance is being tracked
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" asChild>
          <Link href="/student/live">Leave Class</Link>
        </Button>
      </div>

      <JitsiEmbed
        roomName={room.roomName}
        displayName={room.displayName}
        domain={room.domain}
        onJoin={handleJoin}
        onLeave={handleLeave}
      />
    </div>
  );
}
