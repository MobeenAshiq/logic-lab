"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { InspectorTab } from "@/components/admin/ai/inspector-tab";
import { OVERVIEW_KEY, OverviewTab } from "@/components/admin/ai/overview-tab";
import { PromptTab } from "@/components/admin/ai/prompt-tab";
import { ProvidersTab } from "@/components/admin/ai/providers-tab";
import { SafetyTab } from "@/components/admin/ai/safety-tab";
import { PageHeader } from "@/components/shared";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import type { AiOverview } from "@/lib/ai-mentor";

type Tab = "overview" | "inspector" | "safety" | "providers" | "prompt";

export default function AdminAiPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Shares the overview query (and its cache) for the open-flags badge.
  const overview = useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: () => api<AiOverview>("/admin/ai/overview", { query: { days: 14 } }),
    refetchInterval: 30_000,
  });
  const openFlags = overview.data?.safety.openFlags ?? 0;

  return (
    <>
      <PageHeader
        title="AI Mentor"
        description="API usage against free quotas, live chats, safety reviews, provider keys and prompt tuning."
      />
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <div className="-mx-4 mb-4 overflow-x-auto px-4">
          <TabsList>
            <TabsTrigger value="overview">Usage</TabsTrigger>
            <TabsTrigger value="inspector">Chat inspector</TabsTrigger>
            <TabsTrigger value="safety">
              Safety log{openFlags > 0 && <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-[11px] font-semibold">{openFlags}</span>}
            </TabsTrigger>
            <TabsTrigger value="providers">Providers &amp; keys</TabsTrigger>
            <TabsTrigger value="prompt">Prompt &amp; behaviour</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="inspector"><InspectorTab openSessionId={sessionId} onOpenSession={setSessionId} /></TabsContent>
        <TabsContent value="safety">
          <SafetyTab
            onOpenSession={(id) => {
              setSessionId(id);
              setTab("inspector");
            }}
          />
        </TabsContent>
        <TabsContent value="providers"><ProvidersTab /></TabsContent>
        <TabsContent value="prompt"><PromptTab /></TabsContent>
      </Tabs>
    </>
  );
}
