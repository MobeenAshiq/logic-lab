"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Download, FileText, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  EmptyState,
  ErrorState,
  Field,
  LoadingRows,
  PageHeader,
  Spinner,
  StatusBadge,
} from "@/components/shared";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/student/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api/client";
import { applyFormErrors, toastError } from "@/lib/errors";
import { daysLeft, formatDate, pkr, todayIso } from "@/lib/format";
import { t } from "@/lib/i18n";
import { readSlipText } from "@/lib/ocr";
import { BILLING_KEY } from "@/lib/student";
import { MAX_UPLOAD_BYTES, uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";
import type {
  PaymentInstructions,
  PaymentMethod,
  PaymentStatus,
  Quote,
  StudentBilling,
  StudentPayment,
} from "@/types/api";

const tb = t.student.billing;
const SLIP_TYPES = ["image/jpeg", "image/png", "application/pdf"];
const statusTone: Record<PaymentStatus, "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export default function BillingPage() {
  const billing = useQuery({
    queryKey: BILLING_KEY,
    queryFn: () => api<StudentBilling>("/student/billing"),
  });

  if (billing.isError)
    return <ErrorState error={billing.error} onRetry={() => billing.refetch()} />;
  if (!billing.data) return <LoadingRows rows={4} />;
  const b = billing.data;
  const pending = b.payments.find((p) => p.status === "pending");

  return (
    <>
      <PageHeader title={tb.title} description={tb.subtitle} />
      <AccessSummary billing={b} />
      {pending ? (
        <Alert className="mb-8">
          <AlertDescription>{tb.pendingNotice}</AlertDescription>
        </Alert>
      ) : (
        <Checkout billing={b} />
      )}
      <History payments={b.payments} />
    </>
  );
}

