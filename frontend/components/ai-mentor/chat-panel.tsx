"use client";

import { Bot, Code2, Copy, MessageSquarePlus, Send, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";
import { Markdown } from "@/components/community/markdown";
import { Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "@/components/ai-mentor/code-panel";
import { extractCode, STACKS, type MentorMessage, type MentorSession, type MentorUsage, type StackType } from "@/lib/ai-mentor";
import { cn } from "@/lib/utils";

const STARTERS = [
  "Explain REST controllers vs services with an analogy, then show code.",
  "What's the difference between a stack and a queue? When do I use each?",
  "Review my approach: how should I structure a WebSocket chat backend?",
  "How does RAG work, and how would I build a tiny version?",
];

/** Center panel: session picker, stack choice, the conversation and the composer. */
export function ChatPanel({
  sessions,
  activeId,
  onSelectSession,
  stack,
  onStackChange,
  scopeLabel,
  messages,
  loading,
  pending,
  draft,
  onDraftChange,
  onSend,
  usage,
  onOpenCode,
}: {
  sessions: MentorSession[];
  activeId: string | null;
  onSelectSession: (id: string | null) => void;
  stack: StackType;
  onStackChange: (stack: StackType) => void;
  scopeLabel: string;
  messages: MentorMessage[];
  loading: boolean;
  pending: string | null;
  draft: string;
  onDraftChange: (text: string) => void;
  onSend: (text?: string) => void;
  usage: MentorUsage | undefined;
  onOpenCode: (blockId: string) => void;
}) {
  const bottom = useRef<HTMLDivElement>(null);
  const outOfMessages = !!usage && !("unlimited" in usage) && usage.remaining === 0;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card" aria-label="AI Mentor chat">
      <div className="flex flex-wrap items-center gap-2 border-b p-3">
        <Select value={activeId ?? "new"} onValueChange={(v) => onSelectSession(v === "new" ? null : v)}>
          <SelectTrigger className="h-8 max-w-[14rem] min-w-0 flex-1 text-sm" aria-label="Chat history"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="new">✨ New chat</SelectItem>
            {sessions.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={stack} onValueChange={(v) => onStackChange(v as StackType)}>
          <SelectTrigger className="h-8 w-[9.5rem] text-sm" aria-label="Preferred stack"><SelectValue /></SelectTrigger>
          <SelectContent>{STACKS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
        </Select>
        {activeId && (
          <Button size="sm" variant="ghost" className="ml-auto h-8" onClick={() => onSelectSession(null)}>
            <MessageSquarePlus /> New
          </Button>
        )}
        <p className="w-full truncate text-xs text-muted-foreground">Context: {scopeLabel}</p>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {loading ? (
          <div className="grid h-full place-items-center"><Spinner /></div>
        ) : messages.length === 0 && !pending ? (
          <div className="mx-auto max-w-md py-8 text-center">
            <Bot className="mx-auto mb-3 size-10 text-primary" />
            <h2 className="font-heading text-lg font-semibold">Your LogicLab AI Mentor</h2>
            <p className="mt-1 text-sm text-muted-foreground">Ask about programming, DSA, web architecture, AI, or your tech career. Answers start with an analogy, then code.</p>
            <div className="mt-5 grid gap-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => onSend(s)} disabled={outOfMessages} className="rounded-lg border p-2.5 text-left text-sm hover:border-primary hover:bg-primary/5 disabled:opacity-50">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m) => <MessageBubble key={m.id} message={m} onOpenCode={onOpenCode} />)}
            {pending && (
              <>
                <MessageBubble message={{ id: "pending", senderType: "user", content: pending, flagStatus: "none", createdAt: "" }} onOpenCode={onOpenCode} />
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Sparkles className="size-4 animate-pulse text-primary" /> Mentor is thinking…</div>
              </>
            )}
          </>
        )}
        <div ref={bottom} />
      </div>

      <form
        className="border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSend();
        }}
      >
        {outOfMessages && <p className="mb-2 rounded-lg bg-muted p-2 text-sm">You&apos;ve used all your AI messages for today. Your limit resets tomorrow.</p>}
        <Textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          maxLength={4000}
          rows={2}
          placeholder="Ask a technical question… (Shift+Enter for a new line)"
          aria-label="Message the AI Mentor"
          className="resize-none"
        />
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {usage && !("unlimited" in usage) ? `${usage.remaining} of ${usage.limit} AI messages left today` : "Only technical questions are answered."}
          </p>
          <Button type="submit" size="sm" disabled={!draft.trim() || !!pending || outOfMessages}>
            {pending ? <Spinner /> : <Send />} Send
          </Button>
        </div>
      </form>
    </section>
  );
}

function MessageBubble({ message, onOpenCode }: { message: MentorMessage; onOpenCode: (id: string) => void }) {
  const isUser = message.senderType === "user";
  const flagged = message.flagStatus !== "none";
  const code = isUser ? [] : extractCode(message.id, message.content);
  return (
    <div className={cn("group", isUser ? "ml-8 flex justify-end" : "mr-4")}>
      <div
        className={cn(
          "max-w-full rounded-xl p-3 text-sm",
          isUser ? "bg-primary/10 whitespace-pre-wrap" : "border bg-background",
          flagged && !isUser && "border-warning/40 bg-warning/10",
        )}
      >
        {!isUser && (
          <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            {flagged ? <><ShieldAlert className="size-3 text-warning" /> Mentor (outside scope)</> : <><Sparkles className="size-3" /> Mentor</>}
          </p>
        )}
        {isUser ? message.content : <Markdown className="text-sm">{message.content}</Markdown>}
        {!isUser && !flagged && (
          <div className="mt-2 flex flex-wrap gap-1 opacity-70 group-hover:opacity-100">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => void copyText(message.content)}><Copy className="size-3" /> Copy answer</Button>
            {code.map((b, i) => (
              <Button key={b.id} size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onOpenCode(b.id)}>
                <Code2 className="size-3" /> Open {code.length > 1 ? `#${i + 1} ` : ""}in sandbox
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
