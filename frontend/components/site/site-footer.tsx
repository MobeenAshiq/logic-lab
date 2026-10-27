import Link from "next/link";
import { Logo } from "@/components/logo";
import { t } from "@/lib/i18n";

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2">
        <div>
          <Logo withTagline />
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:justify-end">
          <Link href="/courses" className="text-muted-foreground hover:text-foreground">
            {t.common.nav.courses}
          </Link>
          <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
            {t.common.nav.pricing}
          </Link>
          <Link href="/login" className="text-muted-foreground hover:text-foreground">
            {t.common.nav.login}
          </Link>
        </nav>
      </div>
      <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-1 border-t px-4 py-4 text-xs sm:flex-row sm:justify-between">
        <span>{t.common.footer.rights(new Date().getFullYear())}</span>
        <span>{t.common.footer.madeIn}</span>
      </div>
    </footer>
  );
}
