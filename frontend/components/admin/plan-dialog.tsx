"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { AdminPlan, AdminTrack } from "@/types/api";

const s = t.admin.billing.plans.form;

const schema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(1000),
    pricePkr: z.number({ error: t.admin.validation.required }).int().min(0).max(1_000_000),
    durationDays: z.number({ error: t.admin.validation.required }).int().min(1).max(730),
    allTracks: z.boolean(),
    trackIds: z.array(z.string()),
    isActive: z.boolean(),
  })
  .refine((v) => v.allTracks || v.trackIds.length > 0, {
    path: ["trackIds"],
    message: s.tracksRequired,
  });
type Values = z.infer<typeof schema>;

function defaults(plan: AdminPlan | null): Values {
  return {
    name: plan?.name ?? "",
    description: plan?.description ?? "",
    pricePkr: plan?.pricePkr ?? 0,
    durationDays: plan?.durationDays ?? 30,
    allTracks: plan?.allTracks ?? false,
    trackIds: plan?.trackIds ?? [],
    isActive: plan?.isActive ?? true,
  };
}

/** Create (plan = null) or edit a plan. Controlled by the parent via `open`. */
export function PlanDialog({
  open,
  onOpenChange,
  plan,
  tracks,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: AdminPlan | null;
  tracks: AdminTrack[];
}) {
  const queryClient = useQueryClient();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: defaults(plan) });

  useEffect(() => {
    if (open) form.reset(defaults(plan));
  }, [open, plan, form]);

  const mutation = useMutation({
    mutationFn: (values: Values) => {
      const body = { ...values, trackIds: values.allTracks ? [] : values.trackIds };
      return plan
        ? api<AdminPlan>(`/admin/billing/plans/${plan.id}`, { method: "PATCH", body })
        : api<AdminPlan>("/admin/billing/plans", { method: "POST", body });
    },
    onSuccess: () => {
      toast.success(plan ? s.updated : s.created);
      void queryClient.invalidateQueries({ queryKey: ["admin", "plans"] });
      onOpenChange(false);
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  const allTracks = form.watch("allTracks");
  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{plan ? t.admin.billing.editPlan : t.admin.billing.newPlan}</DialogTitle>
            {plan && <DialogDescription>{s.priceNote}</DialogDescription>}
          </DialogHeader>
          <Field label={s.name} htmlFor="plan-name" error={errors.name?.message}>
            <Input id="plan-name" {...form.register("name")} />
          </Field>
          <Field label={s.description} htmlFor="plan-desc" error={errors.description?.message}>
            <Textarea id="plan-desc" rows={2} {...form.register("description")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={s.price} htmlFor="plan-price" error={errors.pricePkr?.message}>
              <Input
                id="plan-price"
                type="number"
                inputMode="numeric"
                min={0}
                {...form.register("pricePkr", { valueAsNumber: true })}
              />
            </Field>
            <Field label={s.duration} htmlFor="plan-days" error={errors.durationDays?.message}>
              <Input
                id="plan-days"
                type="number"
                inputMode="numeric"
                min={1}
                {...form.register("durationDays", { valueAsNumber: true })}
              />
            </Field>
          </div>
          <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
            <div>
              <Label htmlFor="plan-all">{s.allTracks}</Label>
              <p className="text-muted-foreground text-xs">{s.allTracksHint}</p>
            </div>
            <Controller
              control={form.control}
              name="allTracks"
              render={({ field }) => (
                <Switch id="plan-all" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </div>
          {!allTracks && (
            <Field label={s.tracks} error={errors.trackIds?.message}>
              <Controller
                control={form.control}
                name="trackIds"
                render={({ field }) => (
                  <div className="grid gap-2 rounded-lg border p-3">
                    {tracks.map((track) => {
                      const checked = field.value.includes(track.id);
                      return (
                        <label key={track.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) =>
                              field.onChange(
                                c === true
                                  ? [...field.value, track.id]
                                  : field.value.filter((id) => id !== track.id),
                              )
                            }
                          />
                          {track.title}
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            </Field>
          )}
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="plan-active">{s.active}</Label>
            <Controller
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <Switch id="plan-active" checked={field.value} onCheckedChange={field.onChange} />
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
