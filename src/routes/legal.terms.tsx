import { createFileRoute } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of service — Flavourly" },
      {
        name: "description",
        content:
          "The terms that govern your use of Flavourly, including trials, billing in ZAR, and acceptable use.",
      },
      { property: "og:title", content: "Terms of service — Flavourly" },
      { property: "og:description", content: "Trial, billing and acceptable use terms." },
    ],
  }),
  component: TermsPage,
});

const sections = [
  {
    heading: "Your trial",
    body: "Every new workspace gets 14 days free. No card is required to begin and you can stop at any point without owing anything.",
  },
  {
    heading: "Billing",
    body: "Plans are billed monthly in advance, in South African rand, excluding VAT. You can change or cancel your plan before the next billing date.",
  },
  {
    heading: "Your content",
    body: "Your menus, guest records and messages stay yours. We hold a licence to process them only to run the service for you.",
  },
  {
    heading: "Acceptable use",
    body: "Don't use Flavourly to send unsolicited bulk messages, impersonate another business, or contact guests who have opted out.",
  },
  {
    heading: "AI drafts",
    body: "Flavourly drafts replies for your team. A person on your side approves anything that goes to a guest, and you remain responsible for what is sent.",
  },
  {
    heading: "Ending the agreement",
    body: "Either side can end the agreement with 30 days' notice. We'll export your data on request for 60 days after closing.",
  },
];

function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground">
          Terms of service
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
