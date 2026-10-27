"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Mail,
  X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { PaymentStatusBadge } from "@/components/admin/payment-badges";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ErrorState, Field, LoadingRows, PageHeader, Spinner } from "@/components/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { applyFormErrors, toastError } from "@/lib/errors";
import { formatDate, formatDateTime, pkr } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { AdminPaymentDetail } from "@/types/api";

const s = t.admin.payment;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function SlipPreview({ payment }: { payment: AdminPaymentDetail }) {
  const isPdf = payment.slipKey.toLowerCase().endsWith(".pdf");
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{s.slip}</CardTitle>
        <Button asChild variant="outline" size="sm">
          <a href={payment.slipUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink /> {s.openSlip}
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        {isPdf ? (
          <iframe
            src={payment.slipUrl}
            title={s.slip}
            className="bg-muted h-[480px] w-full rounded-lg border"
          />
        ) : (
          // Signed R2 URL that expires in 10 minutes: next/image optimisation does not apply.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={payment.slipUrl}
            alt={s.slip}
            className="bg-muted max-h-[560px] w-full rounded-lg border object-contain"
          />
        )}
      </CardContent>
    </Card>
  );
}

function RejectDialog({ id, onDone }: { id: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const schema = z.object({
    reason: z.string().trim().min(3, t.admin.validation.reasonMin).max(500),
  });
  type Values = z.infer<typeof schema>;
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { reason: "" } });
  const mutation = useMutation({
    mutationFn: (values: Values) =>
      api<AdminPaymentDetail>(`/admin/payments/${id}/reject`, { method: "POST", body: values }),
    onSuccess: () => {
      toast.success(s.rejected);
      setOpen(false);
      onDone();
    },
    onError: (err) => applyFormErrors(err, form.setError),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <X /> {s.reject}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={form.handleSubmit((v) => mutation.mutate(v))} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{s.rejectTitle}</DialogTitle>
            <DialogDescription>{s.rejectBody}</DialogDescription>
          </DialogHeader>
          <Field
            label={s.reason}
            htmlFor="reject-reason"
            error={form.formState.errors.reason?.message}
          >
            <Textarea id="reject-reason" rows={3} {...form.register("reason")} />
          </Field>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.actions.cancel}
            </Button>
            <Button type="submit" variant="destructive" disabled={mutation.isPending}>
              {mutation.isPending && <Spinner />}
              {s.reject}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceCard({ payment, onChange }: { payment: AdminPaymentDetail; onChange: () => void }) {
  const invoice = payment.invoice;
  const download = useMutation({
    mutationFn: () => api<{ url: string }>(`/admin/invoices/${invoice!.id}/download`),
    onSuccess: ({ url }) => window.open(url, "_blank", "noopener,noreferrer"),
    onError: toastError,
  });
  const resend = useMutation({
    mutationFn: () =>
      api<{ sent: boolean }>(`/admin/invoices/${invoice!.id}/resend`, { method: "POST" }),
    onSuccess: ({ sent }) => {
      if (sent) toast.success(s.resent);
      else toast.error(s.resendFailed);
      onChange();
    },
    onError: toastError,
  });
  if (!invoice) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{s.invoice}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <div>
          <p className="font-mono font-medium">{invoice.invoiceNo}</p>
          <p className="text-muted-foreground text-xs">
            {invoice.emailedAt ? s.emailedAt(formatDateTime(invoice.emailedAt)) : s.notEmailed}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => download.mutate()}
            disabled={download.isPending}
          >
            {download.isPending ? <Spinner /> : <Download />} {s.downloadInvoice}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => resend.mutate()}
            disabled={resend.isPending}
          >
            {resend.isPending ? <Spinner /> : <Mail />} {s.resend}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminPaymentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin", "payment", id],
    queryFn: () => api<AdminPaymentDetail>(`/admin/payments/${id}`),
  });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "payment", id] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
  };

  const approve = async () => {
    try {
      const res = await api<AdminPaymentDetail>(`/admin/payments/${id}/approve`, {
        method: "POST",
      });
      const message = s.approved(res.invoice?.invoiceNo ?? "", res.emailed ?? false);
      if (res.emailed) toast.success(message);
      else toast.warning(message);
      queryClient.setQueryData(["admin", "payment", id], res);
      refresh();
    } catch (err) {
      toastError(err);
      refresh();
    }
  };

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
      <Link href="/admin/payments">
        <ArrowLeft /> {s.back}
      </Link>
    </Button>
  );

  if (query.isLoading) return <LoadingRows rows={6} />;
  if (query.isError || !query.data) {
    return (
      <>
        {back}
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }

  const p = query.data;
  const mismatch = p.amount !== p.expectedAmount;

  return (
    <>
      {back}
      <PageHeader
        title={s.title(p.transactionId)}
        description={`${p.user.profile?.fullName || p.user.email} · ${p.plan.name}`}
        actions={
          p.status === "pending" ? (
            <>
              <RejectDialog id={p.id} onDone={refresh} />
              <ConfirmDialog
                title={s.approveTitle}
                description={s.approveBody}
                confirmLabel={s.approve}
                onConfirm={approve}
              >
                <Button>
                  <Check /> {s.approve}
                </Button>
              </ConfirmDialog>
            </>
          ) : (
            <PaymentStatusBadge status={p.status} />
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="grid min-w-0 content-start gap-4">
          {p.warnings.length > 0 ? (
            <Alert className="border-warning/40 text-warning">
              <AlertTriangle />
              <AlertTitle>{s.warningsTitle}</AlertTitle>
              <AlertDescription>
                <ul className="text-foreground list-disc pl-4">
                  {p.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="border-success/40 text-success">
              <CheckCircle2 />
              <AlertTitle>{s.noWarningsTitle}</AlertTitle>
            </Alert>
          )}

          {p.status === "rejected" && p.rejectReason && (
            <Alert variant="destructive">
              <X />
              <AlertTitle>{s.rejectReason}</AlertTitle>
              <AlertDescription>{p.rejectReason}</AlertDescription>
            </Alert>
          )}

          <SlipPreview payment={p} />

          <Card>
            <CardHeader>
              <CardTitle>{s.ocrText}</CardTitle>
            </CardHeader>
            <CardContent>
              {p.ocrText ? (
                <pre className="bg-muted max-h-64 overflow-auto rounded-lg p-3 font-mono text-xs whitespace-pre-wrap">
                  {p.ocrText}
                </pre>
              ) : (
                <p className="text-muted-foreground text-sm">{s.noOcr}</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{s.details}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <Row label={s.status}>
                  <PaymentStatusBadge status={p.status} />
                </Row>
                <Row label={s.student}>
                  <span className="block">{p.user.profile?.fullName || "—"}</span>
                  <span className="text-muted-foreground block text-xs font-normal">
                    {p.user.email}
                  </span>
                </Row>
                <Row label={s.plan}>{p.plan.name}</Row>
                <Row label={s.coupon}>
                  {p.coupon ? <span className="font-mono">{p.coupon.code}</span> : s.noCoupon}
                </Row>
                <Row label={s.amount}>
                  <span className={cn("tabular-nums", mismatch && "text-warning")}>
                    {pkr(p.amount)}
                  </span>
                </Row>
                <Row label={s.expected}>
                  <span className="tabular-nums">{pkr(p.expectedAmount)}</span>
                </Row>
                <Row label={s.method}>{t.common.paymentMethods[p.method]}</Row>
                <Row label={s.transactionId}>
                  <span className="font-mono">{p.transactionId}</span>
                </Row>
                <Row label={s.paidAt}>{formatDate(p.paidAt)}</Row>
                <Row label={s.submitted}>{formatDateTime(p.createdAt)}</Row>
                {p.reviewedAt && <Row label={s.reviewedAt}>{formatDateTime(p.reviewedAt)}</Row>}
                <Row label={s.previous}>{p.previousPayments}</Row>
              </dl>
            </CardContent>
          </Card>
          <InvoiceCard payment={p} onChange={refresh} />
        </div>
      </div>
    </>
  );
}
