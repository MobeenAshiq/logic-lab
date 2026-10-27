export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'item'
  );
}

/** Returns `base`, or `base-2`, `base-3`, ... the first one `taken` says is free. */
export async function uniqueSlug(
  base: string,
  taken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const root = slugify(base);
  for (let n = 1; ; n++) {
    const candidate = n === 1 ? root : `${root}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
}
