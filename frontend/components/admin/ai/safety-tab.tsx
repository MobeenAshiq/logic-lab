"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, MessagesSquare, RotateCcw } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingRows, StatusBadge, type Tone } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api/client";
import { CATEGORY_LABEL, type FlagCategory, type Paged, type SecurityFlag } from "@/lib/ai-mentor";
import { toastError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { OVERVIEW_KEY } from "./overview-tab";

const PAGE_SIZE = 25;
const CATEGORY_TONE: Record<FlagCategory, Tone> = {
  prompt_injection: "danger",
  harmful: "danger",
  off_topic: "neutral",
  blocked_phrase: "warning",
};

/** Requests caught by the guardrail (local filter) or refused by the model, for review. */
export function SafetyTab({ onOpenSession }: { onOpenSession: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<"open" | "reviewed" | "all">("open");
  const [category, setCategory] = useState<FlagCategory | "all">("all");
  const [page, setPage] = useState(1);
  const params = { status, category: category === "all" ? undefined : category, page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: ["admin", "ai", "flags", params],
    queryFn: () => api<Paged<SecurityFlag>>("/admin/ai/flags", { query: params }),
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
  const review = useMutation({
    mutationFn: ({ id, reviewed }: { id: string; reviewed: boolean }) => api(`/admin/ai/flags/${id}`, { method: "PATCH", body: { reviewed } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "ai", "flags"] });
      void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
    },
    onError: toastError,
  });

  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={status} onValueChange={(v) => { setStatus(v as typeof status); setPage(1); }}>
          <SelectTrigger className="w-40" aria-label="Review status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Needs review</SelectItem>
            <SelectItem value="reviewed">Reviewed</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => { setCategory(v as typeof category); setPage(1); }}>
          <SelectTrigger className="w-48" aria-label="Category"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {(Object.keys(CATEGORY_LABEL) as FlagCategory[]).map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title={status === "open" ? "Nothing to review" : "No safety log entries"} description="Blocked and refused requests show up here." />
      ) : (
        <>
          <ul className="space-y-3">
            {data.items.map((f) => (
              <li key={f.id} className="rounded-xl border p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  <StatusBadge tone={CATEGORY_TONE[f.category]}>{CATEGORY_LABEL[f.category]}</StatusBadge>
                  <span className="text-muted-foreground">{f.source === "local" ? "Blocked by filter (no API call)" : "Refused by the model"}</span>
                  <span className="text-muted-foreground">· {formatDateTime(f.timestamp)}</span>
                  {f.reviewedAt && <StatusBadge tone="success">Reviewed</StatusBadge>}
                </div>
                <p className="text-sm font-medium">{f.user.profile?.fullName || f.user.email} <span className="font-normal text-muted-foreground">({f.user.email})</span></p>
                <blockquote className="mt-2 rounded-lg bg-muted p-3 text-sm whitespace-pre-wrap break-words">{f.promptText}</blockquote>
                <p className="mt-2 text-xs text-muted-foreground">Reason: {f.reason}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {f.reviewedAt ? (
                    <Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: f.id, reviewed: false })}><RotateCcw /> Reopen</Button>
                  ) : (
                    <Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: f.id, reviewed: true })}><Check /> Mark reviewed</Button>
                  )}
                  {f.sessionId && <Button size="sm" variant="ghost" onClick={() => onOpenSession(f.sessionId!)}><MessagesSquare /> Open chat</Button>}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{data.total} entries</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
