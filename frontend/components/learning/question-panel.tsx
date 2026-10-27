"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Clock, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState, LoadingRows, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { t } from "@/lib/i18n";
import { formatClock, learningKeys } from "@/lib/learning";
import type { LessonQuestion } from "@/types/api";

const tq = t.learning.qa;

/** Q&A under a lesson. `currentTime`/`onSeek` connect it to the video player. */
export function QuestionPanel({
  lessonId,
  currentTime,
  onSeek,
}: {
  lessonId: string;
  currentTime?: () => number;
  onSeek?: (seconds: number) => void;
}) {
  const queryClient = useQueryClient();
  const questions = useQuery({
    queryKey: learningKeys.questions(lessonId),
    queryFn: () => api<LessonQuestion[]>(`/learn/lessons/${lessonId}/questions`),
  });
  const [body, setBody] = useState("");
  const [withTime, setWithTime] = useState(Boolean(currentTime));

  const ask = useMutation({
    mutationFn: () =>
      api<LessonQuestion>(`/learn/lessons/${lessonId}/questions`, {
        method: "POST",
        body: {
          body: body.trim(),
          timestampSeconds: withTime && currentTime ? Math.floor(currentTime()) : null,
        },
      }),
    onSuccess: () => {
      setBody("");
      toast.success(tq.asked);
      void queryClient.invalidateQueries({ queryKey: learningKeys.questions(lessonId) });
    },
    onError: toastError,
  });

  return (
    <div className="space-y-6">
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim().length >= 3) ask.mutate();
        }}
      >
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={tq.askPlaceholder}
          maxLength={2000}
          rows={3}
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {currentTime ? (
            <Label className="flex items-center gap-2 text-sm font-normal">
              <Checkbox checked={withTime} onCheckedChange={(v) => setWithTime(v === true)} />
              {tq.attachTime}
            </Label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm" disabled={ask.isPending || body.trim().length < 3}>
            {ask.isPending && <Spinner />}
            {tq.ask}
          </Button>
        </div>
      </form>

      {questions.isLoading ? (
        <LoadingRows rows={2} />
      ) : !questions.data?.length ? (
        <EmptyState icon={MessageSquare} title={tq.empty} />
      ) : (
        <ul className="space-y-4">
          {questions.data.map((q) => (
            <QuestionItem key={q.id} question={q} lessonId={lessonId} onSeek={onSeek} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuestionItem({
  question: q,
  lessonId,
  onSeek,
  defaultOpen = false,
}: {
  question: LessonQuestion;
  lessonId: string;
  onSeek?: (seconds: number) => void;
  defaultOpen?: boolean;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(defaultOpen);
  const [reply, setReply] = useState("");
  const answer = useMutation({
    mutationFn: () =>
      api<LessonQuestion>(`/learn/questions/${q.id}/answers`, {
        method: "POST",
        body: { body: reply.trim() },
      }),
    onSuccess: () => {
      setReply("");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: learningKeys.questions(lessonId) });
      void queryClient.invalidateQueries({ queryKey: ["teach", "questions"] });
    },
    onError: toastError,
  });

  return (
    <li className="rounded-xl border p-4">
      <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
        <span className="text-foreground font-medium">{q.author.fullName}</span>
        <span>{timeAgo(q.createdAt)}</span>
        {q.timestampSeconds !== null &&
          (onSeek ? (
            <button
              type="button"
              onClick={() => onSeek(q.timestampSeconds!)}
              className="bg-primary/10 text-primary hover:bg-primary/15 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium"
              aria-label={tq.jump(formatClock(q.timestampSeconds))}
            >
              <Clock className="size-3" /> {formatClock(q.timestampSeconds)}
            </button>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3" /> {tq.atTime(formatClock(q.timestampSeconds))}
            </span>
          ))}
      </div>
      <p className="mt-2 text-sm whitespace-pre-line">{q.body}</p>

      {q.answers.length > 0 && (
        <ul className="mt-3 space-y-3 border-l-2 pl-4">
          {q.answers.map((a) => (
            <li key={a.id}>
              <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                <span className="text-foreground font-medium">{a.author.fullName}</span>
                {a.isStaff && (
                  <StatusBadge tone="primary">
                    <BadgeCheck className="size-3" />
                    {a.author.role === "mentor" ? tq.mentor : tq.staff}
                  </StatusBadge>
                )}
                <span>{timeAgo(a.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-line">{a.body}</p>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (reply.trim()) answer.mutate();
          }}
        >
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={tq.answerPlaceholder}
            maxLength={4000}
            rows={2}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" size="sm" disabled={answer.isPending || !reply.trim()}>
              {answer.isPending && <Spinner />}
              {tq.answer}
            </Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="ghost" className="mt-2 -ml-2" onClick={() => setOpen(true)}>
          {tq.answer}
        </Button>
      )}
    </li>
  );
}