function AccessSummary({ billing }: { billing: StudentBilling }) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>{tb.accessTitle}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {billing.access.length === 0 && <p className="text-muted-foreground">{tb.noAccess}</p>}
        {billing.access.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{a.plan?.name ?? t.common.subscriptionStatus.trial}</span>
            <StatusBadge tone={a.status === "trial" ? "primary" : "success"}>
              {t.common.subscriptionStatus[a.status]}
            </StatusBadge>
            <span className="text-muted-foreground">
              {t.student.dashboard.endsIn(daysLeft(a.endsAt))} ·{" "}
              {t.student.dashboard.endsOn(formatDate(a.endsAt))}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Checkout({ billing }: { billing: StudentBilling }) {
  const [planId, setPlanId] = useState<string | null>(
    billing.pendingSubscription?.plan?.id ?? billing.plans[0]?.id ?? null,
  );
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<string | null>(null);

  const quote = useQuery({
    queryKey: ["student", "quote", planId, coupon],
    enabled: Boolean(planId),
    queryFn: () =>
      api<Quote>("/student/billing/quote", {
        method: "POST",
        body: { planId, couponCode: coupon ?? undefined },
      }),
  });

  // An invalid coupon: tell the student and fall back to the plain price.
  useEffect(() => {
    if (quote.error && coupon) {
      toastError(quote.error);
      setCoupon(null);
    }
  }, [quote.error, coupon]);

  if (billing.plans.length === 0) {
    return (
      <div className="mb-8">
        <EmptyState title={t.site.pricing.empty} />
      </div>
    );
  }

  return (
    <div className="mb-8 grid gap-6 lg:grid-cols-5">
      <div className="space-y-6 lg:col-span-3">
        <section>
          <h2 className="mb-3 text-lg font-semibold">{tb.plansTitle}</h2>
          <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
            {billing.plans.map((plan) => {
              const selected = plan.id === planId;
              return (
                <button
                  key={plan.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setPlanId(plan.id)}
                  className={cn(
                    "hover:border-primary/50 rounded-xl border p-4 text-left transition-colors",
                    selected && "border-primary bg-primary/5 ring-primary ring-1",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{plan.name}</p>
                    {selected && <Check className="text-primary size-4" />}
                  </div>
                  <p className="mt-2 text-xl font-semibold">
                    {pkr(plan.pricePkr)}
                    <span className="text-muted-foreground ml-1 text-xs font-normal">
                      {t.site.pricing.perDays(plan.durationDays)}
                    </span>
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {plan.allTracks
                      ? t.site.pricing.allTracks
                      : plan.tracks.map((tr) => tr.title).join(", ")}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <Instructions instructions={billing.paymentInstructions} />
        {planId && (
          <SlipForm
            planId={planId}
            coupon={coupon}
            total={quote.data?.total}
            instructions={billing.paymentInstructions}
          />
        )}
      </div>

      <Card className="h-fit lg:sticky lg:top-20 lg:col-span-2">
        <CardHeader>
          <CardTitle>{quote.data?.planName ?? "…"}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (couponInput.trim()) setCoupon(couponInput.trim().toUpperCase());
            }}
          >
            <Input
              placeholder={tb.coupon}
              aria-label={tb.coupon}
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
            />
            {coupon ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCoupon(null);
                  setCouponInput("");
                }}
              >
                {tb.removeCoupon}
              </Button>
            ) : (
              <Button type="submit" variant="outline">
                {tb.apply}
              </Button>
            )}
          </form>
          {quote.data ? (
            <dl className="grid gap-2">
              <Row label={tb.summary.price} value={pkr(quote.data.pricePkr)} />
              {quote.data.discount > 0 && (
                <Row
                  label={`${tb.summary.discount}${quote.data.couponCode ? ` (${quote.data.couponCode})` : ""}`}
                  value={`- ${pkr(quote.data.discount)}`}
                  className="text-success"
                />
              )}
              <div className="bg-border my-1 h-px" />
              <Row label={tb.summary.total} value={pkr(quote.data.total)} strong />
            </dl>
          ) : (
            <LoadingRows rows={2} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex justify-between gap-4", className)}>
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={cn(strong && "text-base font-semibold")}>{value}</dd>
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="hover:text-primary inline-flex items-center gap-1.5 font-mono text-sm font-medium"
      aria-label={`${tb.copy} ${value}`}
    >
      {value}
      {copied ? (
        <Check className="text-success size-3.5" />
      ) : (
        <Copy className="size-3.5 opacity-60" />
      )}
    </button>
  );
}

function Instructions({ instructions: i }: { instructions: PaymentInstructions }) {
  const wallets = [
    { key: "easypaisa" as const, data: i.easypaisa },
    { key: "jazzcash" as const, data: i.jazzcash },
  ];
  return (
    <section>
      <h2 className="mb-1 text-lg font-semibold">{tb.howToPay}</h2>
      <p className="text-muted-foreground mb-3 text-sm">{tb.instructionsNote}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {wallets.map(
          ({ key, data }) =>
            data && (
              <Card key={key} className="gap-2 py-4">
                <CardHeader className="px-4">
                  <CardTitle className="text-sm">{t.common.paymentMethods[key]}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-1 px-4 text-sm">
                  <p className="text-muted-foreground">
                    {tb.accountTitle}: <span className="text-foreground">{data.accountTitle}</span>
                  </p>
                  <CopyValue value={data.number} />
                </CardContent>
              </Card>
            ),
        )}
        {i.bank && (
          <Card className="gap-2 py-4 sm:col-span-2">
            <CardHeader className="px-4">
              <CardTitle className="text-sm">{t.common.paymentMethods.bank}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 px-4 text-sm">
              <p className="text-muted-foreground">
                {tb.bankName}: <span className="text-foreground">{i.bank.bankName}</span>
              </p>
              <p className="text-muted-foreground">
                {tb.accountTitle}: <span className="text-foreground">{i.bank.accountTitle}</span>
              </p>
              <CopyValue value={i.bank.iban} />
            </CardContent>
          </Card>
        )}
      </div>
      {i.note && <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">{i.note}</p>}
    </section>
  );
}

const slipSchema = z.object({
  method: z.enum(["easypaisa", "jazzcash", "bank"]),
  transactionId: z
    .string()
    .trim()
    .min(4)
    .max(40)
    .regex(/^[A-Za-z0-9 -]+$/),
  amount: z.coerce.number<string>().int().min(1).max(1_000_000),
  paidAt: z.iso.date(),
});
type SlipValues = z.input<typeof slipSchema>;
type SlipOutput = z.output<typeof slipSchema>;

type OcrState =
  | { status: "idle" }
  | { status: "reading"; progress: number }
  | { status: "done"; text: string | null }
  | { status: "skipped" };

function SlipForm({
  planId,
  coupon,
  total,
  instructions,
}: {
  planId: string;
  coupon: string | null;
  total?: number;
  instructions: PaymentInstructions;
}) {
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrState>({ status: "idle" });

  const methods = useMemo(() => {
    const configured = (["easypaisa", "jazzcash", "bank"] as PaymentMethod[]).filter(
      (m) => instructions[m] !== null,
    );
    return configured.length > 0
      ? configured
      : (["easypaisa", "jazzcash", "bank"] as PaymentMethod[]);
  }, [instructions]);

  const form = useForm<SlipValues, unknown, SlipOutput>({
    resolver: zodResolver(slipSchema),
    defaultValues: { method: methods[0], transactionId: "", amount: "", paidAt: todayIso() },
  });

  // Prefill the amount with the total, unless the student already typed one.
  useEffect(() => {
    if (total !== undefined && !form.getFieldState("amount").isDirty) {
      form.setValue("amount", String(total));
    }
  }, [total, form]);

  const onFile = async (picked: File | undefined) => {
    setFileError(null);
    setOcr({ status: "idle" });
    if (!picked) return setFile(null);
    if (!SLIP_TYPES.includes(picked.type)) return setFileError(tb.fileType);
    if (picked.size > MAX_UPLOAD_BYTES) return setFileError(tb.fileTooBig);
    setFile(picked);
    if (!picked.type.startsWith("image/")) return setOcr({ status: "skipped" });
    setOcr({ status: "reading", progress: 0 });
    try {
      const text = await readSlipText(picked, (progress) =>
        setOcr({ status: "reading", progress }),
      );
      setOcr({ status: "done", text });
    } catch {
      // OCR is only a hint for the admin; never block the payment on it.
      setOcr({ status: "done", text: null });
    }
  };

  const submit = useMutation({
    mutationFn: async (values: SlipOutput) => {
      if (!file) throw new Error(tb.slip);
      const slipKey = await uploadFile("/student/payments/upload-url", file);
      return api<StudentPayment>("/student/payments", {
        method: "POST",
        body: {
          ...values,
          planId,
          couponCode: coupon ?? undefined,
          slipKey,
          ocrText: ocr.status === "done" ? ocr.text : null,
        },
      });
    },
    onSuccess: async () => {
      toast.success(tb.submitted);
      form.reset();
      setFile(null);
      setOcr({ status: "idle" });
      await queryClient.invalidateQueries({ queryKey: BILLING_KEY });
    },
    onError: (err) => {
      if (err instanceof ApiError) applyFormErrors(err, form.setError);
      else toastError(err);
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (!file) {
      setFileError(tb.slip);
      return;
    }
    submit.mutate(values);
  });
  const errors = form.formState.errors;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tb.slipTitle}</CardTitle>
        <CardDescription>{tb.instructionsNote}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <Field label={tb.method} error={errors.method?.message}>
            <Controller
              control={form.control}
              name="method"
              render={({ field }) => (
                <RadioGroup
                  value={field.value}
                  onValueChange={field.onChange}
                  className="flex flex-wrap gap-4"
                >
                  {methods.map((m) => (
                    <div key={m} className="flex items-center gap-2">
                      <RadioGroupItem value={m} id={`method-${m}`} />
                      <Label htmlFor={`method-${m}`} className="font-normal">
                        {t.common.paymentMethods[m]}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            />
          </Field>
          <Field
            label={tb.transactionId}
            htmlFor="transactionId"
            hint={tb.transactionIdHint}
            error={errors.transactionId?.message}
          >
            <Input id="transactionId" autoComplete="off" {...form.register("transactionId")} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tb.amount} htmlFor="amount" error={errors.amount?.message}>
              <Input id="amount" inputMode="numeric" {...form.register("amount")} />
            </Field>
            <Field label={tb.paidAt} htmlFor="paidAt" error={errors.paidAt?.message}>
              <Input id="paidAt" type="date" max={todayIso()} {...form.register("paidAt")} />
            </Field>
          </div>
          <Field label={tb.slip} error={fileError ?? undefined}>
            <input
              ref={fileInput}
              type="file"
              accept={SLIP_TYPES.join(",")}
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="hover:border-primary/50 hover:bg-muted/40 flex items-center gap-3 rounded-lg border border-dashed p-4 text-left text-sm transition-colors"
            >
              {file ? (
                <FileText className="text-primary size-5 shrink-0" />
              ) : (
                <Upload className="text-muted-foreground size-5 shrink-0" />
              )}
              <span className="min-w-0 flex-1 truncate">{file ? file.name : tb.chooseFile}</span>
            </button>
            {ocr.status === "reading" && (
              <div className="text-muted-foreground grid gap-1 text-xs">
                <span>{tb.reading}</span>
                <Progress value={ocr.progress * 100} />
              </div>
            )}
            {ocr.status === "done" && <p className="text-success text-xs">{tb.readDone}</p>}
            {ocr.status === "skipped" && (
              <p className="text-muted-foreground text-xs">{tb.readSkipped}</p>
            )}
          </Field>
          <Button
            type="submit"
            disabled={submit.isPending || ocr.status === "reading"}
            className="h-9"
          >
            {submit.isPending && <Spinner />}
            {submit.isPending ? tb.submitting : tb.submit}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function History({ payments }: { payments: StudentPayment[] }) {
  const download = async (invoiceId: string) => {
    try {
      const { url } = await api<{ url: string }>(`/student/invoices/${invoiceId}/download`);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{tb.historyTitle}</h2>
      {payments.length === 0 ? (
        <EmptyState title={tb.historyEmpty} />
      ) : (
        <div className="divide-y rounded-xl border">
          {payments.map((p) => (
            <div key={p.id} className="flex flex-col gap-2 p-4 text-sm sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {p.planName} · {pkr(p.amount)}
                </p>
                <p className="text-muted-foreground text-xs">
                  {formatDate(p.createdAt)} · {t.common.paymentMethods[p.method]} ·{" "}
                  {p.transactionId}
                </p>
                {p.status === "rejected" && p.rejectReason && (
                  <p className="text-destructive mt-1 text-xs">{tb.rejected(p.rejectReason)}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge tone={statusTone[p.status]}>
                  {t.common.paymentStatus[p.status]}
                </StatusBadge>
                {p.invoice && (
                  <Button variant="outline" size="sm" onClick={() => void download(p.invoice!.id)}>
                    <Download /> {p.invoice.invoiceNo}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
