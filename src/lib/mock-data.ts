/**
 * Mock data layer.
 * Everything here mirrors the shape a real API would return, so swapping in a
 * backend later means replacing these exports with fetchers — no UI changes.
 */

export const rand = (value: number) =>
  new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(value);

export type Restaurant = {
  slug: string;
  name: string;
  city: string;
  cuisine: string;
  rating: number;
  reviewCount: number;
  signatureDish: string;
  accent: string;
};

export const demoRestaurant: Restaurant = {
  slug: "marble-jhb",
  name: "Marble",
  city: "Rosebank, Johannesburg",
  cuisine: "Wood-fired African grill",
  rating: 4.7,
  reviewCount: 3128,
  signatureDish: "Dry-aged Sirloin over open flame",
  accent: "#8c5a2b",
};

export const revenue = {
  yesterday: 12400,
  yesterdayChange: 8.4,
  weekForecast: 85000,
  monthToDate: 642300,
  recovered: 38200,
  covers: 214,
  averageCheck: 615,
};

export const revenueTrend = [
  { day: "Mon", revenue: 9800, forecast: 9200 },
  { day: "Tue", revenue: 7100, forecast: 8600 },
  { day: "Wed", revenue: 10400, forecast: 10100 },
  { day: "Thu", revenue: 12400, forecast: 11800 },
  { day: "Fri", revenue: 18600, forecast: 17900 },
  { day: "Sat", revenue: 21400, forecast: 20800 },
  { day: "Sun", revenue: 14200, forecast: 14000 },
];

export type Vip = {
  id: string;
  name: string;
  ltv: number;
  visits: number;
  time: string;
  party: number;
  note: string;
  favourite: string;
  tier: "VIP" | "Regular" | "At risk";
};

export const vipsTonight: Vip[] = [
  {
    id: "v1",
    name: "Thabo Mokoena",
    ltv: 45200,
    visits: 38,
    time: "19:00",
    party: 4,
    note: "Anniversary — proposed here in 2021.",
    favourite: "Rib-eye, medium rare · Kanonkop Pinotage",
    tier: "VIP",
  },
  {
    id: "v2",
    name: "Priya Naidoo",
    ltv: 50800,
    visits: 44,
    time: "19:30",
    party: 8,
    note: "Corporate host — books quarterly team dinners.",
    favourite: "Tasting menu · No shellfish",
    tier: "VIP",
  },
  {
    id: "v3",
    name: "Daniel van Wyk",
    ltv: 21400,
    visits: 19,
    time: "20:00",
    party: 2,
    note: "Always requests the window banquette.",
    favourite: "Lamb rump · Sauvignon Blanc",
    tier: "VIP",
  },
  {
    id: "v4",
    name: "Ayanda Dlamini",
    ltv: 18600,
    visits: 16,
    time: "20:45",
    party: 6,
    note: "Birthday table — sparkler on dessert last time.",
    favourite: "Sharing grill · Gin & tonic",
    tier: "VIP",
  },
];

export const segments = [
  { name: "VIP whales", count: 68, ltv: 41200, trend: "+6%", tone: "gold" },
  { name: "Regulars", count: 412, ltv: 8600, trend: "+2%", tone: "forest" },
  { name: "At risk (30d+)", count: 145, ltv: 5400, trend: "-9%", tone: "warning" },
  { name: "First-timers", count: 233, ltv: 1200, trend: "+18%", tone: "muted" },
];

export type Review = {
  id: string;
  author: string;
  rating: number;
  source: "Google" | "TripAdvisor" | "Facebook";
  time: string;
  body: string;
  draft: string;
  status: "Needs approval" | "Posted" | "Scheduled";
};

