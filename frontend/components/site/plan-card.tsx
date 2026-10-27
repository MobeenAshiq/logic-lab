import { Check } from "lucide-react";
import Link from "next/link";
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
    <Card className={cn("flex flex-col", highlight && "border-primary ring-primary ring-1")}>
      <CardHeader>
        <CardTitle>{plan.name}</CardTitle>
        {plan.description && <CardDescription>{plan.description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-3xl font-semibold tracking-tight">
          {pkr(plan.pricePkr)}
          <span className="text-muted-foreground ml-1 text-sm font-normal">
            {t.site.pricing.perDays(plan.durationDays)}
          </span>
        </p>
        <ul className="mt-5 space-y-2 text-sm">
          {(plan.allTracks ? [{ id: "all", title: t.site.pricing.allTracks }] : plan.tracks).map(
            (track) => (
              <li key={track.id} className="flex items-center gap-2">
                <Check className="text-primary size-4" />
                {track.title}
              </li>
            ),
          )}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild className="w-full" variant={highlight ? "default" : "outline"}>
          <Link href="/signup">{t.site.pricing.choose}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
