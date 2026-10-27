export const site = {
  hero: {
    badge: "7-day free trial · No card needed",
    secondaryCta: "Browse courses",
    imageAlt: "Students learning together on their laptops",
    stats: [
      { value: "3", label: "Tracks" },
      { value: "7 days", label: "Free trial" },
      { value: "PKR", label: "Local payments" },
    ],
  },
  programs: {
    title: "Our programs",
    subtitle: "Pick a path and start building real projects from day one.",
    alts: {
      web: "Web Development course: HTML, CSS, JavaScript and real-world projects",
      ai: "AI / Machine Learning course: build intelligent systems with Python",
      data: "Data Science course: data analysis and visualization with Python",
    },
  },
  mentors: {
    title: "Learn with real mentors",
    body: "Every course is taught by mentors who answer your questions right under the lesson, at the exact second of the video you are stuck on.",
    points: [
      "Hands-on projects in every module",
      "Beginner friendly, step by step",
      "Real datasets and real web apps",
      "Track your progress, streak and time",
    ],
    imageAlt: "A mentor helping a student at a laptop",
  },
  tracks: {
    title: "Three tracks, one path",
    subtitle: "Start with logic, then build for the web or dive into AI.",
    courses: (n: number) => `${n} course${n === 1 ? "" : "s"}`,
    explore: "Explore",
  },
  how: {
    title: "How it works",
    steps: [
      {
        title: "Start your free trial",
        body: "Sign up and pick a track. You get 7 days of full access, no payment needed.",
      },
      {
        title: "Learn with mentors",
        body: "Watch lessons, practice daily and ask mentors when you are stuck.",
      },
      {
        title: "Pay your way",
        body: "Continue with EasyPaisa, JazzCash or a bank transfer. Upload your slip and we activate your plan.",
      },
    ],
  },
  pricing: {
    title: "Simple pricing",
    subtitle: "Start free for 7 days. Pay in rupees with the method you already use.",
    perDays: (days: number) => (days === 30 ? "/ month" : `/ ${days} days`),
    allTracks: "All tracks",
    choose: "Get started",
    seeAll: "See all plans",
    empty: "Plans will be announced soon.",
    trialNote: "Every new account starts with a 7-day free trial on one track.",
    methods: "Pay with EasyPaisa, JazzCash or bank transfer.",
  },
  faq: { title: "Frequently asked questions" },
  testimonials: { title: "What students say" },
  cta: {
    title: "Ready to start?",
    body: "Pick a track and learn free for 7 days.",
  },
  catalog: {
    title: "Courses",
    subtitle: "Every course, organised by track.",
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
