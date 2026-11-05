"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  Database,
  Flame,
  Layers,
  Sparkles,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackCategory {
  id: string;
  name: string;
  icon: typeof Brain;
  isNew?: boolean;
  curriculum: {
    title: string;
    viewAllHref: string;
    primaryItems: Array<{
      title: string;
      href: string;
      badge?: string;
    }>;
    discoverItems: Array<{
      id: string;
      title: string;
      subtitle?: string;
      href: string;
      isNew?: boolean;
      hasSubmenu?: boolean;
    }>;
  };
  submenus: Record<
    string,
    {
      title: string;
      items: Array<{ title: string; href: string; badge?: string }>;
    }
  >;
}

const TRACKS_DATA: TrackCategory[] = [
  {
    id: "logic-building",
    name: "Logic Building",
    icon: Brain,
    curriculum: {
      title: "LOGIC BUILDING",
      viewAllHref: "/courses?track=logic-building",
      primaryItems: [
        { title: "Today's Summary", href: "/courses" },
        {
          title: "Foundations of Problem Solving",
          href: "/courses",
          badge: "⭐ 4.9 · 1.4k Learners",
        },
        { title: "Pattern Recognition & Loops", href: "/courses" },
        { title: "Functions & Recursion", href: "/courses" },
      ],
      discoverItems: [
        {
          id: "interview-prep",
          title: "Interview Prep Pack",
          subtitle: "Handpicked problems for top tech interviews",
          href: "/courses",
        },
        {
          id: "etfs",
          title: "Foundational Algorithms (DSA)",
          href: "/courses",
        },
        {
          id: "valuations",
          title: "Valuations & Skill Tests",
          href: "/courses",
          hasSubmenu: true,
        },
        {
          id: "screener",
          title: "Problem Screener",
          subtitle: "Filter challenges by difficulty & pattern",
          href: "/courses",
          isNew: true,
        },
        {
          id: "scores",
          title: "LogicLab Scores",
          subtitle: "Rating of your algorithmic mastery",
          href: "/leaderboard",
          isNew: true,
        },
      ],
    },
    submenus: {
      valuations: {
        title: "VALUATIONS",
        items: [
          { title: "Top P/E Coding Drills", href: "/courses" },
          { title: "Time & Space Complexity Tests", href: "/courses" },
          { title: "Top Scoring Algorithmic Tasks", href: "/courses" },
          { title: "Large Scale Logic Tests", href: "/courses" },
          { title: "99th Percentile Challenges", href: "/courses" },
          { title: "Beginner Diagnostic Assessment", href: "/courses" },
        ],
      },
      screener: {
        title: "FILTER CRITERIA",
        items: [
          { title: "Array & Hash Tables", href: "/courses" },
          { title: "Two Pointers & Sliding Window", href: "/courses" },
          { title: "Binary Search Variations", href: "/courses" },
          { title: "Linked Lists & Pointers", href: "/courses" },
          { title: "Stack & Queue Simulation", href: "/courses" },
          { title: "Tree & Graph Traversals", href: "/courses" },
        ],
      },
      scores: {
        title: "SCORE METRICS",
        items: [
          { title: "Algorithmic Precision Score", href: "/leaderboard" },
          { title: "Time Efficiency Benchmark", href: "/leaderboard" },
          { title: "Code Cleanliness Rating", href: "/leaderboard" },
          { title: "Consistency Streak Rating", href: "/leaderboard" },
          { title: "Speed Performance Index", href: "/leaderboard" },
          { title: "Mentor Endorsement Badges", href: "/leaderboard" },
        ],
      },
      "interview-prep": {
        title: "COMPANY TRACKS",
        items: [
          { title: "FAANG & Big Tech Curated Set", href: "/courses" },
          { title: "Fintech & Banking Systems", href: "/courses" },
          { title: "High-Growth Startups Pack", href: "/courses" },
          { title: "Behavioral & System Logic", href: "/courses" },
          { title: "Mock Interview Simulations", href: "/courses" },
          { title: "Live Mentor Code Review", href: "/courses" },
        ],
      },
    },
  },
  {
    id: "web-dev",
    name: "Fullstack Web Dev",
    icon: Code2,
    curriculum: {
      title: "WEB DEVELOPMENT",
      viewAllHref: "/courses?track=web-development",
      primaryItems: [
        { title: "Fullstack Roadmap 2026", href: "/courses" },
        {
          title: "Modern React 19 & Next.js 15",
          href: "/courses",
          badge: "🔥 Hot",
        },
        { title: "Backend APIs & Database Design", href: "/courses" },
        { title: "Authentication & Cloud Deployment", href: "/courses" },
      ],
      discoverItems: [
        {
          id: "fullstack-projects",
          title: "Production Projects",
          subtitle: "Build real SaaS, e-commerce, & real-time apps",
          href: "/courses",
        },
        {
          id: "architecture",
          title: "System Architecture & Scaling",
          href: "/courses",
        },
        {
          id: "valuations",
          title: "Valuations & Skill Tests",
          href: "/courses",
          hasSubmenu: true,
        },
        {
          id: "screener",
          title: "Fullstack Code Screener",
          subtitle: "Evaluate architecture & security standards",
          href: "/courses",
          isNew: true,
        },
        {
          id: "scores",
          title: "Developer Readiness Score",
          subtitle: "Industry benchmark for hiring readiness",
          href: "/leaderboard",
          isNew: true,
        },
      ],
    },
    submenus: {
      valuations: {
        title: "WEB SKILL ASSESSMENTS",
        items: [
          { title: "Next.js SSR & Server Actions Test", href: "/courses" },
          { title: "PostgreSQL & Prisma Schema Design", href: "/courses" },
          { title: "REST & WebSocket Realtime APIs", href: "/courses" },
          { title: "State Management & React Query", href: "/courses" },
          { title: "Docker & AWS Cloud Setup", href: "/courses" },
          { title: "Security & OWASP Best Practices", href: "/courses" },
        ],
      },
      "fullstack-projects": {
        title: "PORTFOLIO PROJECTS",
        items: [
          { title: "E-Commerce with Stripe Payments", href: "/courses" },
          { title: "Real-Time Collaboration Platform", href: "/courses" },
          { title: "AI-Powered SaaS Application", href: "/courses" },
          { title: "Job Board & Applicant Tracking", href: "/courses" },
          { title: "Social Feed & Notifications Engine", href: "/courses" },
          { title: "Analytics Dashboard with Charts", href: "/courses" },
        ],
      },
      scores: {
        title: "SKILL BENCHMARKS",
        items: [
          { title: "Frontend Architecture Rating", href: "/leaderboard" },
          { title: "Backend Scalability Metric", href: "/leaderboard" },
          { title: "Code Quality & Linting Score", href: "/leaderboard" },
          { title: "Test Coverage & CI/CD Metric", href: "/leaderboard" },
          { title: "Mentor Code Review Level", href: "/leaderboard" },
          { title: "Portfolio Completeness Score", href: "/leaderboard" },
        ],
      },
    },
  },
  {
    id: "ai-ml",
    name: "AI & Machine Learning",
    icon: Cpu,
    curriculum: {
      title: "AI & DATA SCIENCE",
      viewAllHref: "/courses?track=ai-ml-data-science",
      primaryItems: [
        { title: "Applied AI & Python Roadmap", href: "/courses" },
        {
          title: "LLM Engineering & Agents",
          href: "/courses",
          badge: "🚀 Trending",
        },
        { title: "Deep Learning & Neural Nets", href: "/courses" },
        { title: "Data Pipelines & MLOps", href: "/courses" },
      ],
      discoverItems: [
        {
          id: "ai-apps",
          title: "Autonomous Agent Systems",
          subtitle: "Build RAG and tool-calling intelligent agents",
          href: "/courses",
        },
        {
          id: "vector-dbs",
          title: "Vector Databases & Embeddings",
          href: "/courses",
        },
        {
          id: "valuations",
          title: "Valuations & Skill Tests",
          href: "/courses",
          hasSubmenu: true,
        },
        {
          id: "screener",
          title: "AI Model Screener",
          subtitle: "Compare latency, cost, and accuracy",
          href: "/courses",
          isNew: true,
        },
        {
          id: "scores",
          title: "AI Engineering Scores",
          subtitle: "Validate your generative AI proficiency",
          href: "/leaderboard",
          isNew: true,
        },
      ],
    },
    submenus: {
      valuations: {
        title: "AI EVALUATIONS",
        items: [
          { title: "Prompt Engineering & Evaluation", href: "/courses" },
          { title: "RAG Retrieval Accuracy Benchmark", href: "/courses" },
          { title: "Fine-Tuning & LoRA Practical Test", href: "/courses" },
          { title: "LangChain & LlamaIndex Pipelines", href: "/courses" },
          { title: "Vector Search Optimization Drills", href: "/courses" },
          { title: "AI Guardrails & Safety Audits", href: "/courses" },
        ],
      },
      "ai-apps": {
        title: "AGENT PROJECTS",
        items: [
          { title: "Autonomous Web Research Agent", href: "/courses" },
          { title: "Multimodal Voice Assistant", href: "/courses" },
          { title: "Code Generation & Refactoring Bot", href: "/courses" },
          { title: "Enterprise Knowledge Base RAG", href: "/courses" },
          { title: "Automated Data Analyst Agent", href: "/courses" },
          { title: "Customer Support Orchestrator", href: "/courses" },
        ],
      },
    },
  },
  {
    id: "dsa-contests",
    name: "Data Structures & DSA",
    icon: Database,
    curriculum: {
      title: "DSA & COMPETITIVE CODING",
      viewAllHref: "/courses",
      primaryItems: [
        { title: "DSA Zero to Hero Path", href: "/courses" },
        {
          title: "Graph Theory & Dynamic Programming",
          href: "/courses",
          badge: "Hard",
        },
        { title: "Contest Problem Archive", href: "/courses" },
        { title: "Weekly Speed Contests", href: "/community" },
      ],
      discoverItems: [
        {
          id: "speed-arena",
          title: "Speed Coding Arena",
          subtitle: "Timed battles against peer developers",
          href: "/community",
        },
        {
          id: "patterns",
          title: "14 Fundamental Coding Patterns",
          href: "/courses",
        },
        {
          id: "valuations",
          title: "Valuations & Skill Tests",
          href: "/courses",
          hasSubmenu: true,
        },
        {
          id: "screener",
          title: "Problem Difficulty Screener",
          subtitle: "Pick by acceptance rate & tags",
          href: "/courses",
          isNew: true,
        },
        {
          id: "scores",
          title: "Contest Elo Rating",
          subtitle: "Live competitive rating updated weekly",
          href: "/leaderboard",
          isNew: true,
        },
      ],
    },
    submenus: {
      valuations: {
        title: "ALGORITHMIC VALUATIONS",
        items: [
          { title: "Top P/E Algorithmic Puzzles", href: "/courses" },
          { title: "Graph Cycle & Shortest Path Drill", href: "/courses" },
          { title: "0/1 Knapsack & DP Variations", href: "/courses" },
          { title: "Bit Manipulation Mastery", href: "/courses" },
          { title: "Trie & String Matching Tests", href: "/courses" },
          { title: "Monotonic Stack & Queue Tasks", href: "/courses" },
        ],
      },
    },
  },
  {
    id: "interactive-labs",
    name: "Interactive Labs",
    icon: Terminal,
    isNew: true,
    curriculum: {
      title: "INTERACTIVE CODE LABS",
      viewAllHref: "/courses",
      primaryItems: [
        { title: "In-Browser Cloud Linux Terminals", href: "/courses" },
        {
          title: "Realtime Collaborative Coding",
          href: "/courses",
          badge: "✨ Live",
        },
        { title: "Bug Hunting Simulator", href: "/courses" },
        { title: "Database Query Playground", href: "/courses" },
      ],
      discoverItems: [
        {
          id: "cloud-ide",
          title: "Instant Web IDE",
          subtitle: "Run Node.js, Python, & Go with zero install",
          href: "/courses",
        },
        {
          id: "live-pairing",
          title: "Peer-to-Peer Pair Programming",
          href: "/community",
        },
        {
          id: "valuations",
          title: "Valuations & Skill Tests",
          href: "/courses",
          hasSubmenu: true,
        },
        {
          id: "screener",
          title: "Lab Environment Screener",
          subtitle: "Choose runtime, memory, and stack",
          href: "/courses",
          isNew: true,
        },
        {
          id: "scores",
          title: "Terminal Mastery Scores",
          subtitle: "Command-line speed & troubleshooting badge",
          href: "/leaderboard",
          isNew: true,
        },
      ],
    },
    submenus: {
      valuations: {
        title: "HANDS-ON LAB TESTS",
        items: [
          { title: "Linux Shell Scripting Challenge", href: "/courses" },
          { title: "SQL Optimization Playground", href: "/courses" },
          { title: "Git Conflict Resolution Drill", href: "/courses" },
          { title: "Docker Containerization Lab", href: "/courses" },
          { title: "Microservice Debugging Arena", href: "/courses" },
          { title: "CI/CD Pipeline Troubleshooting", href: "/courses" },
        ],
      },
    },
  },
];

