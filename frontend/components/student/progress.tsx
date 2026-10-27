/** Thin progress bar (0-100). */
export function Progress({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="bg-muted h-1.5 overflow-hidden rounded-full"
    >
      <div className="bg-primary h-full transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  );
}
