"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calculator,
  ChevronDown,
  Code,
  Compass,
  FileCode,
  GitBranch,
  Network,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOLS_LIST = [
  {
    icon: Code,
    title: "In-Browser Code Sandbox",
    description: "Run Python, JS, C++, and Go with instant execution",
    href: "/courses",
  },
  {
    icon: Calculator,
    title: "Big-O Complexity Calculator",
    description: "Analyze time and space complexity of code",
    href: "/courses",
  },
  {
    icon: Network,
    title: "Data Structure Visualizer",
    description: "Step-by-step visual animation of trees, graphs & heaps",
    href: "/courses",
  },
  {
    icon: FileCode,
    title: "SQL Query Playground",
    description: "Practice schema design and query optimization",
    href: "/courses",
  },
  {
    icon: GitBranch,
    title: "Git Scenario Simulator",
    description: "Interactive visual branching and conflict drills",
    href: "/courses",
  },
  {
    icon: Sparkles,
    title: "AI Code Reviewer",
    description: "Get real-time feedback on clean code and edge cases",
    href: "/courses",
    isNew: true,
  },
];

export function ToolsDropdown() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all outline-none",
          open
            ? "bg-slate-100 font-semibold text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        )}
      >
        <span>Tools</span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200",
            open ? "rotate-180 text-foreground" : "text-muted-foreground"
          )}
        />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full z-40 mt-2.5 w-80 overflow-hidden rounded-2xl border border-border/80 bg-background/98 p-2 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150"
            style={{
              boxShadow:
                "0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
              LEARNING & DEV TOOLS
            </div>
            <div className="flex flex-col gap-1">
              {TOOLS_LIST.map((tool, idx) => {
                const Icon = tool.icon;
                return (
                  <Link
                    key={idx}
                    href={tool.href}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/80 group"
                  >
                    <div className="mt-0.5 grid size-8 place-items-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-foreground">
                          {tool.title}
                        </span>
                        {tool.isNew && (
                          <span className="rounded-full bg-rose-500/10 px-1.5 py-0.2 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            New
                          </span>
                        )}
                      </div>
                      <p className="line-clamp-1 text-[11px] text-muted-foreground">
                        {tool.description}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
