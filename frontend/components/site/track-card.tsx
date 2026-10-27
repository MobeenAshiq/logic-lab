import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TrackIcon } from "@/components/site/track-icon";
import { Card, CardContent } from "@/components/ui/card";
import { accentClasses, TRACK_ART } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PublicTrack } from "@/types/api";

export function TrackCard({ track }: { track: PublicTrack }) {
  const art = TRACK_ART[track.slug];
  const accent = accentClasses[art?.accent ?? "blue"];
  return (
    <Link href={`/courses?track=${track.slug}`} className="group">
      <Card className="group-hover:border-primary/50 h-full overflow-hidden pt-0 transition-colors">
        <div className="from-primary/15 to-primary/5 relative aspect-[16/10] bg-gradient-to-br">
          {art && (
            <Image
              src={art.src}
              alt=""
              fill
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          )}
        </div>
        <CardContent className="flex flex-1 flex-col">
          <span className={cn("grid size-10 place-items-center rounded-lg", accent)}>
            <TrackIcon name={track.icon} className="size-5" />
          </span>
          <h3 className="mt-4 font-semibold">{track.title}</h3>
          <p className="text-muted-foreground mt-1 flex-1 text-sm">{track.description}</p>
          <p className="text-primary mt-4 flex items-center gap-1 text-sm font-medium">
            {t.site.tracks.courses(track._count.courses)}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
