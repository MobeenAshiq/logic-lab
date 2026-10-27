import { BookOpen, Brain, Code2, Globe, type LucideIcon, Sparkles } from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  brain: Brain,
  globe: Globe,
  sparkles: Sparkles,
  code: Code2,
};

/** Tracks store a short icon name (set in the CMS). */
export function TrackIcon({ name, className }: { name: string | null; className?: string }) {
  const Icon = (name && ICONS[name]) || BookOpen;
  return <Icon className={className} />;
}
