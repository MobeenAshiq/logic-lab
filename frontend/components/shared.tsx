"use client";

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Inbox,
  Loader2,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import * as React from "react";
import { useState, useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/errors";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// 1. Page Header (Page title 30px bold Plus Jakarta Sans)
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  description,
  actions,
  badge,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b pb-4">
      <div className="min-w-0">
        {badge && <div className="mb-2">{badge}</div>}
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed sm:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 2. Stat Card (icon, big number, label, small trend "+12% this week")
// ---------------------------------------------------------------------------

export function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  trendPositive = true,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  value: React.ReactNode;
  label: string;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}) {
  return (
    <Card className={cn("card-hover border-border bg-card rounded-xl p-5 shadow-sm", className)}>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">{label}</span>
        {Icon && (
          <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary dark:bg-primary/20">
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <span className="font-heading text-3xl font-bold tracking-tight text-foreground">
          {value}
        </span>
        {trend && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              trendPositive
                ? "bg-success/10 text-success dark:bg-success/20"
                : "bg-danger/10 text-danger dark:bg-danger/20",
            )}
          >
            {trendPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {trend}
          </span>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 3. Status Badge (Colored pill: Pending, Approved, Rejected, Active, Trial, Expired)
// ---------------------------------------------------------------------------

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "accent";
export type StatusPill = "pending" | "approved" | "rejected" | "active" | "trial" | "expired" | "completed" | "passed";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  primary: "bg-primary/10 text-primary border-primary/20 dark:bg-primary/20",
  success: "bg-success/10 text-success border-success/20 dark:bg-success/20",
  warning: "bg-warning/15 text-warning border-warning/25 dark:bg-warning/20",
  danger: "bg-danger/10 text-danger border-danger/20 dark:bg-danger/20",
  accent: "bg-accent/15 text-accent border-accent/25 dark:bg-accent/20",
};

const pillTones: Record<StatusPill, Tone> = {
  pending: "warning",
  approved: "success",
  completed: "success",
  passed: "success",
  rejected: "danger",
  active: "primary",
  trial: "primary",
  expired: "neutral",
};

export function StatusBadge({
  tone,
  status,
  children,
  className,
}: {
  tone?: Tone;
  status?: StatusPill;
  children?: React.ReactNode;
  className?: string;
}) {
  const resolvedTone = tone ?? (status ? pillTones[status] : "neutral");
  const label =
    children ??
    (status
      ? status.charAt(0).toUpperCase() + status.slice(1)
      : null);

  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors border",
        toneClasses[resolvedTone],
        className,
      )}
    >
      {label}
    </Badge>
  );
}

export function PublishedBadge({ published }: { published: boolean }) {
  return (
    <StatusBadge tone={published ? "success" : "neutral"}>
      {published ? t.common.published : t.common.draft}
    </StatusBadge>
  );
}

// ---------------------------------------------------------------------------
// 4. Empty State (Illustration/icon, one-line message, one action button)
// ---------------------------------------------------------------------------

