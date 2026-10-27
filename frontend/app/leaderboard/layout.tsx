import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { t } from "@/lib/i18n";

export const metadata: Metadata = {
  title: `${t.realtime.leaderboard.title} — LogicLab`,
  description: t.realtime.leaderboard.subtitle,
};

export default function LeaderboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
