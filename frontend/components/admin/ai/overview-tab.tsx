"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, KeyRound, MessagesSquare, PauseCircle, ShieldAlert, Users } from "lucide-react";
import { useState } from "react";
import { ErrorState, LoadingRows, StatCard, StatusBadge, type Tone } from "@/components/shared";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api/client";
import { PROVIDER_LABEL, type AiOverview, type ProviderOverview } from "@/lib/ai-mentor";
import { cn } from "@/lib/utils";

export const OVERVIEW_KEY = ["admin", "ai", "overview"] as const;
const n = new Intl.NumberFormat("en");

const STATUS: Record<ProviderOverview["status"], { tone: Tone; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  ok: { tone: "success", label: "Healthy", icon: CheckCircle2 },
  rate_limited: { tone: "warning", label: "Rate limited today", icon: AlertTriangle },
  capped: { tone: "danger", label: "Daily cap reached", icon: PauseCircle },
  no_key: { tone: "neutral", label: "No API key", icon: KeyRound },
};

export function OverviewTab() {
  const query = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => api<AiOverview>("/admin/ai/overview", { query: { days: 14 } }),
    refetchInterval: 30_000,
  });
  if (query.isLoading) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const data = query.data!;
  const totalToday = data.providers.reduce((s, p) => s + p.today.requests, 0);

  return (
    <div className="space-y-6">
      {!data.enabled && (
        <p className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
          <PauseCircle className="size-4 text-warning" /> The AI Mentor is switched off for students. Turn it on under Prompt &amp; behaviour.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Activity} label="API requests today" value={n.format(totalToday)} />
        <StatCard icon={MessagesSquare} label="Mentor messages today" value={n.format(data.mentor.messagesToday)} />
        <StatCard icon={Users} label="Active students today" value={n.format(data.mentor.activeUsersToday)} />
        <StatCard icon={ShieldAlert} label="Open safety flags" value={n.format(data.safety.openFlags)} trend={data.safety.flagsToday ? `${data.safety.flagsToday} today` : undefined} trendPositive={false} />
      </div>
      <p className="text-xs text-muted-foreground">Counts include every AI feature (mentor, lesson tutor, code review, question drafts). Daily counters reset at 00:00 UTC ({new Date(data.resetsAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} your time). Refreshes every 30 seconds.</p>
      <div className="grid gap-4 lg:grid-cols-3">
        {[...data.providers].sort((a, b) => (a.order ?? 99) - (b.order ?? 99)).map((p) => <ProviderCard key={p.provider} p={p} />)}
      </div>
    </div>
  );
}

function ProviderCard({ p }: { p: ProviderOverview }) {
  const status = STATUS[p.status];
  const used = p.today.requests;
  const pct = p.dailyCap > 0 ? Math.min(100, (used / p.dailyCap) * 100) : 0;
  const meterTone = pct >= 100 ? "bg-danger" : pct >= 80 ? "bg-warning" : "bg-primary";
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{PROVIDER_LABEL[p.provider]}</CardTitle>
            <CardDescription className="truncate font-mono text-xs" title={p.model}>{p.model}</CardDescription>
          </div>
          <StatusBadge tone={status.tone}><status.icon className="mr-1 inline size-3" />{status.label}</StatusBadge>
        </div>
        <p className="text-xs text-muted-foreground">{p.order ? `Fallback position ${p.order}` : "Not in the fallback order"}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium">Requests today</span>
            <span className="text-muted-foreground">{n.format(used)}{p.dailyCap > 0 ? ` / ${n.format(p.dailyCap)} cap` : " (no cap)"}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted" role="meter" aria-valuemin={0} aria-valuemax={p.dailyCap || undefined} aria-valuenow={used} aria-label={`${PROVIDER_LABEL[p.provider]} requests today`}>
            <div className={cn("h-full rounded-full", meterTone)} style={{ width: `${pct}%` }} />
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-2 text-center text-xs">
          <Metric label="Tokens" value={n.format(p.today.tokensIn + p.today.tokensOut)} />
          <Metric label="Failures" value={n.format(p.today.failures)} />
          <Metric label="429s" value={n.format(p.today.rateLimited)} />
        </dl>
        <DailyBars p={p} />
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 py-1.5">
      <dd className="font-semibold text-foreground">{value}</dd>
      <dt className="text-muted-foreground">{label}</dt>
    </div>
  );
}

/** Single-series bars (one per day). Hover or focus a day for its numbers; a hidden table mirrors it. */
function DailyBars({ p }: { p: ProviderOverview }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...p.daily.map((d) => d.requests));
  const shown = hover === null ? null : p.daily[hover];
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" });
  return (
    <div>
      <div className="mb-1 flex h-4 justify-between text-xs">
        <span className="font-medium">Last {p.daily.length} days</span>
        <span className="text-muted-foreground">
          {shown ? `${day(shown.day)}: ${n.format(shown.requests)} req · ${n.format(shown.tokens)} tok${shown.rateLimited ? ` · ${shown.rateLimited}×429` : ""}` : `peak ${n.format(max)}/day`}
        </span>
      </div>
      <div className="flex h-16 items-end gap-0.5 border-b border-border" onMouseLeave={() => setHover(null)} aria-hidden>
        {p.daily.map((d, i) => (
          <div key={d.day} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
            <div
              className={cn("w-full rounded-t-[4px] bg-primary transition-opacity", hover !== null && hover !== i && "opacity-40", d.requests === 0 && "bg-transparent")}
              style={{ height: `${(d.requests / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{day(p.daily[0].day)}</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>{PROVIDER_LABEL[p.provider]} daily usage</caption>
        <thead><tr><th>Day</th><th>Requests</th><th>Tokens</th><th>Rate limited</th><th>Failures</th></tr></thead>
        <tbody>{p.daily.map((d) => <tr key={d.day}><td>{d.day}</td><td>{d.requests}</td><td>{d.tokens}</td><td>{d.rateLimited}</td><td>{d.failures}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
