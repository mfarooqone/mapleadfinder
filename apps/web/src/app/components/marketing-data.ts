export type MarketingReview = {
  id: string;
  name: string;
  role: string;
  company: string;
  rating: number;
  quote: string;
  avatar: string;
};

/** @deprecated Use MarketingReview */
export type DashboardReview = MarketingReview;

export type LeaderboardEntry = {
  rank: number;
  name: string;
  leads: number;
  replies: number;
  trend: string;
};

export type LandingFeature = {
  id: string;
  icon: string;
  title: string;
  description: string;
};

export type LandingStep = {
  step: number;
  title: string;
  description: string;
};

export type LandingPricingTier = {
  id: string;
  name: string;
  price: number;
  period: string;
  note?: string;
  description: string;
  features: string[];
  highlighted?: boolean;
  cta: string;
};

export type LandingFaqItem = {
  question: string;
  answer: string;
};

export const TRUST_STATS = {
  users: "12,400+",
  leadsScraped: "2.8M+",
  messagesSent: "890K+",
  avgRating: "4.9",
};

export const TRUSTED_COMPANIES = [
  "Al Kasir Scrap",
  "Gulf Metals",
  "SteelHub KSA",
  "Desert Logistics",
  "Riyadh Traders",
  "Emirates B2B",
];

const BASE_REVIEWS: MarketingReview[] = [
  {
    id: "1",
    name: "Ahmed Al-Rashid",
    role: "Sales Director",
    company: "Gulf Metals Trading",
    rating: 5,
    quote:
      "MapLeadFinder cut our prospecting time in half. Google Maps scrape + WhatsApp outreach in one place — exactly what our team needed.",
    avatar: "AR",
  },
  {
    id: "2",
    name: "Sarah Mitchell",
    role: "Growth Lead",
    company: "ScaleUp Agency",
    rating: 5,
    quote:
      "We replaced three tools with this dashboard. The warm-up flow keeps our WhatsApp accounts safe while we scale outreach.",
    avatar: "SM",
  },
  {
    id: "3",
    name: "Omar Hassan",
    role: "Founder",
    company: "Desert Logistics",
    rating: 5,
    quote:
      "Found 400+ local businesses in Riyadh in one afternoon. Reply rates went up 3x after using templates and pacing.",
    avatar: "OH",
  },
  {
    id: "4",
    name: "Fatima Khan",
    role: "BD Manager",
    company: "SteelHub KSA",
    rating: 4,
    quote:
      "Clean UI, fast scraper, and the inbox view makes follow-ups easy. Best lead finder we've tried for MENA markets.",
    avatar: "FK",
  },
  {
    id: "5",
    name: "James Okonkwo",
    role: "Outbound Lead",
    company: "Nairobi Growth Co",
    rating: 5,
    quote:
      "The Google Maps scraper pulls phone numbers we actually reach on WhatsApp. CSV export and filters feel like Apollo, but built for local businesses.",
    avatar: "JO",
  },
  {
    id: "6",
    name: "Layla Mansour",
    role: "Marketing Manager",
    company: "Dubai B2B Hub",
    rating: 5,
    quote:
      "Voice notes, bulk campaigns, and inbox in one dashboard. Our team stopped juggling five different apps for lead gen.",
    avatar: "LM",
  },
];

export const DASHBOARD_REVIEWS = BASE_REVIEWS.slice(0, 4);
export const LANDING_REVIEWS = BASE_REVIEWS;

export const LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "Farooq", leads: 2840, replies: 412, trend: "+24%" },
  { rank: 2, name: "Khalil", leads: 1920, replies: 318, trend: "+18%" },
  { rank: 3, name: "Rehman", leads: 1650, replies: 276, trend: "+12%" },
  { rank: 4, name: "Saud", leads: 980, replies: 154, trend: "+9%" },
];

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: "scraper",
    icon: "MapPinned",
    title: "Google Maps Scraper",
    description:
      "Search by keyword and city. Pull business names, phones, ratings, and websites automatically.",
  },
  {
    id: "database",
    icon: "Database",
    title: "Lead Database",
    description:
      "Filter, tag, and export contacts. CSV import and unified list for scraper + manual leads.",
  },
  {
    id: "whatsapp",
    icon: "MessageSquare",
    title: "WhatsApp Campaigns",
    description:
      "Bulk send with templates, pacing, and warm-up guards to protect your business number.",
  },
  {
    id: "warmup",
    icon: "Shield",
    title: "Warm-up & Anti-block",
    description:
      "Engaged-only sends, delay caps, and wa.me warm-up links — built for safe outreach at scale.",
  },
  {
    id: "email",
    icon: "Mail",
    title: "Email Outreach",
    description:
      "SMTP bulk send, mailbox sync, and AI-assisted drafts alongside your WhatsApp flows.",
  },
  {
    id: "inbox",
    icon: "Inbox",
    title: "Inbox & Templates",
    description:
      "Track replies in one place. Save approved message templates for consistent campaigns.",
  },
];

