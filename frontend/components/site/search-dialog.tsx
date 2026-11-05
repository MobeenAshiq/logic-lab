"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Brain,
  Code2,
  Cpu,
  Layers,
  Search,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const SEARCH_ITEMS = [
  {
    title: "Logic Building & Problem Solving",
    category: "Tracks",
    href: "/courses?track=logic-building",
    icon: Brain,
  },
  {
    title: "Fullstack Web Development",
    category: "Tracks",
    href: "/courses?track=web-development",
    icon: Code2,
  },
  {
    title: "AI & Machine Learning",
    category: "Tracks",
    href: "/courses?track=ai-ml-data-science",
    icon: Cpu,
  },
  {
    title: "Two Sum & Hash Map Mastery",
    category: "Challenges",
    href: "/courses",
    icon: Sparkles,
  },
  {
    title: "Dynamic Programming: 0/1 Knapsack",
    category: "Challenges",
    href: "/courses",
    icon: Sparkles,
  },
  {
    title: "Weekly Speed Challenge Leaderboard",
    category: "Community",
    href: "/leaderboard",
    icon: Trophy,
  },
  {
    title: "Community Doubts & Discussion Forum",
    category: "Community",
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
    ? SEARCH_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          item.category.toLowerCase().includes(query.toLowerCase())
      )
    : SEARCH_ITEMS;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl">
        <DialogTitle className="sr-only">Quick Search</DialogTitle>
        {/* Search input header */}
        <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3.5 bg-surface/40">
          <Search className="size-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tracks, courses, challenges, or topics... (Cmd+K)"
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

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No matching courses or challenges found for &ldquo;{query}&rdquo;
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
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-muted/80 group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                        <Icon className="size-3.5" />
                      </div>
                      <span className="truncate font-medium text-foreground">
                        {item.title}
                      </span>
                    </div>
                    <span className="rounded-md border border-border/60 bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0">
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
