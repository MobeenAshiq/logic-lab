"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import { ModerationCard } from "@/components/moderation/moderation-card";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/shared";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { ModerationGroup } from "@/types/api";

const s = t.moderation;
type Status = "open" | "closed";

export default function ModerationPage() {
  const [status, setStatus] = useState<Status>("open");
  const query = useQuery({
    queryKey: ["admin", "moderation", status],
    queryFn: () => api<ModerationGroup[]>("/admin/moderation", { query: { status } }),
  });

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} />
      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)} className="mb-6">
        <TabsList>
          <TabsTrigger value="open">{s.tabs.open}</TabsTrigger>
          <TabsTrigger value="closed">{s.tabs.closed}</TabsTrigger>
        </TabsList>
      </Tabs>

      {query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.isLoading ? (
        <LoadingRows rows={3} />
      ) : !query.data?.length ? (
        <EmptyState icon={ShieldCheck} title={status === "open" ? s.emptyOpen : s.emptyClosed} />
      ) : (
        <div className="space-y-4">
          {query.data.map((group) => (
            <ModerationCard
              key={`${group.targetType}:${group.targetId}`}
              group={group}
              open={status === "open"}
            />
          ))}
        </div>
      )}
    </>
  );
}