export function ProgramsMegaMenu({
  isOpen,
  onOpenChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedTrackId, setSelectedTrackId] = useState("logic-building");
  const [selectedSubmenuId, setSelectedSubmenuId] = useState("valuations");

  const currentTrack =
    TRACKS_DATA.find((t) => t.id === selectedTrackId) || TRACKS_DATA[0];

  const currentSubmenu =
    currentTrack.submenus[selectedSubmenuId] ||
    currentTrack.submenus["valuations"] || {
      title: "VALUATIONS",
      items: [
        { title: "Top P/E Coding Drills", href: "/courses" },
        { title: "Time & Space Complexity Tests", href: "/courses" },
        { title: "Top Scoring Algorithmic Tasks", href: "/courses" },
        { title: "Large Scale Logic Tests", href: "/courses" },
        { title: "99th Percentile Challenges", href: "/courses" },
        { title: "Beginner Diagnostic Assessment", href: "/courses" },
      ],
    };

  return (
    <div
      className="relative"
      onMouseLeave={() => {
        // slight delay can be added or handled by parent hover
      }}
    >
      {/* Trigger Button (like Markets ⌄ in the screenshot) */}
      <button
        type="button"
        onClick={() => onOpenChange(!isOpen)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-all outline-none",
          isOpen
            ? "bg-slate-100 font-semibold text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
            : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
        )}
        aria-expanded={isOpen}
      >
        <span>Tracks</span>
        <ChevronDown
          className={cn(
            "size-3.5 transition-transform duration-200",
            isOpen ? "rotate-180 text-foreground" : "text-muted-foreground"
          )}
        />
      </button>

      {/* Floating 3-Column Mega Menu Card */}
      {isOpen && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-30"
            onClick={() => onOpenChange(false)}
          />

          <div
            className={cn(
              "absolute left-0 top-full z-40 mt-2.5 flex overflow-hidden rounded-2xl border border-border/80 bg-background/98 p-0 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150",
              "w-[860px] max-w-[94vw]"
            )}
            style={{
              boxShadow:
                "0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
          >
            {/* COLUMN 1: TRACK CATEGORIES (~210px) */}
            <div className="w-56 shrink-0 border-r border-border/70 bg-surface/50 p-3">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                TRACKS
              </div>

              <div className="flex flex-col gap-1">
                {TRACKS_DATA.map((track) => {
                  const Icon = track.icon;
                  const isActive = track.id === selectedTrackId;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onMouseEnter={() => {
                        setSelectedTrackId(track.id);
                        setSelectedSubmenuId("valuations");
                      }}
                      onClick={() => {
                        setSelectedTrackId(track.id);
                        setSelectedSubmenuId("valuations");
                      }}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                        isActive
                          ? "bg-slate-200/70 font-semibold text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-850 dark:hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            isActive
                              ? "text-primary"
                              : "text-muted-foreground group-hover:text-foreground"
                          )}
                        />
                        <span className="truncate">{track.name}</span>
                        {track.isNew && (
                          <span className="rounded-full bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                            New
                          </span>
                        )}
                      </div>
                      <ChevronRight
                        className={cn(
                          "size-3.5 shrink-0 transition-transform",
                          isActive
                            ? "text-slate-900 dark:text-white"
                            : "text-muted-foreground/50 group-hover:text-muted-foreground"
                        )}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 2: TRACK CURRICULUM & DISCOVER (~310px) */}
            <div className="w-80 shrink-0 border-r border-border/70 p-4">
              {/* Header row */}
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  {currentTrack.curriculum.title}
                </span>
                <Link
                  href={currentTrack.curriculum.viewAllHref}
                  onClick={() => onOpenChange(false)}
                  className="group flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                >
                  <span>View all</span>
                  <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              {/* Primary links */}
              <div className="flex flex-col gap-0.5">
                {currentTrack.curriculum.primaryItems.map((item, idx) => (
                  <Link
                    key={idx}
                    href={item.href}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm text-slate-800 transition-colors hover:bg-muted/80 hover:text-primary dark:text-slate-200"
                  >
                    <span className="font-medium">{item.title}</span>
                    {item.badge && (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>

              <div className="my-3 border-t border-border/70" />

              {/* Discover subsection */}
              <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground/70">
                Discover
              </div>

              <div className="flex flex-col gap-1">
                {currentTrack.curriculum.discoverItems.map((item) => {
                  const isHovered = selectedSubmenuId === item.id;
                  return (
                    <div
                      key={item.id}
                      onMouseEnter={() => {
                        if (currentTrack.submenus[item.id]) {
                          setSelectedSubmenuId(item.id);
                        }
                      }}
                      className={cn(
                        "group flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 transition-all",
                        isHovered && item.hasSubmenu
                          ? "bg-slate-200/80 font-semibold text-slate-900 dark:bg-slate-800 dark:text-white"
                          : "hover:bg-muted/80 text-foreground"
                      )}
                    >
                      <Link
                        href={item.href}
                        onClick={() => onOpenChange(false)}
                        className="flex-1 min-w-0"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {item.title}
                          </span>
                          {item.isNew && (
                            <span className="rounded-full bg-rose-500/10 px-1.5 py-0.2 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                              New
                            </span>
                          )}
                        </div>
                        {item.subtitle && (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {item.subtitle}
                          </p>
                        )}
                      </Link>

                      {item.hasSubmenu && (
                        <ChevronRight
                          className={cn(
                            "size-3.5 shrink-0 transition-colors ml-2",
                            isHovered
                              ? "text-slate-900 dark:text-white"
                              : "text-muted-foreground/60"
                          )}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* COLUMN 3: VALUATIONS & SUBMENU ITEMS (~320px) */}
            <div className="flex-1 p-4 bg-surface/30">
              <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                {currentSubmenu.title}
              </div>

              <div className="flex flex-col gap-1">
                {currentSubmenu.items.map((sub, idx) => (
                  <Link
                    key={idx}
                    href={sub.href}
                    onClick={() => onOpenChange(false)}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-200/60 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                  >
                    <span>{sub.title}</span>
                    {sub.badge && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        {sub.badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
