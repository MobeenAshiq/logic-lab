import {
  ArrowRight,
  Bot,
  BookOpen,
  Check,
  Code2,
  MessageCircleQuestion,
  MessagesSquare,
  NotebookPen,
  Quote,
  Sparkles,
  Trophy,
  Video,
} from "lucide-react";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { LearnTabs } from "@/components/site/learn-tabs";
import { PlanCard } from "@/components/site/plan-card";
import { TrackIcon } from "@/components/site/track-icon";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { serverApi } from "@/lib/api/server";
import { BRAND } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PublicPlan, PublicTrack, SiteContent } from "@/types/api";

export const dynamic = "force-dynamic";

const bannerTone = {
  info: "bg-primary/10 text-primary",
  promo: "bg-primary text-primary-foreground",
  warning: "bg-warning/15 text-warning",
} as const;

/** What a free account unlocks: every item is a real feature in the student portal. */
const UNLOCKS = [
  "Progress tracking",
  "Daily lessons",
  "Daily coding challenges",
  "Python notebook",
  "Live classes",
  "AI tutor",
  "Mentor chat",
  "Leaderboard & streaks",
];

const FEATURES = [
  { icon: BookOpen, title: "Courses", body: "Step-by-step lessons, quizzes and assignments", href: "/student/courses", tint: "text-[#0F766E] dark:text-[#2DD4BF]" },
  { icon: Sparkles, title: "Daily Lesson", body: "A new lesson and 5-question quiz every day", href: "/student/daily", tint: "text-[#7C3AED] dark:text-[#A78BFA]" },
  { icon: Code2, title: "Daily Challenges", body: "One coding problem a day, auto-checked", href: "/student/challenges", tint: "text-[#2563EB] dark:text-[#60A5FA]" },
  { icon: NotebookPen, title: "Python Notebook", body: "Write and run Python in your browser", href: "/student/notebook", tint: "text-[#CA8A04] dark:text-[#FACC15]" },
  { icon: Video, title: "Live Classes", body: "Learn live and ask questions as you go", href: "/student/live", tint: "text-[#DC2626] dark:text-[#F87171]" },
  { icon: Bot, title: "AI Tutor", body: "Hints and error explanations, any time", href: "/student/mentor", tint: "text-[#0891B2] dark:text-[#22D3EE]" },
  { icon: MessageCircleQuestion, title: "Mentor Chat", body: "Ask your doubts to real mentors", href: "/student/doubts", tint: "text-[#DB2777] dark:text-[#F472B6]" },
  { icon: MessagesSquare, title: "Community", body: "Ask, answer and learn with other students", href: "/community", tint: "text-[#16A34A] dark:text-[#4ADE80]" },
  { icon: Trophy, title: "Leaderboard", body: "Earn points and climb the weekly ranks", href: "/leaderboard", tint: "text-[#D97706] dark:text-[#FBBF24]" },
];

