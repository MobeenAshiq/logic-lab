import { DashboardShell } from "@/components/dashboard/shell";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell portal="student" siteHeader>{children}</DashboardShell>;
}
