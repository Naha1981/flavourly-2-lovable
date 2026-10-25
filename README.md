# Flavourly Magic

build me this app called flavourly. dont make it look ai genratedat all. must be clean, smooth, easy to usse by busy teams, clean, proffessional, restaurant optimized. only build the landing page, onboarding screens, auth screens and all other pages and screens for now. dont use lovable cloud yet. use my logo as it is. i want you to build something ready to plug in a backend. make this app premium: this app must sell itself. its a web app but optimize it for mobile and all other devices: # FLAVOURLY: PRODUCT REQUIREMENTS DOCUMENT (PRD)

**Version:** 3.0 (The "Magic Link" & "Brand Intelligence" Edition)

**Status:** Production-Ready / Sales-Optimized

**Product Owner:** NahaLabs

**Last Updated:** August 27, 2026

---

## 1. EXECUTIVE SUMMARY: THE PROMISE

**Flavourly is not a dashboard. It is an AI Revenue Employee.**

For the South African restaurant owner working 70-hour weeks, Flavourly is the silent partner that answers the phone at 2 AM, remembers every VIP's favorite wine, and fills empty tables on Tuesdays—all while the owner is in the kitchen.

**The Core Promise:** *"Your restaurant, fully booked. While you cook."*

**The Business Model:** A 5-tier SaaS subscription (R499 – R19,999/mo) powered by a "Magic Link" sales engine that pre-configures the app with the prospect's own branding, menu, and reviews before they even sign up.

---

## 2. DESIGN SYSTEM & BRAND IDENTITY

*Inspired by "Google Stitch" – Premium, Light-First, Data-Rich.*

### 2.1 Visual Philosophy

*   **Light Mode Default:** The app opens to a warm, inviting cream/white canvas, not a dark "hacker" screen. It feels like a high-end menu, not a terminal.

*   **Typography:**

    *   **Headings:** *Playfair Display* (Serif) – Elegant, authoritative, evocative of fine dining menus.

    *   **Body:** *Inter* (Sans-Serif) – Clean, legible, optimized for data density and mobile readability.

*   **Color Palette:**

    *   **Background:** Warm Cream (`#fff8f0`)

    *   **Surface:** Pure White (`#ffffff`) with soft beige containers (`#f5eddf`).

    *   **Primary (Gold):** Deep Gold (`#735c00`) for CTAs and accents.

    *   **Secondary (Green):** Forest Green (`#316948`) for success states and revenue.

    *   **Text:** Charcoal (`#1f1b13`) for high contrast readability.

*   **Logo:** The transparent Flavourly mark (Fork & Leaf) in deep green/gold. It sits cleanly on white headers without a "box" around it.

### 2.2 UI Components (The "Bento" Grid)

*   **Glass Cards:** Semi-transparent white cards (`bg-white/90`) with subtle backdrop blur and soft borders.

*   **Rounded Corners:** Generous radii (`rounded-xl`, `rounded-2xl`) for a friendly, modern feel.

*   **Material Symbols:** Thin-weight icons (wght 200-300) for a sophisticated, non-cluttered look.

*   **Mobile-First:** Every screen is designed for a phone screen first (bottom navigation), then scaled up to desktop (sidebar navigation).

---

## 3. THE USER JOURNEY: THE "5-MINUTE MIRACLE"

### 3.1 The Magic Link (The Sales Experience)

*Before the user even signs up, they experience the product.*

1.  **The Pitch:** You (Super Admin) upload a CSV of 100 prospects (e.g., "Marble", "SUD", "Gemelli").

2.  **The Engine:** Flavourly's **Brand Intelligence Engine** (using Firecrawl/ScrapeGraphAI) automatically scrapes their website for logos, colors, fonts, menus, and Google reviews.

3.  **The Link:** You send a magic link: `flavourly.app/claim/marble-jhb`.

4.  **The "Wow" Moment:** The prospect opens the link on their phone. They don't see a generic demo. They see **Marble's logo**, **Marble's wood-fired menu**, and **Marble's 5-star reviews** already inside the Flavourly dashboard.

5.  **The Close:** A big gold button: **"Claim Your App"**. They click, sign up, and the demo tenant flips to a live 14-day trial.

### 3.2 Onboarding (The Setup)

*   **Step 1: Profile:** Name, Hours, Average Check. (Feeds the AI context).

*   **Step 2: Connect WhatsApp:** Scan QR code. (The pipe is open).

*   **Step 3: The Test:** Owner sends "Table for 2 tonight?" from their personal phone.

