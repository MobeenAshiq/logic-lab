"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { Controller, useForm, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { ErrorState, Field, LoadingRows, PageHeader, Spinner } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors, toastError } from "@/lib/errors";
import { t } from "@/lib/i18n";
import type { PaymentInstructions } from "@/types/api";

const s = t.admin.settings;
const KEY = ["admin", "settings", "payment_instructions"];
const AI_LIMIT_KEY = ["admin", "settings", "ai_daily_limit"];
const NUMBER_RE = /^03\d{2}-?\d{7}$/;
const IBAN_RE = /^PK\d{2}[A-Z]{4}\d{16}$/;

const normalizeIban = (v: string) => v.replace(/\s+/g, "").toUpperCase();

const schema = z
  .object({
    easypaisaEnabled: z.boolean(),
    easypaisaTitle: z.string().trim().max(100),
    easypaisaNumber: z.string().trim(),
    jazzcashEnabled: z.boolean(),
    jazzcashTitle: z.string().trim().max(100),
    jazzcashNumber: z.string().trim(),
    bankEnabled: z.boolean(),
    bankName: z.string().trim().max(100),
    bankTitle: z.string().trim().max(100),
    iban: z.string(),
    note: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    for (const w of ["easypaisa", "jazzcash"] as const) {
      if (!v[`${w}Enabled`]) continue;
      need(v[`${w}Title`].length > 0, `${w}Title`, t.admin.validation.required);
      need(NUMBER_RE.test(v[`${w}Number`]), `${w}Number`, s.numberInvalid);
    }
    if (v.bankEnabled) {
      need(v.bankName.length > 0, "bankName", t.admin.validation.required);
      need(v.bankTitle.length > 0, "bankTitle", t.admin.validation.required);
      need(IBAN_RE.test(normalizeIban(v.iban)), "iban", s.ibanInvalid);
    }
  });
type Values = z.infer<typeof schema>;

function toForm(p: PaymentInstructions): Values {
  return {
    easypaisaEnabled: p.easypaisa !== null,
    easypaisaTitle: p.easypaisa?.accountTitle ?? "",
    easypaisaNumber: p.easypaisa?.number ?? "",
    jazzcashEnabled: p.jazzcash !== null,
    jazzcashTitle: p.jazzcash?.accountTitle ?? "",
    jazzcashNumber: p.jazzcash?.number ?? "",
    bankEnabled: p.bank !== null,
    bankName: p.bank?.bankName ?? "",
    bankTitle: p.bank?.accountTitle ?? "",
    iban: p.bank?.iban ?? "",
    note: p.note,
  };
}

function toApi(v: Values): PaymentInstructions {
  return {
    easypaisa: v.easypaisaEnabled
      ? { accountTitle: v.easypaisaTitle, number: v.easypaisaNumber }
      : null,
    jazzcash: v.jazzcashEnabled
      ? { accountTitle: v.jazzcashTitle, number: v.jazzcashNumber }
      : null,
    bank: v.bankEnabled
      ? { bankName: v.bankName, accountTitle: v.bankTitle, iban: normalizeIban(v.iban) }
      : null,
    note: v.note,
  };
}

/** API field paths (easypaisa.number) → form field names (easypaisaNumber). */
const API_FIELD: Record<string, keyof Values> = {
  "easypaisa.accountTitle": "easypaisaTitle",
  "easypaisa.number": "easypaisaNumber",
  "jazzcash.accountTitle": "jazzcashTitle",
  "jazzcash.number": "jazzcashNumber",
  "bank.bankName": "bankName",
  "bank.accountTitle": "bankTitle",
  "bank.iban": "iban",
  note: "note",
};

