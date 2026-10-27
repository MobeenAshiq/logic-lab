"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { WarningsBadge } from "@/components/admin/payment-badges";
import { EmptyState, ErrorState, LoadingRows, PageHeader, Pagination } from "@/components/shared";
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
import { pkr, timeAgo } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AdminPayment, Paginated, PaymentStatus } from "@/types/api";

const s = t.admin.payments;
const PAGE_SIZE = 20;
const STATUSES: PaymentStatus[] = ["pending", "approved", "rejected"];

function Amount({ p }: { p: AdminPayment }) {
  const mismatch = p.amount !== p.expectedAmount;
  return (
    <div>
      <p className={cn("font-medium tabular-nums", mismatch && "text-warning")}>{pkr(p.amount)}</p>
      {mismatch && (
        <p className="text-muted-foreground text-xs">{s.expected(pkr(p.expectedAmount))}</p>
      )}
    </div>
  );
}

export default function AdminPaymentsPage() {
  const [status, setStatus] = useState<PaymentStatus>("pending");
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin", "payments", status, page],
    queryFn: () =>
      api<Paginated<AdminPayment>>("/admin/payments", {
        query: { status, page, pageSize: PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items ?? [];

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} />
      <Tabs
        value={status}
        onValueChange={(v) => {
          setStatus(v as PaymentStatus);
          setPage(1);
        }}
        className="mb-4"
      >
        <TabsList>
          {STATUSES.map((st) => (
            <TabsTrigger key={st} value={st}>
              {s.tabs[st]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {query.isLoading ? (
        <LoadingRows />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={s.empty[status]} />
      ) : (
        <>
          <div className="hidden rounded-xl border md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{s.columns.student}</TableHead>
                  <TableHead>{s.columns.plan}</TableHead>
                  <TableHead>{s.columns.amount}</TableHead>
                  <TableHead>{s.columns.method}</TableHead>
                  <TableHead>{s.columns.transactionId}</TableHead>
                  <TableHead>{s.columns.submitted}</TableHead>
                  <TableHead>{s.columns.checks}</TableHead>
                  <TableHead className="w-8" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.id} className="relative">
                    <TableCell>
                      <Link
                        href={`/admin/payments/${p.id}`}
                        className="after:absolute after:inset-0"
                      >
                        <span className="block font-medium">{p.user.profile?.fullName || "—"}</span>
                        <span className="text-muted-foreground block text-xs">{p.user.email}</span>
                      </Link>
                    </TableCell>
                    <TableCell>{p.plan.name}</TableCell>
                    <TableCell>
                      <Amount p={p} />
                    </TableCell>
                    <TableCell>{t.common.paymentMethods[p.method]}</TableCell>
                    <TableCell className="font-mono text-xs">{p.transactionId}</TableCell>
                    <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                      {timeAgo(p.createdAt)}
                    </TableCell>
                    <TableCell>
                      <WarningsBadge count={p.warnings.length} />
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="text-muted-foreground size-4" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="grid gap-3 md:hidden">
            {items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/admin/payments/${p.id}`}
                  className="hover:bg-muted/40 block rounded-xl border p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {p.user.profile?.fullName || p.user.email}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">{p.plan.name}</p>
                    </div>
                    <Amount p={p} />
                  </div>
                  <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span>{t.common.paymentMethods[p.method]}</span>
                    <span className="font-mono">{p.transactionId}</span>
                    <span>{timeAgo(p.createdAt)}</span>
                    <WarningsBadge count={p.warnings.length} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={query.data?.total ?? 0}
            onPageChange={setPage}
          />
        </>
      )}
    </>
  );
}
