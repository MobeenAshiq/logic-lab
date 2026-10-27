import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Bulb mark + "Logic Lab" wordmark (text, so it stays sharp in light and dark mode). */
export function Logo({
  href = "/",
  className,
  withTagline = false,
}: {
  href?: string;
  className?: string;
  withTagline?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label={t.common.appName}
      className={cn("flex items-center gap-2 tracking-tight", className)}
    >
      <Image src={BRAND.mark} alt="" width={22} height={35} className="h-8 w-auto" priority />
      <span className="flex flex-col leading-none">
        <span className="text-lg font-bold">
          <span className="text-brand-navy dark:text-foreground">Logic</span>{" "}
          <span className="text-brand-blue">Lab</span>
        </span>
        {withTagline && (
          <span className="text-muted-foreground mt-1 text-[10px] font-medium">
            {t.common.tagline}
          </span>
        )}
      </span>
    </Link>
  );
}
