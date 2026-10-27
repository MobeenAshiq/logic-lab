// All user-facing strings live here so Urdu (ur.ts) can be added later.

export const en = {
  errors: {
    VALIDATION_FAILED: 'Some fields are invalid.',
    UNAUTHENTICATED: 'Please log in to continue.',
    SESSION_EXPIRED: 'Your session has expired. Please log in again.',
    SESSION_REVOKED_DEVICE_LIMIT:
      'You were signed out because your account was used on another device.',
    INVALID_CREDENTIALS: 'Incorrect email or password.',
    EMAIL_NOT_VERIFIED:
      'Please verify your email before logging in. We can send you a new code.',
    EMAIL_TAKEN: 'An account with this email already exists. Please log in.',
    INVALID_CODE: 'The code is incorrect or has expired.',
    INVALID_RESET_TOKEN: 'This reset link is invalid or has expired.',
    ACCOUNT_BANNED: 'Your account has been suspended.',
    FORBIDDEN_ROLE: 'You do not have access to this page.',
    MFA_SETUP_REQUIRED: 'Set up two-factor authentication to open your portal.',
    MFA_VERIFY_REQUIRED: 'Enter your two-factor authentication code.',
    MFA_ALREADY_ENABLED: 'Two-factor authentication is already enabled.',
    MFA_NOT_SET_UP: 'Start two-factor setup first.',
    RATE_LIMITED: 'Too many attempts. Please try again later.',
    GOOGLE_NOT_CONFIGURED: 'Google login is not available right now.',
    GOOGLE_EMAIL_NOT_VERIFIED: 'Your Google email address is not verified.',
    OAUTH_STATE_MISMATCH: 'Login request expired. Please try again.',
    USER_NOT_FOUND: 'User not found.',
    CANNOT_CHANGE_SELF: 'You cannot change your own role or status.',
    SUPER_ADMIN_ONLY: 'Only a super admin can do this.',
    STORAGE_NOT_CONFIGURED: 'File uploads are not available right now.',
    TRACK_NOT_FOUND: 'Track not found.',
    COURSE_NOT_FOUND: 'Course not found.',
    MODULE_NOT_FOUND: 'Module not found.',
    LESSON_NOT_FOUND: 'Lesson not found.',
    SLUG_TAKEN: 'This URL slug is already used.',
    INVALID_ORDER:
      'The new order must list every item of this parent exactly once.',
    TRACK_HAS_COURSES: 'Move or delete the courses in this track first.',
    UNPUBLISH_BEFORE_DELETE: 'Unpublish this item before deleting it.',
    NOT_A_MENTOR: 'Only users with the mentor role can be assigned.',
    INVALID_UNLOCK_MODULE:
      'The unlock module must be another module of the same course, without loops.',
    UNKNOWN_SITE_CONTENT: 'Unknown site content block.',
    TRIAL_ALREADY_USED:
      'The free trial has already been used for this email or Google account.',
    PLAN_NOT_FOUND: 'This plan is not available.',
    INVALID_COUPON: 'This coupon code is invalid or has expired.',
    COUPON_CODE_TAKEN: 'A coupon with this code already exists.',
    DUPLICATE_TRANSACTION_ID:
      'This transaction ID has already been submitted. Check the ID on your receipt.',
    PAYMENT_ALREADY_PENDING:
      'You already have a payment waiting for review. Please wait for it to be checked.',
    SLIP_NOT_UPLOADED: 'Upload the payment slip first.',
    PAYMENT_NOT_FOUND: 'Payment not found.',
    PAYMENT_ALREADY_REVIEWED: 'This payment has already been reviewed.',
    INVOICE_NOT_FOUND: 'Invoice not found.',
    SUBSCRIPTION_REQUIRED:
      'Your access has ended or does not include this course. Choose a plan to continue.',
    UNKNOWN_SETTING: 'Unknown setting.',
    MODULE_LOCKED: 'Finish the previous module to unlock this lesson.',
    NOT_COURSE_MENTOR: 'You are not a mentor of this course.',
    QUESTION_NOT_FOUND: 'Question not found.',
    ATTACHMENT_NOT_FOUND: 'File not found.',
    VIDEO_NOT_UPLOADED: 'This lesson has no video yet.',
    UPLOAD_NOT_FINISHED: 'The upload did not finish. Please try again.',
    INVALID_UPLOAD_KEY: 'This upload does not belong to this lesson.',
    NOT_A_VIDEO_LESSON: 'Only video lessons can have a video.',
    NOT_A_QUIZ_LESSON: 'This lesson is not a quiz.',
    NOT_AN_ASSIGNMENT_LESSON: 'This lesson is not an assignment.',
    QUESTION_NOT_IN_COURSE:
      'Questions must come from this course’s question bank.',
    QUESTION_IN_USE:
      'This question is used in a quiz. Remove it from the quiz first.',
    BANK_QUESTION_NOT_FOUND: 'Question not found.',
    QUIZ_NOT_READY: 'This quiz has no questions yet.',
    QUIZ_NOT_OPEN: 'This quiz is not open yet.',
    QUIZ_CLOSED: 'This quiz has closed.',
    NO_ATTEMPTS_LEFT: 'You have used all your attempts for this quiz.',
    ATTEMPT_NOT_FOUND: 'Quiz attempt not found.',
    ATTEMPT_CLOSED: 'Time is up. Your answers were submitted.',
    INVALID_ANSWER: 'This answer does not match the question.',
    ASSIGNMENT_ALREADY_SUBMITTED: 'You have already submitted this assignment.',
    SUBMISSION_NOT_FOUND: 'Submission not found.',
    NOT_SUBMITTED: 'This work has not been submitted yet.',
    SCORE_TOO_HIGH: 'A score is higher than the points available.',
    MISSING_SCORES: 'Score every rubric criterion (or every written answer).',
    POST_NOT_FOUND: 'Post not found.',
    ANSWER_NOT_FOUND: 'Answer not found.',
    COMMUNITY_ACCESS_REQUIRED:
      'Start your free trial or choose a plan to post, answer and vote in the community.',
    STAFF_ONLY_ANNOUNCEMENT: 'Only mentors and admins can post announcements.',
    CANNOT_VOTE_OWN: 'You cannot vote on your own post or answer.',
    CANNOT_REPORT_OWN: 'You cannot report your own post or answer.',
    ALREADY_REPORTED:
      'You have already reported this. Our team will review it.',
    NOT_ALLOWED_TO_ACCEPT:
      'Only the person who asked or a mentor can accept an answer.',
    NOT_YOUR_CONTENT: 'You can only edit or delete your own posts and answers.',
    INVALID_IMAGE_REF: 'Images must be uploaded with the image button.',
    NOT_AN_ANSWER_OF_POST: 'This answer belongs to a different post.',
    CONVERSATION_NOT_FOUND: 'Conversation not found.',
    CONVERSATION_CLOSED: 'This conversation is closed.',
    ALREADY_CLAIMED: 'Another mentor already picked up this doubt.',
    NOT_CONVERSATION_MEMBER: 'You are not part of this conversation.',
    LIVE_SESSION_NOT_FOUND: 'Live session not found.',
    TOO_EARLY_FOR_LIVE_SESSION:
      'The live class will open 10 minutes before the scheduled start time.',
    NOT_SESSION_MENTOR: 'You are not the mentor of this live class.',
    RECORDING_NOT_UPLOADED:
      'No recording has been uploaded for this session yet.',
  },
  email: {
    verifySubject: 'Your LogicLab verification code',
    verifyBody: (name: string, code: string) =>
      `Hi ${name || 'there'},\n\nYour LogicLab verification code is ${code}. It expires in 10 minutes.\n\nIf you did not sign up, you can ignore this email.`,
    resetSubject: 'Reset your LogicLab password',
    resetBody: (name: string, link: string) =>
      `Hi ${name || 'there'},\n\nReset your password using this link (valid for 30 minutes):\n${link}\n\nIf you did not ask for this, you can ignore this email.`,
    openInApp: 'Open in Logic Lab',
    invoiceSubject: (invoiceNo: string) =>
      `Payment approved: invoice ${invoiceNo}`,
    invoiceBody: (name: string, invoiceNo: string) =>
      `Hi ${name || 'there'},\n\nYour payment has been approved and your LogicLab access is now active. Your invoice ${invoiceNo} is attached.\n\nHappy learning!`,
    paymentRejectedSubject: 'Your LogicLab payment could not be verified',
    paymentRejectedBody: (name: string, reason: string, link: string) =>
      `Hi ${name || 'there'},\n\nWe could not verify your payment.\nReason: ${reason}\n\nPlease upload a correct slip here: ${link}`,
    expirySubject: (days: number) =>
      `Your LogicLab access ends in ${days} day${days === 1 ? '' : 's'}`,
    expiryBody: (name: string, days: number, endsAt: Date, link: string) =>
      `Hi ${name || 'there'},\n\nYour LogicLab access ends in ${days} day${days === 1 ? '' : 's'} (${endsAt.toDateString()}). Renew here to keep learning: ${link}`,
  },
  notifications: {
    newDoubt: (course: string) => `New doubt in ${course}`,
    doubtClaimed: (mentor: string) =>
      `${mentor || 'A mentor'} picked up your doubt`,
    chatReply: (name: string) => `New message from ${name || 'your mentor'}`,
    gradeReturned: (lesson: string) => `Your assignment "${lesson}" was graded`,
    quizGraded: (lesson: string) => `Your quiz "${lesson}" was graded`,
    paymentApproved: 'Payment approved: your access is active',
    paymentRejected: 'Your payment could not be verified',
    newAnswer: (title: string) => `New answer on "${title}"`,
    answerAccepted: (title: string) => `Your answer on "${title}" was accepted`,
    liveClassSoon: (title: string) =>
      `Live class "${title}" starts in 30 minutes`,
    points: (n: number, reason: string) =>
      `${n > 0 ? '+' : ''}${n} points: ${reason}`,
    warning: 'A message from the moderators',
    pointReasons: {
      quiz_passed: 'quiz passed',
      assignment_on_time: 'assignment submitted on time',
      accepted_answer: 'answer accepted',
      streak_7_days: '7-day learning streak',
      live_class_attended: 'live class attended',
      plagiarism_confirmed: 'plagiarism confirmed',
    },
  },
  invoice: {
    title: 'INVOICE',
    paid: 'PAID',
    billedTo: 'Billed to',
    plan: 'Plan',
    period: 'Access period',
    price: 'Price',
    discount: 'Discount',
    total: 'Total paid',
    method: 'Payment method',
    transactionId: 'Transaction ID',
    footer: 'Thank you for learning with LogicLab.',
  },
  messages: {
    CODE_SENT: 'If the account needs verification, a new code has been sent.',
    RESET_SENT:
      'If an account exists for this email, a reset link has been sent.',
    PASSWORD_RESET: 'Your password has been changed. Please log in.',
    LOGGED_OUT: 'You have been logged out.',
  },
} as const;

export type ErrorCode = keyof typeof en.errors;
export type MessageCode = keyof typeof en.messages;

export const t = en;
