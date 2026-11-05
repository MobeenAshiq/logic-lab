"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

type TeachUsage = { unlimited: true } | { limit: number; used: number; remaining: number };
export const teachUsageKey = ["teach", "ai", "usage"] as const;

/** "7 of 10 AI requests remaining today" for mentors; nothing for admins (unlimited). */
export function MentorAiUsage() {
  const usage = useQuery({ queryKey: teachUsageKey, queryFn: () => api<TeachUsage>("/teach/ai/usage") });
  if (!usage.data || "unlimited" in usage.data) return null;
  return (
    <p className="text-muted-foreground text-xs">
      {usage.data.remaining} of {usage.data.limit} AI requests remaining today
    </p>
  );
}
