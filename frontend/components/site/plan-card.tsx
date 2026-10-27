import { Check, Sparkles } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { pkr } from "@/lib/format";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import type { PublicPlan } from "@/types/api";

export function PlanCard({ plan, highlight = false }: { plan: PublicPlan; highlight?: boolean }) {
  return (
    <Card
      className={cn(
        "card-hover relative flex flex-col rounded-xl border border-border bg-card p-0 transition-all shadow-sm",
        highlight && "border-primary ring-1 ring-primary/80 shadow-md",
      )}
    >
      {highlight && (
        <div className="absolute -top-3 right-5">
          <Badge className="bg-primary text-primary-foreground flex items-center gap-1 px-3 py-0.5 text-xs font-semibold shadow-sm border-transparent">
            <Sparkles className="size-3" /> Most popular
          </Badge>
        </div>
      )}

      <CardHeader className="p-6 pb-4">
        <CardTitle className="font-heading text-xl font-bold tracking-tight text-foreground">
          {plan.name}
        </CardTitle>
        {plan.description && (
          <CardDescription className="text-muted-foreground text-sm mt-1">
            {plan.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="flex-1 px-6 pb-6 pt-0">
        <div className="flex items-baseline gap-1">
          <span className="font-heading text-3xl font-extrabold tracking-tight text-foreground">
            {pkr(plan.pricePkr)}
          </span>
          <span className="text-muted-foreground text-sm font-medium">
            {t.site.pricing.perDays(plan.durationDays)}
          </span>
        </div>

        <div className="border-border my-5 border-t" />

        <ul className="space-y-2.5 text-sm">
          {(plan.allTracks ? [{ id: "all", title: t.site.pricing.allTracks }] : plan.tracks).map(
            (track) => (
              <li key={track.id} className="flex items-center gap-2.5 text-foreground">
                <span className="grid size-4 place-items-center rounded-full bg-primary/10 text-primary">
                  <Check className="size-3 stroke-[2.5]" />
                </span>
                <span className="text-sm font-medium">{track.title}</span>
              </li>
            ),
          )}
          <li className="flex items-center gap-2.5 text-muted-foreground text-xs">
            <span className="grid size-4 place-items-center rounded-full bg-success/10 text-success">
              <Check className="size-3 stroke-[2.5]" />
            </span>
            <span>7-day free trial included</span>
          </li>
          <li className="flex items-center gap-2.5 text-muted-foreground text-xs">
            <span className="grid size-4 place-items-center rounded-full bg-success/10 text-success">
              <Check className="size-3 stroke-[2.5]" />
            </span>
            <span>Mentor support & community access</span>
          </li>
        </ul>
      </CardContent>

      <CardFooter className="p-6 pt-0">
        <Button
          asChild
          className="w-full h-10 font-semibold"
          variant={highlight ? "default" : "secondary"}
        >
          <Link href="/signup">{t.site.pricing.choose}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
