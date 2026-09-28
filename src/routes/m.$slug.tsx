import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Sparkles } from "lucide-react";

import { getPublicMenu } from "@/lib/menu.functions";
import { formatZAR } from "@/lib/south-africa";

export const Route = createFileRoute("/m/$slug")({
  loader: ({ params }) => getPublicMenu({ data: { slug: params.slug } }),
  head: ({ loaderData }) => {
    const name = loaderData?.venue.name ?? "Menu";
    return {
      meta: [
        { title: `${name} — Menu` },
        {
          name: "description",
          content: `Live menu for ${name}. Book a table or chat on WhatsApp.`,
        },
        { property: "og:title", content: `${name} — Menu` },
      ],
    };
  },
  component: PublicMenuPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "vegan", label: "Vegan" },
  { key: "vegetarian", label: "Vegetarian" },
  { key: "halaal", label: "Halaal" },
  { key: "gluten_free", label: "Gluten free" },
] as const;

const flagLabel = (f: string) => f.replace("_", " ");

function PublicMenuPage() {
  const menu = Route.useLoaderData();
  const [cat, setCat] = useState<string>(menu?.categories[0]?.id ?? "");
  const [filter, setFilter] = useState<string>("all");

  const active = menu?.categories.find((c) => c.id === cat) ?? menu?.categories[0];
  const items = useMemo(
    () => (active?.items ?? []).filter((i) => filter === "all" || i.dietaryFlags.includes(filter)),
    [active, filter],
  );

  if (!menu) {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6 text-center">
        <div>
          <h1 className="font-display text-2xl text-foreground">Menu not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This link may be out of date. Ask the restaurant for their latest one.
          </p>
        </div>
      </main>
    );
  }

  const wa = menu.venue.whatsappPhone
    ? `https://wa.me/${menu.venue.whatsappPhone}?text=${encodeURIComponent("Hi! I'd like to book a table")}`
    : null;
  const join = menu.venue.whatsappPhone
    ? `https://wa.me/${menu.venue.whatsappPhone}?text=${encodeURIComponent("JOIN")}`
    : null;

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <div className="flex items-center justify-between gap-3">
            <h1 className="font-display text-xl text-foreground">{menu.venue.name}</h1>
            {join && (
              <a
                href={join}
                className="rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-foreground"
              >
                Join · get 50 points
              </a>
            )}
          </div>
          <nav
            className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-2"
            aria-label="Menu sections"
          >
            {menu.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm transition ${
                  (active?.id ?? "") === c.id
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground"
                }`}
              >
                {c.name}
              </button>
            ))}
          </nav>
          <div
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-3 text-xs"
            aria-label="Dietary filters"
          >
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 ${filter === f.key ? "bg-secondary font-medium text-foreground" : "text-muted-foreground"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-2xl gap-3 px-4 py-4">
        {menu.categories.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            The menu is being updated. Check back shortly.
          </p>
        )}
        {items.length === 0 && menu.categories.length > 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nothing here matches that filter.
          </p>
        )}
        {items.map((item) => (
          <article
            key={item.id}
            className={`glass-card rounded-2xl border border-border p-4 ${item.isAvailable ? "" : "opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-medium text-foreground">{item.name}</h2>
                  {!item.isAvailable && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      Sold out today
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                )}
                {item.dietaryFlags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {item.dietaryFlags.map((f) => (
                      <span
                        key={f}
                        className="rounded-md bg-forest-soft px-2 py-0.5 text-[11px] capitalize text-forest"
                      >
                        {flagLabel(f)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <span className="shrink-0 font-display text-base text-foreground">
                {formatZAR(item.priceCents)}
              </span>
            </div>
            {item.isAvailable && item.pairings.length > 0 && (
              <div className="mt-3 grid gap-2 border-t border-border pt-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                  <Sparkles className="size-3.5" /> Often paired with
                </p>
                {item.pairings.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-foreground">{p.name}</p>
                      {p.pitch && <p className="text-xs text-muted-foreground">{p.pitch}</p>}
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      +{formatZAR(p.priceCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </article>
        ))}
      </main>

      {wa && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">Questions or a table for tonight?</p>
            <a
              href={wa}
              className="inline-flex items-center gap-2 rounded-full bg-forest px-4 py-2.5 text-sm font-medium text-white"
            >
              <MessageCircle className="size-4" /> Chat on WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
