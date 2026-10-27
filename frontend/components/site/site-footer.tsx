import { MessageCircle } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { t } from "@/lib/i18n";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-4 sm:grid-cols-2">
        <div className="space-y-4 md:col-span-1">
          <Logo withTagline />
          <p className="text-muted-foreground text-xs leading-relaxed max-w-xs">
            Learn programming with real mentors in Pakistan. Logic Building, Web Development, and AI/ML.
          </p>
          <div className="pt-1">
            <Button
              variant="outline"
              size="sm"
              asChild
              className="border-emerald-600/30 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400 gap-1.5 h-8 text-xs font-semibold"
            >
              <a
                href="https://wa.me/923000000000"
                target="_blank"
                rel="noreferrer"
                aria-label="Contact us on WhatsApp"
              >
                <MessageCircle className="size-3.5 fill-current" />
                Chat on WhatsApp
              </a>
            </Button>
          </div>
        </div>

        <div>
          <h4 className="font-heading text-foreground text-xs font-bold uppercase tracking-wider mb-3">
            Learning
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/courses" className="text-muted-foreground hover:text-foreground transition-colors">
                {t.common.nav.courses}
              </Link>
            </li>
            <li>
              <Link href="/courses?track=logic-building" className="text-muted-foreground hover:text-foreground transition-colors">
                Logic Building
              </Link>
            </li>
            <li>
              <Link href="/courses?track=web-development" className="text-muted-foreground hover:text-foreground transition-colors">
                Web Development
              </Link>
            </li>
            <li>
              <Link href="/courses?track=ai-ml-data-science" className="text-muted-foreground hover:text-foreground transition-colors">
                AI/ML & Data Science
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading text-foreground text-xs font-bold uppercase tracking-wider mb-3">
            Platform
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                {t.common.nav.pricing}
              </Link>
            </li>
            <li>
              <Link href="/community" className="text-muted-foreground hover:text-foreground transition-colors">
                Community Q&A
              </Link>
            </li>
            <li>
              <Link href="/login" className="text-muted-foreground hover:text-foreground transition-colors">
                {t.common.nav.login}
              </Link>
            </li>
            <li>
              <Link href="/signup" className="text-muted-foreground hover:text-foreground transition-colors">
                {t.common.nav.startTrial}
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-heading text-foreground text-xs font-bold uppercase tracking-wider mb-3">
            Legal & Support
          </h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                7-Day Free Trial
              </Link>
            </li>
            <li>
              <span className="text-muted-foreground/60 text-xs cursor-default">
                EasyPaisa · JazzCash · Bank
              </span>
            </li>
            <li>
              <span className="text-muted-foreground/60 text-xs cursor-default">
                support@logiclab.pk
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} {BRAND.name}. All rights reserved.</span>
          <span className="font-medium text-foreground/80">{t.common.footer.madeIn}</span>
        </div>
      </div>
    </footer>
  );
}
