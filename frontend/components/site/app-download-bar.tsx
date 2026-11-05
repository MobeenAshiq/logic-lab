"use client";

import { Apple } from "lucide-react";
import { cn } from "@/lib/utils";

export function GooglePlayIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M3.6 2.4C3.4 2.6 3.2 2.9 3.2 3.4V20.6C3.2 21.1 3.4 21.4 3.6 21.6L3.7 21.7L13.3 12.1V11.9L3.7 2.3L3.6 2.4Z"
        fill="#2196F3"
      />
      <path
        d="M16.5 15.3L13.3 12.1V11.9L16.5 8.7L16.6 8.8L20.4 11C21.5 11.6 21.5 12.4 20.4 13L16.6 15.2L16.5 15.3Z"
        fill="#FFC107"
      />
      <path
        d="M16.6 15.2L13.3 11.9L3.6 21.6C4 22 4.7 22 5.5 21.5L16.6 15.2Z"
        fill="#4CAF50"
      />
      <path
        d="M16.6 8.8L5.5 2.5C4.7 2 4 2 3.6 2.4L13.3 12.1L16.6 8.8Z"
        fill="#F44336"
      />
    </svg>
  );
}

export function AppDownloadBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-center gap-3 p-3",
        className
      )}
    >
      {/* App Store button */}
      <a
        href="#app-store"
        className="group flex items-center gap-2.5 rounded-xl bg-black px-4 py-2 text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg dark:bg-white dark:text-black dark:hover:bg-zinc-100"
      >
        <Apple className="size-6 shrink-0 fill-current" />
        <div className="flex flex-col text-left leading-none">
          <span className="text-[10px] font-normal tracking-wide opacity-80">
            Download on the
          </span>
          <span className="text-xs font-bold tracking-tight mt-0.5">
            App Store
          </span>
        </div>
      </a>

      {/* Google Play button */}
      <a
        href="#google-play"
        className="group flex items-center gap-2.5 rounded-xl bg-black px-4 py-2 text-white shadow-md transition-all hover:bg-zinc-800 hover:shadow-lg dark:bg-white dark:text-black dark:hover:bg-zinc-100"
      >
        <GooglePlayIcon className="size-5.5 shrink-0" />
        <div className="flex flex-col text-left leading-none">
          <span className="text-[10px] font-normal tracking-wide opacity-80">
            Download on the
          </span>
          <span className="text-xs font-bold tracking-tight mt-0.5">
            Google Play
          </span>
        </div>
      </a>
    </div>
  );
}
