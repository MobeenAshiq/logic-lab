import { differenceInCalendarDays, format, formatDistanceToNow } from "date-fns";

export function pkr(amount: number) {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

export function formatDate(value: string | Date) {
  return format(new Date(value), "d MMM yyyy");
}

export function formatDateTime(value: string | Date) {
  return format(new Date(value), "d MMM yyyy, h:mm a");
}

export function timeAgo(value: string | Date) {
  return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function daysLeft(until: string | Date) {
  return differenceInCalendarDays(new Date(until), new Date());
}

/** Today in the user's local time as YYYY-MM-DD (for date inputs). */
export function todayIso() {
  return format(new Date(), "yyyy-MM-dd");
}
