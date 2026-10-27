import { isUploadKey } from '../storage/uploads';

/** Images in community Markdown are written as ![alt](r2:<key>) and signed on read. */
const R2_REF = /r2:([A-Za-z0-9/._-]+)/g;

export function imageKeys(...texts: (string | null | undefined)[]): string[] {
  const keys = new Set<string>();
  for (const text of texts) {
    for (const m of (text ?? '').matchAll(R2_REF)) keys.add(m[1]);
  }
  return [...keys];
}

/** True if every image reference is an upload by `userId`. */
export function ownImagesOnly(
  userId: string,
  ...texts: (string | null | undefined)[]
) {
  return imageKeys(...texts).every((k) =>
    isUploadKey('community-image', k, userId),
  );
}

/** Plain-text preview for feed cards. */
export function excerpt(markdown: string, length = 220) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}
