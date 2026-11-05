"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, BookOpen, Flame, GraduationCap, ShieldCheck, Trophy, Users, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface TickerItem {
  id: string;
  badge: string;
  text: string;
  metric?: string;
  href: string;
  icon: typeof Award;
}

const REAL_TICKER_ITEMS: TickerItem[] = [
  {
    id: "1",
    badge: "STUDENTS",
    text: "1,200+ Active Students enrolled across Pakistan",
    metric: "4.9/5 Rating",
    href: "/courses",
    icon: Users,
  },
  {
    id: "2",
    badge: "CURRICULUM",
    text: "40+ Hands-on coding lessons & assignments",
    metric: "3 Tracks",
    href: "/courses",
    icon: BookOpen,
  },
  {
    id: "3",
    badge: "MENTORSHIP",
    text: "15+ Industry engineer mentors reviewing assignments",
    metric: "1-on-1 Reviews",
    href: "/courses",
    icon: GraduationCap,
  },
  {
    id: "4",
    badge: "FREE TRIAL",
    text: "7-Day full access trial · No credit card required",
    metric: "Start Free",
    href: "/signup",
    icon: ShieldCheck,
  },
  {
    id: "5",
    badge: "REWARDS",
    text: "PKR 50,000 monthly prize pool for top leaderboard finishers",
    metric: "Monthly Contest",
    href: "/leaderboard",
    icon: Trophy,
  },
  {
    id: "6",
    badge: "LIVE SESSIONS",
    text: "Weekly interactive live office hours & code-alongs",
    metric: "Office Hours",
    href: "/community",
    icon: Video,
  },
];

export function LivePlatformTicker({ className }: { className?: string }) {
  const [isPaused, setIsPaused] = useState(false);

  // Seamless marquee loop
  const tickerItems = [...REAL_TICKER_ITEMS, ...REAL_TICKER_ITEMS];

  return (
    <div
      className={cn(
        "relative flex h-9.5 w-full items-center overflow-hidden border-b border-border/70 bg-surface/80 text-xs backdrop-blur-md transition-colors",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Left Pinned Real Platform Status */}
      <div className="z-10 flex h-full shrink-0 items-center gap-2 border-r border-border/80 bg-background px-3.5 shadow-[4px_0_12px_rgba(0,0,0,0.03)]">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-heading font-extrabold tracking-tight text-foreground">
          LOGICLAB
        </span>
        <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary sm:inline-flex">
          1,200+ Students
        </span>
      </div>

      {/* Marquee Ticker Track */}
      <div className="relative flex w-full items-center overflow-hidden">
        <div
          className={cn(
            "flex shrink-0 items-center gap-2.5 will-change-transform",
            "animate-marquee"
          )}
          style={{ animationPlayState: isPaused ? "paused" : "running" }}
        >
          {tickerItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link
                key={`${item.id}-${idx}`}
                href={item.href}
                className="group flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-0.5 transition-all hover:border-primary/40 hover:bg-muted/80"
              >
                <span className="flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.2 font-mono text-[9px] font-bold uppercase text-primary">
                  <Icon className="size-2.5" />
                  {item.badge}
                </span>

                <span className="font-medium text-foreground/90 group-hover:text-primary transition-colors text-[11px]">
                  {item.text}
                </span>

                {item.metric && (
                  <span className="font-mono text-[10px] font-semibold text-muted-foreground group-hover:text-foreground">
                    {item.metric}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
