"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Code2,
  Cpu,
  GraduationCap,
  Layers,
  Search,
  Trophy,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

const REAL_SEARCH_ITEMS = [
  {
    title: "Logic Building Track",
    category: "Track",
    description: "Foundations of problem solving, flowcharts, loops, and functions",
    href: "/courses?track=logic-building",
    icon: Brain,
  },
  {
    title: "Web Development Track",
    category: "Track",
    description: "HTML, CSS, JavaScript, React 19, Next.js 15, and PostgreSQL",
    href: "/courses?track=web-development",
    icon: Code2,
  },
  {
    title: "AI & Data Science Track",
    category: "Track",
    description: "Python, data analysis, machine learning algorithms, and deep learning",
    href: "/courses?track=ai-ml-data-science",
    icon: Cpu,
  },
  {
    title: "Browse All Courses",
    category: "Curriculum",
    description: "View all 40+ mentor-guided lessons and assignments",
    href: "/courses",
    icon: GraduationCap,
  },
  {
    title: "Student Leaderboard & Rewards",
    category: "Leaderboard",
    description: "Check top student rankings, streaks, and PKR 50,000 monthly prizes",
    href: "/leaderboard",
    icon: Trophy,
  },
  {
    title: "Community & Doubt Discussion",
    category: "Community",
    description: "Ask questions, discuss problems, and connect with peers",
    href: "/community",
    icon: Layers,
  },
];

export function SearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  const filteredItems = query
    ? REAL_SEARCH_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.description.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : REAL_SEARCH_ITEMS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl">
        <DialogTitle className="sr-only">Quick Search</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 bg-surface/40">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, courses, or community... (Cmd+K)"
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No matching pages found for &ldquo;{query}&rdquo;
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {filteredItems.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="flex items-start justify-between rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted/80 group"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0 mt-0.5">
                        <Icon className="size-3.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-foreground text-xs">
                          {item.title}
                        </div>
                        <p className="line-clamp-1 text-[11px] text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <span className="rounded-md border border-border/60 bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 ml-2">
                      {item.category}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
