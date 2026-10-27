import { DashboardShell } from "@/components/dashboard/shell";

export default function MentorLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell portal="mentor">{children}</DashboardShell>;
}
