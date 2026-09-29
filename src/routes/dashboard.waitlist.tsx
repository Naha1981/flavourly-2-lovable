import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Clock3 } from "lucide-react";

import { listWaitlist, type WaitlistEntry } from "@/lib/waitlist.functions";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/waitlist")({
  head: () =>
    dashMeta(
      "Waitlist",
      "Guests waiting for a table. A cancellation offers the slot automatically, oldest request first.",
    ),
  component: WaitlistPage,
});

const STATUS_LABEL: Record<string, string> = { waiting: "Waiting", offered: "Offer sent" };

function WaitlistPage() {
  const { profile, ready } = useRestaurantProfile();
  const list = useServerFn(listWaitlist);
  const [rows, setRows] = useState<WaitlistEntry[] | null>(null);

  const reload = useCallback(
    async () => setRows(await list({ data: { tenantId: profile.slug } })),
    [list, profile.slug],
  );
  useEffect(() => {
    if (!ready) return;
    void reload();
    const id = setInterval(() => void reload(), 30_000);
    return () => clearInterval(id);
  }, [ready, reload]);

  if (!ready || !rows) return null;
  const byDate = rows.reduce<Record<string, WaitlistEntry[]>>((acc, r) => {
    (acc[r.requestedDate] ??= []).push(r);
    return acc;
  }, {});

  return (
    <>
      <PageTitle
        title="Waitlist"
        sub={
          "Guests text WAITLIST 4 Friday to join. A cancellation offers the table automatically to the longest-waiting party that fits."
        }
      />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nobody is waiting right now.</p>
      ) : (
        <div className="grid gap-6">
          {Object.entries(byDate).map(([date, entries]) => (
            <section key={date}>
              <h2 className="mb-2 font-display text-lg text-foreground">
                {new Date(`${date}T12:00:00Z`).toLocaleDateString("en-ZA", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  timeZone: "UTC",
                })}
              </h2>
              <div className="grid gap-2">
                {entries.map((e) => (
                  <article
                    key={e.id}
                    className="glass-card flex items-center justify-between gap-3 rounded-2xl border border-border p-4"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {e.customerName ?? "Guest"}{" "}
                        <span className="font-normal text-muted-foreground">
                          · party of {e.partySize}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        +{e.customerPhone} · waiting since{" "}
                        {new Date(e.createdAt).toLocaleTimeString("en-ZA", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${e.status === "offered" ? "bg-forest-soft text-forest" : "bg-secondary text-muted-foreground"}`}
                    >
                      {e.status === "offered" && <Clock3 className="size-3.5" />}
                      {STATUS_LABEL[e.status] ?? e.status}
                      {e.status === "offered" && e.offerExpiresAt
                        ? ` · until ${new Date(e.offerExpiresAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`
                        : ""}
                    </span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
