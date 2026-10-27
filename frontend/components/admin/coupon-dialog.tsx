"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Field, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api/client";
import { applyFormErrors } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { AdminPlan, Coupon, DiscountType } from "@/types/api";

const s = t.admin.billing.coupons.form;

const schema = z
  .object({
    code: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{3,30}$/, s.codeHint),
    discountType: z.enum(["percent", "fixed"]),
    discountValue: z.number({ error: t.admin.validation.required }).int().min(1).max(1_000_000),
    // Optional numbers/dates are kept as strings in the form ("" = none).
    maxRedemptions: z.string().regex(/^\d*$/),
    expiresAt: z.string(),
    isActive: z.boolean(),
    planIds: z.array(z.string()),
  })
  .refine((v) => v.discountType !== "percent" || v.discountValue <= 100, {
    path: ["discountValue"],
    message: s.percentMax,
  });
type Values = z.infer<typeof schema>;

function defaults(coupon: Coupon | null): Values {
  return {
    code: coupon?.code ?? "",
    discountType: coupon?.discountType ?? "percent",
    discountValue: coupon?.discountValue ?? 10,
    maxRedemptions: coupon?.maxRedemptions ? String(coupon.maxRedemptions) : "",
    expiresAt: coupon?.expiresAt ? format(new Date(coupon.expiresAt), "yyyy-MM-dd") : "",
    isActive: coupon?.isActive ?? true,
    planIds: coupon?.planIds ?? [],
  };
}

/** Create (coupon = null) or edit a coupon. The code cannot change after creation. */
export function CouponDialog({
  open,
  onOpenChange,
  coupon,
  plans,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coupon: Coupon | null;
  plans: AdminPlan[];
}) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(coupon) });

  useEffect(() => {
    if (open) form.reset(defaults(coupon));
  }, [open, coupon, form]);

  const mutation = useMutation({
    mutationFn: ({ code, maxRedemptions, expiresAt, ...rest }: Values) => {
      const body = {
        ...rest,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : null,
        // End of the chosen day in Pakistan time.
        expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59+05:00`).toISOString() : null,
      };
      return coupon
        ? api<Coupon>(`/admin/billing/coupons/${coupon.id}`, { method: "PATCH", body })
        : api<Coupon>("/admin/billing/coupons", { method: "POST", body: { ...body, code } });
    },
    onSuccess: () => {
      toast.success(coupon ? s.updated : s.created);
      void queryClient.invalidateQueries({ queryKey: ["admin", "coupons"] });
      onOpenChange(false);
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {coupon ? t.admin.billing.editCoupon : t.admin.billing.newCoupon}
            </DialogTitle>
          </DialogHeader>
          <Field
            label={s.code}
            htmlFor="coupon-code"
            hint={s.codeHint}
            error={errors.code?.message}
          >
            <Input
              id="coupon-code"
              className="font-mono uppercase"
              disabled={!!coupon}
              {...form.register("code")}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={s.type}>
              <Controller
                control={form.control}
                name="discountType"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as DiscountType)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">{s.percent}</SelectItem>
                      <SelectItem value="fixed">{s.fixed}</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field label={s.value} htmlFor="coupon-value" error={errors.discountValue?.message}>
              <Input
                id="coupon-value"
                type="number"
                inputMode="numeric"
                min={1}
                {...form.register("discountValue", { valueAsNumber: true })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field
              label={s.maxRedemptions}
              htmlFor="coupon-max"
              hint={s.maxRedemptionsHint}
              error={errors.maxRedemptions?.message}
            >
              <Input id="coupon-max" inputMode="numeric" {...form.register("maxRedemptions")} />
            </Field>
            <Field label={s.expiresAt} htmlFor="coupon-exp" hint={s.expiresHint}>
              <Input id="coupon-exp" type="date" {...form.register("expiresAt")} />
            </Field>
          </div>
          <Field label={s.plans} hint={s.plansHint}>
            <Controller
              control={form.control}
              name="planIds"
              render={({ field }) => (
                <div className="grid max-h-40 gap-2 overflow-y-auto rounded-lg border p-3">
                  {plans.map((plan) => (
                    <label key={plan.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={field.value.includes(plan.id)}
                        onCheckedChange={(c) =>
                          field.onChange(
                            c === true
                              ? [...field.value, plan.id]
                              : field.value.filter((id) => id !== plan.id),
                          )
                        }
                      />
                      {plan.name}
                    </label>
                  ))}
                </div>
              )}
            />
          </Field>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="coupon-active">{s.active}</Label>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch id="coupon-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              {t.common.actions.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
