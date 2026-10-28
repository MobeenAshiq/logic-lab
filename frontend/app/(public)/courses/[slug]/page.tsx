import { FileText, HelpCircle, Lock, NotebookPen, PlayCircle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { serverApi } from "@/lib/api/server";
import { t } from "@/lib/i18n";
import type { LessonType, PublicCourse } from "@/types/api";

export const dynamic = "force-dynamic";

const lessonIcon: Record<LessonType, typeof FileText> = {
  video: PlayCircle,
  article: FileText,
  quiz: HelpCircle,
  assignment: NotebookPen,
};

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = await serverApi<PublicCourse>(`/courses/${encodeURIComponent(slug)}`);
  return course
    ? { title: course.title, description: course.shortDescription || undefined }
    : { title: t.common.errors.notFoundTitle };
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const course = await serverApi<PublicCourse>(`/courses/${encodeURIComponent(slug)}`);
  if (!course) notFound();
  const jar = await cookies();
  const isLoggedIn = jar.has("ll_access") || jar.has("ll_refresh");
  const lessonCount = course.modules.reduce((n, m) => n + m.lessons.length, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <Link
        href={`/courses?track=${course.track.slug}`}
        className="text-muted-foreground hover:text-foreground text-sm"
      >
        ← {course.track.title}
      </Link>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="secondary">{course.track.title}</Badge>
        <Badge variant="outline">{t.common.levels[course.level]}</Badge>
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{course.title}</h1>
      {course.shortDescription && (
        <p className="text-muted-foreground mt-3 text-lg">{course.shortDescription}</p>
      )}
      <p className="text-muted-foreground mt-3 text-sm">
        {t.site.catalog.modules(course.modules.length)} · {t.site.catalog.lessons(lessonCount)}
      </p>

      {course.coverImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={course.coverImageUrl}
          alt=""
          className="mt-8 aspect-[16/9] w-full rounded-xl border object-cover"
        />
      )}

      {course.description && (
        <p className="mt-8 leading-7 whitespace-pre-line">{course.description}</p>
      )}

      {course.mentors.length > 0 && (
        <div className="mt-8">
          <h2 className="text-muted-foreground text-sm font-medium">{t.site.catalog.mentors}</h2>
          <p className="mt-1">{course.mentors.map((m) => m.fullName).join(", ")}</p>
        </div>
      )}

      <h2 className="mt-12 text-xl font-semibold">{t.site.catalog.curriculum}</h2>
      {course.modules.length > 0 ? (
        <div className="mt-4 space-y-4">
          {course.modules.map((mod, i) => (
            <section key={mod.id} className="rounded-xl border">
              <header className="border-b px-5 py-3">
                <p className="text-muted-foreground text-xs font-medium">
                  {i + 1}. {mod.title}
                </p>
                {mod.description && (
                  <p className="text-muted-foreground mt-1 text-sm">{mod.description}</p>
                )}
              </header>
              <ul className="divide-y">
                {mod.lessons.map((lesson) => {
                  const Icon = lessonIcon[lesson.type];
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/student/lessons/${lesson.id}`}
                        className="hover:bg-muted/50 flex items-center gap-3 px-5 py-3 text-sm transition-colors"
                      >
                        <Icon className="text-muted-foreground size-4 shrink-0" />
                        <span className="flex-1">{lesson.title}</span>
                        {lesson.durationSeconds ? (
                          <span className="text-muted-foreground text-xs">
                            {t.site.catalog.minutes(lesson.durationSeconds)}
                          </span>
                        ) : null}
                        <Lock className="text-muted-foreground size-3.5" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="bg-muted/30 mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Curriculum is currently being updated. Check back shortly!
        </div>
      )}

      <div className="bg-muted/50 mt-10 flex flex-col items-center gap-3 rounded-xl px-6 py-8 text-center">
        <p className="text-muted-foreground text-sm">
          {isLoggedIn ? "Continue your learning on your student dashboard." : t.site.catalog.locked}
        </p>
        <Button asChild>
          {isLoggedIn ? (
            <Link href={`/student/courses/${course.slug}`}>Go to Course</Link>
          ) : (
            <Link href="/signup">{t.common.nav.startTrial}</Link>
          )}
        </Button>
      </div>
    </div>
  );
}