export const LANDING_STEPS: LandingStep[] = [
  {
    step: 1,
    title: "Scrape local leads",
    description: "Run a Google Maps job by niche and location. Leads land in your database in minutes.",
  },
  {
    step: 2,
    title: "Enrich & filter",
    description: "Keep contactable numbers, tag categories, and export CSV for your team.",
  },
  {
    step: 3,
    title: "Message at scale",
    description: "Connect WhatsApp, warm up contacts, then send bulk campaigns with smart pacing.",
  },
  {
    step: 4,
    title: "Close in the inbox",
    description: "Reply from the unified inbox. Track conversations and follow up until they convert.",
  },
];

export const LANDING_PRICING: LandingPricingTier[] = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    period: "forever",
    description: "For solo reps testing local outreach.",
    features: [
      "500 leads / month",
      "Google Maps scraper",
      "1 WhatsApp number",
      "Basic templates",
      "Email support",
    ],
    cta: "Start free",
  },
  {
    id: "pro",
    name: "Pro",
    price: 20,
    period: "lifetime",
    note: "One-time payment",
    description: "For daily lead generation and outreach.",
    highlighted: true,
    features: [
      "Unlimited leads",
      "Bulk WhatsApp + voice",
      "Warm-up & pacing controls",
      "Email outreach + SMTP",
      "Priority support",
      "Unified inbox",
    ],
    cta: "Get lifetime access",
  },
];

export const LANDING_FAQ: LandingFaqItem[] = [
  {
    question: "Is WhatsApp bulk sending safe?",
    answer:
      "MapLeadFinder includes warm-up mode, pacing delays, engaged-only filters, and daily caps — designed to reduce block risk. Always follow WhatsApp's terms and local regulations.",
  },
  {
    question: "How does the Google Maps scraper work?",
    answer:
      "Enter a business keyword and location. Our Playwright-powered scraper collects listings from Google Maps and saves them to your lead database with phone, rating, and address.",
  },
  {
    question: "Can I use more than one WhatsApp number?",
    answer:
      "Each login maps to one WhatsApp number and scoped data. Create a separate login when you need another number.",
  },
  {
    question: "Do you support email outreach too?",
    answer:
      "Yes. Configure SMTP, send bulk email campaigns, and manage a synced mailbox alongside WhatsApp — all from the same dashboard.",
  },
  {
    question: "What countries work best for scraping?",
    answer:
      "Google Maps coverage is global. Teams in MENA, South Asia, and Europe see strong results for local B2B niches like scrap, logistics, and trades.",
  },
  {
    question: "Can I import my own contact list?",
    answer:
      "Upload CSV contacts or add manually. They merge with scraped leads in one unified database with opt-in and warm-up status.",
  },
];

export type OnboardingStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  done: boolean;
};

export function buildOnboardingSteps({
  connected,
  leadsCount,
  templatesCount,
  conversationsCount,
}: {
  connected: boolean;
  leadsCount: number;
  templatesCount: number;
  conversationsCount: number;
}): OnboardingStep[] {
  return [
    {
      id: "whatsapp",
      label: "Connect WhatsApp",
      description: "Scan QR and link your business number",
      href: "/dashboard/whatsapp/setup",
      done: connected,
    },
    {
      id: "scrape",
      label: "Scrape your first leads",
      description: "Pull businesses from Google Maps by keyword",
      href: "/dashboard/scraper",
      done: leadsCount > 0,
    },
    {
      id: "template",
      label: "Create a message template",
      description: "Save approved copy for bulk outreach",
      href: "/dashboard/templates",
      done: templatesCount > 0,
    },
    {
      id: "send",
      label: "Send your first campaign",
      description: "Warm up contacts and start conversations",
      href: "/dashboard/whatsapp",
      done: conversationsCount > 0,
    },
  ];
}

export function buildPipelineStages({
  leadsCount,
  optedInCount,
  conversationsCount,
  engagedCount,
}: {
  leadsCount: number;
  optedInCount: number;
  conversationsCount: number;
  engagedCount: number;
}) {
  const scraped = Math.max(leadsCount, 1);
  return [
    {
      label: "Scraped",
      value: leadsCount,
      pct: 100,
      color: "bg-sky-500",
    },
    {
      label: "Contactable",
      value: optedInCount,
      pct: Math.round((optedInCount / scraped) * 100),
      color: "bg-teal-500",
    },
    {
      label: "Messaged",
      value: conversationsCount,
      pct: Math.round((conversationsCount / scraped) * 100),
      color: "bg-amber-500",
    },
    {
      label: "Engaged",
      value: engagedCount,
      pct: Math.round((engagedCount / scraped) * 100),
      color: "bg-emerald-500",
    },
  ];
}
