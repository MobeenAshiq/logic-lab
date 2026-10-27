import { z } from "zod";
import { t } from "@/lib/i18n";

// Mirrors backend/src/content/content.schemas.ts and site-content.ts.

export const LEVELS = ["beginner", "intermediate", "advanced"] as const;
export const LESSON_TYPES = ["video", "article", "quiz", "assignment"] as const;

const title = z.string().trim().min(2).max(150);

export const slugField = z
  .string()
  .trim()
  .max(80)
  .refine(
    (v) => v === "" || /^[a-z0-9]+(-[a-z0-9]+)*$/.test(v),
    t.adminContent.validation.slugFormat,
  )
  .refine((v) => v === "" || v.length >= 2, "At least 2 characters.");

export const trackFormSchema = z.object({
  title,
  slug: slugField,
  description: z.string().trim().max(1000),
  icon: z.string().trim().max(50),
});
export type TrackForm = z.infer<typeof trackFormSchema>;

export const newCourseSchema = z.object({
  title,
  level: z.enum(LEVELS),
  shortDescription: z.string().trim().max(300),
});
export type NewCourseForm = z.infer<typeof newCourseSchema>;

export const courseFormSchema = z.object({
  title,
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, t.adminContent.validation.slugFormat),
  trackId: z.uuid(),
  level: z.enum(LEVELS),
  shortDescription: z.string().trim().max(300),
  description: z.string().trim().max(10_000),
});
export type CourseForm = z.infer<typeof courseFormSchema>;

export const moduleFormSchema = z.object({
  title,
  description: z.string().trim().max(2000),
});
export type ModuleForm = z.infer<typeof moduleFormSchema>;

export const newLessonSchema = z.object({
  title,
  type: z.enum(LESSON_TYPES),
});
export type NewLessonForm = z.infer<typeof newLessonSchema>;

export const lessonFormSchema = z.object({
  title,
  type: z.enum(LESSON_TYPES),
  /** Whole minutes as typed; empty = no duration. */
  durationMinutes: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, "Enter whole minutes.")
    .refine((v) => v === "" || Number(v) <= 24 * 60, "At most 24 hours."),
});
export type LessonForm = z.infer<typeof lessonFormSchema>;

// --- Landing page blocks ---

export const hrefField = z
  .string()
  .trim()
  .max(300)
  .regex(/^(\/(?!\/)|https:\/\/)/, t.adminContent.validation.hrefFormat);

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const heroSchema = z.object({
  title: text(1, 120),
  subtitle: text(0, 300),
  ctaText: text(1, 40),
  ctaHref: hrefField,
});

export const faqSchema = z.object({
  items: z.array(z.object({ question: text(1, 200), answer: text(1, 2000) })).max(30),
});

export const testimonialsSchema = z.object({
  items: z.array(z.object({ name: text(1, 80), role: text(0, 100), quote: text(1, 600) })).max(20),
});

export const bannerFormSchema = z.object({
  items: z
    .array(
      z.object({
        id: text(1, 40),
        text: text(1, 200),
        href: z.union([z.literal(""), hrefField]),
        variant: z.enum(["info", "promo", "warning"]),
        active: z.boolean(),
        startsAt: z.string(),
        endsAt: z.string(),
      }),
    )
    .max(10),
});
export type BannerForm = z.infer<typeof bannerFormSchema>;
