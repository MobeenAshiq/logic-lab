import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Flask/beaker icon made of code brackets { }, representing Logic + Lab.
 * Conforms to Brand Identity in LogicLab Frontend Design Guide.
 */
export function BeakerCodeIcon({ className = "size-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      {/* Liquid inside beaker */}
      <path
        d="M9.5 22L12 16H20L22.5 22C23.5 24.5 21.8 27 19 27H13C10.2 27 8.5 24.5 9.5 22Z"
        className="fill-primary/20 dark:fill-primary/30"
      />
      {/* Liquid surface wave */}
      <path
        d="M12 16C13.5 17 15 15.5 16.5 16C18 16.5 19 15.8 20 16"
        className="stroke-primary"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      {/* Small reaction bubbles */}
      <circle cx="14" cy="22" r="1.25" className="fill-primary" />
      <circle cx="18" cy="19.5" r="1" className="fill-primary" />
      <circle cx="16" cy="12" r="0.8" className="fill-primary/70" />

      {/* Left Code Bracket forming left neck & flask wall */}
      <path
        d="M13 5H12C11.4 5 11 5.4 11 6V10C11 11.5 10.2 12.8 9 13.5L7.2 14.5C6.5 15 6 15.8 6 16.7C6 17.6 6.5 18.4 7.2 18.9L9 20C10.2 20.7 11 22 11 23.5V25C11 26.1 11.9 27 13 27"
        className="stroke-foreground"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Right Code Bracket forming right neck & flask wall */}
      <path
        d="M19 5H20C20.6 5 21 5.4 21 6V10C21 11.5 21.8 12.8 23 13.5L24.8 14.5C25.5 15 26 15.8 26 16.7C26 17.6 25.5 18.4 24.8 18.9L23 20C21.8 20.7 21 22 21 23.5V25C21 26.1 20.1 27 19 27"
        className="stroke-primary"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Top rim of flask */}
      <path
        d="M11 5H21"
        className="stroke-foreground"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Brand Logo: Beaker bracket mark + bold "LogicLab" with "Logic" in text color and "Lab" in primary teal.
 */
export function Logo({
  href = "/",
  className,
  withTagline = false,
  size = "md",
}: {
  href?: string;
  className?: string;
  withTagline?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const iconSizes = {
    sm: "size-6",
    md: "size-8",
    lg: "size-10",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-xl",
    lg: "text-2xl",
  };

  return (
    <Link
      href={href}
      aria-label={BRAND.name}
      className={cn("group flex items-center gap-2.5 tracking-tight transition-opacity hover:opacity-95", className)}
    >
      <div className="relative grid place-items-center rounded-lg bg-surface p-1 transition-transform group-hover:scale-105 border border-border/50">
        <BeakerCodeIcon className={iconSizes[size]} />
      </div>
      <span className="flex flex-col leading-none">
        <span className={cn("font-heading font-extrabold tracking-tight", textSizes[size])}>
          <span className="text-foreground">Logic</span>
          <span className="text-primary">Lab</span>
        </span>
        {withTagline && (
          <span className="text-muted-foreground mt-1 text-[11px] font-medium tracking-normal">
            {BRAND.tagline}
          </span>
        )}
      </span>
    </Link>
  );
}
