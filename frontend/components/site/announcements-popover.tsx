"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, Megaphone, Sparkles, Trophy, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

const ANNOUNCEMENTS = [
  {
    id: "1",
    title: "Weekly Speed Challenge #14",
    time: "2 hours ago",
    description: "Live timed coding battles this Saturday at 8:00 PM PKT. Win cash prizes and pro mentor badges.",
    tag: "Contest",
    tagColor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    href: "/community",
  },
  {
    id: "2",
    title: "New AI Tutor Copilot Released",
    time: "Yesterday",
    description: "Practice problems with real-time hints, Big-O analysis, and line-by-line debugging assistance.",
    tag: "Feature",
    tagColor: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    href: "/courses",
  },
  {
    id: "3",
    title: "MOU Signed with Top Tech Startups",
    time: "3 days ago",
    description: "Top 5% performers on the LogicLab leaderboard are now directly referred for software engineering roles.",
    tag: "Careers",
    tagColor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    href: "/leaderboard",
  },
];

export function AnnouncementsPopover() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "relative grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground outline-none",
          open && "bg-muted text-foreground"
        )}
        aria-label="Announcements"
      >
        <Megaphone className="size-4.5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-40 mt-2.5 w-84 overflow-hidden rounded-2xl border border-border/80 bg-background/98 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              boxShadow:
                "0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                LATEST ANNOUNCEMENTS
              </span>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                3 New
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              {ANNOUNCEMENTS.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="rounded-xl p-2.5 transition-colors hover:bg-muted/80 block"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "rounded px-1.5 py-0.2 text-[10px] font-bold uppercase",
                        item.tagColor
                      )}
                    >
                      {item.tag}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {item.time}
                    </span>
                  </div>
                  <h4 className="mt-1 text-xs font-semibold text-foreground">
                    {item.title}
                  </h4>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