/** Quick links under the header, like a topic bar. */
const TOPICS = [
  { label: "Courses", href: "/courses" },
  { label: "Logic Building", href: "/courses" },
  { label: "Python", href: "/courses" },
  { label: "JavaScript", href: "/courses" },
  { label: "C++", href: "/courses" },
  { label: "Community", href: "/community" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Pricing", href: "/pricing" },
];

export default async function LandingPage() {
  const jar = await cookies();
  const isLoggedIn = jar.has("ll_access") || jar.has("ll_refresh");

  const [content, tracks, plans] = await Promise.all([
    serverApi<SiteContent>("/site-content"),
    serverApi<PublicTrack[]>("/tracks"),
    serverApi<PublicPlan[]>("/plans"),
  ]);

  const hero = content?.hero ?? {
    title: t.site.hero.headline,
    subtitle:
      "Logic Building, Web Development and AI/ML with real mentors, built for students in Pakistan.",
    ctaText: t.site.hero.primaryCta,
    ctaHref: "/signup",
  };
  const faq = content?.faq ?? { items: [] };
  const testimonials = content?.testimonials ?? { items: [] };
  const banners = content?.banners ?? { items: [] };
  const startHref = isLoggedIn ? "/student" : hero.ctaHref || "/signup";
  const startText = isLoggedIn ? "Go to Dashboard" : hero.ctaText || t.site.hero.primaryCta;
  const featureHref = (href: string) =>
    isLoggedIn || !href.startsWith("/student") ? href : "/signup";

  return (
    <>
      {banners.items
        ?.filter((x) => x.active)
        .map((x) => (
          <div key={x.id} className={cn("px-4 py-2 text-center text-sm font-medium", bannerTone[x.variant])}>
            {x.href ? (
              <Link href={x.href} className="underline-offset-4 hover:underline">
                {x.text}
              </Link>
            ) : (
              x.text
            )}
          </div>
        ))}

      {/* Topic bar */}
      <nav aria-label="Topics" className="overflow-x-auto bg-[#1E293B]">
        <ul className="mx-auto flex max-w-6xl gap-1 px-4">
          {TOPICS.map((topic) => (
            <li key={topic.label}>
              <Link
                href={topic.href}
                className="block px-3 py-2.5 text-xs font-bold tracking-wide whitespace-nowrap text-slate-200 uppercase hover:bg-[#0F766E] hover:text-white"
              >
                {topic.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* Hero */}
      <section className="bg-[#0F172A] px-4 py-16 text-white sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {hero.title || t.site.hero.headline}
            </h1>
            <p className="mt-4 text-lg text-slate-300">{hero.subtitle}</p>
            <p className="mt-2 text-lg font-bold text-[#FACC15]">{t.site.hero.badge}</p>

            <p className="mt-8 text-sm font-semibold text-slate-300">A free account unlocks:</p>
            <ul className="mt-3 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              {UNLOCKS.map((item) => (
                <li key={item} className="flex items-center gap-2 text-slate-100">
                  <Check className="size-4 shrink-0 text-[#2DD4BF]" /> {item}
                </li>
              ))}
            </ul>
            {!isLoggedIn && (
              <p className="mt-6 text-sm text-slate-400">
                Already a member?{" "}
                <Link href="/login" className="font-semibold text-[#2DD4BF] hover:underline">
                  Log in
                </Link>
              </p>
            )}
          </div>

          {/* Sign-up card */}
          <div className="rounded-[6px] border border-white/10 bg-[#1E293B] p-6 shadow-2xl sm:p-8">
            <div className="flex items-center gap-4">
              <span className="grid size-16 place-items-center rounded-full bg-white">
                <Image src={BRAND.mark} alt="" width={30} height={48} className="h-10 w-auto" />
              </span>
              <div>
                <p className="font-heading text-xl font-bold">{BRAND.name}</p>
                <p className="text-sm text-slate-400">{BRAND.tagline}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 text-center">
              {t.site.hero.stats.map((s) => (
                <div key={s.label} className="rounded-[4px] bg-white/5 px-2 py-3">
                  <p className="font-heading text-lg font-extrabold">{s.value}</p>
                  <p className="text-[11px] text-slate-400">{s.label}</p>
                </div>
              ))}
            </div>
            <Button
              asChild
              size="lg"
              className="mt-6 w-full bg-[#2DD4BF] font-bold text-[#0B1220] hover:bg-[#5EEAD4]"
            >
              <Link href={startHref}>
                {startText} <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="mt-3 w-full border-white/20 bg-transparent font-semibold text-white hover:bg-white/10 hover:text-white"
            >
              <Link href="/courses">{t.site.hero.secondaryCta}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Tracks */}
      <section className="px-4 py-16" id="tracks">
        <div className="mx-auto grid max-w-6xl gap-6">
          {(tracks ?? []).map((track) => (
            <div
              key={track.id}
              className="grid items-center gap-8 rounded-[6px] bg-gradient-to-br from-[#E0F2FE] to-[#CCFBF1] p-8 sm:p-10 md:grid-cols-[1fr_auto] dark:from-[#0C2A3A] dark:to-[#0D2E2B]"
            >
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-[#0F766E] uppercase dark:text-[#2DD4BF]">
                  Track · {t.site.tracks.courses(track._count.courses)}
                </p>
                <h2 className="font-heading mt-2 text-3xl font-extrabold tracking-tight text-[#0B1220] sm:text-4xl dark:text-white">
                  {track.title}
                </h2>
                <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-700 dark:text-slate-300">
                  {track.description}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild className="bg-[#0B1220] font-bold text-white hover:bg-[#1E293B] dark:bg-white dark:text-[#0B1220]">
                    <Link href={startHref}>Start this track</Link>
                  </Button>
                  <Button asChild variant="outline" className="border-[#0B1220]/20 bg-white/70 font-semibold text-[#0B1220] dark:border-white/20 dark:bg-transparent dark:text-white">
                    <Link href={`/courses?track=${track.slug}`}>View courses</Link>
                  </Button>
                </div>
              </div>
              <span className="mx-auto grid size-32 place-items-center rounded-[6px] bg-white text-[#0F766E] shadow-lg sm:size-40 dark:bg-[#0B1220] dark:text-[#2DD4BF]">
                <TrackIcon name={track.icon} className="size-16 sm:size-20" />
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* What do you want to learn? */}
      <section className="bg-surface px-4 py-20">
        <SectionTitle
          eyebrow="Learn by doing"
          title="What do you want to learn?"
          subtitle="Pick a language and see what a lesson looks like. Every lesson comes with examples you can run yourself."
        />
        <div className="mt-10">
          <LearnTabs startHref={startHref} />
        </div>
      </section>

      {/* Everything on LogicLab */}
      <section className="px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="font-heading text-foreground text-xl font-bold">Everything on LogicLab</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <Link
                key={f.title}
                href={featureHref(f.href)}
                className="group flex flex-col items-center rounded-[6px] border border-border bg-card p-6 text-center transition-colors hover:border-primary/60 hover:shadow-md"
              >
                <f.icon className={cn("size-9", f.tint)} />
                <span className="font-heading text-foreground mt-3 font-bold">{f.title}</span>
                <span className="text-muted-foreground mt-1 text-xs leading-relaxed">{f.body}</span>
              </Link>
            ))}
            <Link
              href="/courses"
              className="flex items-center gap-4 rounded-[6px] border border-dashed border-border p-6 hover:border-primary/60"
            >
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                <ArrowRight className="size-5" />
              </span>
              <span>
                <span className="font-heading text-foreground block font-bold">Browse all courses</span>
                <span className="text-muted-foreground text-xs">See every track and course</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* Save your progress */}
      {!isLoggedIn && (
        <section className="px-4 pb-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 rounded-[6px] bg-[#ECFDF5] p-8 sm:p-12 lg:grid-cols-[1.3fr_1fr] dark:bg-[#0D2E2B]">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[#0F766E] uppercase dark:text-[#2DD4BF]">
                Free account
              </p>
              <h2 className="font-heading mt-2 text-3xl font-extrabold tracking-tight text-[#0B1220] sm:text-4xl dark:text-white">
                Save your progress. Everywhere.
              </h2>
              <p className="mt-3 max-w-lg text-base text-slate-700 dark:text-slate-300">
                Create an account to keep your lessons, points and streaks, and pick up where you left off on any device.
              </p>
              <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
                {UNLOCKS.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[#0B1220] dark:text-slate-100">
                    <Check className="size-4 shrink-0 text-[#0F766E] dark:text-[#2DD4BF]" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[6px] bg-card p-8 text-center shadow-lg">
              <p className="font-heading text-foreground text-lg font-bold">Start in one click</p>
              <p className="text-muted-foreground mt-1 text-sm">{t.site.hero.badge}</p>
              <Button asChild size="lg" className="mt-6 w-full font-bold">
                <Link href="/signup">{t.site.hero.primaryCta}</Link>
              </Button>
              <p className="text-muted-foreground my-3 text-xs">or</p>
              <Button asChild size="lg" variant="outline" className="w-full font-semibold">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </div>
        </section>
      )}

      {/* Testimonials (Admin › Landing page) */}
      {testimonials.items.length > 0 && (
        <section className="bg-surface px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <SectionTitle title={t.site.testimonials.title} />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.items.map((item) => (
                <figure key={item.name + item.quote} className="rounded-[6px] border border-border bg-card p-6">
                  <Quote className="size-6 text-primary opacity-60" />
                  <blockquote className="mt-3 text-sm leading-relaxed text-foreground">&ldquo;{item.quote}&rdquo;</blockquote>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                        {item.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-xs">
                      <span className="font-heading block font-semibold text-foreground">{item.name}</span>
                      {item.role && <span className="text-muted-foreground">{item.role}</span>}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Pricing */}
      <section className="border-t border-border bg-surface px-4 py-20" id="pricing">
        <div className="mx-auto max-w-6xl">
          <SectionTitle eyebrow="Pricing" title={t.site.pricing.title} subtitle={t.site.pricing.subtitle} />
          {plans && plans.length > 0 && (
            <div className="mx-auto mt-12 grid justify-center gap-6 [grid-template-columns:repeat(auto-fit,minmax(0,20rem))]">
              {plans.slice(0, 3).map((plan, i) => (
                <PlanCard key={plan.id} plan={plan} highlight={i === Math.min(1, plans.length - 1)} />
              ))}
            </div>
          )}
          <div className="mt-10 text-center">
            <p className="text-muted-foreground text-sm">{t.site.pricing.trialNote}</p>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs font-semibold">
              <span className="rounded-[4px] bg-[#16A34A]/10 px-3 py-1 text-[#15803D] dark:text-[#4ADE80]">EasyPaisa</span>
              <span className="rounded-[4px] bg-[#DC2626]/10 px-3 py-1 text-[#B91C1C] dark:text-[#F87171]">JazzCash</span>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ (Admin › Landing page) */}
      {faq.items.length > 0 && (
        <section className="px-4 py-20" id="faq">
          <div className="mx-auto max-w-3xl">
            <SectionTitle eyebrow="FAQ" title={t.site.faq.title} subtitle={t.site.faq.subtitle} />
            <div className="mt-10 divide-y divide-border rounded-[6px] border border-border bg-card">
              {faq.items.map((item) => (
                <details key={item.question} className="group px-6 py-4">
                  <summary className="font-heading flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-foreground">
                    {item.question}
                    <span className="text-primary text-xl transition-transform duration-200 group-open:rotate-45">+</span>
                  </summary>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed whitespace-pre-line">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Final call to action */}
      <section className="bg-[#0F172A] px-4 py-16 text-center text-white">
        <h2 className="font-heading mx-auto max-w-3xl text-3xl font-extrabold tracking-tight sm:text-4xl">
          {t.site.cta.title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-slate-300">{t.site.cta.body}</p>
        <Button asChild size="lg" className="mt-8 bg-[#2DD4BF] px-10 font-bold text-[#0B1220] hover:bg-[#5EEAD4]">
          <Link href={startHref}>
            {isLoggedIn ? "Go to Dashboard" : t.common.nav.startTrial} <ArrowRight />
          </Link>
        </Button>
      </section>
    </>
  );
}

function SectionTitle({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="text-xs font-bold tracking-[0.18em] text-primary uppercase">{eyebrow}</p>}
      <h2 className="font-heading text-foreground mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="text-muted-foreground mt-3 text-base leading-relaxed">{subtitle}</p>}
    </div>
  );
}
