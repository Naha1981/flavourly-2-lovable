import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import {
  SALES_EMAIL,
  SALES_PHONE_DISPLAY,
  SALES_PHONE_HREF,
  SALES_EMAIL_HREF,
} from "@/lib/contact";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Flavourly - NahaLabs" },
      {
        name: "description",
        content: "Contact NahaLabs about Flavourly pilot enrolment, plan scope and activation.",
      },
      { property: "og:title", content: "Contact Flavourly - NahaLabs" },
    ],
  }),
  component: ContactPage,
});
function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Contact the Flavourly team
        </h1>
        <p className="mt-5 text-muted-foreground">
          Ask about the Starter pilot, your restaurant's needs or capacity for Growth and Pro. Email
          opens your own mail app. Calling opens your phone app. Nothing is sent automatically.
        </p>
        <p className="mt-4 text-muted-foreground">
          Growth and Pro require capacity approval and are not available for self-serve activation.
          No card or automatic charge.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <a href={SALES_EMAIL_HREF}>Email {SALES_EMAIL}</a>
          </Button>
          <Button asChild variant="outline">
            <a href={SALES_PHONE_HREF}>{SALES_PHONE_DISPLAY}</a>
          </Button>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          No payment is taken on this page. Activating messaging requires agreed scope and checks.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/pricing">Back to pilot scope and pricing</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}
