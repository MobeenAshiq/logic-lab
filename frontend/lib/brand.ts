// Brand artwork and images (files in /public). Track art is matched by the
// track slug set in the CMS; unknown tracks fall back to a gradient.

export const BRAND = {
  mark: "/brand/logo-mark.png",
  full: "/brand/logo-full.png",
} as const;

export const STOCK = {
  students: "/images/stock/students.webp",
  mentoring: "/images/stock/mentoring.webp",
} as const;

export type TrackAccent = "blue" | "purple" | "green";

export const TRACK_ART: Record<string, { src: string; accent: TrackAccent }> = {
  "logic-building": { src: "/images/stock/logic-building.webp", accent: "blue" },
  "web-development": { src: "/images/programs/web-development-art.webp", accent: "blue" },
  "ai-ml-data-science": { src: "/images/programs/ai-ml-art.webp", accent: "purple" },
};

/** The three promo cards (from the brand kit) and the catalog filter each opens. */
export const PROGRAMS = [
  { key: "web", image: "/images/programs/web-development-card.webp", track: "web-development" },
  { key: "ai", image: "/images/programs/ai-ml-card.webp", track: "ai-ml-data-science" },
  { key: "data", image: "/images/programs/data-science-card.webp", track: "ai-ml-data-science" },
] as const;

export const accentClasses: Record<TrackAccent, string> = {
  blue: "bg-brand-blue/10 text-brand-blue",
  purple: "bg-brand-purple/10 text-brand-purple",
  green: "bg-brand-green/10 text-brand-green",
};
