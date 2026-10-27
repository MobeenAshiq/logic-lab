"use client";

import { useMutation } from "@tanstack/react-query";
import { BadgeCheck, ChevronDown, ChevronUp, Flag } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Field, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { toastError } from "@/lib/errors";
import { timeAgo } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { CommunityAuthor, ReportReason } from "@/types/api";

const tc = t.community;

/** Name, Mentor/Team badge and time. */
export function AuthorLine({
  author,
  at,
  verb = "asked",
}: {
  author: CommunityAuthor;
  at: string;
  verb?: "asked" | "answered";
}) {
  const staff = author.role !== "student";
  return (
    <span className="text-muted-foreground inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
      <span className="text-foreground font-medium">{author.fullName || "—"}</span>
      {staff && (
        <StatusBadge tone="primary">
          <BadgeCheck className="size-3" />
          {author.role === "mentor" ? tc.mentor : tc.team}
        </StatusBadge>
      )}
      <span>{verb === "asked" ? tc.asked(timeAgo(at)) : tc.answered(timeAgo(at))}</span>
    </span>
  );
}

/** Up/down vote with optimistic score. Clicking your current vote again removes it. */
export function VoteControl({
  targetType,
  targetId,
  score,
  myVote,
  disabled,
  orientation = "vertical",
}: {
  targetType: "post" | "answer";
  targetId: string;
  score: number;
  myVote: number;
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
}) {
  const [state, setState] = useState({ score, myVote });
  const vote = useMutation({
    mutationFn: (value: number) =>
      api<{ score: number; myVote: number }>("/community/votes", {
        method: "PUT",
        body: { targetType, targetId, value },
      }),
    onMutate: (value) => {
      const previous = state;
      setState({ score: state.score - state.myVote + value, myVote: value });
      return previous;
    },
    onSuccess: (res) => setState(res),
    onError: (err, _v, previous) => {
      if (previous) setState(previous);
      toastError(err);
    },
  });
  const click = (value: 1 | -1) => vote.mutate(state.myVote === value ? 0 : value);

  return (
    <div
      className={cn(
        "flex items-center gap-0.5",
        orientation === "vertical" ? "flex-col" : "flex-row",
      )}
    >
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={tc.upvote}
        aria-pressed={state.myVote === 1}
        disabled={disabled || vote.isPending}
        onClick={() => click(1)}
        className={cn(state.myVote === 1 && "text-primary bg-primary/10")}
      >
        <ChevronUp />
      </Button>
      <span className="min-w-6 text-center text-sm font-semibold tabular-nums">{state.score}</span>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label={tc.downvote}
        aria-pressed={state.myVote === -1}
        disabled={disabled || vote.isPending}
        onClick={() => click(-1)}
        className={cn(state.myVote === -1 && "text-destructive bg-destructive/10")}
      >
        <ChevronDown />
      </Button>
    </div>
  );
}

const REASONS = Object.keys(tc.reportReasons) as ReportReason[];

export function ReportButton({
  targetType,
  targetId,
  reported,
}: {
  targetType: "post" | "answer";
  targetId: string;
  reported: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(reported);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [details, setDetails] = useState("");
  const send = useMutation({
    mutationFn: () =>
      api("/community/reports", {
        method: "POST",
        body: { targetType, targetId, reason, details },
      }),
    onSuccess: () => {
      setDone(true);
      setOpen(false);
      toast.success(tc.reportThanks);
    },
    onError: toastError,
  });

  if (done) {
    return (
      <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
        <Flag className="size-3" /> {tc.reported}
      </span>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="xs" variant="ghost" className="text-muted-foreground">
          <Flag /> {tc.report}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tc.reportTitle}</DialogTitle>
          <DialogDescription className="sr-only">{tc.reportTitle}</DialogDescription>
        </DialogHeader>
        <RadioGroup
          value={reason}
          onValueChange={(v) => setReason(v as ReportReason)}
          className="grid gap-2"
        >
          {REASONS.map((r) => (
            <Label key={r} className="flex items-center gap-2 font-normal">
              <RadioGroupItem value={r} /> {tc.reportReasons[r]}
            </Label>
          ))}
        </RadioGroup>
        <Field label={tc.reportDetails} htmlFor="report-details">
          <Textarea
            id="report-details"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            maxLength={1000}
            rows={3}
          />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t.common.actions.cancel}
          </Button>
          <Button onClick={() => send.mutate()} disabled={send.isPending}>
            {send.isPending && <Spinner />}
            {tc.reportSend}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
