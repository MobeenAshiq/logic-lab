import type { Metadata } from "next";
import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: t.community.title };

/** Shared by students, mentors and admins, so it uses the site header, not a portal shell. */
export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
      <SiteFooter />
    </div>
  );
}
