// Response shapes of the LogicLab API (backend/). Dates arrive as ISO strings.

export type Role = "student" | "mentor" | "admin" | "super_admin";
export type UserStatus = "active" | "banned";
export type MfaState = "none" | "setup" | "verify";

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string;
  errors?: { field: string; message: string }[];
  [key: string]: unknown;
}

export interface Paginated<T> {
  total: number;
  page: number;
  items: T[];
}

// --- Auth & users ---

export interface PublicUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
}

export interface SessionResponse {
  user: PublicUser;
  mfa: MfaState;
}

export interface MfaSetup {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  ip: string | null;
  createdAt: string;
}

// --- Content ---

export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type LessonType = "video" | "article" | "quiz" | "assignment";

export interface TiptapNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  marks?: { type: string; attrs?: Record<string, unknown> }[];
  text?: string;
}

export interface AdminTrack {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string | null;
  position: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { courses: number };
}

export interface PublicTrack {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string | null;
  _count: { courses: number };
}

interface CourseBase {
  id: string;
  trackId: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  level: CourseLevel;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  position: number;
  isPublished: boolean;
  publishedAt: string | null;
  track: { id: string; slug: string; title: string };
}

export interface AdminCourseListItem extends CourseBase {
  _count: { modules: number; mentors: number };
}

export interface AdminLessonSummary {
  id: string;
  moduleId: string;
  title: string;
  type: LessonType;
  position: number;
  isPublished: boolean;
  videoKey: string | null;
  durationSeconds: number | null;
}

export interface AdminModule {
  id: string;
  courseId: string;
  title: string;
  description: string;
  position: number;
  isPublished: boolean;
  unlockAfterModuleId: string | null;
  lessons: AdminLessonSummary[];
}

export interface AdminCourse extends CourseBase {
  modules: AdminModule[];
  mentors: { id: string; fullName: string; email: string; assignedAt: string }[];
}

export interface AdminLesson extends AdminLessonSummary {
  content: TiptapNode | null;
  assetUrls: Record<string, string>;
}

export interface PublicCourseListItem {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  level: CourseLevel;
  track: { slug: string; title: string };
  coverImageUrl: string | null;
}

export interface PublicCourse {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  level: CourseLevel;
  track: { slug: string; title: string };
  coverImageUrl: string | null;
  mentors: { fullName: string; avatarUrl: string | null }[];
  modules: {
    id: string;
    title: string;
    description: string;
    position: number;
    lessons: {
      id: string;
      title: string;
      type: LessonType;
      position: number;
      durationSeconds: number | null;
    }[];
  }[];
}

export interface LessonProgress {
  positionSeconds: number;
  watchedSeconds: number;
  completed: boolean;
}

export interface Attachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
}

export interface SignedMedia {
  url: string;
  expiresInSeconds: number;
}

export interface LearnLesson {
  id: string;
  title: string;
  type: LessonType;
  position: number;
  durationSeconds: number | null;
  content: TiptapNode | null;
  assetUrls: Record<string, string>;
  notes: string;
  attachments: Attachment[];
  video: SignedMedia | null;
  /** null for mentors/admins previewing. */
  progress: LessonProgress | null;
  watermark: string;
  isStaff: boolean;
  module: { id: string; title: string };
  course: { id: string; slug: string; title: string };
  previousLessonId: string | null;
  nextLessonId: string | null;
}

export interface CourseOutline {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  track: { slug: string; title: string };
  hasAccess: boolean;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  modules: {
    id: string;
    title: string;
    description: string;
    locked: boolean;
    unlockAfterTitle: string | null;
    lessons: {
      id: string;
      title: string;
      type: LessonType;
      durationSeconds: number | null;
      completed: boolean;
      positionSeconds: number;
    }[];
  }[];
}

export interface LearningDashboard {
  streakDays: number;
  weekSeconds: number;
  todaySeconds: number;
  continueLearning: {
    lessonId: string;
    lessonTitle: string;
    courseSlug: string;
    courseTitle: string;
    positionSeconds: number;
    completed: boolean;
  } | null;
  courses: {
    courseId: string;
    slug: string;
    title: string;
    trackTitle: string;
    totalLessons: number;
    completedLessons: number;
    percent: number;
    lastActivityAt: string;
  }[];
  recommendations: {
    topic: string;
    missRate: number;
    suggestedLessons: { lessonId: string; lessonTitle: string; courseSlug: string; courseTitle: string }[];
  }[];
}

