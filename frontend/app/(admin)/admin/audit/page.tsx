"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Fragment, useState } from "react";
import { useDebounced } from "@/components/admin/use-debounced";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { AuditLog } from "@/types/api";

const s = t.admin.audit;
const PAGE_SIZE = 50;

function shortId(id: string | null) {
  return id ? `${id.slice(0, 8)}…` : "—";
}

export default function AdminAuditPage() {
  const [targetId, setTargetId] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const debounced = useDebounced(targetId.trim());

  const params = { targetId: debounced, page, pageSize: PAGE_SIZE };
  const query = useQuery({
    queryKey: ["admin", "audit", params],
    queryFn: () => api<AuditLog[]>("/admin/audit-logs", { query: params }),
    placeholderData: keepPreviousData,
  });
  const logs = query.data ?? [];

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} />
      <div className="relative mb-4 max-w-md">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
        <Input
          value={targetId}
          onChange={(e) => {
            setTargetId(e.target.value);
            setPage(1);
          }}
          placeholder={s.filter}
          aria-label={s.filter}
          className="pl-8 font-mono text-xs"
        />
      </div>

      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : logs.length === 0 ? (
        <EmptyState title={s.empty} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.columns.time}</TableHead>
                <TableHead>{s.columns.action}</TableHead>
                <TableHead>{s.columns.target}</TableHead>
                <TableHead>{s.columns.actor}</TableHead>
                <TableHead>{s.columns.ip}</TableHead>
                <TableHead className="text-right">{s.columns.details}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <Fragment key={log.id}>
                  <TableRow>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.action}</TableCell>
                    <TableCell className="text-xs">
                      <span className="text-muted-foreground">{log.targetType}</span>{" "}
                      <button
                        type="button"
                        className="hover:text-primary font-mono"
                        title={log.targetId ?? undefined}
                        onClick={() => {
                          if (log.targetId) {
                            setTargetId(log.targetId);
                            setPage(1);
                          }
                        }}
                      >
                        {shortId(log.targetId)}
                      </button>
                    </TableCell>
                    <TableCell className="font-mono text-xs" title={log.actorId ?? undefined}>
                      {log.actorId ? shortId(log.actorId) : s.system}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {log.ip ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                        aria-expanded={expanded === log.id}
                      >
                        {expanded === log.id ? s.hide : s.show}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded === log.id && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={6}>
                        <pre className="max-h-64 overflow-auto font-mono text-xs whitespace-pre-wrap">
                          {JSON.stringify(
                            { targetId: log.targetId, actorId: log.actorId, ...log.metadata },
                            null,
                            2,
                          )}
                        </pre>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {(page > 1 || logs.length === PAGE_SIZE) && (
        <div className="mt-4 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            {t.common.pagination.previous}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={logs.length < PAGE_SIZE}
            onClick={() => setPage(page + 1)}
          >
            {t.common.pagination.next}
          </Button>
        </div>
      )}
    </>
  );
}