*   **Step 4: The Magic:** AI replies in 3 seconds: *"Howzit! I have a lovely table by the window at 19:00. Shall I book it?"*

*   **Result:** Time-to-value < 5 minutes. The owner is hooked.

---

## 4. THE 6 ENGINES OF REVENUE (Features & Screens)

Every screen must answer: **"How does this make me money?"**

### ENGINE 1: REVENUE INTELLIGENCE

*   **Screen:** `/dashboard` (The Morning Coffee View)

*   **The View:**

    *   **Hero Card:** "Yesterday's Verified Revenue: R12,400" (Sourced from PayFast webhooks).

    *   **Trend:** "Tuesday is trending 15% below average. Launch a campaign?"

    *   **Forecast:** "Expected this week: R85,000".

*   **The Button:** "Generate Tuesday Campaign" (One-tap marketing).

*   **Money Proof:** Shows *real* bank-verified money, not just "bookings".

### ENGINE 2: CUSTOMER SEGMENTATION (The VIP Engine)

*   **Screen:** `/dashboard/customers/vip-today`

*   **The View:**

    *   **Gold Cards:** "Thabo Mokoena (VIP, R45k LTV) is dining tonight at 19:00."

    *   **Action:** "Send Welcome Message" / "Comp Dessert".

*   **The Logic:** AI scans bookings against the customer database. Identifies whales.

*   **Money Proof:** "VIPs spend 3.5x more. You have 4 VIPs tonight. Potential revenue: R12,000."

### ENGINE 3: REPUTATION MANAGEMENT (The Shield)

*   **Screen:** `/dashboard/reputation`

*   **The View:**

    *   **Feed:** Live stream of Google Reviews.

    *   **AI Drafts:** Next to a 1-star review ("Service was slow"), the AI has already drafted a polite, professional apology.

    *   **Action:** "Edit & Post" (One tap).

*   **The Logic:** Monitors Google Places API. Drafts responses using the owner's "voice".

*   **Money Proof:** "Recovered 12 at-risk customers this month via apology outreach."

### ENGINE 4: MARKET INTELLIGENCE (The Radar)

*   **Screen:** `/dashboard/market`

*   **The View:**

    *   **Competitor Watch:** "Nando's Rosebank just added 'Wings & Rings' to their menu."

    *   **Opportunity:** "No one in 5km offers Sunday Brunch. Opportunity Score: 92/100."

*   **The Logic:** Scrapes competitor websites/menus weekly.

*   **Money Proof:** "Launched Brunch Special based on Market Intel -> R8,000 revenue."

### ENGINE 5: MARKETING AUTOMATION (The Megaphone)

*   **Screen:** `/dashboard/marketing/campaigns`

*   **The View:**

    *   **Campaign Builder:** "Win back 45 dormant customers."

    *   **Message:** "Howzit [Name]! We miss you. 15% off your favorite Rib-Eye this Tuesday. Reply 'BOOK' to claim."

    *   **Launch Button:** Sends via WhatsApp (Outbox pattern).

*   **The Logic:** Identifies "At-Risk" segment -> Generates offer -> Sends via WhatsApp.

*   **Money Proof:** "Campaign ROI: R3,200 recovered from R0 ad spend."

### ENGINE 6: OPERATIONS (The Inbox)

*   **Screen:** `/dashboard/inbox`

*   **The View:**

    *   **Unified Inbox:** WhatsApp, Instagram, Email, Facebook all in one stream.

    *   **Status Badges:** "AI Draft" (Yellow), "Sent" (Green), "Failed" (Red).

    *   **Approval Mode:** For sensitive queries (complaints), AI drafts but waits for owner approval.

*   **The Logic:** Baileys Operator maintains persistent socket. AI classifies intent (Booking vs. Complaint vs. FAQ).

*   **Money Proof:** "0 Missed Messages. 100% Response Rate."

---

## 5. REAL-LIFE USE CASES (The "Money" Stories)

### Story 1: The "Tuesday Slump" (Revenue Recovery)

*   **The Pain:** It's Tuesday morning. The restaurant is empty. The owner is stressing about staff costs.

