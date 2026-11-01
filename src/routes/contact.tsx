import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Pilot contact status - Flavourly" },
      {
        name: "description",
        content:
          "Contact submission is not available during pilot acceptance. No message is sent from this page.",
      },
      { property: "og:title", content: "Pilot contact status - Flavourly" },
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
          Contact submission is not available yet
        </h1>
        <p className="mt-5 text-muted-foreground">
          This page does not send messages. A verified sales contact route still needs to be
          configured and tested. We are not collecting enquiries or promising a reply from this
          page.
        </p>
        <p className="mt-4 text-muted-foreground">
          Growth and Pro require capacity approval and are not available for self-serve activation.
          No card or automatic charge.
        </p>
        <Button asChild className="mt-6 rounded-full">
          <Link to="/pricing">Back to pilot scope and pricing</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}