export const reviews: Review[] = [
  {
    id: "r1",
    author: "Sarah Bennett",
    rating: 1,
    source: "Google",
    time: "23:12 last night",
    body: "Waited 45 minutes for mains on a Tuesday. Food was good but the service killed the night.",
    draft:
      "Howzit Sarah — I'm really sorry about that wait, it's not the evening we wanted to give you. Tuesday's kitchen was short-staffed and that's on us. I'd love to have you back as my guest so we can show you how we normally run. Please reply here and I'll book it personally. — Warren, Owner",
    status: "Needs approval",
  },
  {
    id: "r2",
    author: "Lerato M.",
    rating: 5,
    source: "Google",
    time: "2 hours ago",
    body: "The sirloin over open flame is worth the drive from Pretoria. Staff remembered our names.",
    draft:
      "Thank you Lerato! Deon will be chuffed you noticed. That drive from Pretoria deserves a glass on us next time — just mention this review.",
    status: "Scheduled",
  },
  {
    id: "r3",
    author: "Johan Pretorius",
    rating: 3,
    source: "TripAdvisor",
    time: "Yesterday",
    body: "Great food, but parking was chaos and nobody warned us about the event next door.",
    draft:
      "Thanks for the honest note, Johan. You're right — we should be flagging event nights when you book. We've added a parking heads-up to our confirmation messages from this week.",
    status: "Needs approval",
  },
  {
    id: "r4",
    author: "Nadia K.",
    rating: 5,
    source: "Facebook",
    time: "2 days ago",
    body: "Booked on WhatsApp at 11pm and got an answer in seconds. Wild.",
    draft: "That's our AI host on duty — glad it made the booking easy. See you soon, Nadia!",
    status: "Posted",
  },
];

export const reputationStats = {
  rating: 4.7,
  ratingChange: 0.3,
  responseRate: 100,
  medianResponse: "4 min",
  recovered: 12,
};

export const competitors = [
  {
    name: "Nando's Rosebank",
    distance: "0.8 km",
    change: "Added 'Wings & Rings' combo at R129",
    time: "3 days ago",
    severity: "Watch",
  },
  {
    name: "The Grillhouse",
    distance: "1.4 km",
    change: "Raised sirloin price 12% to R385",
    time: "6 days ago",
    severity: "Opportunity",
  },
  {
    name: "Gemelli",
    distance: "2.1 km",
    change: "Launched bottomless Sunday brunch, R495pp",
    time: "1 week ago",
    severity: "Threat",
  },
];

export const opportunities = [
  {
    title: "No Sunday brunch within 5 km",
    score: 92,
    detail: "Estimated R8,000 incremental revenue on the first Sunday.",
  },
  {
    title: "Corporate lunch gap, Tue–Thu",
    score: 78,
    detail: "14 offices within 1 km, no set-menu lunch offer nearby.",
  },
  {
    title: "Wine pairing evenings",
    score: 64,
    detail: "Search demand up 31% in Rosebank over 90 days.",
  },
];

export type Campaign = {
  id: string;
  name: string;
  segment: string;
  audience: number;
  status: "Draft" | "Scheduled" | "Live" | "Complete";
  sent: number;
  replies: number;
  bookings: number;
  revenue: number;
  message: string;
};

export const campaigns: Campaign[] = [
  {
    id: "c1",
    name: "Tuesday Steak Rescue",
    segment: "At risk (30d+)",
    audience: 150,
    status: "Live",
    sent: 150,
    replies: 41,
    bookings: 12,
    revenue: 4800,
    message:
      "Howzit [Name]! We miss you. 15% off your favourite rib-eye this Tuesday. Reply 'BOOK' to claim.",
  },
  {
    id: "c2",
    name: "VIP Winter Tasting",
    segment: "VIP whales",
    audience: 68,
    status: "Scheduled",
    sent: 0,
    replies: 0,
    bookings: 0,
    revenue: 0,
    message:
      "[Name], we're doing a six-course winter tasting on the 12th. Holding two seats for you until Friday.",
  },
  {
    id: "c3",
    name: "First-timer follow-up",
    segment: "First-timers",
    audience: 233,
    status: "Complete",
    sent: 233,
    replies: 88,
    bookings: 34,
    revenue: 19600,
    message: "Thanks for joining us, [Name]. Here's a complimentary starter on your next visit.",
  },
];

export type Conversation = {
  id: string;
  name: string;
  channel: "WhatsApp" | "Instagram" | "Email" | "Facebook";
  preview: string;
  time: string;
  status: "AI Draft" | "Sent" | "Failed" | "Needs approval";
  intent: "Booking" | "Complaint" | "FAQ" | "Catering";
  unread: boolean;
  messages: { from: "guest" | "ai" | "staff"; body: string; time: string }[];
};

