"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Crown,
  Flame,
  Medal,
  Radio,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { useMe } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRealtimeSocket, useRealtimeEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import type { LeaderboardResponse, PublicTrack } from "@/types/api";

interface SeasonItem {
  key: string;
  startsAt: string;
  endsAt: string;
}

export default function LeaderboardPage() {
  const qc = useQueryClient();
  const { data: meData } = useMe();
  const [selectedSeason, setSelectedSeason] = useState<string>("");
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [isPulsing, setIsPulsing] = useState(false);

  // Subscribe to real-time leaderboard room over Socket.IO
  useEffect(() => {
    const socket = getRealtimeSocket();
    socket.emit("leaderboard:subscribe");
    return () => {
      socket.emit("leaderboard:unsubscribe");
    };
  }, []);

  useRealtimeEvent("leaderboard:updated", () => {
    setIsPulsing(true);
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
    setTimeout(() => setIsPulsing(false), 2000);
  });

  // Load available seasons
  const { data: seasons = [] } = useQuery({
    queryKey: ["leaderboard-seasons"],
    queryFn: () => api<SeasonItem[]>("/leaderboard/seasons"),
  });

  // Load tracks for filtering
  const { data: tracks = [] } = useQuery({
    queryKey: ["tracks"],
    queryFn: () => api<PublicTrack[]>("/tracks"),
  });

  // Load leaderboard data
  const { data: board, isLoading } = useQuery({
    queryKey: ["leaderboard", selectedSeason, selectedTrack],
    queryFn: () =>
      api<LeaderboardResponse>("/leaderboard", {
        query: {
          season: selectedSeason || undefined,
          track: selectedTrack || undefined,
        },
      }),
  });

  const top3 = board?.entries.slice(0, 3) ?? [];
  const rest = board?.entries.slice(3) ?? [];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                "gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10",
                isPulsing && "animate-pulse border-emerald-500",
              )}
            >
              <Radio className="size-3 text-emerald-500 animate-pulse" />
              {t.realtime.leaderboard.liveUpdates}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Season: {board?.season.key ?? "Current"}
            </span>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl flex items-center gap-3">
            <Trophy className="size-8 text-amber-500" />
            {t.realtime.leaderboard.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">
            {t.realtime.leaderboard.subtitle}
          </p>
        </div>

        {/* Season Selector */}
        <div className="flex items-center gap-3">
          <Select
            value={selectedSeason || board?.season.key || ""}
            onValueChange={(val) => setSelectedSeason(val)}
          >
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.key} value={s.key} className="text-xs">
                  {s.key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Track Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b pb-3">
        <button
          type="button"
          onClick={() => setSelectedTrack("")}
          className={cn(
            "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
            !selectedTrack
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          {t.realtime.leaderboard.allTracks}
        </button>
        {tracks.map((track) => (
          <button
            key={track.slug}
            type="button"
            onClick={() => setSelectedTrack(track.slug)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-all",
              selectedTrack === track.slug
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {track.title}
          </button>
        ))}
      </div>

      {/* My Rank Banner (if student is ranked) */}
      {board?.me && (
        <Card className="border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-background to-transparent shadow-sm">
          <CardContent className="flex items-center justify-between p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex size-12 sm:size-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-500 font-extrabold text-xl shadow-inner">
                #{board.me.rank}
              </div>
              <div>
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  {t.realtime.leaderboard.currentRank}
                </p>
                <p className="text-lg font-bold sm:text-xl">
                  {meData?.user.fullName || "You"}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl sm:text-3xl font-extrabold text-primary">
                {board.me.points}
              </p>
              <p className="text-xs text-muted-foreground font-medium">
                {t.realtime.leaderboard.points}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top 3 Podium */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : top3.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-4">
          {/* 2nd Place */}
          {top3[1] && (
            <Card className="relative order-2 md:order-1 border-slate-400/30 bg-card/60 backdrop-blur shadow-sm hover:border-slate-400/50 transition-all">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="bg-slate-300 text-slate-900 border-slate-400 gap-1 text-xs px-2.5 font-bold shadow-xs">
                  <Medal className="size-3.5 text-slate-700" /> #2
                </Badge>
              </div>
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center">
                <Avatar className="size-16 ring-2 ring-slate-300 shadow-md">
                  <AvatarImage src={top3[1].avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-slate-200 text-slate-800 font-bold">
                    {top3[1].fullName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-3 font-bold text-sm truncate max-w-[180px]">
                  {top3[1].fullName}
                </h3>
                <p className="text-xl font-extrabold text-primary mt-1">
                  {top3[1].points} <span className="text-xs font-normal text-muted-foreground">pts</span>
                </p>
              </CardContent>
            </Card>
          )}

          {/* 1st Place */}
          {top3[0] && (
            <Card className="relative order-1 md:order-2 border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-card to-card backdrop-blur shadow-md hover:border-amber-500/60 transition-all scale-100 md:scale-105">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-amber-400 gap-1 text-xs px-3 py-0.5 font-extrabold shadow-sm animate-pulse">
                  <Crown className="size-4 fill-slate-950" /> #1 Champion
                </Badge>
              </div>
              <CardContent className="pt-10 pb-7 flex flex-col items-center text-center">
                <Avatar className="size-20 ring-4 ring-amber-400 shadow-xl">
                  <AvatarImage src={top3[0].avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-amber-100 text-amber-900 font-extrabold text-xl">
                    {top3[0].fullName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-3 font-extrabold text-base truncate max-w-[200px]">
                  {top3[0].fullName}
                </h3>
                <p className="text-2xl font-black text-amber-500 mt-1">
                  {top3[0].points} <span className="text-xs font-medium text-muted-foreground">pts</span>
                </p>
              </CardContent>
            </Card>
          )}

          {/* 3rd Place */}
          {top3[2] && (
            <Card className="relative order-3 border-amber-700/30 bg-card/60 backdrop-blur shadow-sm hover:border-amber-700/50 transition-all">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="bg-amber-700/20 text-amber-700 dark:text-amber-400 border-amber-700/40 gap-1 text-xs px-2.5 font-bold shadow-xs">
                  <Medal className="size-3.5" /> #3
                </Badge>
              </div>
              <CardContent className="pt-8 pb-6 flex flex-col items-center text-center">
                <Avatar className="size-16 ring-2 ring-amber-700/40 shadow-md">
                  <AvatarImage src={top3[2].avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-amber-900/20 text-amber-700 font-bold">
                    {top3[2].fullName.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <h3 className="mt-3 font-bold text-sm truncate max-w-[180px]">
                  {top3[2].fullName}
                </h3>
                <p className="text-xl font-extrabold text-primary mt-1">
                  {top3[2].points} <span className="text-xs font-normal text-muted-foreground">pts</span>
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      ) : null}

      {/* Main Table & Rules Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="overflow-hidden shadow-xs">
            <div className="border-b px-4 py-3 bg-muted/40 font-semibold text-xs flex justify-between text-muted-foreground uppercase tracking-wider">
              <span>{t.realtime.leaderboard.student}</span>
              <span>{t.realtime.leaderboard.points}</span>
            </div>
            <div className="divide-y">
              {board?.entries.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  {t.realtime.leaderboard.noEntries}
                </div>
              ) : (
                board?.entries.map((entry) => (
                  <div
                    key={entry.userId}
                    className={cn(
                      "flex items-center justify-between p-3.5 transition-colors hover:bg-muted/40",
                      entry.isMe && "bg-primary/5 font-semibold",
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={cn(
                          "w-6 text-center text-xs font-bold",
                          entry.rank === 1 && "text-amber-500",
                          entry.rank === 2 && "text-slate-400",
                          entry.rank === 3 && "text-amber-700",
                          entry.rank > 3 && "text-muted-foreground",
                        )}
                      >
                        {entry.rank}
                      </span>
                      <Avatar className="size-8">
                        <AvatarImage src={entry.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-xs">
                          {entry.fullName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-sm">
                        {entry.fullName}
                        {entry.isMe && (
                          <Badge variant="secondary" className="ml-2 text-[10px] py-0 px-1.5">
                            You
                          </Badge>
                        )}
                      </span>
                    </div>
                    <span className="text-sm font-extrabold text-foreground ml-4">
                      {entry.points}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* How to earn points sidebar */}
        <div className="space-y-4">
          <Card className="bg-muted/20 border-border/60">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" />
                <h4 className="font-bold text-sm">
                  {t.realtime.leaderboard.pointBreakdown}
                </h4>
              </div>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center justify-between p-2 rounded-lg bg-background border">
                  <span>Quiz Passed</span>
                  <Badge variant="outline" className="font-bold text-emerald-600">+20</Badge>
                </li>
                <li className="flex items-center justify-between p-2 rounded-lg bg-background border">
                  <span>Assignment On-Time</span>
                  <Badge variant="outline" className="font-bold text-emerald-600">+15</Badge>
                </li>
                <li className="flex items-center justify-between p-2 rounded-lg bg-background border">
                  <span>Accepted Q&A Answer</span>
                  <Badge variant="outline" className="font-bold text-emerald-600">+10</Badge>
                </li>
                <li className="flex items-center justify-between p-2 rounded-lg bg-background border">
                  <span>7-Day Study Streak</span>
                  <Badge variant="outline" className="font-bold text-emerald-600">+25</Badge>
                </li>
                <li className="flex items-center justify-between p-2 rounded-lg bg-background border">
                  <span>Live Class Attended</span>
                  <Badge variant="outline" className="font-bold text-emerald-600">+5</Badge>
                </li>
              </ul>
              <div className="rounded-lg bg-primary/5 p-3 text-[11px] text-muted-foreground flex items-center gap-2">
                <Flame className="size-4 text-orange-500 shrink-0" />
                <span>Scores reset at the start of each month in Pakistan Standard Time.</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