export interface QuestionAuthor {
  id: string;
  fullName: string;
  role: Role | null;
}

export interface LessonQuestion {
  id: string;
  lessonId: string;
  body: string;
  timestampSeconds: number | null;
  createdAt: string;
  author: QuestionAuthor;
  answers: {
    id: string;
    body: string;
    isStaff: boolean;
    createdAt: string;
    author: QuestionAuthor;
  }[];
}

export interface InboxQuestion extends LessonQuestion {
  lesson: { id: string; title: string };
  course: { id: string; title: string };
}

export interface TeachCourse {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  trackTitle: string;
  modules: {
    id: string;
    title: string;
    isPublished: boolean;
    lessons: {
      id: string;
      title: string;
      type: LessonType;
      isPublished: boolean;
      durationSeconds: number | null;
      hasVideo: boolean;
      attachmentCount: number;
      questionCount: number;
    }[];
  }[];
}

export interface TeachLesson {
  id: string;
  title: string;
  type: LessonType;
  isPublished: boolean;
  notes: string;
  durationSeconds: number | null;
  video: (SignedMedia & { size: number | null }) | null;
  attachments: Attachment[];
  module: { id: string; title: string };
  course: { id: string; slug: string; title: string };
}

export interface Banner {
  id: string;
  text: string;
  href: string | null;
  variant: "info" | "promo" | "warning";
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

export interface SiteContent {
  hero: { title: string; subtitle: string; ctaText: string; ctaHref: string };
  faq: { items: { question: string; answer: string }[] };
  testimonials: { items: { name: string; role: string; quote: string }[] };
  banners: { items: Banner[] };
}

export type SiteContentKey = keyof SiteContent;

export interface UploadTicket {
  key: string;
  uploadUrl: string;
  method: "PUT";
  headers: Record<string, string>;
  expiresInSeconds: number;
}

// --- Billing ---

export type SubscriptionStatus = "trial" | "pending" | "active" | "expired";
export type PaymentMethod = "easypaisa" | "jazzcash" | "bank";
export type PaymentStatus = "pending" | "approved" | "rejected";
export type DiscountType = "percent" | "fixed";

export interface AdminPlan {
  id: string;
  name: string;
  description: string;
  pricePkr: number;
  durationDays: number;
  allTracks: boolean;
  trackIds: string[];
  isActive: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicPlan {
  id: string;
  name: string;
  description: string;
  pricePkr: number;
  durationDays: number;
  allTracks: boolean;
  tracks: { id: string; slug: string; title: string }[];
}

export interface Coupon {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  planIds: string[];
  createdAt: string;
}

export interface AccessItem {
  id: string;
  status: SubscriptionStatus;
  plan: { id: string; name: string } | null;
  allTracks: boolean;
  trackIds: string[];
  startsAt: string;
  endsAt: string;
}

export interface StudentPayment {
  id: string;
  planName?: string;
  method: PaymentMethod;
  transactionId: string;
  amount: number;
  expectedAmount: number;
  paidAt: string;
  status: PaymentStatus;
  rejectReason: string | null;
  createdAt: string;
  invoice: { id: string; invoiceNo: string; issuedAt?: string } | null;
}

export interface PaymentInstructions {
  easypaisa: { accountTitle: string; number: string } | null;
  jazzcash: { accountTitle: string; number: string } | null;
  bank: { bankName: string; accountTitle: string; iban: string } | null;
  note: string;
}

export interface StudentBilling {
  access: AccessItem[];
  hasAccess: boolean;
  pendingSubscription: { id: string; plan: { id: string; name: string } | null } | null;
  canStartTrial: boolean;
  needsTrackChoice: boolean;
  plans: PublicPlan[];
  payments: StudentPayment[];
  paymentInstructions: PaymentInstructions;
}

export interface Quote {
  planId: string;
  planName: string;
  couponCode: string | null;
  pricePkr: number;
  discount: number;
  total: number;
}

export interface AdminPayment {
  id: string;
  userId: string;
  subscriptionId: string;
  planId: string;
  couponId: string | null;
  method: PaymentMethod;
  transactionId: string;
  amount: number;
  expectedAmount: number;
  paidAt: string;
  slipKey: string;
  status: PaymentStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
  user: { id: string; email: string; profile: { fullName: string } | null };
  plan: { id: string; name: string; pricePkr: number; durationDays: number };
  coupon: { code: string; discountType: DiscountType; discountValue: number } | null;
  invoice: { id: string; invoiceNo: string; emailedAt: string | null } | null;
  warnings: string[];
}

export interface AdminPaymentDetail extends AdminPayment {
  ocrText: string | null;
  slipUrl: string;
  previousPayments: number;
  emailed?: boolean;
}

// --- Phase 5: quizzes, assignments, integrity ---

export type QuestionType = "mcq" | "short" | "code";
export type Difficulty = "easy" | "medium" | "hard";
export type AttemptStatus = "in_progress" | "submitted" | "graded";
export type SubmissionStatus = "draft" | "submitted" | "returned";

export interface McqOption {
  id: string;
  text: string;
}

/** One edit in the write-only editor, or a blocked paste. */
export type TypingEvent =
  { at: number; pos: number; del: number; ins: string } | { at: number; kind: "paste_blocked" };

export interface IntegrityFlags {
  burst: boolean;
  burstMaxChars: number;
  fastTyping: boolean;
  fastestCharsPer10s: number;
  pasteAttempts: number;
  contentMismatch: boolean;
  typedChars: number;
  eventCount: number;
  aiReview?: {
    similarity: { submissionId: string; score: number } | null;
    authorship: { concern: boolean; confidence: number; rationale: string } | null;
  };
}

export interface BankQuestion {
  id: string;
  courseId: string;
  type: QuestionType;
  difficulty: Difficulty;
  tags: string[];
  prompt: string;
  options: McqOption[];
  correctOptionIds: string[];
  allowMultiple: boolean;
  explanation: string;
  sampleAnswer: string;
  codeLanguage: "javascript" | "python" | null;
  points: number;
  createdAt: string;
  usedInQuizzes?: number;
}

export interface QuizBuilder {
  id: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  timeLimitSeconds: number;
  startsAt: string | null;
  endsAt: string | null;
  passMark: number;
  maxAttempts: number;
  attemptCount: number;
  totalPoints: number;
  questions: BankQuestion[];
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  maxPoints: number;
}

export interface AssignmentBuilder {
  id: string;
  lessonId: string;
  lessonTitle: string;
  courseId: string;
  instructions: string;
  dueAt: string | null;
  maxMarks: number;
  rubric: RubricCriterion[];
  submissionCounts: Partial<Record<SubmissionStatus, number>>;
}

export type QuizBlockedReason = "QUIZ_NOT_OPEN" | "QUIZ_CLOSED" | "NO_ATTEMPTS_LEFT";

export type QuizInfo =
  | { ready: false; serverNow: string }
  | {
    ready: true;
    serverNow: string;
    quizId: string;
    timeLimitSeconds: number;
    startsAt: string | null;
    endsAt: string | null;
    passMark: number;
    maxAttempts: number;
    questionCount: number;
    totalPoints: number;
    activeAttemptId: string | null;
    canStart: boolean;
    blockedReason: QuizBlockedReason | null;
    passed: boolean;
    attempts: {
      id: string;
      status: AttemptStatus;
      startedAt: string;
      submittedAt: string | null;
      autoSubmitted: boolean;
      score: number | null;
      maxScore: number;
      percent: number | null;
      passed: boolean | null;
    }[];
  };

export interface SavedAnswer {
  optionIds?: string[];
  text?: string;
}

export interface AttemptView {
  id: string;
  lessonId: string;
  status: AttemptStatus;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  serverNow: string;
  passMark: number;
  reveal: boolean;
  questions: {
    id: string;
    type: QuestionType;
    prompt: string;
    options: McqOption[];
    allowMultiple: boolean;
    codeLanguage: string | null;
    points: number;
    answer: SavedAnswer | null;
    correctOptionIds?: string[];
    explanation?: string;
    earned?: number | null;
  }[];
  result: {
    autoScore: number;
    score: number | null;
    maxScore: number;
    percent: number | null;
    passed: boolean | null;
    feedback: string;
    pendingReview: boolean;
  } | null;
}

export interface AssignmentInfo {
  id: string;
  lessonId: string;
  instructions: string;
  dueAt: string | null;
  maxMarks: number;
  rubric: RubricCriterion[];
  serverNow: string;
  submission: {
    id: string;
    status: SubmissionStatus;
    content: string;
    draftSavedAt: string | null;
    submittedAt: string | null;
    late: boolean;
    grade: number | null;
    rubricScores: Record<string, number>;
    feedback: string;
    returnedAt: string | null;
  } | null;
}

export interface PersonRef {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
}

export interface GradingItem {
  kind: "submission" | "attempt";
  id: string;
  student: PersonRef;
  course: { id: string; title: string };
  lesson: { id: string; title: string };
  submittedAt: string | null;
  late: boolean;
  flagged: boolean;
  tabSwitches: number | null;
  score: number | null;
  maxScore: number;
}

export interface AttemptForGrader {
  id: string;
  status: AttemptStatus;
  student: PersonRef;
  course: { id: string; title: string };
  lesson: { id: string; title: string };
  passMark: number;
  startedAt: string;
  deadlineAt: string;
  submittedAt: string | null;
  autoSubmitted: boolean;
  tabSwitches: number;
  autoScore: number;
  score: number | null;
  maxScore: number;
  percent: number | null;
  passed: boolean | null;
  feedback: string;
  questions: {
    id: string;
    type: QuestionType;
    prompt: string;
    options: McqOption[];
    correctOptionIds: string[];
    sampleAnswer: string;
    codeLanguage: string | null;
    points: number;
    answer: SavedAnswer | null;
    autoCorrect: boolean | null;
    manualScore: number | null;
    typingEvents: TypingEvent[];
    flags: IntegrityFlags | null;
  }[];
}

export interface SubmissionForGrader {
  id: string;
  status: SubmissionStatus;
  student: PersonRef;
  course: { id: string; title: string };
  lesson: { id: string; title: string };
  instructions: string;
  dueAt: string | null;
  maxMarks: number;
  rubric: RubricCriterion[];
  content: string;
  submittedAt: string | null;
  late: boolean;
  flags: IntegrityFlags | Record<string, never>;
  typingEvents: TypingEvent[];
  grade: number | null;
  rubricScores: Record<string, number>;
  feedback: string;
  returnedAt: string | null;
}

// --- Phase 6: community ---

export type PostKind = "question" | "announcement";
export type ReportReason = "spam" | "abuse" | "cheating" | "off_topic" | "other";
export type ModerationAction = "hide" | "delete" | "warn" | "dismiss" | "restore";

export interface CommunityAuthor {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  role: Role;
}

export interface PostCard {
  id: string;
  kind: PostKind;
  title: string;
  excerpt: string;
  tags: string[];
  track: { id: string; slug: string; title: string } | null;
  score: number;
  answerCount: number;
  accepted: boolean;
  isPinned: boolean;
  myVote: number;
  author: CommunityAuthor;
  createdAt: string;
  lastActivityAt: string;
}

export interface CommunityFeed {
  total: number;
  page: number;
  pageSize: number;
  pinned: PostCard[];
  items: PostCard[];
}

export interface CommunityAnswer {
  id: string;
  body: string;
  codeSnippet: string | null;
  codeLanguage: string | null;
  score: number;
  isStaff: boolean;
  accepted: boolean;
  hidden: boolean;
  author: CommunityAuthor;
  createdAt: string;
  updatedAt: string;
  myVote: number;
  reportedByMe: boolean;
  isMine: boolean;
}

export interface CommunityPost {
  id: string;
  kind: PostKind;
  title: string;
  body: string;
  codeSnippet: string | null;
  codeLanguage: string | null;
  tags: string[];
  track: { id: string; slug: string; title: string } | null;
  score: number;
  answerCount: number;
  acceptedAnswerId: string | null;
  isPinned: boolean;
  hidden: boolean;
  author: CommunityAuthor;
  createdAt: string;
  updatedAt: string;
  myVote: number;
  reportedByMe: boolean;
  isMine: boolean;
  canAccept: boolean;
  canParticipate: boolean;
  assetUrls: Record<string, string>;
  answers: CommunityAnswer[];
}

export interface CommunityMe {
  canParticipate: boolean;
  isStaff: boolean;
  warnings: { id: string; reason: string; createdAt: string }[];
}

export interface ModerationGroup {
  targetType: "post" | "answer";
  targetId: string;
  postId: string;
  title: string;
  excerpt: string;
  author: PersonRef;
  hidden: boolean;
  deleted: boolean;
  reports: {
    id: string;
    reason: ReportReason;
    details: string;
    status: "open" | "resolved" | "dismissed";
    action: ModerationAction | null;
    note: string;
    createdAt: string;
    reporter: PersonRef;
  }[];
}

// ---------------------------------------------------------------------------
// Phase 7: Realtime Chat, Points, Leaderboard, Notifications
// ---------------------------------------------------------------------------

export type ConversationStatus = "waiting" | "open" | "closed";

export type PointReason =
  | "quiz_passed"
  | "assignment_on_time"
  | "accepted_answer"
  | "streak_7_days"
  | "live_class_attended"
  | "plagiarism_confirmed";

export type NotificationType =
  | "new_doubt"
  | "doubt_claimed"
  | "chat_reply"
  | "grade_returned"
  | "quiz_graded"
  | "payment_approved"
  | "payment_rejected"
  | "new_answer"
  | "answer_accepted"
  | "points"
  | "moderation_warning"
  | "live_class_soon";

export interface Conversation {
  id: string;
  studentId: string;
  mentorId: string | null;
  courseId: string;
  subject: string;
  status: ConversationStatus;
  lastMessageAt: string;
  studentLastReadAt: string | null;
  mentorLastReadAt: string | null;
  claimedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  student: PersonRef;
  mentor: PersonRef | null;
  course: { id: string; title: string; slug: string };
  lastMessage?: { id: string; body: string; createdAt: string; senderId: string };
  unreadCount?: number;
  isWithinOfficeHours?: boolean;
  mentorOfficeHoursNote?: string;
  messages?: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  attachmentKey: string | null;
  attachmentUrl?: string | null;
  createdAt: string;
  sender: PersonRef;
}

export interface OfficeHourSlot {
  id?: string;
  weekday: number; // 0 = Sun .. 6 = Sat
  startMinute: number; // 0 .. 1439
  endMinute: number;
}

export interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** GET /notifications: latest 30 items plus the total unread count. */
export interface NotificationList {
  items: NotificationItem[];
  unread: number;
}

export type NotificationPreferences =Partial<Record<NotificationType, boolean>>;

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  points: number;
  isMe: boolean;
}

export interface LeaderboardResponse {
  season: { key: string; startsAt: string; endsAt: string };
  track: { id: string; title: string; slug: string } | null;
  entries: LeaderboardEntry[];
  me: { rank: number; points: number } | null;
}

export interface StudentPointsSummary {
  season: string;
  seasonPoints: number;
  totalPoints: number;
  rank: number | null;
  recent: { id: string; reason: PointReason; points: number; createdAt: string }[];
}

// ---------------------------------------------------------------------------
// Phase 8: Live Classes & Attendance
// ---------------------------------------------------------------------------

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  durationMinutes: number;
  roomName?: string;
  hasRecording?: boolean;
  recordingKey?: string | null;
  recordingUrl?: string | null;
  canJoin?: boolean;
  attended?: boolean;
  course: { id: string; title: string; slug?: string };
  mentor: PersonRef;
  attendanceCount?: number;
  attendance?: { id: string; joinedAt: string; leftAt: string | null } | null;
}

export interface LiveSessionAttendance {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  joinedAt: string;
  leftAt: string | null;
  durationMinutes: number | null;
}

export interface LiveSessionDetail extends Omit<LiveSession, "attendance"> {
  attendance: LiveSessionAttendance[];
}

export interface LiveSessionRoom {
  id: string;
  title: string;
  roomName: string;
  domain: string;
  displayName: string;
}

