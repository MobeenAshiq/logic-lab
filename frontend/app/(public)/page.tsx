import {
  ArrowRight,
  Award,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Code2,
  Flame,
  HelpCircle,
  MessageSquare,
  PlayCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  Video,
} from "lucide-react";
import { cookies } from "next/headers";
import Image from "next/image";
import Link from "next/link";
import { PlanCard } from "@/components/site/plan-card";
import { TrackCard } from "@/components/site/track-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { serverApi } from "@/lib/api/server";
import { BRAND, STOCK, TRACK_THEMES } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PublicPlan, PublicTrack, SiteContent } from "@/types/api";

export const dynamic = "force-dynamic";

const bannerTone = {
  info: "bg-primary/10 text-primary",
  promo: "bg-primary text-primary-foreground",
  warning: "bg-warning/15 text-warning",
} as const;

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

  return (
    <>
      {/* 1. Announcement Banners */}
      {banners.items
        ?.filter((b) => b.active)
        .map((b) => (
          <div
            key={b.id}
            className={cn("px-4 py-2 text-center text-sm font-medium", bannerTone[b.variant])}
          >
            {b.href ? (
              <Link href={b.href} className="underline-offset-4 hover:underline">
                {b.text}
              </Link>
            ) : (
              b.text
            )}
          </div>
        ))}

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden border-b border-border bg-gradient-to-b from-surface/50 to-background py-16 sm:py-24">
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_25%_10%,color-mix(in_srgb,var(--primary)_12%,transparent),transparent),radial-gradient(40%_40%_at_85%_25%,color-mix(in_srgb,var(--accent)_10%,transparent),transparent)]" />

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 lg:grid-cols-12">
          {/* Left Hero Content */}
          <div className="text-center lg:col-span-7 lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary dark:bg-primary/20">
              <Sparkles className="size-3.5" />
              {t.site.hero.badge}
            </span>

            <h1 className="font-heading text-foreground mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-[56px] lg:leading-[1.12]">
              {hero.title || t.site.hero.headline}
            </h1>

            <p className="text-muted-foreground mt-5 max-w-xl text-base leading-relaxed sm:text-lg lg:mx-0">
              {hero.subtitle}
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button size="lg" asChild className="h-11 px-6 font-semibold shadow-md">
                <Link href={isLoggedIn ? "/student" : (hero.ctaHref || "/signup")}>
                  {isLoggedIn ? "Go to Dashboard" : (hero.ctaText || t.site.hero.primaryCta)}{" "}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button size="lg" variant="secondary" asChild className="h-11 px-6 font-semibold">
                <Link href="/courses">{t.site.hero.secondaryCta}</Link>
              </Button>
            </div>

            {/* Quick Hero Stat Tickers */}
            <dl className="border-border/60 mx-auto mt-10 grid max-w-md grid-cols-3 gap-4 border-t pt-6 text-left lg:mx-0">
              {t.site.hero.stats.map((stat) => (
                <div key={stat.label}>
                  <dd className="font-heading text-foreground text-2xl font-bold tracking-tight">
                    {stat.value}
                  </dd>
                  <dt className="text-muted-foreground text-xs font-medium">{stat.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Right Hero Visual: Interactive Student Dashboard Mockup Preview */}
          <div className="relative mx-auto w-full max-w-md lg:col-span-5 lg:max-w-none">
            <Link
              href={isLoggedIn ? "/student" : "/courses"}
              className="group block"
            >
              <div className="card-hover border-border bg-card relative overflow-hidden rounded-2xl border p-5 shadow-xl transition-all group-hover:border-primary/50">
                {/* Top window bar */}
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-danger/80" />
                    <span className="size-2.5 rounded-full bg-warning/80" />
                    <span className="size-2.5 rounded-full bg-success/80" />
                    <span className="text-muted-foreground ml-2 text-xs font-mono font-medium">
                      logiclab.pk/student
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {isLoggedIn ? "Your Dashboard" : "Dashboard Preview"}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent">
                      <Flame className="size-3 fill-current" /> 3-day streak
                    </span>
                  </div>
                </div>

                {/* Greeting */}
                <div className="mt-4 flex items-center justify-between">
                  <div>
                    <h4 className="font-heading text-base font-bold text-foreground">
                      {isLoggedIn ? "Welcome back, Student! 👋" : "Great job, Ali! 👋"}
                    </h4>
                    <p className="text-muted-foreground text-xs">
                      {isLoggedIn ? "Ready to continue your lessons?" : "Ready for today's challenge?"}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                    <Trophy className="size-3.5" /> 450 pts
                  </span>
                </div>

                {/* Active Course Progress Card */}
                <div className="bg-surface border-border mt-4 rounded-xl border p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-[#7C3AED]/10 px-2 py-0.5 text-[11px] font-semibold text-[#7C3AED]">
                      Logic Building
                    </span>
                    <span className="text-muted-foreground text-xs font-medium">Lesson 4 of 12</span>
                  </div>
                  <h5 className="font-heading text-foreground mt-2 text-sm font-bold">
                    Problem Solving & Flowcharts
                  </h5>
                  <div className="mt-3 flex items-center justify-between text-xs font-semibold">
                    <span className="text-muted-foreground font-normal">Progress</span>
                    <span className="text-primary font-bold">65%</span>
                  </div>
                  <div className="bg-muted mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                    <div className="bg-primary h-full w-[65%] rounded-full" />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px]">Mentor: Bilal Ahmed</span>
                    <span className="text-primary text-xs font-semibold hover:underline flex items-center gap-1">
                      {isLoggedIn ? "Go to Course" : "Resume"} <ArrowRight className="size-3" />
                    </span>
                  </div>
                </div>

                {/* Live Class Reminder */}
                <div className="border-border/80 bg-primary/5 mt-3 flex items-center justify-between rounded-xl border p-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
                      <Video className="size-4" />
                    </span>
                    <div>
                      <p className="font-heading text-foreground text-xs font-bold">
                        Live Q&A Office Hours
                      </p>
                      <p className="text-muted-foreground text-[11px]">Today at 7:00 PM PKT</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="border-primary/30 text-primary text-[10px]">
                    Upcoming
                  </Badge>
                </div>

                {/* Verified Feedback Badge */}
                <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-xs text-muted-foreground border border-border/50">
                  <ShieldCheck className="size-4 text-success shrink-0" />
                  <span className="truncate">
                    Assignment graded by Mentor Hamza · <strong>95/100</strong>
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* 3. Trust Bar */}
      <section className="border-b border-border bg-surface py-5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-around gap-6 px-4 text-center">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users className="size-4 text-primary" />
            <span>{t.site.trustBar.students}</span>
          </div>
          <span className="text-border hidden sm:inline">|</span>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <PlayCircle className="size-4 text-primary" />
            <span>{t.site.trustBar.lessons}</span>
          </div>
          <span className="text-border hidden sm:inline">|</span>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Award className="size-4 text-primary" />
            <span>{t.site.trustBar.mentors}</span>
          </div>
          <span className="text-border hidden sm:inline">|</span>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="size-4 text-accent" />
            <span>{t.site.trustBar.rating}</span>
          </div>
        </div>
      </section>

      {/* 4. Three Tracks Section */}
      <section className="mx-auto max-w-6xl px-4 py-20" id="tracks">
        <SectionTitle title={t.site.tracks.title} subtitle={t.site.tracks.subtitle} />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {(tracks ?? []).map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      </section>

      {/* 5. How It Works (4 Steps) */}
      <section className="border-y border-border bg-surface/40 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle title={t.site.how.title} subtitle={t.site.how.subtitle} />
          <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {t.site.how.steps.map((step, i) => (
              <li
                key={step.title}
                className="card-hover border-border bg-card relative flex flex-col rounded-xl border p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="bg-primary text-primary-foreground font-heading grid size-9 place-items-center rounded-lg text-sm font-bold shadow-sm">
                    0{i + 1}
                  </span>
                  <span className="text-border font-mono text-xs font-semibold">STEP</span>
                </div>
                <h3 className="font-heading text-foreground mt-5 text-lg font-bold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 6. Features Grid */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionTitle title={t.site.features.title} subtitle={t.site.features.subtitle} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.site.features.items.map((feat) => {
            const icons = {
              video: Video,
              play: PlayCircle,
              check: CheckCircle2,
              message: MessageSquare,
              sparkles: Bot,
              users: Users,
            };
            const Icon = icons[feat.icon as keyof typeof icons] || Code2;
            return (
              <div
                key={feat.title}
                className="card-hover border-border bg-card flex flex-col rounded-xl border p-6 shadow-sm"
              >
                <div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary dark:bg-primary/20">
                  <Icon className="size-5" />
                </div>
                <h3 className="font-heading text-foreground mt-4 text-lg font-bold">
                  {feat.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 7. Leaderboard & Rewards Preview */}
      <section className="border-y border-border bg-surface/50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <SectionTitle
            title={t.site.leaderboard.title}
            subtitle={t.site.leaderboard.subtitle}
          />
          <div className="mt-12 grid gap-8 lg:grid-cols-12 items-center">
            {/* Left explanation */}
            <div className="lg:col-span-5 space-y-4">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent">
                <Trophy className="size-3.5 fill-current" /> Monthly Season Awards
              </span>
              <h3 className="font-heading text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Compete, learn consistently, and earn cash rewards
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {t.site.leaderboard.monthlyPrizes}
              </p>
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="size-4 text-success" />
                  <span>Points earned from lessons, assignments, and speed</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="size-4 text-success" />
                  <span>Maintained streaks multiply your season ranking score</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle2 className="size-4 text-success" />
                  <span>Fair play verified with typing integrity detection</span>
                </div>
              </div>
            </div>

            {/* Right: Podium cards */}
            <div className="lg:col-span-7 grid gap-4 sm:grid-cols-3">
              {[
                {
                  rank: "1st",
                  name: "Zainab Fatima",
                  track: "Logic Building",
                  points: "1,840 pts",
                  streak: "18 days",
                  medal: "🥇",
                  reward: "PKR 25,000",
                },
                {
                  rank: "2nd",
                  name: "Muhammad Usman",
                  track: "Web Development",
                  points: "1,620 pts",
                  streak: "14 days",
                  medal: "🥈",
                  reward: "PKR 15,000",
                },
                {
                  rank: "3rd",
                  name: "Saad Sheikh",
                  track: "AI & Data Science",
                  points: "1,490 pts",
                  streak: "12 days",
                  medal: "🥉",
                  reward: "PKR 10,000",
                },
              ].map((winner) => (
                <div
                  key={winner.rank}
                  className="card-hover border-border bg-card relative flex flex-col items-center rounded-xl border p-5 text-center shadow-sm"
                >
                  <span className="text-3xl">{winner.medal}</span>
                  <span className="font-heading text-foreground mt-2 text-base font-bold">
                    {winner.name}
                  </span>
                  <span className="text-muted-foreground text-xs">{winner.track}</span>
                  <div className="bg-surface border-border my-3 w-full rounded-lg border p-2 text-xs">
                    <p className="font-heading font-bold text-primary">{winner.points}</p>
                    <p className="text-muted-foreground text-[11px]">🔥 {winner.streak}</p>
                  </div>
                  <span className="font-heading text-accent text-xs font-bold">
                    Prize: {winner.reward}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 8. Mentors Section */}
      <section className="mx-auto max-w-6xl px-4 py-20" id="mentors">
        <SectionTitle title={t.site.mentors.title} subtitle={t.site.mentors.subtitle} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.site.mentors.featured.map((m) => (
            <div
              key={m.name}
              className="card-hover border-border bg-card flex flex-col rounded-xl border p-6 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <Avatar className="size-12 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary font-heading text-sm font-bold">
                    {m.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="font-heading text-foreground text-base font-bold">{m.name}</h4>
                  <p className="text-muted-foreground text-xs">{m.role}</p>
                </div>
              </div>
              <p className="text-muted-foreground mt-4 text-xs leading-relaxed">
                Expertise: <strong className="text-foreground">{m.expertise}</strong>
              </p>
              <div className="border-border mt-5 flex items-center justify-between border-t pt-3 text-xs">
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                  {m.track}
                </span>
                <span className="font-semibold text-accent flex items-center gap-1">
                  ★ {m.rating}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Testimonials Section */}
      {testimonials.items.length > 0 && (
        <section className="border-y border-border bg-surface/30 py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionTitle title={t.site.testimonials.title} />
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {testimonials.items.map((item) => (
                <figure
                  key={item.name + item.quote}
                  className="card-hover border-border bg-card rounded-xl border p-6 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <Quote className="text-primary size-6 opacity-60" />
                    <blockquote className="mt-3 text-sm leading-relaxed text-foreground">
                      &ldquo;{item.quote}&rdquo;
                    </blockquote>
                  </div>
                  <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                    <Avatar className="size-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                        {item.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-xs">
                      <span className="font-heading font-semibold text-foreground block">
                        {item.name}
                      </span>
                      {item.role && <span className="text-muted-foreground">{item.role}</span>}
                    </div>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 10. Pricing Preview Section */}
      <section className="mx-auto max-w-6xl px-4 py-20" id="pricing">
        <SectionTitle title={t.site.pricing.title} subtitle={t.site.pricing.subtitle} />

        {plans && plans.length > 0 ? (
          <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
            {plans.slice(0, 3).map((plan, i) => (
              <PlanCard key={plan.id} plan={plan} highlight={i === Math.min(1, plans.length - 1)} />
            ))}
          </div>
        ) : (
          <div className="mx-auto mt-10 max-w-md rounded-xl border border-dashed border-border p-8 text-center bg-surface/50">
            <Sparkles className="mx-auto size-8 text-primary" />
            <h4 className="font-heading mt-3 text-base font-bold text-foreground">
              Season Enrollment Opening Soon
            </h4>
            <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
              {t.site.pricing.empty}
            </p>
            <Button asChild className="mt-5 font-semibold">
              <Link href={isLoggedIn ? "/student" : "/signup"}>
                {isLoggedIn ? "Go to Dashboard" : "Start 7-Day Free Trial"}
              </Link>
            </Button>
          </div>
        )}

        {/* Payment logos and notes */}
        <div className="mt-10 text-center">
          <p className="text-muted-foreground text-sm">{t.site.pricing.trialNote}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="rounded-md border border-border bg-surface px-2.5 py-1">EasyPaisa</span>
            <span className="rounded-md border border-border bg-surface px-2.5 py-1">JazzCash</span>
            <span className="rounded-md border border-border bg-surface px-2.5 py-1">
              Direct Bank Transfer
            </span>
          </div>
        </div>
      </section>

      {/* 11. FAQ Accordion */}
      {faq.items.length > 0 && (
        <section className="border-t border-border bg-surface/40 py-20" id="faq">
          <div className="mx-auto max-w-3xl px-4">
            <SectionTitle title={t.site.faq.title} subtitle={t.site.faq.subtitle} />
            <div className="mt-10 divide-y divide-border rounded-xl border border-border bg-card shadow-sm">
              {faq.items.map((item) => (
                <details key={item.question} className="group px-6 py-4.5">
                  <summary className="font-heading flex cursor-pointer list-none items-center justify-between gap-4 text-base font-semibold text-foreground">
                    {item.question}
                    <span className="text-muted-foreground font-mono text-lg transition-transform duration-200 group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="text-muted-foreground mt-3 text-sm leading-relaxed whitespace-pre-line">
                    {item.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 12. Final Call to Action */}
      <section className="px-4 py-20">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 px-6 py-14 text-center text-primary-foreground shadow-xl">
          <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.15),transparent)]" />
          <h2 className="font-heading text-3xl font-extrabold tracking-tight sm:text-4xl">
            {t.site.cta.title}
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-base opacity-90 leading-relaxed">
            {t.site.cta.body}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              variant="secondary"
              asChild
              className="h-11 px-7 font-bold text-foreground shadow-sm"
            >
              <Link href={isLoggedIn ? "/student" : "/signup"}>
                {isLoggedIn ? "Go to Dashboard" : t.common.nav.startTrial}
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-primary-foreground/30 text-primary-foreground hover:bg-white/10 h-11 px-6 font-semibold"
            >
              <Link href="/courses">Browse courses</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="font-heading text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="text-muted-foreground mt-3 text-base leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}
