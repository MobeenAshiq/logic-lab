"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Hand,
  Inbox,
  MessageCircleQuestion,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { useRealtimeEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/types/api";

export default function MentorDoubtsPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"queue" | "active" | "closed">("queue");

  // Load unclaimed queue
  const { data: queue = [], isLoading: loadingQueue, refetch: refetchQueue } = useQuery({
    queryKey: ["mentor-queue"],
    queryFn: () => api<Conversation[]>("/chat/queue"),
    enabled: tab === "queue",
  });

  // Load my active or closed doubts
  const { data: myDoubts = [], isLoading: loadingMy, refetch: refetchMy } = useQuery({
    queryKey: ["mentor-doubts", tab],
    queryFn: () =>
      api<Conversation[]>("/chat/conversations", {
        query: { status: tab === "closed" ? "closed" : "active" },
      }),
    enabled: tab !== "queue",
  });

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/chat/conversations/${id}/claim`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Doubt claimed! You can now chat with the student.");
      qc.invalidateQueries({ queryKey: ["mentor-queue"] });
      qc.invalidateQueries({ queryKey: ["mentor-doubts"] });
    },
    onError: (err: any) => toast.error(err.message || "Failed to claim doubt"),
  });

  // Realtime events
  useRealtimeEvent("queue:updated", () => {
    refetchQueue();
  });
  useRealtimeEvent("chat:claimed", () => {
    refetchQueue();
    refetchMy();
  });
  useRealtimeEvent("chat:message", () => {
    refetchMy();
  });

  const isLoading = tab === "queue" ? loadingQueue : loadingMy;
  const currentList = tab === "queue" ? queue : myDoubts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl flex items-center gap-2.5">
          <MessageCircleQuestion className="size-7 text-primary" />
          Mentor Doubt Queue & Chat
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pick up student questions from your courses and assist them in 1-on-1 chats.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b pb-2">
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="queue" className="text-xs relative">
              {t.realtime.chat.tabs.queue}
              {queue.length > 0 && (
                <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.2">
                  {queue.length}
                </span>
              )}
            </TabsTrigger>
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
        </div>
      ) : currentList.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center">
            <Inbox className="size-10 stroke-1 text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold text-base">
              {tab === "queue"
                ? t.realtime.chat.emptyQueue
                : t.realtime.chat.noDoubts}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mt-1">
              {tab === "queue"
                ? "When students open doubts in courses assigned to you, they will appear here in real time."
                : "No conversations found in this section."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {currentList.map((doubt) => {
            const hasUnread = (doubt.unreadCount ?? 0) > 0;
            return (
              <Card
                key={doubt.id}
                className={cn(
                  "transition-all hover:border-primary/50 hover:shadow-xs",
                  hasUnread && "border-primary/40 bg-primary/5",
                )}
              >
                <CardContent className="p-4 sm:p-5 flex items-start justify-between gap-4">
                  <Link
                    href={`/mentor/doubts/${doubt.id}`}
                    className="space-y-1.5 flex-1 min-w-0 block group"
                  >
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

                    <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
                      <Avatar className="size-4.5">
                        <AvatarImage src={doubt.student.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[9px]">
                          {doubt.student.fullName.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{doubt.student.fullName}</span>
                      <span>•</span>
                      <span>
                        {new Date(doubt.lastMessageAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </Link>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {tab === "queue" && (
                      <Button
                        size="sm"
                        onClick={() => claimMutation.mutate(doubt.id)}
                        disabled={claimMutation.isPending}
                        className="gap-1.5"
                      >
                        <Hand className="size-3.5" />
                        {t.realtime.chat.claimButton}
                      </Button>
                    )}

                    {tab !== "queue" && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/mentor/doubts/${doubt.id}`}>
                          <MessageSquare className="size-3.5 mr-1" />
                          Chat
                        </Link>
                      </Button>
                    )}
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
