import Image from "next/image";
import { BRAND } from "@/lib/brand";
import { t } from "@/lib/i18n";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-muted/30 flex min-h-[calc(100dvh-3.5rem)] items-start justify-center px-4 py-12 sm:items-center">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src={BRAND.mark} alt="" width={40} height={64} className="h-14 w-auto" priority />
          <p className="text-muted-foreground mt-2 text-xs">{t.common.tagline}</p>
        </div>
        {children}
      </div>
    </div>
  );
}
