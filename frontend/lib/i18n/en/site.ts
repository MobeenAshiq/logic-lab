export const site = {
  hero: {
    badge: "7-day free trial · No card needed",
    headline: "Learn to code with real mentors, not just videos",
    secondaryCta: "Explore courses",
    primaryCta: "Start 7-Day Free Trial",
    imageAlt: "LogicLab interactive student learning dashboard preview",
    stats: [
      { value: "7 days", label: "Free trial" },
      { value: "Rs 0", label: "To get started" },
      { value: "1-on-1", label: "Mentor help" },
    ],
  },
  inside: {
    title: "Everything inside one account",
    items: [
      "Live classes",
      "Daily lessons",
      "Daily coding challenges",
      "AI tutor",
      "Python notebook",
      "Mentor chat",
      "Community Q&A",
      "Leaderboard",
    ],
  },
  tracks: {
    title: "Three tracks, one path",
    subtitle: "Start with logic building, then master full-stack web or dive into AI and data science.",
    courses: (n: number) => `${n} course${n === 1 ? "" : "s"}`,
    explore: "View track",
  },
  how: {
    title: "How it works",
    subtitle: "A proven, mentor-backed path from beginner to industry-ready engineer.",
    steps: [
      {
        title: "Sign up",
        body: "Create your free account in seconds. No credit card or upfront payment required.",
      },
      {
        title: "Free trial",
        body: "Get 7 full days of unrestricted access to all lessons, assignments, and mentor office hours.",
      },
      {
        title: "Learn with mentors",
        body: "Watch video lessons, solve coding challenges, and get 1-on-1 feedback whenever you are stuck.",
      },
      {
        title: "Climb the leaderboard",
        body: "Earn points for lessons, challenges and streaks, and watch your rank grow every week.",
      },
    ],
  },
  features: {
    title: "Everything you need to master programming",
    subtitle: "Built specifically for students who want real progress, not just another video playlist.",
    items: [
      {
        title: "Live Classes",
        description: "Interactive weekly sessions with mentors to discuss complex concepts and code live.",
        icon: "video",
      },
      {
        title: "Recorded Lectures",
        description: "Bite-sized, high-definition videos with timestamped notes, speed control, and resume tracking.",
        icon: "play",
      },
      {
        title: "Real-Time Quizzes",
        description: "Server-timed multiple-choice and conceptual quizzes to solidify your understanding instantly.",
        icon: "check",
      },
      {
        title: "Mentor Chat",
        description: "Ask questions right under the exact second of a lecture and get detailed mentor replies.",
        icon: "message",
      },
      {
        title: "AI Tutor",
        description: "Get personalized hints and error explanations without having the solution spoiled.",
        icon: "sparkles",
      },
      {
        title: "Community Q&A",
        description: "Discuss homework, share portfolio projects, and learn alongside ambitious peers.",
        icon: "users",
      },
    ],
  },
  leaderboard: {
    title: "Learning that feels like a game",
    subtitle: "Consistent effort is rewarded. Earn points for daily lessons, streaks, and top quiz scores.",
    rulesLink: "See the leaderboard",
    body: "Every lesson, quiz, challenge and daily streak earns points. Your rank updates live, so you always know how far you have come.",
  },
  mentors: {
    title: "Learn with real mentors",
    subtitle: "Industry engineers guiding you every step of the way.",
    body: "Every course is taught by active industry professionals who review your assignments and answer your questions directly.",
    points: [
      "1-on-1 code reviews on every assignment",
      "Typing replay inspection ensuring genuine code",
      "Weekly live office hours for deep-dive questions",
      "Tailored advice for Pakistani tech careers",
    ],
    imageAlt: "A mentor helping a student with code",
  },
  pricing: {
    title: "Simple, transparent pricing",
    subtitle: "Start free for 7 days. Pay in rupees with the local payment method you already use.",
    perDays: (days: number) => (days === 30 ? "/ month" : `/ ${days} days`),
    allTracks: "All tracks included",
    choose: "Get started",
    seeAll: "See all plans",
    empty: "New season plans will be announced soon. Start your 7-day free trial today!",
    trialNote: "Every new account starts with a 7-day free trial on one track.",
    methods: "Pay securely with EasyPaisa or JazzCash.",
  },
  faq: {
    title: "Frequently asked questions",
    subtitle: "Have questions? We have answers. Reach out on WhatsApp if you need anything else.",
  },
  testimonials: { title: "What students say" },
  cta: {
    title: "Start your 7-day free trial today",
    body: "No credit card needed. Pick a track and start building real programming logic in minutes.",
  },
  catalog: {
    title: "Courses",
    subtitle: "Every course, organised by track and difficulty.",
    allTracks: "All tracks",
    allLevels: "All levels",
    empty: "No courses here yet. Check back soon.",
    modules: (n: number) => `${n} module${n === 1 ? "" : "s"}`,
    lessons: (n: number) => `${n} lesson${n === 1 ? "" : "s"}`,
    mentors: "Mentors",
    curriculum: "Curriculum",
    locked: "Start your free trial to open the lessons.",
    open: "Open",
    minutes: (s: number) => `${Math.max(1, Math.round(s / 60))} min`,
  },
} as const;
