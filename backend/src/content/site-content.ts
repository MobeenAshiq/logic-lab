import { z } from 'zod';

/** Links must be site-relative or https, so no `javascript:` URLs reach the page. */
const href = z
  .string()
  .trim()
  .max(300)
  .regex(
    /^(\/(?!\/)|https:\/\/)/,
    'Use a path like /pricing or an https:// link.',
  );

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Every landing-page block the CMS can edit, with its shape. */
export const SITE_CONTENT_SCHEMAS = {
  hero: z.strictObject({
    title: text(1, 120),
    subtitle: text(0, 300),
    ctaText: text(1, 40),
    ctaHref: href,
  }),
  faq: z.strictObject({
    items: z
      .array(z.strictObject({ question: text(1, 200), answer: text(1, 2000) }))
      .max(30),
  }),
  testimonials: z.strictObject({
    items: z
      .array(
        z.strictObject({
          name: text(1, 80),
          role: text(0, 100),
          quote: text(1, 600),
        }),
      )
      .max(20),
  }),
  banners: z.strictObject({
    items: z
      .array(
        z.strictObject({
          id: text(1, 40),
          text: text(1, 200),
          href: href.nullable(),
          variant: z.enum(['info', 'promo', 'warning']),
          active: z.boolean(),
          startsAt: z.iso.datetime().nullable(),
          endsAt: z.iso.datetime().nullable(),
        }),
      )
      .max(10),
  }),
};

export type SiteContentKey = keyof typeof SITE_CONTENT_SCHEMAS;
export type SiteContent = {
  [K in SiteContentKey]: z.infer<(typeof SITE_CONTENT_SCHEMAS)[K]>;
};
export const SITE_CONTENT_KEYS = Object.keys(
  SITE_CONTENT_SCHEMAS,
) as SiteContentKey[];

export function isSiteContentKey(key: string): key is SiteContentKey {
  return key in SITE_CONTENT_SCHEMAS;
}

/** Used by the seed and whenever a block has never been saved. */
export const SITE_CONTENT_DEFAULTS: SiteContent = {
  hero: {
    title: 'Learn to think like a programmer',
    subtitle:
      'Logic Building, Web Development and AI/ML with real mentors, built for students in Pakistan.',
    ctaText: 'Start your 7-day free trial',
    ctaHref: '/signup',
  },
  faq: {
    items: [
      {
        question: 'How does the free trial work?',
        answer:
          'You get 7 days of full access to one track. No payment details are needed to start.',
      },
      {
        question: 'How do I pay?',
        answer:
          'Pay with EasyPaisa, JazzCash or bank transfer, then upload your payment slip. We verify it and activate your plan.',
      },
      {
        question: 'Do I need any experience?',
        answer:
          'No. The Logic Building track starts from zero and prepares you for the other tracks.',
      },
    ],
  },
  testimonials: { items: [] },
  banners: { items: [] },
};
