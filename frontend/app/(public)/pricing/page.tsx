import type { Metadata } from "next";
import { PlanCard } from "@/components/site/plan-card";
import { serverApi } from "@/lib/api/server";
import { t } from "@/lib/i18n";
import type { PublicPlan } from "@/types/api";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: t.common.nav.pricing };

export default async function PricingPage() {
  const plans = (await serverApi<PublicPlan[]>("/plans")) ?? [];
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{t.site.pricing.title}</h1>
        <p className="text-muted-foreground mt-3">{t.site.pricing.subtitle}</p>
      </div>
      {plans.length > 0 ? (
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan, i) => (
            <PlanCard key={plan.id} plan={plan} highlight={i === Math.min(1, plans.length - 1)} />
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground mt-12 text-center">{t.site.pricing.empty}</p>
      )}
      <div className="text-muted-foreground mt-10 space-y-1 text-center text-sm">
        <p>{t.site.pricing.trialNote}</p>
        <p>{t.site.pricing.methods}</p>
      </div>
    </div>
  );
}