export const conversations: Conversation[] = [
  {
    id: "m1",
    name: "Kabelo Sithole",
    channel: "WhatsApp",
    preview: "Table for 2 tonight?",
    time: "2 min",
    status: "Sent",
    intent: "Booking",
    unread: true,
    messages: [
      { from: "guest", body: "Table for 2 tonight?", time: "18:02" },
      {
        from: "ai",
        body: "Howzit! I have a lovely table by the window at 19:00. Shall I book it?",
        time: "18:02",
      },
      { from: "guest", body: "Perfect, book it 🙏", time: "18:04" },
      {
        from: "ai",
        body: "Done — 19:00 for two, under Kabelo. See you tonight!",
        time: "18:04",
      },
    ],
  },
  {
    id: "m2",
    name: "Sarah Bennett",
    channel: "Instagram",
    preview: "We waited 45 minutes on Tuesday…",
    time: "22 min",
    status: "Needs approval",
    intent: "Complaint",
    unread: true,
    messages: [
      { from: "guest", body: "We waited 45 minutes on Tuesday and nobody checked on us.", time: "17:41" },
      {
        from: "ai",
        body: "Draft: I'm really sorry Sarah — that's not our standard. I'd like to host you personally to make it right. Can I book you in this week?",
        time: "17:41",
      },
    ],
  },
  {
    id: "m3",
    name: "Zandile Khumalo",
    channel: "WhatsApp",
    preview: "Do you cater for 40 people?",
    time: "1 hr",
    status: "AI Draft",
    intent: "Catering",
    unread: false,
    messages: [
      { from: "guest", body: "Do you cater for 40 people on a Saturday?", time: "16:55" },
      {
        from: "ai",
        body: "Draft: We do! Our private room seats 40 with a set menu from R395pp. Want me to hold a date?",
        time: "16:55",
      },
    ],
  },
  {
    id: "m4",
    name: "Andrew Fields",
    channel: "Email",
    preview: "Corporate account invoicing",
    time: "3 hrs",
    status: "Sent",
    intent: "FAQ",
    unread: false,
    messages: [
      { from: "guest", body: "Can we set up monthly invoicing for our team dinners?", time: "14:20" },
      {
        from: "ai",
        body: "Absolutely — I've sent the corporate account form to this address. Kevin will confirm within a day.",
        time: "14:21",
      },
    ],
  },
  {
    id: "m5",
    name: "Michelle du Toit",
    channel: "Facebook",
    preview: "Are you open on the public holiday?",
    time: "5 hrs",
    status: "Failed",
    intent: "FAQ",
    unread: false,
    messages: [
      { from: "guest", body: "Are you open on the public holiday?", time: "12:10" },
      { from: "ai", body: "Delivery failed — channel token expired.", time: "12:10" },
    ],
  },
];

export const plans = [
  {
    name: "Starter",
    price: 499,
    target: "Takeaways & cafés",
    highlight: "AI Inbox on WhatsApp",
    features: [
      "AI Inbox (WhatsApp only)",
      "500 AI messages / month",
      "Booking capture & confirmations",
      "1 location, 2 staff seats",
    ],
  },
  {
    name: "Casual",
    price: 1499,
    target: "Casual dining",
    highlight: "Reputation + segmentation",
    features: [
      "Everything in Starter",
      "2,000 AI messages / month",
      "Reputation management & AI replies",
      "Customer segmentation & VIP alerts",
    ],
  },
  {
    name: "Premium",
    price: 3999,
    target: "Full service",
    highlight: "Marketing on autopilot",
    popular: true,
    features: [
      "Everything in Casual",
      "10,000 AI messages / month",
      "Marketing automation & campaigns",
      "Market intelligence & competitor radar",
    ],
  },
  {
    name: "Signature",
    price: 7999,
    target: "Fine dining",
    highlight: "Magic Link onboarding",
    features: [
      "Everything in Premium",
      "Magic Link branded onboarding",
      "Multi-channel: IG, FB, email",
      "Approval workflows & staff roles",
    ],
  },
  {
    name: "Group",
    price: 19999,
    target: "Multi-location",
    highlight: "Cross-location control",
    features: [
      "Everything in Signature",
      "Unlimited locations & analytics",
      "API access & data exports",
      "Dedicated success manager",
    ],
  },
];
