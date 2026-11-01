import { createFileRoute, Link } from "@tanstack/react-router";
import { dashMeta, PageTitle } from "./dashboard";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/dashboard/")({
  head: () => dashMeta("Today", "Your workspace status. No sample customer or revenue records."),
  component: Today,
});
function Today() {
  return (
    <div className="space-y-6">
      <PageTitle title="Your workspace" sub="No verified operating summary is available yet." />
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Connect real information first</h2>
        <p className="mt-3 text-muted-foreground">
          This page does not show invented bookings, guests, revenue, forecasts or campaign results.
          A live operating summary still needs to be connected and tested.
        </p>
        <p className="mt-3 text-muted-foreground">
          Connection, AI and sending remain paused until activation checks pass. A booking request
          is not a confirmed reservation.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/dashboard/settings">Restaurant settings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard/inbox">Open inbox</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
