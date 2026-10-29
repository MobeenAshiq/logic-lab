"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Code2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { type Usage, usageKey } from "./ai-tutor-panel";

export function PracticeCodeReview({ lessonId }: { lessonId: string }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [review, setReview] = useState("");
  const usage = useQuery({ queryKey: usageKey, queryFn: () => api<Usage>("/learn/ai/usage") });
  const request = useMutation({
    mutationFn: () => api<{ review: string } & Usage>(`/learn/lessons/${lessonId}/ai/code-review`, { method: "POST", body: { code, language: "javascript" } }),
    onSuccess: (result) => { setReview(result.review); queryClient.setQueryData(usageKey, result); },
    onError: (error) => {
      if (error instanceof ApiError && error.code === "AI_DAILY_LIMIT_REACHED") {
        setReview("You’ve used all your AI messages for today. Your limit resets tomorrow.");
        void queryClient.invalidateQueries({ queryKey: usageKey });
      } else toastError(error);
    },
  });

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Code2 className="size-4 text-primary" /> Practice code review</CardTitle>
        <CardDescription>Get debugging hints on practice code. This review is unavailable for graded quizzes and assignments.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {usage.data?.remaining === 0 && <p className="rounded-lg bg-muted p-3 text-sm">You’ve used all your AI messages for today. Your limit resets tomorrow.</p>}
        <Textarea value={code} onChange={(event) => setCode(event.target.value)} rows={8} maxLength={12_000} placeholder="Paste your practice code here…" aria-label="Practice code" className="font-mono text-xs" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">{usage.data ? `${usage.data.remaining} of ${usage.data.limit} AI messages remaining today` : "Daily message limit applies"}</span>
          <Button size="sm" disabled={!code.trim() || request.isPending || usage.data?.remaining === 0} onClick={() => request.mutate()}>{request.isPending ? "Reviewing…" : "Review my code"}<Sparkles className="ml-1 size-4" /></Button>
        </div>
        {review && <div className="rounded-lg border bg-muted/30 p-4 text-sm leading-6 whitespace-pre-wrap" aria-live="polite">{review}</div>}
      </CardContent>
    </Card>
  );
}
