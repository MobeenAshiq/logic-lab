import { randomUUID } from 'node:crypto';
import { z } from 'zod';

const MB = 1024 * 1024;

/** What an upload is for decides where it is stored and what is allowed. */
export const UPLOAD_PURPOSES = {
  'lesson-image': {
    prefix: 'content/lesson-image',
    maxBytes: 5 * MB,
    types: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    },
  },
  'course-cover': {
    prefix: 'content/course-cover',
    maxBytes: 5 * MB,
    types: { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' },
  },
  /** Stored under videos/<lessonId>/. Uploaded in parts (multipart). */
  'lesson-video': {
    prefix: 'videos',
    maxBytes: 2000 * MB,
    types: { 'video/mp4': 'mp4', 'video/webm': 'webm' },
  },
  /** Downloadable lesson resources, stored under attachments/<lessonId>/. */
  'lesson-attachment': {
    prefix: 'attachments',
    maxBytes: 50 * MB,
    types: {
      'application/pdf': 'pdf',
      'application/zip': 'zip',
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'text/plain': 'txt',
      'text/csv': 'csv',
      'text/markdown': 'md',
      'application/json': 'json',
      'application/x-ipynb+json': 'ipynb',
      'text/x-python': 'py',
      'text/javascript': 'js',
      'text/html': 'html',
      'text/css': 'css',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        'pptx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        'xlsx',
    },
  },
  /** Images in community posts/answers, stored under community/<userId>/. */
  'community-image': {
    prefix: 'community',
    maxBytes: 5 * MB,
    types: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    },
  },
  /** Images sent in mentor chat, stored under chat/<userId>/. */
  'chat-image': {
    prefix: 'chat',
    maxBytes: 5 * MB,
    types: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp',
      'image/gif': 'gif',
    },
  },
  /** Stored under slips/<userId>/ so ownership is visible from the key. */
  'payment-slip': {
    prefix: 'slips',
    maxBytes: 5 * MB,
    types: {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'application/pdf': 'pdf',
    },
  },
} as const satisfies Record<
  string,
  { prefix: string; maxBytes: number; types: Record<string, string> }
>;

export type UploadPurpose = keyof typeof UPLOAD_PURPOSES;

const fileFields = {
  contentType: z.string().max(100),
  size: z.number().int().positive(),
};

function checkFile(
  purpose: UploadPurpose,
  v: { contentType: string; size: number },
  ctx: z.RefinementCtx,
) {
  const rule = UPLOAD_PURPOSES[purpose];
  if (!(v.contentType in rule.types)) {
    ctx.addIssue({
      code: 'custom',
      path: ['contentType'],
      message: `Allowed types: ${Object.keys(rule.types).join(', ')}`,
    });
  }
  if (v.size > rule.maxBytes) {
    ctx.addIssue({
      code: 'custom',
      path: ['size'],
      message: `Max size is ${rule.maxBytes / MB} MB`,
    });
  }
}

/** Admin CMS uploads. */
export const createUploadSchema = z
  .strictObject({
    purpose: z.enum(['lesson-image', 'course-cover']),
    ...fileFields,
  })
  .superRefine((v, ctx) => checkFile(v.purpose, v, ctx));

/** Lesson video (multipart) and lesson attachment uploads. */
export const videoUploadSchema = z
  .strictObject(fileFields)
  .superRefine((v, ctx) => checkFile('lesson-video', v, ctx));
export const attachmentUploadSchema = z
  .strictObject({ ...fileFields, filename: z.string().trim().min(1).max(200) })
  .superRefine((v, ctx) => checkFile('lesson-attachment', v, ctx));

/** Community image uploads. */
export const communityImageSchema = z
  .strictObject(fileFields)
  .superRefine((v, ctx) => checkFile('community-image', v, ctx));

/** Chat image uploads. */
export const chatImageSchema = z
  .strictObject(fileFields)
  .superRefine((v, ctx) => checkFile('chat-image', v, ctx));

/** Student payment slip uploads. */
export const slipUploadSchema = z
  .strictObject(fileFields)
  .superRefine((v, ctx) => checkFile('payment-slip', v, ctx));

export type CreateUploadInput = z.infer<typeof createUploadSchema>;
export type SlipUploadInput = z.infer<typeof slipUploadSchema>;
export type CommunityImageInput = z.infer<typeof communityImageSchema>;
export type ChatImageInput = z.infer<typeof chatImageSchema>;
export type VideoUploadInput = z.infer<typeof videoUploadSchema>;
export type AttachmentUploadInput = z.infer<typeof attachmentUploadSchema>;

export function newUploadKey(
  purpose: UploadPurpose,
  contentType: string,
  ownerId?: string,
) {
  const rule = UPLOAD_PURPOSES[purpose];
  const ext = (rule.types as Record<string, string>)[contentType];
  const dir = ownerId ? `${rule.prefix}/${ownerId}` : rule.prefix;
  return `${dir}/${randomUUID()}.${ext}`;
}

/** True if `key` looks like one this API issued for `purpose` (and owner). */
export function isUploadKey(
  purpose: UploadPurpose,
  key: string,
  ownerId?: string,
) {
  const { prefix, types } = UPLOAD_PURPOSES[purpose];
  const exts = Object.values(types).join('|');
  const dir = ownerId ? `${prefix}/${ownerId}` : prefix;
  return new RegExp(`^${dir}/[0-9a-f-]{36}\\.(${exts})$`).test(key);
}
