"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Award,
  Bell,
  Check,
  CheckCheck,
  GraduationCap,
  MessageSquare,
  Settings2,
  ShieldAlert,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { useRealtimeEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import type {
  NotificationItem,
  NotificationPreferences,
  NotificationType,
} from "@/types/api";

function notificationIcon(type: NotificationType) {
  switch (type) {
    case "points":
      return <Award className="size-4 text-amber-500" />;
    case "live_class_soon":
      return <Video className="size-4 text-emerald-500" />;
    case "chat_reply":
    case "new_doubt":
    case "new_answer":
    case "answer_accepted":
      return <MessageSquare className="size-4 text-sky-500" />;
    case "grade_returned":
    case "quiz_graded":
      return <GraduationCap className="size-4 text-indigo-500" />;
    case "moderation_warning":
      return <ShieldAlert className="size-4 text-rose-500" />;
    default:
      return <Bell className="size-4 text-muted-foreground" />;
  }
}

export function NotificationsBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [filterUnread, setFilterUnread] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<NotificationItem[]>("/notifications"),
    refetchInterval: 30000,
  });

  const { data: preferences } = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => api<NotificationPreferences>("/notifications/preferences"),
    enabled: prefsOpen,
  });

  const updatePrefs = useMutation({
    mutationFn: (body: NotificationPreferences) =>
      api<NotificationPreferences>("/notifications/preferences", {
        method: "PUT",
        body,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-preferences"] });
      toast.success(t.common.status.saved);
      setPrefsOpen(false);
    },
  });

  const markAllRead = useMutation({
    mutationFn: () =>
      api<{ count: number }>("/notifications/read-all", { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markRead = useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  // Listen to live notification events over the socket
  useRealtimeEvent<NotificationItem>("notification:new", (item) => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    toast(item.title, {
      description: item.body || undefined,
      icon: notificationIcon(item.type),
    });
  });

  // Listen to live points awarded event
  useRealtimeEvent<{ points: number; reason: string }>("points:awarded", (data) => {
    qc.invalidateQueries({ queryKey: ["points"] });
    qc.invalidateQueries({ queryKey: ["leaderboard"] });
    toast.success(`+${data.points} Points!`, {
      description: `Earned for: ${data.reason.replace(/_/g, " ")}`,
      icon: <Award className="size-4 text-amber-500" />,
    });
  });

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const filtered = filterUnread
    ? notifications.filter((n) => !n.readAt)
    : notifications;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative size-9 rounded-full"
            aria-label="Notifications"
          >
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4.5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-in zoom-in-75">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 sm:w-96 p-0 shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">{t.realtime.notifications.title}</span>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} new
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                title={t.realtime.notifications.preferences}
                onClick={() => setPrefsOpen(true)}
              >
                <Settings2 className="size-3.5" />
              </Button>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => markAllRead.mutate()}
                  disabled={markAllRead.isPending}
                >
                  <CheckCheck className="size-3.5 mr-1" />
                  {t.realtime.notifications.markAllRead}
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-b px-4 py-1.5 text-xs text-muted-foreground">
            <span>{filterUnread ? "Showing unread" : "Showing all"}</span>
            <button
              type="button"
              className="hover:text-foreground transition-colors underline"
              onClick={() => setFilterUnread(!filterUnread)}
            >
              {filterUnread ? t.realtime.notifications.all : t.realtime.notifications.unreadOnly}
            </button>
          </div>

          <ScrollArea className="max-h-[360px]">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <Bell className="size-8 stroke-1 text-muted-foreground/40 mb-2" />
                <p className="text-xs">{t.realtime.notifications.empty}</p>
              </div>
            ) : (
              <div className="divide-y">
                {filtered.map((n) => {
                  const isUnread = !n.readAt;
                  const itemContent = (
                    <div
                      className={cn(
                        "flex items-start gap-3 p-3 text-left transition-colors hover:bg-muted/50 cursor-pointer",
                        isUnread && "bg-primary/5",
                      )}
                      onClick={() => {
                        if (isUnread) markRead.mutate(n.id);
                        if (n.link) setOpen(false);
                      }}
                    >
                      <div className="mt-0.5 shrink-0 rounded-full bg-background p-1.5 border shadow-xs">
                        {notificationIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p
                            className={cn(
                              "text-xs leading-snug line-clamp-2",
                              isUnread ? "font-semibold text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {n.title}
                          </p>
                          {isUnread && (
                            <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        {n.body && (
                          <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                            {n.body}
                          </p>
                        )}
                        <span className="text-[10px] text-muted-foreground/70 mt-1 block">
                          {new Date(n.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>
                  );

                  return n.link ? (
                    <Link key={n.id} href={n.link} className="block">
                      {itemContent}
                    </Link>
                  ) : (
                    <div key={n.id}>{itemContent}</div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      {/* Preferences Dialog */}
      <Dialog open={prefsOpen} onOpenChange={setPrefsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t.realtime.notifications.preferences}</DialogTitle>
            <DialogDescription>
              {t.realtime.notifications.preferencesDesc}
            </DialogDescription>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const payload: NotificationPreferences = {
                grade_returned: fd.get("grade_returned") === "on",
                quiz_graded: fd.get("quiz_graded") === "on",
                new_doubt: fd.get("new_doubt") === "on",
                chat_reply: fd.get("chat_reply") === "on",
                live_class_soon: fd.get("live_class_soon") === "on",
              };
              updatePrefs.mutate(payload);
            }}
            className="space-y-4 pt-2"
          >
            {(
              [
                "grade_returned",
                "quiz_graded",
                "chat_reply",
                "new_doubt",
                "live_class_soon",
              ] as NotificationType[]
            ).map((key) => {
              const checked = preferences?.[key] !== false; // defaults to true
              return (
                <div key={key} className="flex items-center justify-between gap-2">
                  <label htmlFor={key} className="text-sm font-medium leading-none cursor-pointer">
                    {t.realtime.notifications.emailTypes[
                      key as keyof typeof t.realtime.notifications.emailTypes
                    ] ?? key}
                  </label>
                  <Switch
                    id={key}
                    name={key}
                    defaultChecked={checked}
                  />
                </div>
              );
            })}

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPrefsOpen(false)}
              >
                {t.common.actions.cancel}
              </Button>
              <Button type="submit" size="sm" disabled={updatePrefs.isPending}>
                <Check className="size-4 mr-1.5" />
                {t.realtime.notifications.savePreferences}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
