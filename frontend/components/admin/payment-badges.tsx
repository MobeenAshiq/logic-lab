import { StatusBadge } from "@/components/shared";
import { t } from "@/lib/i18n";
import type { PaymentStatus } from "@/types/api";

const tone = { pending: "warning", approved: "success", rejected: "danger" } as const;

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <StatusBadge tone={tone[status]}>{t.common.paymentStatus[status]}</StatusBadge>;
}

export function WarningsBadge({ count }: { count: number }) {
  return count > 0 ? (
    <StatusBadge tone="warning">{t.admin.payments.warnings(count)}</StatusBadge>
  ) : (
    <StatusBadge tone="success">{t.admin.payments.noWarnings}</StatusBadge>
  );
}
