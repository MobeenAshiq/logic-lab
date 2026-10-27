"use client";

import { useQuery } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { CouponDialog } from "@/components/admin/coupon-dialog";
import { PlanDialog } from "@/components/admin/plan-dialog";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge } from "@/components/shared";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api/client";
import { formatDate, pkr } from "@/lib/format";
import { t } from "@/lib/i18n";
import type { AdminPlan, AdminTrack, Coupon } from "@/types/api";

const s = t.admin.billing;

function PlansTab({ plans, tracks }: { plans: AdminPlan[]; tracks: AdminTrack[] }) {
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [open, setOpen] = useState(false);
  const edit = (plan: AdminPlan | null) => {
    setEditing(plan);
    setOpen(true);
  };
  const trackTitle = (id: string) => tracks.find((tr) => tr.id === id)?.title ?? "?";

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => edit(null)}>
          <Plus /> {s.newPlan}
        </Button>
      </div>
      {plans.length === 0 ? (
        <EmptyState title={s.plans.empty} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.plans.columns.name}</TableHead>
                <TableHead>{s.plans.columns.price}</TableHead>
                <TableHead>{s.plans.columns.duration}</TableHead>
                <TableHead>{s.plans.columns.tracks}</TableHead>
                <TableHead>{s.plans.columns.status}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <p className="font-medium">{plan.name}</p>
                    {plan.description && (
                      <p className="text-muted-foreground max-w-xs truncate text-xs">
                        {plan.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{pkr(plan.pricePkr)}</TableCell>
                  <TableCell>{s.plans.days(plan.durationDays)}</TableCell>
                  <TableCell className="text-xs" title={plan.trackIds.map(trackTitle).join(", ")}>
                    {plan.allTracks ? s.plans.allTracks : s.plans.tracksCount(plan.trackIds.length)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={plan.isActive ? "success" : "neutral"}>
                      {plan.isActive ? s.plans.active : s.plans.inactive}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => edit(plan)}
                      aria-label={s.editPlan}
                    >
                      <Pencil />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <PlanDialog open={open} onOpenChange={setOpen} plan={editing} tracks={tracks} />
    </>
  );
}

function CouponsTab({ coupons, plans }: { coupons: Coupon[]; plans: AdminPlan[] }) {
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [open, setOpen] = useState(false);
  const edit = (coupon: Coupon | null) => {
    setEditing(coupon);
    setOpen(true);
  };
  const now = Date.now();

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => edit(null)}>
          <Plus /> {s.newCoupon}
        </Button>
      </div>
      {coupons.length === 0 ? (
        <EmptyState title={s.coupons.empty} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{s.coupons.columns.code}</TableHead>
                <TableHead>{s.coupons.columns.discount}</TableHead>
                <TableHead>{s.coupons.columns.used}</TableHead>
                <TableHead>{s.coupons.columns.expires}</TableHead>
                <TableHead>{s.coupons.columns.plans}</TableHead>
                <TableHead>{s.coupons.columns.status}</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((c) => {
                const expired = c.expiresAt !== null && Date.parse(c.expiresAt) <= now;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono font-medium">{c.code}</TableCell>
                    <TableCell>
                      {c.discountType === "percent"
                        ? s.coupons.percentOff(c.discountValue)
                        : s.coupons.fixedOff(pkr(c.discountValue))}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {c.redeemedCount} / {c.maxRedemptions ?? s.coupons.unlimited}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.expiresAt ? formatDate(c.expiresAt) : s.coupons.never}
                    </TableCell>
                    <TableCell className="text-xs">
                      {c.planIds.length === 0
                        ? s.coupons.allPlans
                        : s.coupons.plansCount(c.planIds.length)}
                    </TableCell>
                    <TableCell>
                      {expired ? (
                        <StatusBadge tone="neutral">{s.coupons.expired}</StatusBadge>
                      ) : (
                        <StatusBadge tone={c.isActive ? "success" : "neutral"}>
                          {c.isActive ? s.coupons.active : s.coupons.inactive}
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => edit(c)}
                        aria-label={s.editCoupon}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <CouponDialog open={open} onOpenChange={setOpen} coupon={editing} plans={plans} />
    </>
  );
}

export default function AdminBillingPage() {
  const plans = useQuery({
    queryKey: ["admin", "plans"],
    queryFn: () => api<AdminPlan[]>("/admin/billing/plans"),
  });
  const coupons = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: () => api<Coupon[]>("/admin/billing/coupons"),
  });
  const tracks = useQuery({
    queryKey: ["admin", "tracks"],
    queryFn: () => api<AdminTrack[]>("/admin/content/tracks"),
  });

  const error = plans.error ?? coupons.error ?? tracks.error;
  const loading = plans.isLoading || coupons.isLoading || tracks.isLoading;

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} />
      {loading ? (
        <LoadingRows />
      ) : error ? (
        <ErrorState
          error={error}
          onRetry={() => {
            void plans.refetch();
            void coupons.refetch();
            void tracks.refetch();
          }}
        />
      ) : (
        <Tabs defaultValue="plans">
          <TabsList className="mb-4">
            <TabsTrigger value="plans">{s.tabs.plans}</TabsTrigger>
            <TabsTrigger value="coupons">{s.tabs.coupons}</TabsTrigger>
          </TabsList>
          <TabsContent value="plans">
            <PlansTab plans={plans.data ?? []} tracks={tracks.data ?? []} />
          </TabsContent>
          <TabsContent value="coupons">
            <CouponsTab coupons={coupons.data ?? []} plans={plans.data ?? []} />
          </TabsContent>
        </Tabs>
      )}
    </>
  );
}
