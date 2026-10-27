# Logic Lab Web (Phases 1–6)

Next.js 15 (App Router) · TypeScript strict · Tailwind v4 · shadcn/ui (Radix) · lucide-react ·
TanStack Query · react-hook-form + zod · Tiptap · dnd-kit · Tesseract.js.

## Run locally

```bash
# 1. API (see ../backend/README.md): docker compose up -d, db:deploy, seed, then
cd ../backend && npm run start:dev          # http://localhost:4000

# 2. Web
cd ../frontend
cp .env.example .env.local                  # API_URL=http://localhost:4000
npm install
npm run dev                                  # http://localhost:3100
```

Log in as the seeded super admin (`SUPER_ADMIN_EMAIL` / `SUPER_ADMIN_PASSWORD` in the backend `.env`).
You'll be asked to set up 2FA with an authenticator app first.

## How it talks to the API

The browser only talks to this app. `next.config.ts` proxies `/api/*` to `API_URL`, so the
API's httpOnly cookies are first-party. Two backend settings depend on this:
- `API_URL=http://localhost:3100/api`, which the Google OAuth callback URL is built from.
- `TRUST_PROXY=1`, so rate limits see the real client IP.

- **Route protection:** `middleware.ts` guards `/student`, `/mentor`, `/admin` and `/mfa`. It asks the API
  `/me` who the user is, refreshes an expired access token on the way, then enforces the portal
  role and 2FA. This is the first of the three role checks (middleware, API guard, DB rules).
- **Browser calls:** `lib/api/client.ts` (`api()`) is used by every client component. On a 401 it refreshes once,
  retries, and otherwise sends the user to `/login?next=…`.
- **Public pages:** `lib/api/server.ts` (`serverApi()`) is server-side fetching for the landing page, `/pricing` and `/courses`. They
  render fresh on every request, so CMS edits show immediately.
- **API URL is fixed at build time:** `API_URL` is read when you run `next build` (rewrites and middleware are compiled
  in), so set it before building for production.

## Pages

| Area | Routes |
|---|---|
| Public | `/` (landing from the CMS), `/pricing`, `/courses?track=&level=`, `/courses/[slug]` |
| Auth | `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password`, `/auth/callback` (Google), `/mfa` |
| Student | `/student` (trial track picker, continue learning, streak, weekly time, course progress), `/student/billing` (plans, coupon, payment details, slip upload + OCR, history, invoices), `/student/courses/[slug]` (outline with progress and locks), `/student/lessons/[id]` (video player with watermark/speed/resume, article, quiz, assignment with write-only editor, notes, downloads, timestamped Q&A; paywall or locked states), `/student/quizzes/[attemptId]` (server-timed attempt, results) |
| Mentor | `/mentor` (assigned courses, unanswered questions), `/mentor/lessons/[id]` (video, notes, downloads, Q&A; quiz builder or assignment + rubric editor), `/mentor/courses/[id]/questions` (question bank), `/mentor/grading` (queue, submission grader with typing replay, quiz attempt grader) |
| Community | `/community` (feed: track/tag filters, sort, search, pinned announcements), `/community/new`, `/community/posts/[id]` (votes, answers, accept, report), `/community/posts/[id]/edit` |
| Admin | `/admin`, `/admin/users`, `/admin/content` (tracks + courses, drag to reorder), `/admin/content/courses/[id]`, `/admin/content/lessons/[id]` (Tiptap), `/admin/content/site` (hero/FAQ/testimonials/banners), `/admin/payments`, `/admin/payments/[id]`, `/admin/billing` (plans + coupons), `/admin/settings` (payment instructions), `/admin/audit`, `/admin/grading`, `/admin/moderation`, `/admin/content/courses/[id]/questions` |

## Conventions

- All UI text lives in `lib/i18n/en/*.ts` (`t.common`, `t.auth`, `t.site`, `t.student`, `t.admin`,
  `t.adminContent`). Add Urdu by adding `lib/i18n/ur/` with the same shape.
- **API types:** `types/api.ts` has the API response types.
- **Forms:** every form uses zod. API `VALIDATION_FAILED` errors are mapped onto fields with
  `applyFormErrors`.
- **Uploads:** they go straight to R2 with presigned URLs (`lib/upload.ts`).
- **Article images:** lessons store image R2 keys, not URLs (`lib/tiptap.ts` adds/removes `src`).
- **Slip OCR:** Tesseract.js runs in the browser on image slips only (`lib/ocr.ts`, loaded on demand). It
  downloads its language data from a CDN the first time.
- **Video:** lecture videos upload straight to R2 in 10 MB parts (`lib/video-upload.ts`; the bucket CORS must expose `ETag`).
  Watch progress is reported every 15 s (`useProgressReporter` in `lib/learning.ts`).
- **Design:** light/dark/system theme (next-themes), one accent colour (indigo), and a mobile-first
  layout where the dashboard sidebar becomes a sheet.

Checks: `npx tsc --noEmit`, `npm run lint`, `npm run build`.
