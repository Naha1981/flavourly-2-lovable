import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/stories")({
  head: () => ({
    meta: [
      { title: "Pilot evidence - Flavourly" },
      {
        name: "description",
        content: "Customer results will be published only after verification and permission.",
      },
      { property: "og:title", content: "Pilot evidence - Flavourly" },
      {
        property: "og:description",
        content: "No verified customer results are published here yet.",
      },
    ],
  }),
  component: StoriesPage,
});

function StoriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-6">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Pilot evidence, before promises
        </h1>
        <p className="mt-5 text-muted-foreground">
          No verified customer results are published here yet. We will only publish customer names,
          quotes and measured results after checking the evidence and receiving permission.
        </p>
        <section className="mt-8 rounded-2xl border border-border bg-card p-7">
          <h2 className="font-display text-2xl">Starter pilot</h2>
          <p className="mt-3 text-muted-foreground">
            Seven-day trial, no card or automatic charge. Connect your own WhatsApp Business number,
            turn on auto-replies and run a test enquiry before relying on replies. A booking request
            is not a confirmed reservation.
          </p>
          <Button asChild className="mt-5 rounded-full">
            <Link to="/pricing">See pilot scope and limits</Link>
          </Button>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
