"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  Hand,
  Image as ImageIcon,
  Loader2,
  Paperclip,
  Send,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/community/markdown";
import { api } from "@/lib/api/client";
import { useMe } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { getRealtimeSocket, useRealtimeEvent } from "@/lib/realtime";
import { cn } from "@/lib/utils";
import type { Conversation, PersonRef } from "@/types/api";

interface ChatRoomProps {
  conversationId: string;
  backHref: string;
}

interface DetailMessage {
  id: string;
  senderId: string;
  body: string;
  attachmentKey: string | null;
  createdAt: string;
}

interface ConversationDetail extends Omit<Conversation, "messages"> {
  side: "student" | "mentor" | "staff";
  canClaim: boolean;
  canSend: boolean;
  availability?: {
    isWithinOfficeHours: boolean;
    note: string;
  };
  assetUrls: Record<string, string>;
  messages: DetailMessage[];
}

export function ChatRoom({ conversationId, backHref }: ChatRoomProps) {
  const qc = useQueryClient();
  const { data: meData } = useMe();
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState<{
    file: File;
    preview: string;
    key?: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: conv, isLoading } = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => api<ConversationDetail>(`/chat/conversations/${conversationId}`),
    refetchInterval: 15000,
  });

  // Mark conversation as read on load
  useEffect(() => {
    if (conv) {
      api(`/chat/conversations/${conversationId}/read`, { method: "POST" }).catch(
        () => {},
      );
    }
  }, [conversationId, conv?.messages?.length]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conv?.messages?.length, otherTyping]);

  // Real-time Socket.IO events
  useRealtimeEvent<{ conversationId: string; message: DetailMessage }>(
    "chat:message",
    (data) => {
      if (data.conversationId === conversationId) {
        qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
        api(`/chat/conversations/${conversationId}/read`, { method: "POST" }).catch(
          () => {},
        );
      }
    },
  );

  useRealtimeEvent<{ conversationId: string; mentor: PersonRef }>(
    "chat:claimed",
    (data) => {
      if (data.conversationId === conversationId) {
        qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      }
    },
  );

  useRealtimeEvent<{ conversationId: string }>("chat:closed", (data) => {
    if (data.conversationId === conversationId) {
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    }
  });

  useRealtimeEvent<{ conversationId: string; userId: string; isTyping: boolean }>(
    "typing",
    (data) => {
      if (data.conversationId === conversationId && data.userId !== meData?.user.id) {
        setOtherTyping(data.isTyping);
      }
    },
  );

  // Send typing event debounced
  const notifyTyping = () => {
    const socket = getRealtimeSocket();
    socket.emit("typing", { conversationId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("typing", { conversationId, isTyping: false });
    }, 2000);
  };

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({
      body,
      attachmentKey,
    }: {
      body: string;
      attachmentKey?: string | null;
    }) => {
      return api<DetailMessage>(`/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        body: { body, attachmentKey },
      });
    },
    onSuccess: () => {
      setText("");
      setAttachment(null);
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to send message");
    },
  });

  // Claim doubt mutation (mentor)
  const claimMutation = useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>(`/chat/conversations/${conversationId}/claim`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Doubt claimed! You can now reply to the student.");
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
    onError: (err: any) => toast.error(err.message || "Could not claim doubt"),
  });

  // Close doubt mutation
  const closeMutation = useMutation({
    mutationFn: () =>
      api<{ ok: boolean }>(`/chat/conversations/${conversationId}/close`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast.success("Doubt resolved and closed.");
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
    },
    onError: (err: any) => toast.error(err.message || "Could not close doubt"),
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Only JPG, PNG and WebP images are allowed.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be under 5MB.");
      return;
    }

    const preview = URL.createObjectURL(file);
    setAttachment({ file, preview });

    try {
      setUploading(true);
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        "/chat/uploads",
        {
          method: "POST",
          body: { contentType: file.type, size: file.size },
        },
      );

      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putRes.ok) throw new Error("Upload to storage failed");
      setAttachment({ file, preview, key });
    } catch (err: any) {
      toast.error("Failed to upload image. Please try again.");
      setAttachment(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = () => {
    if (!text.trim() && !attachment?.key) return;
    if (uploading) {
      toast.info("Please wait for the image upload to finish.");
      return;
    }
    sendMutation.mutate({
      body: text.trim() || "(Image Attachment)",
      attachmentKey: attachment?.key ?? null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-[500px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!conv) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Conversation not found.</p>
        <Button asChild className="mt-4" variant="outline" size="sm">
          <Link href={backHref}>Go Back</Link>
        </Button>
      </div>
    );
  }

  const isStudent = conv.side === "student";
  const partner = isStudent ? conv.mentor : conv.student;
  const isClosed = conv.status === "closed";
  const lastReadTime = isStudent ? conv.mentorLastReadAt : conv.studentLastReadAt;

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] min-h-[550px] rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" asChild className="size-8 shrink-0">
            <Link href={backHref}>
              <ArrowLeft className="size-4" />
            </Link>
          </Button>

          <Avatar className="size-9 shrink-0 ring-1 ring-border">
            <AvatarImage src={partner?.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs font-semibold">
              {(partner?.fullName || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold truncate">{conv.subject}</h2>
              <Badge
                variant={
                  conv.status === "open"
                    ? "default"
                    : conv.status === "waiting"
                      ? "secondary"
                      : "outline"
                }
                className="text-[10px] uppercase font-bold tracking-wider"
              >
                {conv.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {conv.course.title} • {partner ? partner.fullName : "Waiting for mentor pickup"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {conv.canClaim && (
            <Button
              size="sm"
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
              className="gap-1.5"
            >
              <Hand className="size-3.5" />
              {t.realtime.chat.claimButton}
            </Button>
          )}

          {!isClosed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => closeMutation.mutate()}
              disabled={closeMutation.isPending}
              className="text-xs gap-1.5"
            >
              <XCircle className="size-3.5" />
              {t.realtime.chat.closeButton}
            </Button>
          )}
        </div>
      </div>

      {/* Office Hours Alert if applicable */}
      {conv.availability && !conv.availability.isWithinOfficeHours && !isClosed && (
        <div className="flex items-center gap-2 bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 text-xs text-amber-700 dark:text-amber-400">
          <Clock className="size-3.5 shrink-0" />
          <span>{conv.availability.note || t.realtime.chat.officeHoursNotice}</span>
        </div>
      )}

      {/* Messages Thread */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/10"
      >
        {conv.status === "waiting" && (
          <div className="mx-auto max-w-md rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-center text-xs text-amber-700 dark:text-amber-400">
            <AlertCircle className="size-4 inline-block mr-1.5 -mt-0.5" />
            {t.realtime.chat.waitingNotice}
          </div>
        )}

        {conv.messages.map((m, idx) => {
          const isMine = m.senderId === meData?.user.id;
          const imageUrl = m.attachmentKey ? conv.assetUrls[m.attachmentKey] : null;
          const isLastMessage = idx === conv.messages.length - 1;
          const isSeen =
            isMine &&
            lastReadTime &&
            new Date(lastReadTime).getTime() >= new Date(m.createdAt).getTime();

          return (
            <div
              key={m.id}
              className={cn("flex flex-col max-w-[85%] sm:max-w-[75%]", isMine ? "ml-auto items-end" : "mr-auto items-start")}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm shadow-xs",
                  isMine
                    ? "bg-primary text-primary-foreground rounded-br-xs"
                    : "bg-card border rounded-bl-xs text-card-foreground",
                )}
              >
                {imageUrl && (
                  <div className="mb-2 overflow-hidden rounded-lg border border-white/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageUrl}
                      alt="Attachment"
                      className="max-h-60 max-w-full rounded object-cover cursor-pointer hover:opacity-95"
                      onClick={() => window.open(imageUrl, "_blank")}
                    />
                  </div>
                )}
                <div className={cn(isMine && "text-primary-foreground")}>
                  <Markdown
                    className={cn(
                      "text-xs sm:text-sm prose-invert",
                      isMine && "[&_p]:text-primary-foreground [&_pre]:bg-black/30 [&_code]:text-white",
                    )}
                  >
                    {m.body}
                  </Markdown>
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground px-1">
                <span>
                  {new Date(m.createdAt).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
                {isMine && isLastMessage && (
                  <span>
                    {isSeen ? (
                      <span className="flex items-center gap-0.5 text-primary">
                        <CheckCheck className="size-3" /> Seen
                      </span>
                    ) : (
                      <Check className="size-3" />
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {otherTyping && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
            <span className="flex gap-1 items-center bg-card border rounded-full px-3 py-1">
              <span className="size-1.5 rounded-full bg-primary animate-bounce" />
              <span className="size-1.5 rounded-full bg-primary animate-bounce delay-150" />
              <span className="size-1.5 rounded-full bg-primary animate-bounce delay-300" />
            </span>
            <span>{partner?.fullName || "Partner"} is typing...</span>
          </div>
        )}

        {isClosed && (
          <div className="mx-auto max-w-md rounded-lg border bg-muted/60 p-3 text-center text-xs text-muted-foreground">
            {t.realtime.chat.closedNotice}
          </div>
        )}
      </div>

      {/* Input Bar */}
      {!isClosed && conv.canSend ? (
        <div className="border-t p-3 bg-card space-y-2">
          {/* Attachment Preview */}
          {attachment && (
            <div className="flex items-center gap-2 p-1.5 bg-muted/60 rounded-lg w-fit border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachment.preview}
                alt="Upload preview"
                className="size-10 rounded object-cover"
              />
              <span className="text-xs truncate max-w-[150px]">
                {attachment.file.name}
              </span>
              {uploading ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-5 rounded-full"
                  onClick={() => setAttachment(null)}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
          )}

          <div className="flex items-end gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              title={t.realtime.chat.attachImage}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || sendMutation.isPending}
            >
              <ImageIcon className="size-4" />
            </Button>

            <Textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                notifyTyping();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t.realtime.chat.typeMessage}
              rows={1}
              className="min-h-[38px] max-h-32 resize-none text-xs sm:text-sm py-2"
            />

            <Button
              onClick={handleSend}
              disabled={(!text.trim() && !attachment?.key) || uploading || sendMutation.isPending}
              size="icon"
              className="size-9 shrink-0"
            >
              {sendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      ) : isClosed ? (
        <div className="border-t p-3 bg-muted/40 text-center text-xs text-muted-foreground">
          {t.realtime.chat.closedNotice}
        </div>
      ) : null}
    </div>
  );
}
