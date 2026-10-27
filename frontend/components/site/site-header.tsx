"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { portalHome, useMe } from "@/lib/auth";
import { t } from "@/lib/i18n";

import { NotificationsBell } from "@/components/notifications/notifications-bell";

const links = [
  { href: "/courses", label: t.common.nav.courses },
  { href: "/pricing", label: t.common.nav.pricing },
  { href: "/community", label: t.community.nav },
  { href: "/leaderboard", label: t.realtime.leaderboard.nav },
];

function AuthButtons({ onNavigate }: { onNavigate?: () => void }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <div className="h-8 w-40" />;
  if (me) {
    return (
      <div className="flex items-center gap-2">
        <NotificationsBell />
        <Button asChild onClick={onNavigate}>
          <Link href={portalHome(me.user.role)}>{t.common.nav.dashboard}</Link>
        </Button>
      </div>
    );
  }
  return (
    <>
      <Button variant="ghost" asChild onClick={onNavigate}>
        <Link href="/login">{t.common.nav.login}</Link>
      </Button>
      <Button asChild onClick={onNavigate}>
        <Link href="/signup">{t.common.nav.startTrial}</Link>
      </Button>
    </>
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Logo />
        <nav className="hidden items-center gap-5 text-sm md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <ThemeToggle />
          <AuthButtons />
        </div>
        <div className="ml-auto flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t.common.nav.openMenu}>
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle asChild>
                  <div>
                    <Logo />
                  </div>
                </SheetTitle>
              </SheetHeader>
              <nav className="grid gap-1 px-4">
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="hover:bg-muted rounded-lg px-3 py-2 text-sm font-medium"
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
              <div className="grid gap-2 px-4">
                <AuthButtons onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
