"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { useDebounced } from "@/components/admin/use-debounced";
import { Markdown } from "@/components/community/markdown";
import { EmptyState, ErrorState, LoadingRows, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { PROVIDER_LABEL, STACKS, type AdminSessionDetail, type AdminSessionRow, type AiProvider, type Paged } from "@/lib/ai-mentor";
import { formatDateTime, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;
const stackLabel = (v: string) => STACKS.find((s) => s.value === v)?.label ?? v;
const who = (u: AdminSessionRow["user"]) => u.profile?.fullName || u.email;

/** Live list of mentor chats (polls every 10s) with a full transcript view. */
export function InspectorTab({ openSessionId, onOpenSession }: { openSessionId: string | null; onOpenSession: (id: string | null) => void }) {
  const [search, setSearch] = useState("");
  const [flagged, setFlagged] = useState(false);
  const [page, setPage] = useState(1);
  const debounced = useDebounced(search.trim());
  const params = { search: debounced, flagged: flagged ? "true" : undefined, page, pageSize: PAGE_SIZE };
  const list = useQuery({
    queryKey: ["admin", "ai", "sessions", params],
    queryFn: () => api<Paged<AdminSessionRow>>("/admin/ai/sessions", { query: params }),
    placeholderData: keepPreviousData,
    refetchInterval: 10_000,
    enabled: !openSessionId,
  });

  if (openSessionId) return <Transcript id={openSessionId} onBack={() => onOpenSession(null)} />;

  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search student name, email, or chat title" aria-label="Search chats" className="pl-8" />
        </div>
        <div className="flex items-center gap-2">
          <Switch id="flagged-only" checked={flagged} onCheckedChange={(v) => { setFlagged(v); setPage(1); }} />
          <Label htmlFor="flagged-only" className="text-sm">Flagged chats only</Label>
        </div>
        <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><span className="size-2 animate-pulse rounded-full bg-success" /> Live</span>
      </div>
      {list.isLoading ? (
        <LoadingRows />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No mentor chats yet" description={flagged || debounced ? "Try clearing the filters." : "Chats appear here as soon as students start using the AI Mentor."} />
      ) : (
        <>
          <ul className="divide-y rounded-xl border">
            {data.items.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onOpenSession(s.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left hover:bg-muted/50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {who(s.user)} · {s.course?.title ?? "No course"}{s.module ? ` › ${s.module.title}` : ""} · {stackLabel(s.stackType)}
                    </p>
                  </div>
                  {s._count.flags > 0 && <StatusBadge tone="warning"><ShieldAlert className="mr-1 inline size-3" />{s._count.flags} flagged</StatusBadge>}
                  <span className="text-xs text-muted-foreground">{s._count.messages} msgs</span>
                  <span className="w-24 text-right text-xs text-muted-foreground">{timeAgo(s.lastMessageAt)}</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{data.total} chats</span>
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

function Transcript({ id, onBack }: { id: string; onBack: () => void }) {
  const query = useQuery({
    queryKey: ["admin", "ai", "session", id],
    queryFn: () => api<AdminSessionDetail>(`/admin/ai/sessions/${id}`),
    refetchInterval: 10_000,
  });
  const s = query.data;
  const tokens = s?.messages.reduce((sum, m) => sum + m.tokensUsed, 0) ?? 0;
  return (
    <div className="space-y-4">
      <Button size="sm" variant="ghost" onClick={onBack}><ArrowLeft /> All chats</Button>
      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : s ? (
        <>
          <div className="rounded-xl border p-4">
            <h3 className="font-heading text-lg font-semibold">{s.title}</h3>
            <p className="text-sm text-muted-foreground">
              {who(s.user)} ({s.user.email}) · {s.course?.title ?? "No course"}{s.module ? ` › ${s.module.title}` : ""} · {stackLabel(s.stackType)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Started {formatDateTime(s.createdAt)} · {s.messages.length} messages · {tokens.toLocaleString()} tokens</p>
          </div>
          <div className="space-y-3">
            {s.messages.map((m) => {
              const flagged = m.flagStatus !== "none";
              return (
                <div key={m.id} className={cn("rounded-xl border p-3 text-sm", m.senderType === "user" ? "bg-primary/5" : "bg-background", flagged && "border-warning/40 bg-warning/10")}>
                  <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{m.senderType === "user" ? "Student" : "Mentor"}</span>
                    <span>{formatDateTime(m.createdAt)}</span>
                    {m.provider && <span>{PROVIDER_LABEL[m.provider as AiProvider] ?? m.provider} · <span className="font-mono">{m.model}</span></span>}
                    {m.tokensUsed > 0 && <span>{m.tokensUsed} tokens</span>}
                    {flagged && <StatusBadge tone="warning">{m.flagStatus === "blocked" ? "Blocked by filter" : "Refused by model"}</StatusBadge>}
                  </div>
                  {m.senderType === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <Markdown className="text-sm">{m.content}</Markdown>}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}
