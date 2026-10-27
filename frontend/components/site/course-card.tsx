import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { TRACK_ART } from "@/lib/brand";
import { t } from "@/lib/i18n";
import type { PublicCourseListItem } from "@/types/api";

export function CourseCard({ course }: { course: PublicCourseListItem }) {
  return (
    <Link href={`/courses/${course.slug}`} className="group">
      <Card className="group-hover:border-primary/50 h-full overflow-hidden pt-0 transition-colors">
        <div className="from-primary/15 to-primary/5 relative aspect-[16/9] bg-gradient-to-br">
          {course.coverImageUrl ? (
            // Signed R2 URL that expires; next/image caching would break it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.coverImageUrl} alt="" className="size-full object-cover" />
          ) : (
            TRACK_ART[course.track.slug] && (
              <Image
                src={TRACK_ART[course.track.slug].src}
                alt=""
                fill
                sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                className="object-cover"
              />
            )
          )}
        </div>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{course.track.title}</Badge>
            <Badge variant="outline">{t.common.levels[course.level]}</Badge>
          </div>
          <h3 className="mt-3 font-semibold">{course.title}</h3>
          {course.shortDescription && (
            <p className="text-muted-foreground mt-1 line-clamp-2 text-sm">
              {course.shortDescription}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
