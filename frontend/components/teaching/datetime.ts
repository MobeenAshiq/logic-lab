/** ISO string → value for <input type="datetime-local"> (local time), or "". */
export function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value → ISO string, or null when empty. */
export function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : null;
}
