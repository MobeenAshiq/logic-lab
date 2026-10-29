"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";

type ChatMessage = { role: "user" | "assistant"; content: string };
export type Usage = { limit: number; used: number; remaining: number; resetsAt: string };
export const usageKey = ["ai", "usage"] as const;

export function AiTutorPanel({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const usage = useQuery({ queryKey: usageKey, queryFn: () => api<Usage>("/learn/ai/usage") });
  const ask = useMutation({
    mutationFn: (next: ChatMessage[]) => api<{ reply: string } & Usage>(`/learn/lessons/${lessonId}/ai/chat`, { method: "POST", body: { messages: next } }),
    onSuccess: (result, next) => {
      setMessages([...next, { role: "assistant", content: result.reply }]);
      setDraft("");
      queryClient.setQueryData(usageKey, result);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "AI_DAILY_LIMIT_REACHED") {
        toast.message("You’ve used all your AI tutor messages for today. Your limit resets tomorrow.");
        void queryClient.invalidateQueries({ queryKey: usageKey });
      } else toastError(error);
    },
  });

  const submit = () => {
    const text = draft.trim();
    if (!text || ask.isPending || usage.data?.remaining === 0) return;
    const next = [...messages, { role: "user" as const, content: text }].slice(-12);
    ask.mutate(next);
  };

  return (
    <Card className="mt-6 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Bot className="size-4 text-primary" /> AI lesson tutor</CardTitle>
        <p className="text-muted-foreground text-sm">Get hints and explanations. The tutor won’t write a full answer to an active assignment.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {messages.length > 0 && <div className="max-h-80 space-y-3 overflow-y-auto rounded-lg bg-muted/30 p-3" aria-live="polite">
          {messages.map((message, index) => <div key={`${index}-${message.role}`} className={message.role === "user" ? "ml-8 rounded-lg bg-primary/10 p-3 text-sm" : "mr-8 rounded-lg border bg-background p-3 text-sm whitespace-pre-wrap"}>
            <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">{message.role === "assistant" ? <><Sparkles className="size-3" /> Tutor</> : "You"}</p>{message.content}
          </div>)}
        </div>}
        <div className="space-y-2">
          {usage.data?.remaining === 0 && <p className="rounded-lg bg-muted p-3 text-sm">You’ve used all your AI tutor messages for today. Your limit resets tomorrow.</p>}
          <Textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); submit(); } }} maxLength={4000} rows={3} placeholder="Ask about a concept from this lesson…" aria-label="Ask the AI tutor" />
          <div className="flex items-center justify-between gap-3">
            <p className="text-muted-foreground text-xs">{usage.data ? `${usage.data.remaining} of ${usage.data.limit} AI messages remaining today` : "Daily message limit applies"}</p>
            <Button size="sm" onClick={submit} disabled={!draft.trim() || ask.isPending || usage.data?.remaining === 0}>{ask.isPending ? "Thinking…" : "Ask tutor"}<Send className="ml-1 size-3.5" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
