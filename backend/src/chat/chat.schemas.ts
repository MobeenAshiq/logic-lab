import { z } from 'zod';

const body = z.string().trim().min(1).max(5_000);
const attachmentKey = z.string().max(200).nullable().optional();

export const openDoubtSchema = z.strictObject({
  courseId: z.uuid(),
  subject: z.string().trim().min(3).max(120),
  body,
  attachmentKey,
});

export const sendMessageSchema = z
  .strictObject({
    body: z.string().trim().max(5_000).default(''),
    attachmentKey,
  })
  .refine((v) => v.body.length > 0 || Boolean(v.attachmentKey), {
    path: ['body'],
    message: 'Write a message or attach an image.',
  });

export const listConversationsSchema = z.object({
  status: z.enum(['active', 'closed']).default('active'),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Use HH:MM');

export const officeHoursSchema = z.strictObject({
  slots: z
    .array(
      z
        .strictObject({
          weekday: z.number().int().min(0).max(6),
          start: hhmm,
          end: hhmm,
        })
        .refine((s) => s.start < s.end, {
          path: ['end'],
          message: 'End must be after start.',
        }),
    )
    .max(28),
});

export type OpenDoubtInput = z.infer<typeof openDoubtSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ListConversationsInput = z.infer<typeof listConversationsSchema>;
export type OfficeHoursInput = z.infer<typeof officeHoursSchema>;