function MethodCard({
  form,
  enabledName,
  title,
  icon: Icon,
  children,
}: {
  form: UseFormReturn<Values>;
  enabledName: "easypaisaEnabled" | "jazzcashEnabled" | "bankEnabled";
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const enabled = form.watch(enabledName);
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 font-medium">
          <Icon className="text-primary size-4" /> {title}
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor={enabledName} className="text-muted-foreground text-xs">
            {s.enabled}
          </Label>
          <Controller
            control={form.control}
            name={enabledName}
            render={({ field }) => (
              <Switch id={enabledName} checked={field.value} onCheckedChange={field.onChange} />
            )}
          />
        </div>
      </div>
      {enabled && <div className="mt-4 grid gap-3 sm:grid-cols-2">{children}</div>}
    </div>
  );
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [aiLimit, setAiLimit] = useState(30);
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api<PaymentInstructions>("/admin/settings/payment_instructions"),
  });
  const form = useForm<Values>({ resolver: zodResolver(schema) });
  const aiLimitQuery = useQuery({
    queryKey: AI_LIMIT_KEY,
    queryFn: () => api<{ studentMessages: number }>("/admin/settings/ai_daily_limit"),
  });
  useEffect(() => {
    if (aiLimitQuery.data) setAiLimit(aiLimitQuery.data.studentMessages);
  }, [aiLimitQuery.data]);

  useEffect(() => {
    if (query.data) form.reset(toForm(query.data));
  }, [query.data, form]);

  const mutation = useMutation({
    mutationFn: (values: Values) =>
      api<PaymentInstructions>("/admin/settings/payment_instructions", {
        method: "PUT",
        body: toApi(values),
      }),
    onSuccess: (data) => {
      toast.success(s.saved);
      queryClient.setQueryData(KEY, data);
    },
    onError: (err) =>
      applyFormErrors(err, (field, error) =>
        form.setError(API_FIELD[String(field)] ?? "root", error),
      ),
  });
  const aiLimitMutation = useMutation({
    mutationFn: () => api<{ studentMessages: number }>("/admin/settings/ai_daily_limit", { method: "PUT", body: { studentMessages: aiLimit } }),
    onSuccess: (data) => {
      toast.success("AI daily limit saved.");
      queryClient.setQueryData(AI_LIMIT_KEY, data);
    },
    onError: toastError,
  });

  const errors = form.formState.errors;

  if (query.isLoading) return <LoadingRows rows={5} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;

  return (
    <>
      <PageHeader title={s.title} description={s.subtitle} />
      <Card>
        <CardHeader>
          <CardTitle>{s.paymentTitle}</CardTitle>
          <CardDescription>{s.paymentBody}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
            <MethodCard
              form={form}
              enabledName="easypaisaEnabled"
              title={s.easypaisa}
              icon={Smartphone}
            >
              <Field
                label={s.accountTitle}
                htmlFor="ep-title"
                error={errors.easypaisaTitle?.message}
              >
                <Input id="ep-title" {...form.register("easypaisaTitle")} />
              </Field>
              <Field
                label={s.number}
                htmlFor="ep-number"
                hint={s.numberHint}
                error={errors.easypaisaNumber?.message}
              >
                <Input id="ep-number" inputMode="tel" {...form.register("easypaisaNumber")} />
              </Field>
            </MethodCard>
            <MethodCard
              form={form}
              enabledName="jazzcashEnabled"
              title={s.jazzcash}
              icon={Smartphone}
            >
              <Field
                label={s.accountTitle}
                htmlFor="jc-title"
                error={errors.jazzcashTitle?.message}
              >
                <Input id="jc-title" {...form.register("jazzcashTitle")} />
              </Field>
              <Field
                label={s.number}
                htmlFor="jc-number"
                hint={s.numberHint}
                error={errors.jazzcashNumber?.message}
              >
                <Input id="jc-number" inputMode="tel" {...form.register("jazzcashNumber")} />
              </Field>
            </MethodCard>
            <MethodCard form={form} enabledName="bankEnabled" title={s.bank} icon={Building2}>
              <Field label={s.bankName} htmlFor="bank-name" error={errors.bankName?.message}>
                <Input id="bank-name" {...form.register("bankName")} />
              </Field>
              <Field label={s.accountTitle} htmlFor="bank-title" error={errors.bankTitle?.message}>
                <Input id="bank-title" {...form.register("bankTitle")} />
              </Field>
              <Field
                label={s.iban}
                htmlFor="bank-iban"
                hint={s.ibanHint}
                error={errors.iban?.message}
                className="sm:col-span-2"
              >
                <Input id="bank-iban" className="font-mono uppercase" {...form.register("iban")} />
              </Field>
            </MethodCard>
            <Field label={s.note} htmlFor="note" hint={s.noteHint} error={errors.note?.message}>
              <Textarea id="note" rows={3} {...form.register("note")} />
            </Field>
            {errors.root?.message && (
              <p className="text-destructive text-sm">{errors.root.message}</p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={mutation.isPending || !form.formState.isDirty}>
                {mutation.isPending && <Spinner />}
                {t.common.actions.save}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>AI daily usage limit</CardTitle>
          <CardDescription>Maximum tutor and practice-code-review requests per student each UTC day. Set to 0 to disable student AI requests.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); aiLimitMutation.mutate(); }}>
            <Field label="Messages per student per day" htmlFor="ai-daily-limit" hint="Allowed range: 0–500">
              <Input id="ai-daily-limit" type="number" min={0} max={500} step={1} value={aiLimit} onChange={(event) => setAiLimit(Number(event.target.value))} disabled={aiLimitQuery.isLoading || aiLimitQuery.isError} />
            </Field>
            <Button type="submit" disabled={aiLimitMutation.isPending || !Number.isInteger(aiLimit) || aiLimit < 0 || aiLimit > 500}>
              {aiLimitMutation.isPending && <Spinner />}{t.common.actions.save}
            </Button>
            {aiLimitQuery.isError && <p className="text-destructive text-sm">Could not load the current AI limit.</p>}
          </form>
        </CardContent>
      </Card>
    </>
  );
}
