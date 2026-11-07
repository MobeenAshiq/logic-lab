"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, CheckCircle2, KeyRound, PlugZap, Trash2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ErrorState, Field, LoadingRows, Spinner, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ApiError, api } from "@/lib/api/client";
import { PROVIDER_LABEL, type AiMentorConfig, type AiProvider, type ProviderKeyStatus } from "@/lib/ai-mentor";
import { toastError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { OVERVIEW_KEY } from "./overview-tab";

export const CONFIG_KEY = ["admin", "settings", "ai_mentor"] as const;
const KEYS_KEY = ["admin", "ai", "keys"] as const;
const ALL: AiProvider[] = ["gemini", "groq", "openrouter"];
const KEY_HELP: Record<AiProvider, string> = {
  gemini: "aistudio.google.com → Get API key",
  groq: "console.groq.com → API Keys",
  openrouter: "openrouter.ai → Keys (use a :free model)",
};

/** Loads the ai_mentor setting and saves the whole object back (it is audited server-side). */
export function useMentorConfig() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: CONFIG_KEY, queryFn: () => api<AiMentorConfig>("/admin/settings/ai_mentor") });
  const save = useMutation({
    mutationFn: (config: AiMentorConfig) => api<AiMentorConfig>("/admin/settings/ai_mentor", { method: "PUT", body: config }),
    onSuccess: (data) => {
      queryClient.setQueryData(CONFIG_KEY, data);
      void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      toast.success("AI Mentor settings saved. They apply to the next message.");
    },
    onError: (err) => {
      const first = err instanceof ApiError ? Object.entries(err.fieldErrors)[0] : undefined;
      if (first) toast.error(`${first[0] || "Settings"}: ${first[1]}`);
      else toastError(err);
    },
  });
  return { query, save };
}

export function ProvidersTab() {
  const { query, save } = useMentorConfig();
  const keys = useQuery({ queryKey: KEYS_KEY, queryFn: () => api<ProviderKeyStatus[]>("/admin/ai/keys") });
  const [draft, setDraft] = useState<AiMentorConfig | null>(null);
  useEffect(() => {
    if (query.data) setDraft(query.data);
  }, [query.data]);

  if (query.isLoading || keys.isLoading || !draft) return <LoadingRows rows={4} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (keys.isError) return <ErrorState error={keys.error} onRetry={() => void keys.refetch()} />;

  const ordered = [...draft.providerOrder, ...ALL.filter((p) => !draft.providerOrder.includes(p))];
  const dirty = JSON.stringify(draft) !== JSON.stringify(query.data);
  const move = (p: AiProvider, delta: number) => {
    const order = [...draft.providerOrder];
    const i = order.indexOf(p);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    setDraft({ ...draft, providerOrder: order });
  };
  const toggle = (p: AiProvider, on: boolean) => {
    const order = on ? [...draft.providerOrder, p] : draft.providerOrder.filter((x) => x !== p);
    if (order.length === 0) return toast.error("Keep at least one provider in the fallback order.");
    setDraft({ ...draft, providerOrder: order });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Requests go to the first provider in the order below. If it has no key, has reached its daily cap, rate-limits (HTTP 429), errors, or times out, the next one is tried automatically.
      </p>
      {ordered.map((p) => {
        const position = draft.providerOrder.indexOf(p);
        return (
          <ProviderCard
            key={p}
            provider={p}
            status={keys.data!.find((k) => k.provider === p)!}
            position={position}
            total={draft.providerOrder.length}
            model={draft.models[p]}
            cap={draft.dailyCaps[p]}
            onModel={(model) => setDraft({ ...draft, models: { ...draft.models, [p]: model } })}
            onCap={(cap) => setDraft({ ...draft, dailyCaps: { ...draft.dailyCaps, [p]: cap } })}
            onMove={(d) => move(p, d)}
            onToggle={(on) => toggle(p, on)}
          />
        );
      })}
      <div className="sticky bottom-4 flex justify-end gap-2">
        {dirty && <Button variant="outline" onClick={() => setDraft(query.data!)}>Discard</Button>}
        <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(draft)}>{save.isPending && <Spinner />} Save routing</Button>
      </div>
    </div>
  );
}

