import type { Metadata } from "next";
import { DashboardShell } from "@/components/dashboard/shell";

export const metadata: Metadata = { robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell portal="admin">{children}</DashboardShell>;
}
