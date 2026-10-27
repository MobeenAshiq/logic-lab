import {
  BookOpen,
  ClipboardCheck,
  CreditCard,
  FileClock,
  GraduationCap,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  MessagesSquare,
  Receipt,
  Settings,
  ShieldAlert,
  Tags,
  Users,
} from "lucide-react";
import { t } from "@/lib/i18n";

export type Portal = "student" | "mentor" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Highlight only on an exact match (for portal home links). */
  exact?: boolean;
}

export const NAV: Record<Portal, NavItem[]> = {
  student: [
    { href: "/student", label: t.common.nav.dashboard, icon: LayoutDashboard, exact: true },
    { href: "/courses", label: t.common.nav.courses, icon: BookOpen },
    { href: "/community", label: t.community.nav, icon: MessagesSquare },
    { href: "/student/billing", label: t.common.nav.billing, icon: CreditCard },
  ],
  mentor: [
    { href: "/mentor", label: t.common.nav.dashboard, icon: LayoutDashboard, exact: true },
    { href: "/mentor/grading", label: t.grading.nav, icon: ClipboardCheck },
    { href: "/community", label: t.community.nav, icon: MessagesSquare },
  ],
  admin: [
    { href: "/admin", label: t.common.nav.dashboard, icon: LayoutDashboard, exact: true },
    { href: "/admin/users", label: t.common.nav.users, icon: Users },
    { href: "/admin/content", label: t.common.nav.content, icon: GraduationCap, exact: true },
    { href: "/admin/content/site", label: t.common.nav.siteContent, icon: Megaphone },
    { href: "/admin/grading", label: t.grading.nav, icon: ClipboardCheck },
    { href: "/admin/moderation", label: t.moderation.nav, icon: ShieldAlert },
    { href: "/community", label: t.community.nav, icon: MessagesSquare },
    { href: "/admin/payments", label: t.common.nav.payments, icon: Receipt },
    { href: "/admin/billing", label: t.common.nav.plans, icon: Tags },
    { href: "/admin/settings", label: t.common.nav.settings, icon: Settings },
    { href: "/admin/audit", label: t.common.nav.audit, icon: FileClock },
  ],
};

export function isActive(item: NavItem, pathname: string) {
  if (item.exact) {
    // Portal homes and /admin/content also own their detail pages (except other nav items).
    if (item.href === "/admin/content") {
      return pathname === item.href || /^\/admin\/content\/(courses|lessons)\//.test(pathname);
    }
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
