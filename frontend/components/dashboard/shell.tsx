"use client";

import { LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/logo";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { SiteHeader } from "@/components/site/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useLogout, useMe } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isActive, NAV, type Portal } from "./nav";

function NavLinks({ portal, onNavigate }: { portal: Portal; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="grid gap-1">
      {NAV[portal].map((item) => {
        const active = isActive(item, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary",
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu() {
  const { data } = useMe();
  const logout = useLogout();
  const user = data?.user;
  const initials = (user?.fullName || user?.email || "?")
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label={user?.email}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {initials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user?.fullName}</p>
          <p className="text-muted-foreground truncate text-xs">{user?.email}</p>
          {user && (
            <p className="text-muted-foreground mt-1 text-xs">{t.common.roles[user.role]}</p>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending}>
          <LogOut /> {t.common.actions.logout}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LogoutLink() {
  const logout = useLogout();
  return (
    <button
      type="button"
      onClick={() => logout.mutate()}
      disabled={logout.isPending}
      className="text-muted-foreground hover:bg-muted hover:text-foreground mt-auto flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
    >
      <LogOut className="size-4" /> {t.common.actions.logout}
    </button>
  );
}

/**
 * Sidebar + top bar for the student, mentor and admin portals. Mobile: sidebar in a sheet.
 * With `siteHeader`, the public website menu sits on top and replaces the portal top bar
 * on desktop (logout moves to the sidebar).
 */
export function DashboardShell({
  portal,
  siteHeader = false,
  children,
}: {
  portal: Portal;
  siteHeader?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const home = `/${portal}`;

  return (
    <>
      {siteHeader && <SiteHeader />}
      <div className="flex min-h-dvh">
        <aside
          className={cn(
            "bg-sidebar sticky hidden w-60 shrink-0 flex-col border-r px-3 py-4 lg:flex",
            siteHeader ? "top-14 h-[calc(100dvh-3.5rem)]" : "top-0 h-dvh",
          )}
        >
          {/* The website menu above already shows the logo. */}
          {!siteHeader && (
            <div className="mb-6 flex items-center justify-between px-2">
              <Logo href={home} />
              <span className="text-muted-foreground text-xs font-medium">
                {t.common.portals[portal]}
              </span>
            </div>
          )}
          <NavLinks portal={portal} />
          {siteHeader && <LogoutLink />}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "bg-background/80 z-30 flex h-14 items-center gap-2 border-b px-4 backdrop-blur lg:px-8",
              siteHeader ? "lg:hidden" : "sticky top-0",
            )}
          >
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label={t.common.nav.openMenu}
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 px-3">
                <SheetHeader className="px-2">
                  <SheetTitle asChild>
                    <div>
                      <Logo href={home} />
                    </div>
                  </SheetTitle>
                </SheetHeader>
                <NavLinks portal={portal} onNavigate={() => setOpen(false)} />
                {siteHeader && <LogoutLink />}
              </SheetContent>
            </Sheet>
            <Logo href={home} className="lg:hidden" />
            {!siteHeader && (
              <div className="ml-auto flex items-center gap-1.5">
                <NotificationsBell />
                <ThemeToggle />
                <UserMenu />
              </div>
            )}
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}
