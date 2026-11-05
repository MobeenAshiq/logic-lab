"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Code2,
  Cpu,
  GraduationCap,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface TrackDetail {
  id: string;
  name: string;
  description: string;
  icon: typeof Brain;
  accentColor: string;
  viewAllHref: string;
  modules: Array<{
    title: string;
    description: string;
    href: string;
  }>;
  features: Array<{
    title: string;
    description: string;
    href: string;
  }>;
}

const REAL_TRACKS: TrackDetail[] = [
  {
    id: "logic-building",
    name: "Logic Building",
    description: "Foundations of computational thinking and algorithmic problem solving",
    icon: Brain,
    accentColor: "text-[#7C3AED]",
    viewAllHref: "/courses?track=logic-building",
    modules: [
      {
        title: "Problem Solving & Flowcharts",
        description: "Breaking down complex problems into structured logic steps",
        href: "/courses?track=logic-building",
      },
      {
        title: "Loops & Pattern Recognition",
        description: "Nested loops, iteration techniques, and array traversal",
        href: "/courses?track=logic-building",
      },
      {
        title: "Functions, Modularity & Recursion",
        description: "Clean code structure, call stack mastery, and base cases",
        href: "/courses?track=logic-building",
      },
      {
        title: "Data Structures Foundations",
        description: "Arrays, hash maps, two pointers, and basic sorting",
        href: "/courses?track=logic-building",
      },
    ],
    features: [
      {
        title: "Mentor Assignment Reviews",
        description: "Direct feedback from senior engineers on every submission",
        href: "/courses",
      },
      {
        title: "Typing Replay Verification",
        description: "Ensuring authentic learning without copy-pasting",
        href: "/courses",
      },
      {
        title: "Weekly Office Hours",
        description: "Live Q&A sessions to unblock difficult concepts",
        href: "/community",
      },
    ],
  },
  {
    id: "web-development",
    name: "Web Development",
    description: "From beginner to production-grade modern full-stack web applications",
    icon: Code2,
    accentColor: "text-[#2563EB]",
    viewAllHref: "/courses?track=web-development",
    modules: [
      {
        title: "HTML5, Modern CSS & Tailwind",
        description: "Responsive layouts, semantic structure, and modern design systems",
        href: "/courses?track=web-development",
      },
      {
        title: "JavaScript ES6+ & TypeScript",
        description: "Async programming, closures, DOM manipulation, and types",
        href: "/courses?track=web-development",
      },
      {
        title: "React 19 & Next.js 15 Fullstack",
        description: "Server components, server actions, routing, and state",
        href: "/courses?track=web-development",
      },
      {
        title: "PostgreSQL & Database Design",
        description: "Prisma ORM, relational schema modeling, and secure queries",
        href: "/courses?track=web-development",
      },
    ],
    features: [
      {
        title: "Portfolio Capstone Projects",
        description: "Deploy production SaaS apps on Vercel and AWS",
        href: "/courses",
      },
      {
        title: "REST & Realtime WebSockets",
        description: "Build live chat and collaborative application features",
        href: "/courses",
      },
      {
        title: "Authentication & Security",
        description: "JWT, session cookies, MFA, and OAuth best practices",
        href: "/courses",
      },
    ],
  },
  {
    id: "ai-ml-data-science",
    name: "AI & Data Science",
    description: "Python, data analytics, machine learning, and generative AI systems",
    icon: Cpu,
    accentColor: "text-[#DB2777]",
    viewAllHref: "/courses?track=ai-ml-data-science",
    modules: [
      {
        title: "Python for Data Science",
        description: "NumPy, Pandas, data wrangling, and statistical foundations",
        href: "/courses?track=ai-ml-data-science",
      },
      {
        title: "Machine Learning Algorithms",
        description: "Supervised and unsupervised learning with Scikit-Learn",
        href: "/courses?track=ai-ml-data-science",
      },
      {
        title: "Deep Learning & Neural Networks",
        description: "PyTorch fundamentals, computer vision, and NLP models",
        href: "/courses?track=ai-ml-data-science",
      },
      {
        title: "LLMs & Agentic AI Systems",
        description: "RAG architectures, prompt engineering, and intelligent agents",
        href: "/courses?track=ai-ml-data-science",
      },
    ],
    features: [
      {
        title: "AI Tutor Integration",
        description: "Instant personalized hints and debugging assistance",
        href: "/courses",
      },
      {
        title: "Kaggle & Dataset Projects",
        description: "Hands-on analysis of real-world industry datasets",
        href: "/courses",
      },
      {
        title: "Model Deployment & APIs",
        description: "Serve predictions via FastAPI and cloud endpoints",
        href: "/courses",
      },
    ],
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

  const currentTrack =
    REAL_TRACKS.find((t) => t.id === selectedTrackId) || REAL_TRACKS[0];

  return (
    <div className="relative">
      {/* Trigger Button */}
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

      {/* Floating 3-Column Cascading Mega Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => onOpenChange(false)}
          />

          <div
            className={cn(
              "absolute left-0 top-full z-40 mt-2.5 flex overflow-hidden rounded-2xl border border-border/80 bg-background/98 p-0 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95 duration-150",
              "w-[780px] max-w-[92vw]"
            )}
            style={{
              boxShadow:
                "0 20px 40px -15px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.05)",
            }}
          >
            {/* COLUMN 1: 3 REAL TRACKS (~200px) */}
            <div className="w-52 shrink-0 border-r border-border/70 bg-surface/50 p-3">
              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">
                LEARNING TRACKS
              </div>

              <div className="flex flex-col gap-1">
                {REAL_TRACKS.map((track) => {
                  const Icon = track.icon;
                  const isActive = track.id === selectedTrackId;
                  return (
                    <button
                      key={track.id}
                      type="button"
                      onMouseEnter={() => setSelectedTrackId(track.id)}
                      onClick={() => setSelectedTrackId(track.id)}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-all",
                        isActive
                          ? "bg-slate-200/80 font-semibold text-slate-900 shadow-xs dark:bg-slate-800 dark:text-white"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-850 dark:hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            "size-4 shrink-0 transition-colors",
                            isActive ? track.accentColor : "text-muted-foreground"
                          )}
                        />
                        <span className="truncate">{track.name}</span>
                      </div>
                      <ChevronRight
                        className={cn(
                          "size-3.5 shrink-0 transition-transform",
                          isActive
                            ? "text-slate-900 dark:text-white"
                            : "text-muted-foreground/40 group-hover:text-muted-foreground"
                        )}
                      />
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-border/60 px-3">
                <Link
                  href="/courses"
                  onClick={() => onOpenChange(false)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  <GraduationCap className="size-3.5" />
                  <span>Browse All Courses</span>
                </Link>
              </div>
            </div>

            {/* COLUMN 2: TRACK CORE MODULES (~320px) */}
            <div className="w-72 shrink-0 border-r border-border/70 p-4">
              <div className="mb-3 flex items-center justify-between px-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                  CURRICULUM MODULES
                </span>
                <Link
                  href={currentTrack.viewAllHref}
                  onClick={() => onOpenChange(false)}
                  className="group flex items-center gap-1 text-xs font-semibold text-foreground hover:text-primary transition-colors"
                >
                  <span>View track</span>
                  <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              <div className="flex flex-col gap-1">
                {currentTrack.modules.map((mod, idx) => (
                  <Link
                    key={idx}
                    href={mod.href}
                    onClick={() => onOpenChange(false)}
                    className="rounded-lg p-2 transition-colors hover:bg-muted/80 block group"
                  >
                    <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      {mod.title}
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground">
                      {mod.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>

            {/* COLUMN 3: MENTOR & PLATFORM FEATURES (~260px) */}
            <div className="flex-1 p-4 bg-surface/30">
              <div className="mb-3 px-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80">
                WHAT YOU GET
              </div>

              <div className="flex flex-col gap-2">
                {currentTrack.features.map((feat, idx) => (
                  <Link
                    key={idx}
                    href={feat.href}
                    onClick={() => onOpenChange(false)}
                    className="rounded-lg p-2.5 transition-colors hover:bg-slate-200/60 dark:hover:bg-slate-800 block group"
                  >
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                      <Sparkles className="size-3 text-primary shrink-0" />
                      <span>{feat.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground leading-snug">
                      {feat.description}
                    </p>
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
