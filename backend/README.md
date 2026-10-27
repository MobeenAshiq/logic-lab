# LogicLab API

Done: **Phase 1** (authentication and roles), **Phase 2** (CMS and course structure),
**Phase 3** (free trial, payments and invoices), **Phase 4** (recorded lectures and progress),
**Phase 5** (assignments and quizzes with integrity checks), **Phase 6** (community Q&A feed).

NestJS 11 + Prisma + PostgreSQL. This replaces the plan's Next.js + Supabase Auth with a
standalone Node API. A frontend (Next.js or anything else) talks to it with
`fetch(..., { credentials: 'include' })`. Auth uses httpOnly cookies.

## Run locally

```bash
cd backend
npm install
cp .env.example .env          # then set JWT_ACCESS_SECRET and ENCRYPTION_KEY (openssl rand -hex 32)
docker compose up -d          # Postgres on localhost:5433
npm run db:deploy             # apply migrations
npm run seed                  # create the super_admin from SUPER_ADMIN_* env vars
npm run start:dev             # http://localhost:4000
npm run test:e2e              # Phase 1 acceptance checks (needs the database running)
```

If `RESEND_API_KEY` is empty, OTP codes and reset links are printed to the server log.
If Upstash is not configured, an in-memory rate limiter is used, which only works for one process.

