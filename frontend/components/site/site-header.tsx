"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { portalHome, useMe } from "@/lib/auth";
import { t } from "@/lib/i18n";

import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { ProgramsMegaMenu } from "@/components/site/programs-mega-menu";
import { SearchDialog } from "@/components/site/search-dialog";
import { LivePlatformTicker } from "@/components/site/live-platform-ticker";

function AuthButtons({ onNavigate }: { onNavigate?: () => void }) {
  const { data: me, isLoading } = useMe();
  if (isLoading) return <div className="h-8 w-24 animate-pulse rounded-lg bg-muted" />;

  if (me) {
    const initials = me.user.fullName
      ? me.user.fullName
          .split(" ")
          .map((n: string) => n[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "U";

    return (
      <div className="flex items-center gap-2">
        <Link
          href={portalHome(me.user.role)}
          onClick={onNavigate}
          className="group flex items-center gap-2 rounded-full p-0.5 pr-2.5 transition-colors hover:bg-muted"
          title="Go to Dashboard"
        >
          <Avatar className="size-8 border border-border shadow-xs">
            <AvatarImage src={me.user.avatarUrl || ""} alt={me.user.fullName} />
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-xs font-semibold text-foreground md:inline-block max-w-[100px] truncate">
            {me.user.fullName}
          </span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="ghost" size="sm" asChild onClick={onNavigate}>
        <Link href="/login">{t.common.nav.login}</Link>
      </Button>
      <Button size="sm" className="rounded-lg shadow-xs" asChild onClick={onNavigate}>
        <Link href="/signup">{t.common.nav.startTrial}</Link>
      </Button>
    </div>
  );
}

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [megaMenuOpen, setMegaMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md transition-all">
      {/* 1. Main Navigation Bar */}
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Left: Brand Logo & Navigation */}
        <div className="flex items-center gap-6">
          <Logo />

          <nav className="hidden items-center gap-1 text-sm lg:flex">
            {/* 3-Column Cascading Mega Menu */}
            <ProgramsMegaMenu
              isOpen={megaMenuOpen}
              onOpenChange={setMegaMenuOpen}
            />

            <Link
              href="/courses"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {t.common.nav.courses}
            </Link>

            <Link
              href="/community"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {t.community.nav}
            </Link>

            <Link
              href="/leaderboard"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {t.realtime.leaderboard.nav}
            </Link>

            <Link
              href="/pricing"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            >
              {t.common.nav.pricing}
            </Link>
          </nav>
        </div>

        {/* Right: Search, Notifications, Theme Toggle, Auth */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Quick Search Button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="group flex items-center gap-2 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none"
            aria-label="Search"
            title="Search (Cmd+K)"
          >
            <Search className="size-4.5 group-hover:scale-105 transition-transform" />
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <NotificationsBell />
          </div>

          <div className="mx-1 h-5 w-px bg-border/70 hidden sm:block" />

          {/* Theme Toggle */}
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          {/* User Auth Buttons */}
          <div className="hidden md:flex items-center">
            <AuthButtons />
          </div>

          {/* Mobile Menu */}
          <div className="flex items-center gap-1 lg:hidden">
            <ThemeToggle />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t.common.nav.openMenu}>
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-80 p-0 flex flex-col">
                <SheetHeader className="p-4 border-b border-border/70">
                  <SheetTitle asChild>
                    <div>
                      <Logo />
                    </div>
                  </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  <div>
                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Learning Tracks
                    </div>
                    <div className="grid gap-1 mt-1">
                      <Link
                        href="/courses?track=logic-building"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        <span>Logic Building</span>
                        <span className="text-xs text-muted-foreground">Foundation</span>
                      </Link>
                      <Link
                        href="/courses?track=web-development"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        <span>Web Development</span>
                        <span className="text-xs text-muted-foreground">Fullstack</span>
                      </Link>
                      <Link
                        href="/courses?track=ai-ml-data-science"
                        onClick={() => setMobileOpen(false)}
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        <span>AI &amp; Data Science</span>
                        <span className="text-xs text-muted-foreground">Python &amp; ML</span>
                      </Link>
                    </div>
                  </div>

                  <div>
                    <div className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      Navigation
                    </div>
                    <div className="grid gap-1 mt-1">
                      <Link
                        href="/courses"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        {t.common.nav.courses}
                      </Link>
                      <Link
                        href="/community"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        {t.community.nav}
                      </Link>
                      <Link
                        href="/leaderboard"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        {t.realtime.leaderboard.nav}
                      </Link>
                      <Link
                        href="/pricing"
                        onClick={() => setMobileOpen(false)}
                        className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                      >
                        {t.common.nav.pricing}
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="p-4 border-t border-border/70 bg-surface/50">
                  <AuthButtons onNavigate={() => setMobileOpen(false)} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* 2. Real Platform Stats Ticker */}
      <LivePlatformTicker />

      {/* 3. Search Dialog Modal */}
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}
