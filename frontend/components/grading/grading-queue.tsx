"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronRight, Clock, MonitorX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge } from "@/components/shared";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { timeAgo } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { GradingItem } from "@/types/api";

const s = t.grading.queue;
type Status = "pending" | "graded";

export const gradingKey = (status: Status) => ["teach", "grading", status] as const;

function itemHref(basePath: string, item: GradingItem) {
  return `${basePath}/${item.kind === "submission" ? "submissions" : "attempts"}/${item.id}`;
}

function KindBadge({ item }: { item: GradingItem }) {
  return (
    <StatusBadge tone={item.kind === "attempt" ? "primary" : "neutral"}>
      {item.kind === "attempt" ? s.quiz : s.assignment}
    </StatusBadge>
  );
}

function Checks({ item }: { item: GradingItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {item.late && (
        <StatusBadge tone="danger">
          <Clock className="size-3" /> {s.late}
        </StatusBadge>
      )}
      {item.flagged && (
        <StatusBadge tone="warning">
          <AlertTriangle className="size-3" /> {s.flagged}
        </StatusBadge>
      )}
      {item.tabSwitches ? (
        <StatusBadge tone="warning">
          <MonitorX className="size-3" /> {s.tabSwitches(item.tabSwitches)}
        </StatusBadge>
      ) : null}
    </div>
  );
}

/** List of work to grade (or already graded) in the courses the user teaches. */
export function GradingQueue({ basePath }: { basePath: string }) {
  const [status, setStatus] = useState<Status>("pending");
  const queue = useQuery({
    queryKey: gradingKey(status),
    queryFn: () => api<GradingItem[]>("/teach/grading", { query: { status } }),
  });

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} />
      <Tabs value={status} onValueChange={(v) => setStatus(v as Status)} className="mb-4">
        <TabsList>
          <TabsTrigger value="pending">{s.pending}</TabsTrigger>
          <TabsTrigger value="graded">{s.graded}</TabsTrigger>
        </TabsList>
      </Tabs>

      {queue.isError ? (
        <ErrorState error={queue.error} onRetry={() => queue.refetch()} />
      ) : !queue.data ? (
        <LoadingRows rows={4} />
      ) : queue.data.length === 0 ? (
        <EmptyState title={status === "pending" ? s.emptyPending : s.emptyGraded} />
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="space-y-3 md:hidden">
            {queue.data.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <Link
                  href={itemHref(basePath, item)}
                  className="hover:bg-muted/40 block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {item.student.fullName || item.student.email}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{item.student.email}</p>
                    </div>
                    <KindBadge item={item} />
                  </div>
                  <p className="mt-2 text-sm">
                    {item.course.title} › {item.lesson.title}
                  </p>
                  <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {item.submittedAt && <span>{timeAgo(item.submittedAt)}</span>}
                    {status === "graded" && (
                      <span className="text-foreground font-medium tabular-nums">
                        {s.score(item.score, item.maxScore)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2">
                    <Checks item={item} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.columns.student}</TableHead>
                  <TableHead>{s.columns.work}</TableHead>
                  <TableHead>{s.columns.submitted}</TableHead>
                  <TableHead>{s.columns.checks}</TableHead>
                  {status === "graded" && <TableHead>{s.columns.score}</TableHead>}
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.data.map((item) => (
                  <TableRow key={`${item.kind}-${item.id}`} className="relative">
                    <TableCell>
                      <p className="font-medium">{item.student.fullName || item.student.email}</p>
                      <p className="text-muted-foreground text-xs">{item.student.email}</p>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex items-center gap-2">
                        <KindBadge item={item} />
                        <Link
                          href={itemHref(basePath, item)}
                          className="font-medium after:absolute after:inset-0 hover:underline"
                        >
                          {item.lesson.title}
                        </Link>
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">{item.course.title}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.submittedAt ? timeAgo(item.submittedAt) : "–"}
                    </TableCell>
                    <TableCell>
                      <Checks item={item} />
                    </TableCell>
                    {status === "graded" && (
                      <TableCell className="font-medium tabular-nums">
                        {s.score(item.score, item.maxScore)}
                      </TableCell>
                    )}
                    <TableCell>
                      <ChevronRight className="text-muted-foreground size-4" aria-label={s.open} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </>
  );
}