export function EmptyState({
  title,
  description,
  action,
  icon: Icon = Inbox,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 grid size-12 place-items-center rounded-full bg-primary/10 text-primary dark:bg-primary/20">
        <Icon className="size-6" />
      </div>
      <h3 className="font-heading text-foreground text-base font-semibold">{title}</h3>
      {description && (
        <p className="text-muted-foreground mt-1.5 max-w-sm text-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 5. Skeleton Loaders
// ---------------------------------------------------------------------------

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <Skeleton className="aspect-[16/9] w-full rounded-lg" />
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-3 h-5 w-3/4 rounded" />
      <Skeleton className="mt-2 h-4 w-full rounded" />
      <div className="mt-5 flex justify-between border-t border-border pt-3">
        <Skeleton className="h-4 w-20 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex justify-between">
        <Skeleton className="h-4 w-24 rounded" />
        <Skeleton className="size-9 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-20 rounded" />
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin text-primary", className)} />;
}

// ---------------------------------------------------------------------------
// 6. Error State (Clear message + retry button)
// ---------------------------------------------------------------------------

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <Alert variant="destructive" className={cn("rounded-xl border border-danger/30 bg-danger/10 text-foreground", className)}>
      <AlertCircle className="size-4 text-danger" />
      <AlertTitle className="font-heading font-semibold text-danger">
        {t.common.errors.generic}
      </AlertTitle>
      <AlertDescription className="mt-1">
        <p className="text-sm text-foreground/90">{errorMessage(error)}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
            {t.common.actions.retry}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

// ---------------------------------------------------------------------------
// 7. Form Field
// ---------------------------------------------------------------------------

export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-danger text-xs font-medium">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 8. Pagination
// ---------------------------------------------------------------------------

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground font-medium">
        {t.common.pagination.pageOf(page, pages)}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t.common.pagination.previous}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          {t.common.pagination.next}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 9. Reusable Data Table (search, filters, sorting, pagination, row actions)
// ---------------------------------------------------------------------------

export interface Column<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (item: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  searchPlaceholder?: string;
  searchFilter?: (item: T, query: string) => boolean;
  filters?: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    options: { label: string; value: string }[];
  }[];
  actions?: (item: T) => React.ReactNode;
  rowKey: (item: T) => string;
  pageSize?: number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  searchPlaceholder = "Search...",
  searchFilter,
  filters,
  actions,
  rowKey,
  pageSize = 10,
  isLoading = false,
  emptyTitle = "No records found",
  emptyDescription = "Try adjusting your search or filters.",
  emptyAction,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const filteredData = useMemo(() => {
    let result = [...data];
    if (search.trim() && searchFilter) {
      const q = search.trim().toLowerCase();
      result = result.filter((item) => searchFilter(item, q));
    }
    if (sortKey) {
      result.sort((a, b) => {
        const valA = (a as Record<string, unknown>)[sortKey];
        const valB = (b as Record<string, unknown>)[sortKey];
        if (typeof valA === "string" && typeof valB === "string") {
          return sortDir === "asc"
            ? valA.localeCompare(valB)
            : valB.localeCompare(valA);
        }
        if (typeof valA === "number" && typeof valB === "number") {
          return sortDir === "asc" ? valA - valB : valB - valA;
        }
        return 0;
      });
    }
    return result;
  }, [data, search, searchFilter, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const currentPageData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      {(searchFilter || (filters && filters.length > 0)) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {searchFilter && (
            <div className="relative max-w-sm flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-3 size-4" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={searchPlaceholder}
                className="pl-9 bg-background rounded-lg border-border"
              />
            </div>
          )}

          {filters && filters.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.map((f, i) => (
                <Select
                  key={i}
                  value={f.value}
                  onValueChange={(val) => {
                    f.onChange(val);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="w-[160px] bg-background border-border text-xs rounded-lg">
                    <SelectValue placeholder={f.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {f.options.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="p-6">
            <LoadingRows rows={pageSize} />
          </div>
        ) : filteredData.length === 0 ? (
          <EmptyState
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
            className="border-none bg-transparent py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={cn(
                        "px-4 py-3",
                        col.sortable && "cursor-pointer select-none hover:text-foreground",
                        col.className,
                      )}
                      onClick={() => col.sortable && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1.5">
                        {col.header}
                        {col.sortable && (
                          <span className="text-muted-foreground">
                            {sortKey === col.key ? (
                              sortDir === "asc" ? (
                                <ArrowUp className="size-3.5" />
                              ) : (
                                <ArrowDown className="size-3.5" />
                              )
                            ) : (
                              <ArrowUpDown className="size-3.5 opacity-50" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                  {actions && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentPageData.map((item) => (
                  <tr
                    key={rowKey(item)}
                    className="hover:bg-surface/60 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn("px-4 py-3 text-foreground", col.className)}>
                        {col.render(item)}
                      </td>
                    ))}
                    {actions && (
                      <td className="px-4 py-3 text-right">
                        {actions(item)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Table Pagination */}
      {!isLoading && filteredData.length > pageSize && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filteredData.length}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