function ProviderCard({
  provider,
  status,
  position,
  total,
  model,
  cap,
  onModel,
  onCap,
  onMove,
  onToggle,
}: {
  provider: AiProvider;
  status: ProviderKeyStatus;
  position: number;
  total: number;
  model: string;
  cap: number;
  onModel: (v: string) => void;
  onCap: (v: number) => void;
  onMove: (delta: number) => void;
  onToggle: (on: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const setKey = useMutation({
    mutationFn: (value: string | null) => api<ProviderKeyStatus[]>(`/admin/ai/keys/${provider}`, { method: "PATCH", body: { apiKey: value } }),
    onSuccess: (data, value) => {
      queryClient.setQueryData(KEYS_KEY, data);
      void queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      setApiKey("");
      setTest(null);
      toast.success(value ? "API key saved (encrypted)." : "Saved key removed.");
    },
    onError: toastError,
  });
  const runTest = useMutation({
    mutationFn: () => api<{ ok: boolean; latencyMs?: number; error?: string; model: string }>(`/admin/ai/keys/${provider}/test`, { method: "POST" }),
    onSuccess: (r) => setTest(r.ok ? { ok: true, message: `Works with ${r.model} (${r.latencyMs} ms).` } : { ok: false, message: r.error ?? "Failed." }),
    onError: toastError,
  });
  const active = position >= 0;

  return (
    <Card className={active ? undefined : "opacity-75"}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col">
            <Button size="icon" variant="ghost" className="size-6" disabled={!active || position === 0} onClick={() => onMove(-1)} aria-label={`Move ${PROVIDER_LABEL[provider]} up`}><ArrowUp className="size-3.5" /></Button>
            <Button size="icon" variant="ghost" className="size-6" disabled={!active || position === total - 1} onClick={() => onMove(1)} aria-label={`Move ${PROVIDER_LABEL[provider]} down`}><ArrowDown className="size-3.5" /></Button>
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-base">
              {active && <span className="grid size-5 place-items-center rounded-full bg-primary text-[11px] text-primary-foreground">{position + 1}</span>}
              {PROVIDER_LABEL[provider]}
            </CardTitle>
            <CardDescription>
              {status.source === "admin" ? `Key saved here, ending …${status.last4}${status.updatedAt ? ` (updated ${formatDateTime(status.updatedAt)})` : ""}` : status.source === "env" ? `Using the server .env key, ending …${status.last4}` : "No API key yet"}
            </CardDescription>
          </div>
          <StatusBadge tone={status.configured ? "success" : "neutral"}><KeyRound className="mr-1 inline size-3" />{status.configured ? "Key set" : "No key"}</StatusBadge>
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={active} onCheckedChange={onToggle} aria-label={`Use ${PROVIDER_LABEL[provider]}`} /> Use
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2">
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (apiKey.trim()) setKey.mutate(apiKey.trim());
          }}
        >
          <Field label={status.source === "admin" ? "Replace API key" : "API key"} htmlFor={`${provider}-key`} hint={`Get one at ${KEY_HELP[provider]}. Stored encrypted; never shown again.`}>
            <Input id={`${provider}-key`} type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="Paste key" className="font-mono" />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" type="submit" disabled={apiKey.trim().length < 10 || setKey.isPending}>{setKey.isPending && <Spinner />} Save key</Button>
            <Button size="sm" type="button" variant="outline" disabled={!status.configured || runTest.isPending} onClick={() => runTest.mutate()}>{runTest.isPending ? <Spinner /> : <PlugZap />} Test</Button>
            {status.source === "admin" && (
              <Button size="sm" type="button" variant="ghost" disabled={setKey.isPending} onClick={() => setKey.mutate(null)}><Trash2 /> Remove saved key</Button>
            )}
          </div>
          {test && (
            <p className={`flex items-start gap-1.5 text-xs ${test.ok ? "text-success" : "text-danger"}`}>
              {test.ok ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" /> : <XCircle className="mt-0.5 size-3.5 shrink-0" />} {test.message}
            </p>
          )}
        </form>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1 lg:grid-cols-2">
          <Field label="Model" htmlFor={`${provider}-model`} hint="Test after changing it; unsaved edits aren't tested.">
            <Input id={`${provider}-model`} value={model} onChange={(e) => onModel(e.target.value)} className="font-mono text-xs" />
          </Field>
          <Field label="Daily request cap" htmlFor={`${provider}-cap`} hint="Skip this provider after this many calls (UTC day). 0 = no cap.">
            <Input id={`${provider}-cap`} type="number" min={0} value={cap} onChange={(e) => onCap(Math.max(0, Math.floor(Number(e.target.value) || 0)))} />
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}