*   **The Flavourly Fix:**

    1.  **Engine 1** detects Tuesday is historically slow.

    2.  **Engine 5** auto-generates a "Tuesday Steak Special" campaign.

    3.  **Engine 2** targets the "Regulars" segment (people who haven't visited in 30 days).

    4.  **Action:** 150 WhatsApps go out at 10:00 AM.

    5.  **Result:** 12 bookings made instantly. **R4,800 recovered.**

*   **The Owner's Feeling:** "The app just paid for its own monthly subscription in one hour."

### Story 2: The "1-Star Bomb" (Reputation Defense)

*   **The Pain:** A customer leaves a scathing 1-star review at 11 PM. The owner is asleep.

*   **The Flavourly Fix:**

    1.  **Engine 3** detects the review instantly.

    2.  **AI** drafts a humble, empathetic response: *"Howzit Sarah, I'm so sorry about the wait. I'd love to make it right..."*

    3.  **Action:** The response is queued for the owner to approve at 7 AM (or auto-sent if configured).

    4.  **Result:** The customer updates the review to 3 stars. Future customers see the owner cares.

*   **The Owner's Feeling:** "I didn't even have to wake up to put out the fire."

### Story 3: The "VIP Walk-In" (Retention)

*   **The Pain:** A high-spending regular walks in, but the hostess doesn't recognize them. They feel ignored.

*   **The Flavourly Fix:**

    1.  **Engine 2** flags the booking: "Mr. Naidoo (VIP, R50k LTV) arriving in 1 hour."

    2.  **Notification:** Push notification to Owner/Manager: "VIP Arriving. Suggested: Complimentary Amuse-Bouche."

    3.  **Result:** Mr. Naidoo feels like royalty. He brings his corporate team next week (R20k booking).

*   **The Owner's Feeling:** "My staff looks like geniuses."

---

## 6. TECHNICAL ARCHITECTURE (The Engine Room)

*   **Frontend:** Next.js 14 (App Router) + Tailwind CSS + Shadcn UI.

*   **Backend:** Serverless Functions (Vercel) + Neon Postgres (Drizzle ORM).

*   **WhatsApp Operator:** Custom Node.js microservice (Render) using **Baileys** (Free, open-source WhatsApp Web API).

    *   *Why?* Zero per-message fees. Unlimited scale.

*   **AI Brain:** Groq (Llama 3 70B) for speed + OpenAI (GPT-4o) for complex reasoning.

*   **Payments:** PayFast (South African native).

*   **Auth:** Clerk (Multi-tenant support).

---

## 7. PRICING & PACKAGING

| Tier | Price | Target | Key Feature |

| :--- | :--- | :--- | :--- |

| **Starter** | R499/mo | Takeaways | AI Inbox (WhatsApp only), 500 msgs. |

| **Casual** | R1,499/mo | Casual Dining | + Reputation Mgmt, Segmentation, 2k msgs. |

| **Premium** | R3,999/mo | Full Service | + Marketing Automation, Market Intel, 10k msgs. |

| **Signature** | R7,999/mo | Fine Dining | + **Magic Link Onboarding**, Multi-channel, Approval Workflows. |

| **Group** | R19,999/mo | Multi-Location | + Cross-location analytics, API access, Dedicated Success Manager. |

---

## 8. SUCCESS METRICS (How we measure "Happy")

1.  **Activation:** % of users who connect WhatsApp and receive a test reply within 5 mins. (Target: >80%)

2.  **Revenue Recovered:** Total Rand value attributed to Flavourly campaigns. (The "North Star" metric).

3.  **Inbox Zero:** % of nights where the inbox is cleared (all messages answered).

4.  **Retention:** Month-over-month churn < 5%.

---

**Summary for the User:**

This PRD describes a product that sells itself. By using the **Magic Link** to show the prospect *their own restaurant* inside the app, you bypass the "sales pitch" and go straight to the "proof." The design is premium and light, the features are tied directly to revenue, and the automation handles the grunt work so the owner can focus on the food. This is the blueprint for a category-defining SaaS in the African hospitality market.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://flavourly-2-lovable.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d195b6c6-8292-4680-9dff-7e34e8ddd233).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Use Node.js 22 and Bun so local installs match CI. Install Bun from https://bun.sh/docs/installation.

```sh
git clone <this-repository-url>
cd <repository-name>
bun install --frozen-lockfile
bun run dev
```

CI runs typecheck, ESLint, Vitest, and the production Vite build in that order. The separate `e2e/` package has not yet been added to the frozen root install; see the handover checklist for the remaining e2e reproducibility gate.


## Authentication safety

Server functions require a valid Supabase user session and tenant membership by default in development, preview, and production. Set `REQUIRE_AUTH=true` in deployed environments. The legacy `NODE_ENV` value is not an authentication control.

`ALLOW_INSECURE_DEMO=true` is an explicit local/demo-only escape hatch and is ignored when `PUBLIC_APP_URL` is missing, invalid, or HTTPS. Never enable it for a client or internet-facing deployment. Do not put service-role keys or other secrets in `.env.example`; use your hosting provider's secret settings.
