"use client";

import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";

export default function PublicError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-xl font-semibold">{t.common.errors.generic}</h1>
      <Button className="mt-6" onClick={reset}>
        {t.common.actions.retry}
      </Button>
    </div>
  );
}
