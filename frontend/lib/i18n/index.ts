// All UI strings live here so Urdu can be added later (add lib/i18n/ur/* with the same shape).
import { admin } from "./en/admin";
import { adminContent } from "./en/admin-content";
import { assessments } from "./en/assessments";
import { auth } from "./en/auth";
import { common } from "./en/common";
import { community } from "./en/community";
import { grading } from "./en/grading";
import { learning } from "./en/learning";
import { live } from "./en/live";
import { moderation } from "./en/moderation";
import { realtime } from "./en/realtime";
import { site } from "./en/site";
import { student } from "./en/student";
import { teaching } from "./en/teaching";

export const t = {
  common,
  auth,
  site,
  student,
  learning,
  assessments,
  teaching,
  grading,
  community,
  moderation,
  admin,
  adminContent,
  realtime,
  live,
} as const;
