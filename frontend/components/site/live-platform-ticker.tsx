"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Flame, Sparkles, TrendingUp, Users, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TickerItem {
  id: string;
  badge: string;
  badgeColor: string;
  text: string;
  href: string;
  metric?: string;
  icon?: typeof Award;
}

const LIVE_TICKERS: TickerItem[] = [
  {
    id: "1",
    badge: "XP GAIN",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    text: "Hassan M. completed 'LRU Cache' in Python",
    metric: "+50 XP",
    href: "/leaderboard",
    icon: Award,
  },
  {
    id: "2",
    badge: "STREAK",
    badgeColor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    text: "420 students reached a 7+ day coding streak",
    metric: "🔥 7 Days",
    href: "/leaderboard",
    icon: Flame,
  },
  {
    id: "3",
    badge: "CONTEST",
    badgeColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    text: "Weekly Speed Challenge 14 starts Saturday 8 PM PKT",
    metric: "Register",
    href: "/community",
    icon: Zap,
  },
  {
    id: "4",
    badge: "CERTIFIED",
    badgeColor: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    text: "Ayesha R. completed Fullstack Web Track certification",
    metric: "Grade A+",
    href: "/courses",
    icon: Award,
  },
  {
    id: "5",
    badge: "DOUBT SUPPORT",
    badgeColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
    text: "Live Mentors active now · Average response time < 3m",
    metric: "Instant",
    href: "/courses",
    icon: Users,
  },
  {
    id: "6",
    badge: "NEW LAB",
    badgeColor: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    text: "Interactive Next.js 15 Server Actions & Turbopack Lab published",
    metric: "Explore",
    href: "/courses",
    icon: Sparkles,
  },
  {
    id: "7",
    badge: "RANK #1",
    badgeColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    text: "Bilal K. topped the National LogicLab Weekly Leaderboard",
    metric: "2,840 pts",
    href: "/leaderboard",
    icon: TrendingUp,
  },
];

export function LivePlatformTicker({ className }: { className?: string }) {
  const [isPaused, setIsPaused] = useState(false);

  // Duplicate for seamless infinite marquee loop
  const tickerItems = [...LIVE_TICKERS, ...LIVE_TICKERS];

  return (
    <div
      className={cn(
        "relative flex h-10 w-full items-center overflow-hidden border-b border-border/70 bg-surface/80 text-xs backdrop-blur-md transition-colors",
        className
      )}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Left Pinned Live Platform Status Badge */}
      <div className="z-10 flex h-full shrink-0 items-center gap-2.5 border-r border-border/80 bg-background px-3.5 shadow-[4px_0_12px_rgba(0,0,0,0.03)]">
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-heading font-extrabold tracking-tight text-foreground">
          LOGICLAB LIVE
        </span>
        <span className="hidden items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary sm:inline-flex">
          1,420+ Online
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
            const Icon = item.icon || Sparkles;
            return (
              <Link
                key={`${item.id}-${idx}`}
                href={item.href}
                className="group flex cursor-pointer items-center gap-2 rounded-md border border-border/60 bg-background/70 px-2.5 py-1 transition-all hover:border-primary/40 hover:bg-muted/80 hover:shadow-xs"
              >
                <span
                  className={cn(
                    "flex items-center gap-1 rounded border px-1.5 py-0.2 font-mono text-[10px] font-bold uppercase",
                    item.badgeColor
                  )}
                >
                  <Icon className="size-2.5" />
                  {item.badge}
                </span>

                <span className="font-medium text-foreground/90 group-hover:text-primary transition-colors">
                  {item.text}
                </span>

                {item.metric && (
                  <span className="font-mono text-[11px] font-semibold text-muted-foreground group-hover:text-foreground">
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
