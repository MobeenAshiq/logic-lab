// Brand identity and track styling aligned with LogicLab Frontend Design Guide.

export const BRAND = {
  name: "LogicLab",
  tagline: "Think it. Build it. Master it.",
  mark: "/brand/logo-mark.png",
  full: "/brand/logo-full.png",
} as const;

export const STOCK = {
  students: "/images/stock/students.webp",
  mentoring: "/images/stock/mentoring.webp",
} as const;

export type TrackAccent = "violet" | "blue" | "pink";

export const TRACK_ART: Record<string, { src: string; accent: TrackAccent }> = {
  "logic-building": { src: "/images/stock/logic-building.webp", accent: "violet" },
  "web-development": { src: "/images/programs/web-development-art.webp", accent: "blue" },
  "ai-ml-data-science": { src: "/images/programs/ai-ml-art.webp", accent: "pink" },
};

export const TRACK_THEMES: Record<
  string,
  {
    color: string;
    badge: string;
    iconBg: string;
    border: string;
    label: string;
  }
> = {
  "logic-building": {
    color: "text-[#7C3AED] dark:text-[#A78BFA]",
    badge:
      "bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-[#7C3AED]/25 dark:text-[#C4B5FD] border-[#7C3AED]/30",
    iconBg: "bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-[#7C3AED]/20 dark:text-[#A78BFA]",
    border: "border-[#7C3AED]/30",
    label: "Logic Building",
  },
  "web-development": {
    color: "text-[#2563EB] dark:text-[#60A5FA]",
    badge:
      "bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/25 dark:text-[#93C5FD] border-[#2563EB]/30",
    iconBg: "bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA]",
    border: "border-[#2563EB]/30",
    label: "Web Development",
  },
  "ai-ml-data-science": {
    color: "text-[#DB2777] dark:text-[#F472B6]",
    badge:
      "bg-[#DB2777]/10 text-[#DB2777] dark:bg-[#DB2777]/25 dark:text-[#F9A8D4] border-[#DB2777]/30",
    iconBg: "bg-[#DB2777]/10 text-[#DB2777] dark:bg-[#DB2777]/20 dark:text-[#F472B6]",
    border: "border-[#DB2777]/30",
    label: "AI/ML & Data Science",
  },
};

export const accentClasses: Record<TrackAccent, string> = {
  violet: "bg-[#7C3AED]/10 text-[#7C3AED] dark:bg-[#7C3AED]/20 dark:text-[#A78BFA]",
  blue: "bg-[#2563EB]/10 text-[#2563EB] dark:bg-[#2563EB]/20 dark:text-[#60A5FA]",
  pink: "bg-[#DB2777]/10 text-[#DB2777] dark:bg-[#DB2777]/20 dark:text-[#F472B6]",
};
