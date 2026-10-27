import Image from "@tiptap/extension-image";
import StarterKit from "@tiptap/starter-kit";
import type { TiptapNode } from "@/types/api";

/**
 * Article images are stored by R2 key (attrs.key), never by URL: signed URLs
 * expire after 10 minutes. `src` exists only while a document is on screen.
 */
export const KeyedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      key: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-key"),
        renderHTML: (attrs: { key?: string | null }) =>
          attrs.key ? { "data-key": attrs.key } : {},
      },
    };
  },
});

export const lessonExtensions = [
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    link: { openOnClick: false, autolink: true, protocols: ["https", "mailto"] },
  }),
  KeyedImage,
];

function mapNodes(node: TiptapNode, fn: (n: TiptapNode) => TiptapNode | null): TiptapNode | null {
  const mapped = fn({ ...node, attrs: node.attrs ? { ...node.attrs } : undefined });
  if (!mapped) return null;
  if (mapped.content) {
    mapped.content = mapped.content
      .map((c) => mapNodes(c, fn))
      .filter((c): c is TiptapNode => c !== null);
  }
  return mapped;
}

/** Stored doc → doc for display/editing: fills image src from the signed URLs. */
export function toDisplayDoc(doc: TiptapNode | null, assetUrls: Record<string, string>) {
  if (!doc) return null;
  return mapNodes(doc, (n) => {
    if (n.type === "image" && typeof n.attrs?.key === "string") {
      n.attrs.src = assetUrls[n.attrs.key] ?? "";
    }
    return n;
  });
}

/** Editor doc → doc to save: drops src, and drops images that were not uploaded (no key). */
export function toStorageDoc(doc: TiptapNode): TiptapNode {
  return (
    mapNodes(doc, (n) => {
      if (n.type !== "image") return n;
      if (typeof n.attrs?.key !== "string") return null;
      const { src: _src, ...rest } = n.attrs;
      void _src;
      return { ...n, attrs: rest };
    }) ?? { type: "doc", content: [] }
  );
}