## Endpoints

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/signup` | public | `{email, password, fullName}` → sends a 6-digit email code |
| POST | `/auth/verify-email` | public | `{email, code}` → verifies the email and logs the user in |
| POST | `/auth/resend-code` | public | `{email}` |
| POST | `/auth/login` | public | `{email, password}` → `{user, mfa}`; unverified → 403 `EMAIL_NOT_VERIFIED` |
| GET | `/auth/google` → `/auth/google/callback` | public | redirects to `FRONTEND_URL/auth/callback?mfa=…` |
| POST | `/auth/refresh` | refresh cookie | rotates tokens |
| POST | `/auth/logout` | logged in | |
| POST | `/auth/forgot-password` | public | `{email}` → emails `FRONTEND_URL/reset-password?token=…` |
| POST | `/auth/reset-password` | public | `{token, password}`; signs out all devices |
| POST | `/auth/mfa/setup` | mentor/admin | returns QR code (data URL) + secret |
| POST | `/auth/mfa/enable` | mentor/admin | `{code}`, the first code from the authenticator app |
| POST | `/auth/mfa/verify` | mentor/admin | `{code}` on each new login |
| GET / PATCH | `/me` | logged in | PATCH only accepts `fullName`, `avatarUrl` |
| GET | `/student/dashboard` | student | portal gate |
| GET | `/mentor/dashboard` | mentor + 2FA | portal gate |
| GET | `/admin/dashboard` | admin, super_admin + 2FA | portal gate |
| GET | `/admin/users?search=&role=&status=` | admin | |
| PATCH | `/admin/users/:id/role` | admin | `{role, reason}`; only super_admin can grant or remove admin roles |
| PATCH | `/admin/users/:id/status` | admin | `{status, reason}`; ban/unban |
| GET | `/admin/audit-logs?targetId=` | admin | |

### Phase 2: CMS and catalog

All `/admin/content/*` and `/admin/uploads` routes require admin or super_admin (with 2FA).
Publish or unpublish any item with `PATCH {isPublished: true|false}`.

| Method | Path | Notes |
|---|---|---|
| GET / POST | `/admin/content/tracks` | slug is made from the title if not given |
| PATCH / DELETE | `/admin/content/tracks/:id` | delete only when the track has no courses |
| PUT | `/admin/content/tracks/order` | `{ids: [...]}`: the full new order (drag and drop) |
| GET / POST | `/admin/content/courses?trackId=` | `{trackId, title, level, shortDescription, description, coverImageKey}` |
| GET / PATCH / DELETE | `/admin/content/courses/:id` | GET returns the full tree (modules, lessons, mentors); delete only when unpublished |
| PUT | `/admin/content/tracks/:id/courses/order` | |
| POST / DELETE | `/admin/content/courses/:id/mentors[/:mentorId]` | `{mentorId}` (user must have the mentor role); audited |
| POST | `/admin/content/courses/:id/modules` | `{title, unlockAfterModuleId?}` (same course, no loops) |
| PUT | `/admin/content/courses/:id/modules/order` | |
| PATCH / DELETE | `/admin/content/modules/:id` | |
| POST | `/admin/content/modules/:id/lessons` | `{title, type: video\|article\|quiz\|assignment, content?}` |
| PUT | `/admin/content/modules/:id/lessons/order` | |
| GET / PATCH / DELETE | `/admin/content/lessons/:id` | GET adds `assetUrls` (signed image URLs); PATCH `{moduleId}` moves a lesson |
| GET | `/admin/content/site` | all landing-page blocks |
| PUT | `/admin/content/site/:key` | `hero`, `faq`, `testimonials`, `banners` |
| POST | `/admin/uploads` | `{purpose: lesson-image\|course-cover, contentType, size}` → `{key, uploadUrl}` |
| GET | `/tracks`, `/courses?track=&level=`, `/courses/:slug` | **public** catalog: published items only, lesson titles only |
| GET | `/site-content` | **public** landing-page content (active banners only) |

**Article lessons (Tiptap):** the editor saves the Tiptap JSON document (`editor.getJSON()`) as
`content`. To add an image: call `POST /admin/uploads`, `PUT` the file to `uploadUrl` with the
same `Content-Type`, then insert an `image` node with `attrs.key` (no `src`). When the lesson
is loaded, use `assetUrls[key]` as the image `src`; these URLs expire after 10 minutes.

**R2 setup:** create a bucket, then an R2 API token with Object Read & Write access to it.
Fill in `R2_*` in `.env`, then add this CORS policy to the bucket (R2 → bucket → Settings → CORS).
Video uploads go in parts and need the `ETag` header to be readable:

```json
[
  {
    "AllowedOrigins": ["http://localhost:3100"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Phase 3: trial, payments, invoices

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/plans` | public | active plans with their tracks (pricing page) |
| GET | `/student/billing` | student | access, `needsTrackChoice`, `canStartTrial`, plans, payment history with invoices, payment instructions |
| POST | `/student/trial` | student | `{trackId}`: 7 days on one track, once per email and per Google account |
| POST | `/student/billing/quote` | student | `{planId, couponCode?}` → `{pricePkr, discount, total}` |
| POST | `/student/payments/upload-url` | student | `{contentType: image/jpeg\|image/png\|application/pdf, size ≤ 5 MB}` → `{key, uploadUrl}` |
| POST | `/student/payments` | student | `{planId, couponCode?, method, transactionId, amount, paidAt: YYYY-MM-DD, slipKey, ocrText?}` |
| GET | `/student/payments/:id/slip`, `/student/invoices/:id/download` | student | own items only; returns a 10-minute URL |
| GET | `/learn/lessons/:id` | logged in | lesson content; students without access get 403 `SUBSCRIPTION_REQUIRED` + `paywallUrl` |
| GET / POST / PATCH | `/admin/billing/plans[/:id]` | admin | audited; deactivate with `isActive: false` |
| GET / POST / PATCH | `/admin/billing/coupons[/:id]` | admin | percent or fixed; optional expiry, max uses, plans; audited |
| GET | `/admin/payments?status=pending` | admin | review queue with OCR `warnings` |
| GET | `/admin/payments/:id` | admin | details, OCR text, signed `slipUrl` |
| POST | `/admin/payments/:id/approve` | admin | activates access, issues the invoice, emails the PDF |
| POST | `/admin/payments/:id/reject` | admin | `{reason}` (required); emails the student |
| GET / POST | `/admin/invoices/:id/download`, `/admin/invoices/:id/resend` | admin | |
| GET / PUT | `/admin/settings/payment_instructions` | admin | EasyPaisa/JazzCash numbers, bank IBAN, note; audited |

**Slip flow (frontend):** get `upload-url` → `PUT` the file to it → run Tesseract.js on the file
in the browser → `POST /student/payments` with the `key` and the OCR text.

**Who sees lesson content:** admins see everything; a mentor sees only the courses they are
assigned to; a student needs a live trial or subscription that covers the course's track.

Every error is `{statusCode, code, message}`. The frontend switches on `code`:
`UNAUTHENTICATED` / `SESSION_EXPIRED` → `/login`; `SESSION_REVOKED_DEVICE_LIMIT` → `/login`
with the message; `MFA_SETUP_REQUIRED` / `MFA_VERIFY_REQUIRED` → 2FA screen;
`FORBIDDEN_ROLE` → the user's own portal; `ACCOUNT_BANNED` → logged out, show the message.
Messages live in `src/common/i18n/en.ts`.

Frontend pages from the plan (`/login`, `/signup`, `/verify-email`, `/forgot-password`,
`/reset-password`) map directly onto the endpoints above.

## How the security rules are enforced

| Rule | Where |
|---|---|
| Unauthenticated → login; `/student`, `/mentor`, `/admin` per role | Global `AuthGuard` + `@Roles()` ([src/auth/auth.guard.ts](src/auth/auth.guard.ts)) |
| Role is never trusted from the client | The guard loads role and status from the DB on every request. `requireRole()` is used in services. |
| Only admins change `role` / `status` | 1. API: `PATCH /me` rejects unknown fields. 2. Service: `requireRole`. 3. **Database trigger** `profiles_protect_privileged_columns` rejects the change unless the transaction was opened with `prisma.asAdmin()`. |
| Profile row on every new user (role = student) | DB trigger `on_user_created` |
| `audit_logs` insert-only | DB triggers block UPDATE, DELETE, and TRUNCATE |
| Banned users logged out | Ban revokes all sessions; any request with an old session returns 403 `ACCOUNT_BANNED` and clears cookies |
| 2FA for mentor/admin | Session has `mfa_verified_at`; the guard blocks everything except `/me`, `/auth/mfa/*`, and logout until it is set |
| Max 2 student devices | `SessionsService.create` revokes the oldest session (serialized with an advisory lock) |
| Rate limits | `@RateLimit()`: 5 per 15 minutes per IP **and** per email (and per user for MFA) |

> **Difference from the plan:** without Supabase there is no per-user Postgres RLS, because the
> API connects with a single DB role. Access rules are enforced in the guard and services, and
> the critical ones (role/status changes, insert-only audit log) are also enforced by DB triggers.

## Frontend proxy

The web app (`../frontend`) proxies `/api/*` to this API, so the browser sees one origin and
the auth cookies are first-party. Because of this:
- **`API_URL`** must be the public URL *through the proxy* (`http://localhost:3100/api` locally),
  because the Google OAuth callback is built from it. In Google Cloud Console, add
  `http://localhost:3100/api/auth/google/callback` as an authorized redirect URI.
- **`TRUST_PROXY=1`** makes `req.ip` the real client IP, which per-IP rate limits rely on.
- **Cookie path:** both auth cookies use path `/`.

**E2E tests use their own database:** `logiclab_test`, or `TEST_DATABASE_URL` if set. It is
created and migrated automatically before every run, so tests never write into your dev data.

## Phase 1 summary

**Migration:** `prisma/migrations/*_phase1_auth`. Adds `users`, `profiles`, `user_sessions`,
`auth_tokens`, `audit_logs`, the `Role`/`UserStatus` enums, and three triggers.

**New env variables:** see `.env.example`: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_ACCESS_TTL_SECONDS`,
`REFRESH_TTL_DAYS`, `COOKIE_SECURE`, `ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID/SECRET`,
`RESEND_API_KEY`, `EMAIL_FROM`, `UPSTASH_REDIS_REST_URL/TOKEN`, `SUPER_ADMIN_EMAIL/PASSWORD/NAME`,
`FRONTEND_URL`, `API_URL`, `PORT`.

## Phase 2 summary

**Migration:** `prisma/migrations/*_phase2_cms`. Adds `tracks`, `courses` (level, is_published),
`modules` (position, unlock_after_module_id), `lessons` (type, position, Tiptap content),
`course_mentors`, and `site_content`, plus the `CourseLevel` and `LessonType` enums.

**Seed:** `npm run seed` now also creates the three tracks (Logic Building, Web Development,
AI/ML & Data Science) and the default landing-page blocks. It never overwrites CMS edits.

**New env variables:** `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.

**Phase 1 changes:** role and status changes now always require a `reason`.
`/admin/users` can also filter by `status`. A mentor whose role changes loses their course
assignments.

**Tests:** `test/content.e2e-spec.ts` covers the Phase 2 checks. E2E tests use fake R2
credentials (`test/setup-env.ts`); presigning happens locally, so nothing is sent to R2.

### Phase 4: lectures, progress, Q&A

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/learn/lessons/:id` | logged in | lesson + notes, attachments, signed `video` URL (10 min), `progress`, `watermark`, prev/next. 403 `SUBSCRIPTION_REQUIRED` or `MODULE_LOCKED` |
| GET | `/learn/lessons/:id/video-url` | logged in | fresh signed URL (the player calls this when the old one expires) |
| POST | `/learn/lessons/:id/progress` | student | `{positionSeconds, watchedDelta}` every ~15 s; video completes at 90% watched |
| POST | `/learn/lessons/:id/complete` | student | mark an article as done |
| GET | `/learn/attachments/:id` | logged in | signed download URL (saves under the original file name) |
| GET | `/learn/courses/:slug` | logged in | outline with completion %, per-lesson progress, module locks |
| GET / POST | `/learn/lessons/:id/questions` | logged in | `{body, timestampSeconds?}` |
| POST | `/learn/questions/:id/answers` | logged in | `{body}`; answers by course mentors/admins get `isStaff: true` |
| GET | `/student/learning` | student | streak, time this week/today, continue-learning lesson, course progress |
| GET | `/teach/courses`, `/teach/questions?status=unanswered` | mentor, admin | assigned courses (admins: all); unanswered questions |
| GET / PATCH | `/teach/lessons/:id` | mentor, admin | `{notes?, durationSeconds?}` |
| POST | `/teach/lessons/:id/video/start` → `/video/parts` → `/video/complete` (or `/video/abort`) | mentor, admin | multipart upload: 10 MB parts, part URLs signed in batches |
| DELETE | `/teach/lessons/:id/video` | mentor, admin | |
| POST | `/teach/lessons/:id/attachments/upload-url` → PUT → `/teach/lessons/:id/attachments` | mentor, admin | max 50 MB; PDF, ZIP, images, code, Office |
| DELETE | `/teach/lessons/:id/attachments/:attachmentId` | mentor, admin | |

Mentors can only use `/teach/*` on courses they are assigned to (`NOT_COURSE_MENTOR` otherwise).

### Phase 5: quizzes, assignments, grading

| Method | Path | Who | Notes |
|---|---|---|---|
| GET / POST | `/teach/courses/:courseId/questions` | mentor, admin | question bank; filters `type`, `difficulty`, `tag`, `search` |
| PATCH / DELETE | `/teach/questions/:id` | mentor, admin | delete refused while used in a quiz |
| GET / PUT | `/teach/lessons/:id/quiz` | mentor, admin | `{timeLimitMinutes, startsAt, endsAt, passMark, maxAttempts}` |
| PUT | `/teach/lessons/:id/quiz/questions` | mentor, admin | `{questionIds}` (ordered; from this course's bank) |
| GET / PUT | `/teach/lessons/:id/assignment` | mentor, admin | `{instructions, dueAt, maxMarks, rubric[]}`; rubric must add up to `maxMarks` |
| GET | `/teach/grading?status=pending\|graded` | mentor, admin | submissions + quiz attempts needing a mentor |
| GET / POST | `/teach/submissions/:id`, `/teach/submissions/:id/grade` | mentor, admin | typing events + flags; `{rubricScores \| grade, feedback}` returns it to the student |
| GET / POST | `/teach/attempts/:id`, `/teach/attempts/:id/grade` | mentor, admin | `{questionScores, feedback}` for short/code answers |
| GET | `/learn/lessons/:id/quiz` | logged in | rules, attempts, `canStart` / `blockedReason` |
| POST | `/learn/lessons/:id/quiz/attempts` | student | start (or resume) an attempt; deadline set by the server |
| GET | `/learn/attempts/:id` | student (owner) | questions (+ correct answers once the quiz is closed for them), result |
| PUT | `/learn/attempts/:id/answers/:questionId` | student | `{optionIds}` or `{text}`; 409 `ATTEMPT_CLOSED` after the deadline |
| POST | `/learn/attempts/:id/typing`, `/tab-switch`, `/submit` | student | typing batches `{questionId, events}`, tab-leave counter, submit |
| GET | `/learn/lessons/:id/assignment` | logged in | instructions, rubric, own submission (grade only once returned) |
| PUT / POST / POST | `/learn/lessons/:id/assignment/draft`, `/typing`, `/submit` | student | autosave, typing batches, submit |

### Phase 6: community

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/community/me` | logged in | `canParticipate`, `isStaff`, unread moderator warnings |
| POST | `/community/me/warnings/acknowledge` | logged in | |
| GET | `/community/posts?track=&tag=&search=&sort=newest\|top\|unanswered&page=` | logged in | feed + pinned announcements (page 1) |
| GET | `/community/tags` | logged in | popular tags |
| POST / GET / PATCH / DELETE | `/community/posts[/:id]` | participants | `{kind, title, body (Markdown), codeSnippet, codeLanguage, tags, trackId}`; only staff post `announcement` or set `isPinned` |
| POST | `/community/posts/:id/answers` | participants | mentor/admin answers get `isStaff: true` (Mentor badge) |
| PATCH / DELETE | `/community/answers/:id` | author | |
| POST | `/community/posts/:id/accept` | asker, mentor, admin | `{answerId \| null}` |
| PUT | `/community/votes` | participants | `{targetType, targetId, value: 1 \| -1 \| 0}`; not on your own content |
| POST | `/community/reports` | logged in | `{targetType, targetId, reason, details}`; once per item |
| POST | `/community/uploads` | participants | image upload URL; insert as `![alt](r2:<key>)` |
| GET | `/admin/moderation?status=open\|closed` | admin | reports grouped by item |
| POST | `/admin/moderation/resolve` | admin | `{targetType, targetId, action: hide\|delete\|warn\|dismiss\|restore, note}`; audited |

## Phase 6 summary

**Migration:** `prisma/migrations/*_phase6_community`. Adds:
- `posts` (title, Markdown body, code snippet, tags, track, `accepted_answer_id`, score,
  answer count, pinned/hidden/deleted) and `post_answers`.
- `votes`: unique per user per post and per answer, plus CHECK constraints that a vote targets
  exactly one item and is +1 or -1.
- `reports` (unique per reporter per item) and `user_warnings`.

**Rules:**
- **Who can take part:** anyone logged in can read. Posting, answering, voting and uploading
  need a live trial or subscription; mentors and admins always can.
- **Votes:** scores update in the same transaction as the vote, under a row lock. Voting again
  the same way changes nothing, switching moves the score by 2, and 0 removes the vote.
- **Accepting:** the asker or any mentor/admin can accept an answer. The accepted answer is
  listed first, and deleting it clears the "accepted" mark.
- **Images:** only the author's own uploads (`r2:community/<userId>/…`), signed when read. The
  frontend never loads outside images.
- **Moderation:**
  - Hide removes the item from the feed; its author still sees it with a notice.
  - Delete removes it for everyone.
  - Warn shows the author a message on `/community` until they acknowledge it.
  - Each action closes the item's open reports and writes `moderation.<action>` to the
    audit log.

**Tests:** `test/community.e2e-spec.ts`.

## Phase 5 summary

**Migration:** `prisma/migrations/*_phase5_assessments`. Adds:
- `question_bank` (mcq/short/code, difficulty, tags), `quizzes`, `quiz_questions`, and
  `quiz_attempts` (answers, `typing_events` jsonb, `flags`, `tab_switches`, server `deadline_at`).
- `assignments` (`due_at`, `max_marks`), `rubrics`, and `submissions` (content, `typing_events`
  jsonb, `flags`, grade, feedback).

**Rules:**
- **Server timer:** the deadline is `min(start + time limit, quiz end)`, fixed when the attempt
  starts. Answer saves are atomic `jsonb_set` updates with `deadline_at > now()` in the `WHERE`
  clause, so the database refuses late writes.
- **Auto-submit:** an expired attempt is submitted when the student comes back, and also by a
  job that runs every minute. Closing the tab doesn't stop the clock.
- **Grading:** MCQs are graded on the server at submission. A quiz with short/code questions
  waits for a mentor, then score, percent and pass/fail are computed against the pass mark.
- **Correct answers:** students see them only once the quiz is closed for them (the end time has
  passed, or they have no attempts left).
- **Integrity:** the write-only editor sends every edit (`{at, pos, del, ins}`) and blocked
  pastes in batches every 10 s. On submission the server computes:
  - `burst`: more than 200 characters within 1 second;
  - `fastTyping`: more than 150 characters in 10 seconds;
  - `pasteAttempts`: number of blocked pastes;
  - `contentMismatch`: the submitted text isn't what replaying the edits produces.

  Flags are shown to mentors only and never lower a grade on their own.
- **Module unlocking:** "unlock after" now requires passing every quiz in the previous module.
  Modules without a quiz still need all their lessons completed.
- **Lesson completion:** a quiz lesson completes when it's passed, and an assignment lesson
  completes when it's submitted.

**Tests:** `test/assessments.e2e-spec.ts`. E2E tests now blank the Google OAuth keys, so they
don't depend on your `.env`.

## Phase 4 summary

**Migration:** `prisma/migrations/*_phase4_learning`. Adds:
- `enrollments`, `lesson_progress` (watched/position seconds, completed), and `study_days`
  (seconds per student per day, Pakistan time).
- `lesson_questions` (with `timestamp_seconds`) and `lesson_answers` (`is_staff`).
- `lesson_attachments`.
- `lessons.notes` and `lessons.video_size`.

**Rules:**
- **Videos:** plain MP4/WebM, private in R2 and served only through 10-minute signed URLs, so a
  copied link stops working. The player fetches a new URL when one expires mid-lesson. (HLS
  can replace this later.)
- **Watch time:** the client says how much it played, but each ping is capped by the
  wall-clock time since the previous ping (x2 for fast playback, max 120 s). Watch time and
  completion cannot be faked from the browser console.
- **Module unlocking:** a module with `unlock_after_module_id` stays locked until every
  published lesson of that module is complete. Phase 5 will switch this to the module quiz
  pass mark.
- **Streak:** consecutive days with at least 1 minute of learning; today counts once the student
  studies, and the streak isn't broken until the day ends.

**Bug fixed:** the AWS SDK added a CRC32 checksum of an empty body to presigned upload URLs,
which R2 rejects. The client now uses `requestChecksumCalculation: 'WHEN_REQUIRED'`. This
affected every browser upload from Phase 2 onwards.

**Tests:** `test/learning.e2e-spec.ts`.

## Phase 3 summary

**Migration:** `prisma/migrations/*_phase3_billing`. Adds `plans`, `subscriptions`
(trial/pending/active/expired), `payments` (UNIQUE `transaction_id`), `invoices`, `coupons`,
`trial_claims`, `invoice_counters` and `settings`.

**Rules:**
- **Trial:** one per normalized email (lowercase, no `+tag`, Gmail dots ignored) and per
  Google account, enforced by unique keys in `trial_claims`.
- **Access:** checked live from `starts_at`/`ends_at`, so it ends on time even before the
  hourly job marks the subscription `expired`.
- **Transaction IDs:** compared without spaces or case. A student can re-use their own ID
  only after that payment was rejected.
- **Approval:** one DB transaction does all of this: lock the payment, activate the
  subscription (a renewal starts when the current paid access ends), count the coupon,
  assign the next gapless invoice number, render the PDF (pdf-lib), upload it to R2, and
  write the audit log. The email is sent after the commit; if it fails, `emailed_at` stays
  empty and `POST /admin/invoices/:id/resend` sends it again.
- **Reminders:** an hourly cron (`@nestjs/schedule`, inside the API process) expires ended
  subscriptions and emails reminders 3 days and 1 day before the end. It doesn't remind
  students who have already renewed. It is safe to run on several instances.

**No new env variables.** Invoices and slips use the R2 bucket from Phase 2, and emails use Resend.

**Tests:** `test/billing.e2e-spec.ts`. R2 network calls (`putObject`, `exists`) are stubbed;
everything else runs against the real database.

**Google login setup:** In Google Cloud Console, create an OAuth client ID (Web). Add
`http://localhost:4000/auth/google/callback` as an authorized redirect URI, then fill in
`GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

**Production:** set `NODE_ENV=production`, `COOKIE_SECURE=true`, and real secrets. Run
`npm run db:deploy`. The API must sit behind exactly one proxy for `req.ip` (and so rate
limiting) to be correct. Serve the frontend and API on the same site (e.g. `logiclab.pk` and
`api.logiclab.pk`) so `SameSite=Lax` cookies are sent.
