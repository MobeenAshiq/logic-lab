"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Code2,
  FileClock,
  GraduationCap,
  type LucideIcon,
  Megaphone,
  Receipt,
  Settings,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api/client";
import { useMe } from "@/lib/auth";
import { t } from "@/lib/i18n";
import type { AdminPayment, Paginated, PublicUser } from "@/types/api";

const s = t.admin.dashboard;

function StatCard({
  title,
  hint,
  value,
  icon: Icon,
  href,
  cta,
}: {
  title: string;
  hint: string;
  value: number | undefined;
  icon: LucideIcon;
  href: string;
  cta: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
        <Icon className="text-muted-foreground size-4" />
      </CardHeader>
      <CardContent>
        {value === undefined ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className="text-3xl font-semibold tabular-nums">{value}</p>
        )}
        <p className="text-muted-foreground mt-1 text-xs">{hint}</p>
        <Button asChild variant="link" className="mt-2 h-auto px-0">
          <Link href={href}>
            {cta} <ArrowRight />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

const links: { href: string; icon: LucideIcon; title: string; body: string }[] = [
  { href: "/admin/content", icon: GraduationCap, ...s.links.content },
  { href: "/admin/content/site", icon: Megaphone, ...s.links.site },
  { href: "/admin/challenges", icon: Code2, title: "Daily challenges", body: "Publish daily coding exercises by track." },
  { href: "/admin/billing", icon: Tags, ...s.links.plans },
  { href: "/admin/settings", icon: Settings, ...s.links.settings },
  { href: "/admin/audit", icon: FileClock, ...s.links.audit },
];

export default function AdminDashboardPage() {
  const { data: me } = useMe();
  const pending = useQuery({
    queryKey: ["admin", "payments", "pending", "count"],
    queryFn: () =>
      api<Paginated<AdminPayment>>("/admin/payments", {
        query: { status: "pending", pageSize: 1 },
      }),
  });
  const users = useQuery({
    queryKey: ["admin", "users", "count"],
    queryFn: () => api<Paginated<PublicUser>>("/admin/users", { query: { pageSize: 1 } }),
  });

  return (
    <>
      <PageHeader title={s.title(me?.user.fullName ?? "")} description={s.subtitle} />
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title={s.pendingPayments}
          hint={s.pendingHint}
          value={pending.data?.total}
          icon={Receipt}
          href="/admin/payments"
          cta={s.openQueue}
        />
        <StatCard
          title={s.totalUsers}
          hint={s.usersHint}
          value={users.data?.total}
          icon={Users}
          href="/admin/users"
          cta={s.manageUsers}
        />
      </div>

      <h2 className="text-muted-foreground mt-8 mb-3 text-sm font-medium">{s.quickLinks}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="group hover:border-primary/40 hover:bg-muted/40 flex gap-3 rounded-xl border p-4 transition-colors"
          >
            <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-lg">
              <l.icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="group-hover:text-primary block text-sm font-medium">{l.title}</span>
              <span className="text-muted-foreground block text-xs">{l.body}</span>
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
