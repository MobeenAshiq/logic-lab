/** Plain text of a Tiptap lesson document. */
export function lessonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown };
  return `${typeof node.text === 'string' ? node.text : ''} ${Array.isArray(node.content) ? node.content.map(lessonText).join(' ') : ''}`.trim();
}

export function tokenSet(text: string) {
  return new Set(text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}

/** Jaccard word overlap, 0..1. */
export function similarity(a: string, b: string) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let overlap = 0;
  for (const token of left) if (right.has(token)) overlap++;
  return overlap / (left.size + right.size - overlap);
}

/** Share of the query's words that appear in the document, 0..1 (for retrieval). */
export function coverage(query: string, doc: Set<string>) {
  const words = tokenSet(query);
  if (words.size === 0) return 0;
  let hits = 0;
  for (const word of words) if (doc.has(word)) hits++;
  return hits / words.size;
}
