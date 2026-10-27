import { z } from 'zod';
import { isUploadKey } from '../storage/uploads';

/**
 * Tiptap / ProseMirror JSON document, as saved by the article editor.
 * Images must reference an R2 key from /admin/uploads (attrs.key), never an
 * external URL; the API signs the keys when the lesson is read.
 */
export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

const MAX_DOC_BYTES = 500_000;
const MAX_DEPTH = 30;

const nodeSchema: z.ZodType<TiptapNode> = z.lazy(() =>
  z.strictObject({
    type: z.string().min(1).max(50),
    attrs: z.record(z.string(), z.unknown()).optional(),
    content: z.array(nodeSchema).optional(),
    marks: z
      .array(
        z.strictObject({
          type: z.string().min(1).max(50),
          attrs: z.record(z.string(), z.unknown()).optional(),
        }),
      )
      .optional(),
    text: z.string().optional(),
  }),
);

function walk(
  node: TiptapNode,
  depth: number,
  visit: (n: TiptapNode, depth: number) => void,
) {
  visit(node, depth);
  node.content?.forEach((child) => walk(child, depth + 1, visit));
}

export const tiptapDocSchema = nodeSchema.superRefine((doc, ctx) => {
  if (doc.type !== 'doc') {
    ctx.addIssue({ code: 'custom', message: 'Root node must be "doc".' });
  }
  if (JSON.stringify(doc).length > MAX_DOC_BYTES) {
    ctx.addIssue({ code: 'custom', message: 'Article is too large.' });
  }
  walk(doc, 0, (node, depth) => {
    if (depth > MAX_DEPTH) {
      ctx.addIssue({
        code: 'custom',
        message: 'Article is nested too deeply.',
      });
    }
    if (node.type === 'image') {
      const key = node.attrs?.key;
      if (typeof key !== 'string' || !isUploadKey('lesson-image', key)) {
        ctx.addIssue({
          code: 'custom',
          message: 'Images must be uploaded through /admin/uploads.',
        });
      }
      if (node.attrs && 'src' in node.attrs) {
        ctx.addIssue({
          code: 'custom',
          message: 'Image nodes must use attrs.key, not attrs.src.',
        });
      }
    }
  });
});

/** All R2 image keys used in a document. */
export function collectImageKeys(doc: unknown): string[] {
  const parsed = nodeSchema.safeParse(doc);
  if (!parsed.success) return [];
  const keys: string[] = [];
  walk(parsed.data, 0, (node) => {
    if (node.type === 'image' && typeof node.attrs?.key === 'string') {
      keys.push(node.attrs.key);
    }
  });
  return keys;
}
