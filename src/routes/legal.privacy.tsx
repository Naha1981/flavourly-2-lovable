import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Flavourly" },
      {
        name: "description",
        content:
          "How Flavourly collects, stores and protects restaurant and guest information under South African law.",
      },
      { property: "og:title", content: "Privacy policy — Flavourly" },
      { property: "og:description", content: "How we handle your restaurant and guest data." },
    ],
  }),
  component: PrivacyPage,
});

const sections = [
  {
    heading: "What we collect",
    body: "Your restaurant's business details, staff account information, and the guest messages, bookings and reviews you ask Flavourly to handle on your behalf.",
  },
  {
    heading: "Why we collect it",
    body: "To answer guests in your voice, recognise returning diners, draft review replies and show you which nights need help. Nothing is sold or shared for advertising.",
  },
  {
    heading: "Guest information",
    body: "Guest data belongs to your restaurant. You remain the responsible party under POPIA; we process it only on your instruction and delete it on request.",
  },
  {
    heading: "Storage and security",
    body: "Data is encrypted in transit and at rest. Staff access is role-based, and access to guest conversations is logged.",
  },
  {
    heading: "Your choices",
    body: "Export or delete your data at any time from your workspace settings, or by emailing hello@flavourly.app.",
  },
];

function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
          Privacy policy
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">Last updated September 2026</p>
        <div className="mt-10 grid gap-8">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="font-display text-xl font-semibold text-foreground">
                {section.heading}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
