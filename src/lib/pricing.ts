/** Public launch offer. Higher-volume plans are staged until capacity is verified. */
export const TRIAL_DAYS = 7;
export const plans = [
  {
    name: "Starter",
    price: 999,
    target: "First two pilot venues",
    highlight: "Pilot enrolment",
    popular: false,
    features: [
      "One venue and one WhatsApp number",
      "500 service replies per month; pilot cap 25 per day",
      "Menu and hours enquiries, booking-request capture",
      "Inbox and human handoff after activation checks",
    ],
  },
  {
    name: "Growth",
    price: 1500,
    target: "Subject to capacity approval",
    highlight: "Coming after pilot acceptance",
    popular: false,
    features: [
      "One venue and one WhatsApp number",
      "Proposed allowance: 1,000 service replies per month",
      "Loyalty, VIP and reporting only after acceptance",
      "Contact us before choosing this plan",
    ],
  },
  {
    name: "Pro",
    price: 2900,
    target: "Subject to capacity approval",
    highlight: "Coming after pilot acceptance",
    popular: false,
    features: [
      "One venue and one WhatsApp number",
      "Proposed allowance: 2,500 service replies per month",
      "Team controls and reporting only after acceptance",
      "Contact us before choosing this plan",
    ],
  },
];

/** Shown before a customer agrees to paid messaging usage. */
export const MESSAGE_USAGE_FEE_NOTICE =
  "Your plan includes a monthly volume of WhatsApp messaging. Additional messaging may carry usage charges. Any extra usage and its rates must be agreed before activation. No automatic overage charges during the pilot.";
