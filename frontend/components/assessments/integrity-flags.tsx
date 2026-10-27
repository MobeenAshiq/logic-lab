import { AlertTriangle, ShieldCheck } from "lucide-react";
import { t } from "@/lib/i18n";
import type { IntegrityFlags } from "@/types/api";

const tf = t.assessments.flags;

/** Integrity hints for a written answer (and quiz tab switches). Shown to mentors only. */
export function IntegrityFlagsList({
  flags,
  tabSwitches,
}: {
  flags: Partial<IntegrityFlags> | null | undefined;
  tabSwitches?: number | null;
}) {
  const items: string[] = [];
  if (flags?.burst) items.push(tf.burst(flags.burstMaxChars ?? 0));
  if (flags?.fastTyping) items.push(tf.fastTyping(flags.fastestCharsPer10s ?? 0));
  if (flags?.pasteAttempts) items.push(tf.paste(flags.pasteAttempts));
  if (flags?.contentMismatch) items.push(tf.mismatch);
  if (tabSwitches) items.push(tf.tabSwitches(tabSwitches));

  return (
    <div className="space-y-2 text-sm">
      {items.length === 0 ? (
        <p className="text-success flex items-center gap-2">
          <ShieldCheck className="size-4" /> {tf.clean}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li key={item} className="text-warning flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {item}
            </li>
          ))}
        </ul>
      )}
      {flags && typeof flags.typedChars === "number" && (
        <p className="text-muted-foreground text-xs">
          {tf.stats(flags.typedChars, flags.eventCount ?? 0)}
        </p>
      )}
      {items.length > 0 && <p className="text-muted-foreground text-xs">{tf.note}</p>}
    </div>
  );
}
