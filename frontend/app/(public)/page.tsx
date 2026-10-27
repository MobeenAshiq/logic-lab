import { ArrowRight, CheckCircle2, Quote } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { PlanCard } from "@/components/site/plan-card";
import { TrackCard } from "@/components/site/track-card";
import { Button } from "@/components/ui/button";
import { serverApi } from "@/lib/api/server";
import { BRAND, STOCK } from "@/lib/brand";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PublicPlan, PublicTrack, SiteContent } from "@/types/api";

// Always fresh: hero/FAQ edits in the CMS show up on the next page load.
export const dynamic = "force-dynamic";

const bannerTone = {
  info: "bg-primary/10 text-primary",
  promo: "bg-primary text-primary-foreground",
  warning: "bg-warning/15 text-warning",
} as const;

export default async function LandingPage() {
  const [content, tracks, plans] = await Promise.all([
    serverApi<SiteContent>("/site-content"),
    serverApi<PublicTrack[]>("/tracks"),
    serverApi<PublicPlan[]>("/plans"),
  ]);
  if (!content) throw new Error("Site content unavailable");
  const { hero, faq, testimonials, banners } = content;

  return (
    <>
      {banners.items.map((b) => (
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

      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_60%_at_20%_0%,color-mix(in_oklch,var(--brand-blue)_14%,transparent),transparent),radial-gradient(50%_50%_at_90%_20%,color-mix(in_oklch,var(--brand-purple)_12%,transparent),transparent)]" />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span className="bg-background text-muted-foreground inline-flex rounded-full border px-3 py-1 text-xs font-medium">
              {t.site.hero.badge}
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
              {hero.title}
            </h1>
            {hero.subtitle && (
              <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg text-pretty lg:mx-0">
                {hero.subtitle}
              </p>
            )}
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <Button size="lg" asChild className="h-11 px-6">
                <Link href={hero.ctaHref}>
                  {hero.ctaText} <ArrowRight />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-11 px-6">
                <Link href="/courses">{t.site.hero.secondaryCta}</Link>
              </Button>
            </div>
            <dl className="mx-auto mt-10 grid max-w-sm grid-cols-3 gap-4 lg:mx-0">
              {t.site.hero.stats.map((stat) => (
                <div key={stat.label}>
                  <dt className="text-muted-foreground text-xs">{stat.label}</dt>
                  <dd className="text-xl font-semibold">{stat.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative mx-auto w-full max-w-xl">
            <div className="relative aspect-[3/2] overflow-hidden rounded-2xl border shadow-xl">
              <Image
                src={STOCK.students}
                alt={t.site.hero.imageAlt}
                fill
                priority
                sizes="(min-width: 1024px) 560px, 100vw"
                className="object-cover"
              />
            </div>
            <div className="bg-background absolute -bottom-6 -left-4 flex items-center gap-3 rounded-xl border p-3 shadow-lg sm:-left-8">
              <Image src={BRAND.mark} alt="" width={28} height={45} className="h-10 w-auto" />
              <div className="leading-tight">
                <p className="text-sm font-semibold">{t.common.appName}</p>
                <p className="text-muted-foreground text-xs">{t.common.tagline}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionTitle title={t.site.tracks.title} subtitle={t.site.tracks.subtitle} />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {(tracks ?? []).map((track) => (
            <TrackCard key={track.id} track={track} />
          ))}
        </div>
      </section>

      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-6xl px-4 py-20">
          <SectionTitle title={t.site.how.title} />
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {t.site.how.steps.map((step, i) => (
              <li key={step.title} className="bg-background rounded-xl border p-6">
                <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-full text-sm font-semibold">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 lg:grid-cols-2">
        <div className="relative aspect-[3/2] overflow-hidden rounded-2xl border">
          <Image
            src={STOCK.mentoring}
            alt={t.site.mentors.imageAlt}
            fill
            sizes="(min-width: 1024px) 560px, 100vw"
            className="object-cover"
          />
        </div>
        <div>
          <h2 className="text-3xl font-semibold tracking-tight">{t.site.mentors.title}</h2>
          <p className="text-muted-foreground mt-3">{t.site.mentors.body}</p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {t.site.mentors.points.map((point) => (
              <li key={point} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="text-brand-green mt-0.5 size-4 shrink-0" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20">
        <SectionTitle title={t.site.pricing.title} subtitle={t.site.pricing.subtitle} />
        {plans && plans.length > 0 ? (
          <div className="mx-auto mt-10 grid max-w-4xl gap-4 md:grid-cols-3">
            {plans.slice(0, 3).map((plan, i) => (
              <PlanCard key={plan.id} plan={plan} highlight={i === Math.min(1, plans.length - 1)} />
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mt-8 text-center">{t.site.pricing.empty}</p>
        )}
        <p className="text-muted-foreground mt-6 text-center text-sm">
          {t.site.pricing.trialNote}{" "}
          <Link href="/pricing" className="text-primary font-medium hover:underline">
            {t.site.pricing.seeAll}
          </Link>
        </p>
      </section>

      {testimonials.items.length > 0 && (
        <section className="bg-muted/30 border-y">
          <div className="mx-auto max-w-6xl px-4 py-20">
            <SectionTitle title={t.site.testimonials.title} />
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {testimonials.items.map((item) => (
                <figure
                  key={item.name + item.quote}
                  className="bg-background rounded-xl border p-6"
                >
                  <Quote className="text-primary size-5" />
                  <blockquote className="mt-3 text-sm">{item.quote}</blockquote>
                  <figcaption className="mt-4 text-sm">
                    <span className="font-medium">{item.name}</span>
                    {item.role && <span className="text-muted-foreground"> · {item.role}</span>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {faq.items.length > 0 && (
        <section className="mx-auto max-w-3xl px-4 py-20">
          <SectionTitle title={t.site.faq.title} />
          <div className="mt-8 divide-y rounded-xl border">
            {faq.items.map((item) => (
              <details key={item.question} className="group px-5 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium">
                  {item.question}
                  <span className="text-muted-foreground transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground mt-2 text-sm whitespace-pre-line">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="px-4 pb-20">
        <div className="bg-primary text-primary-foreground mx-auto max-w-4xl rounded-2xl px-6 py-12 text-center">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t.site.cta.title}</h2>
          <p className="mt-2 opacity-90">{t.site.cta.body}</p>
          <Button size="lg" variant="secondary" asChild className="mt-6 h-11 px-6">
            <Link href="/signup">{t.common.nav.startTrial}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-semibold tracking-tight">{title}</h2>
      {subtitle && <p className="text-muted-foreground mt-3">{subtitle}</p>}
    </div>
  );
}
