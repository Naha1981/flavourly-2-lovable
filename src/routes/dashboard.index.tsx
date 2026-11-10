import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { dashMeta, PageTitle } from "./dashboard";
import { Button } from "@/components/ui/button";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { listMenuAdmin } from "@/lib/menu.functions";
export const Route = createFileRoute("/dashboard/")({
  head: () =>
    dashMeta("Today", "Your saved restaurant workspace. No sample customer or revenue records."),
  component: Today,
});
function Today() {
  const { profile, ready, error: profileError } = useRestaurantProfile();
  const load = useServerFn(listMenuAdmin);
  const [menu, setMenu] = useState<Awaited<ReturnType<typeof listMenuAdmin>> | null>(null);
  const [error, setError] = useState(false);
  const refresh = useCallback(async () => {
    if (!ready || !profile.slug) return;
    try {
      setMenu(await load({ data: { tenantId: profile.slug } }));
      setError(false);
    } catch {
      setError(true);
    }
  }, [load, ready, profile.slug]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const available = menu?.items.filter((item) => item.isAvailable).length;
  return (
    <div className="space-y-6">
      <PageTitle
        title={profile.name || "Your workspace"}
        sub="Your saved restaurant details and menu. No sample results."
      />
      {profileError && <p role="alert">{profileError}</p>}
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Restaurant menu</h2>
        {error ? (
          <p role="alert" className="mt-3">
            Menu summary could not load.{" "}
            <button className="underline" onClick={() => void refresh()}>
              Retry summary
            </button>
          </p>
        ) : !menu ? (
          <p role="status" className="mt-3">
            Loading your saved menu...
          </p>
        ) : (
          <>
            <p className="mt-3">
              {menu.items.length} saved {menu.items.length === 1 ? "dish" : "dishes"}. {available}{" "}
              available, {menu.items.length - (available ?? 0)} sold out.
            </p>
            {menu.items.length === 0 && (
              <p className="mt-2 text-muted-foreground">
                Add your first dish and price. It stays in your own workspace when you return.
              </p>
            )}
            {profile.slug && (
              <a
                className="mt-3 inline-block text-primary underline"
                href={"/m/" + encodeURIComponent(profile.slug)}
              >
                View your guest menu
              </a>
            )}
          </>
        )}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/dashboard/menu">Manage menu</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/onboarding" search={{ step: "profile" }}>
              Edit restaurant
            </Link>
          </Button>
        </div>
      </section>
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-2xl">Messaging activation</h2>
        <p className="mt-3 text-muted-foreground">
          Saving a menu does not activate WhatsApp replies or sending. Connection, account capacity,
          reply limits and a test incoming message must be checked before activation.
        </p>
        <p className="mt-3 text-muted-foreground">
          A booking request is not a confirmed reservation. This summary does not claim revenue,
          bookings or message delivery.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button asChild>
            <Link to="/dashboard/settings">Restaurant settings</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard/inbox">Open inbox</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard/billing">Usage and plan</Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
