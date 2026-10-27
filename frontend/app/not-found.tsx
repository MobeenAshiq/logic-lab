import Link from "next/link";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4 text-center">
      <div>
        <p className="text-primary text-5xl font-semibold">404</p>
        <h1 className="mt-3 text-xl font-semibold">{t.common.errors.notFoundTitle}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.common.errors.notFoundBody}</p>
        <Button asChild className="mt-6">
          <Link href="/">{t.common.errors.goHome}</Link>
        </Button>
      </div>
    </div>
  );
}
