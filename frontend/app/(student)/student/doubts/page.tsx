"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  MessageCircleQuestion,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { OpenDoubtDialog } from "@/components/chat/open-doubt-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { useRealtimeEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/api";

export default function StudentDoubtsPage() {
  const [tab, setTab] = useState<"active" | "closed">("active");

  const { data: doubts = [], isLoading, refetch } = useQuery({
    queryKey: ["student-doubts", tab],
    queryFn: () =>
      api<Conversation[]>("/chat/conversations", {
        query: { status: tab },
      }),
  });

  useRealtimeEvent("chat:message", () => refetch());
  useRealtimeEvent("chat:claimed", () => refetch());
  useRealtimeEvent("chat:closed", () => refetch());

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2.5">
            <MessageCircleQuestion className="size-7 text-primary" />
            {t.realtime.chat.title}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t.realtime.chat.subtitle}
          </p>
        </div>
        <OpenDoubtDialog />
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b pb-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="active" className="text-xs">
              {t.realtime.chat.tabs.active}
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              {t.realtime.chat.tabs.closed}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : doubts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <MessageSquare className="size-10 stroke-1 text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold text-base">
              {t.realtime.chat.noDoubts}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-4">
              {tab === "active"
                ? "Stuck on a lesson or coding challenge? Open a doubt and our course mentors will assist you directly."
                : "No closed doubts yet."}
            </p>
            {tab === "active" && <OpenDoubtDialog />}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {doubts.map((doubt) => {
            const hasUnread = (doubt.unreadCount ?? 0) > 0;
            return (
              <Link
                key={doubt.id}
                href={`/student/doubts/${doubt.id}`}
                className="block group"
              >
                <Card
                  className={cn(
                    "transition-all hover:border-primary/50 hover:shadow-xs",
                    hasUnread && "border-primary/40 bg-primary/5",
                  )}
                >
                  <CardContent className="p-4 sm:p-5 flex items-start justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {doubt.course.title}
                        </Badge>
                        <Badge
                          variant={
                            doubt.status === "open"
                              ? "default"
                              : doubt.status === "waiting"
                                ? "secondary"
                                : "outline"
                          }
                          className="text-[10px] uppercase font-bold"
                        >
                          {doubt.status}
                        </Badge>
                        {hasUnread && (
                          <span className="flex size-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>

                      <h3 className="text-base font-semibold group-hover:text-primary transition-colors truncate">
                        {doubt.subject}
                      </h3>

                      {doubt.lastMessage && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {doubt.lastMessage.body}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(doubt.lastMessageAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>

                      {doubt.mentor ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar className="size-5">
                            <AvatarImage src={doubt.mentor.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-[10px]">
                              {doubt.mentor.fullName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs truncate max-w-[120px]">
                            {doubt.mentor.fullName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                          <Clock className="size-3" /> Waiting for mentor
                        </span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
