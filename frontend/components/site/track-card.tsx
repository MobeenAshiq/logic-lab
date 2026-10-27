import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TrackIcon } from "@/components/site/track-icon";
import { Card, CardContent } from "@/components/ui/card";
import { TRACK_ART, TRACK_THEMES } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PublicTrack } from "@/types/api";

export function TrackCard({ track }: { track: PublicTrack }) {
  const art = TRACK_ART[track.slug];
  const theme = TRACK_THEMES[track.slug] ?? {
    color: "text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
    iconBg: "bg-primary/10 text-primary",
    border: "border-primary/30",
    label: track.title,
  };

  return (
    <Link href={`/courses?track=${track.slug}`} className="group block h-full">
      <Card className="card-hover border-border bg-card group-hover:border-primary/50 flex h-full flex-col overflow-hidden rounded-xl pt-0 transition-all shadow-sm">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-muted">
          {art ? (
            <Image
              src={art.src}
              alt={track.title}
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="from-primary/15 to-primary/5 flex size-full items-center justify-center bg-gradient-to-br">
              <TrackIcon name={track.icon} className="size-12 text-primary/60" />
            </div>
          )}
        </div>
        <CardContent className="flex flex-1 flex-col p-6">
          <div className="flex items-center justify-between">
            <span className={cn("grid size-11 place-items-center rounded-xl", theme.iconBg)}>
              <TrackIcon name={track.icon} className="size-6" />
            </span>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                theme.badge,
              )}
            >
              {theme.label}
            </span>
          </div>

          <h3 className="font-heading text-foreground group-hover:text-primary mt-4 text-xl font-bold tracking-tight transition-colors">
            {track.title}
          </h3>
          <p className="text-muted-foreground mt-2 flex-1 text-sm leading-relaxed">
            {track.description}
          </p>

          <div className="border-border mt-5 flex items-center justify-between border-t pt-4">
            <span className="text-muted-foreground text-xs font-medium">
              {t.site.tracks.courses(track._count.courses)}
            </span>
            <span className="text-primary group-hover:text-primary/90 flex items-center gap-1 text-sm font-semibold">
              View track
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
