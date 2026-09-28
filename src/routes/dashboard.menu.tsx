import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  deleteMenuItem,
  deletePairing,
  getVenue,
  listMenuAdmin,
  saveCategory,
  saveMenuItem,
  savePairing,
  setItemAvailability,
  type MenuCategoryRow,
  type MenuItemRow,
  type PairingRow,
} from "@/lib/menu.functions";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { formatZAR } from "@/lib/south-africa";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/menu")({
  head: () => dashMeta("Menu", "Manage dishes, mark items sold out and set up pairings."),
  component: MenuPage,
});

const DIETARY = ["vegan", "vegetarian", "halaal", "gluten_free", "dairy_free", "nut_free"] as const;
const PAIR_TYPES = [
  { v: "beverage_pairing", l: "Drink pairing" },
  { v: "dessert_pairing", l: "Dessert pairing" },
  { v: "cross_sell", l: "Goes well with" },
  { v: "upsell", l: "Upgrade" },
] as const;
const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

const toCents = (v: string) => {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
};

function MenuPage() {
  const { profile, ready } = useRestaurantProfile();
  const tenantId = profile.slug;
  const list = useServerFn(listMenuAdmin);
  const venue = useServerFn(getVenue);
  const setAvail = useServerFn(setItemAvailability);
  const [data, setData] = useState<{
    categories: MenuCategoryRow[];
    items: MenuItemRow[];
    pairings: PairingRow[];
  } | null>(null);
  const [hasVenue, setHasVenue] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setData(await list({ data: { tenantId } }));
  }, [list, tenantId]);

  useEffect(() => {
    if (!ready) return;
    void reload();
    void venue({ data: { tenantId } }).then((v) => setHasVenue(Boolean(v)));
  }, [ready, reload, venue, tenantId]);

  const toggle = async (item: MenuItemRow) => {
    setError(null);
    const next = !item.isAvailable;
    setData((d) =>
      d
        ? { ...d, items: d.items.map((i) => (i.id === item.id ? { ...i, isAvailable: next } : i)) }
        : d,
    );
    const res = await setAvail({ data: { tenantId, itemId: item.id, isAvailable: next } });
    if (!res.ok) {
      setError(res.error);
      void reload();
    }
  };

  if (!ready || !data) return null;
  const grouped = [
    ...data.categories.map((c) => ({
      id: c.id,
      name: c.name,
      items: data.items.filter((i) => i.categoryId === c.id),
    })),
    {
      id: "none",
      name: "No section",
      items: data.items.filter(
        (i) => !i.categoryId || !data.categories.some((c) => c.id === i.categoryId),
      ),
    },
  ].filter((g) => g.items.length > 0);

  return (
    <>
      <PageTitle
        title="Menu"
        sub="Mark a dish sold out and it disappears from your public menu right away."
      />
      {!hasVenue && (
        <p className="mb-4 rounded-xl bg-secondary p-3 text-sm text-foreground">
          Your public menu goes live once you save your venue details in{" "}
          <Link to="/dashboard/settings" className="font-medium text-primary underline">
            Settings
          </Link>
          .
        </p>
      )}
      {hasVenue && (
        <p className="mb-4 text-sm text-muted-foreground">
          Public menu:{" "}
          <Link
            to="/m/$slug"
            params={{ slug: tenantId }}
            className="font-medium text-primary underline"
          >
            /m/{tenantId}
          </Link>
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 text-sm text-destructive">
          {error}
        </p>
      )}

      <AddDish tenantId={tenantId} categories={data.categories} onSaved={reload} />

      <div className="mt-6 grid gap-6">
        {grouped.map((g) => (
          <section key={g.id}>
            <h2 className="mb-2 font-display text-lg text-foreground">{g.name}</h2>
            <div className="grid gap-2">
              {g.items.map((item) => (
                <DishRow
                  key={item.id}
                  item={item}
                  all={data.items}
                  pairings={data.pairings.filter((p) => p.sourceItemId === item.id)}
                  tenantId={tenantId}
                  onToggle={() => toggle(item)}
                  onChanged={reload}
                />
              ))}
            </div>
          </section>
        ))}
        {grouped.length === 0 && (
          <p className="text-sm text-muted-foreground">No dishes yet. Add your first one above.</p>
        )}
      </div>
    </>
  );
}

function AddDish({
  tenantId,
  categories,
  onSaved,
}: {
  tenantId: string;
  categories: MenuCategoryRow[];
  onSaved: () => Promise<void>;
}) {
  const saveItem = useServerFn(saveMenuItem);
  const addCat = useServerFn(saveCategory);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    price: "",
    cost: "",
    category: "",
    sales: "0",
    desc: "",
    flags: [] as string[],
    newCat: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    setMsg(null);
    const price = toCents(f.price);
    if (!f.name.trim() || price === null) return setMsg("Add a name and a price in rand.");
    const cost = f.cost.trim() === "" ? null : toCents(f.cost);
    if (f.cost.trim() !== "" && cost === null) return setMsg("Cost must be a number in rand.");
    const res = await saveItem({
      data: {
        tenantId,
        name: f.name,
        description: f.desc || null,
        priceCents: price,
        costPriceCents: cost,
        categoryId: f.category || null,
        dietaryFlags: f.flags as never,
        salesCount30d: Math.max(0, Math.floor(Number(f.sales) || 0)),
      },
    });
    if (!res.ok) return setMsg(res.error);
    setF({ ...f, name: "", price: "", cost: "", desc: "", flags: [], sales: "0" });
    await onSaved();
  };

  const addSection = async () => {
    if (!f.newCat.trim()) return;
    await addCat({ data: { tenantId, name: f.newCat, sortOrder: categories.length } });
    setF({ ...f, newCat: "" });
    await onSaved();
  };

  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Add a dish
      </Button>
    );
  return (
    <div className="glass-card grid gap-4 rounded-2xl border border-border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="d-name">Dish name</Label>
          <Input
            id="d-name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="d-cat">Section</Label>
          <select
            id="d-cat"
            className={selectCls}
            value={f.category}
            onChange={(e) => setF({ ...f, category: e.target.value })}
          >
            <option value="">No section</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="d-price">Price (R)</Label>
          <Input
            id="d-price"
            inputMode="decimal"
            value={f.price}
            onChange={(e) => setF({ ...f, price: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="d-cost">Cost to make (R, optional)</Label>
          <Input
            id="d-cost"
            inputMode="decimal"
            value={f.cost}
            onChange={(e) => setF({ ...f, cost: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="d-sales">Sold in the last 30 days</Label>
          <Input
            id="d-sales"
            inputMode="numeric"
            value={f.sales}
            onChange={(e) => setF({ ...f, sales: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="d-desc">Description</Label>
          <Input
            id="d-desc"
            value={f.desc}
            onChange={(e) => setF({ ...f, desc: e.target.value })}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {DIETARY.map((d) => {
          const on = f.flags.includes(d);
          return (
            <button
              key={d}
              type="button"
              aria-pressed={on}
              onClick={() =>
                setF({ ...f, flags: on ? f.flags.filter((x) => x !== d) : [...f.flags, d] })
              }
              className={`rounded-full px-3 py-1 text-xs capitalize ${on ? "bg-forest-soft text-forest" : "border border-border text-muted-foreground"}`}
            >
              {d.replace("_", " ")}
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={submit}>Save dish</Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Close
        </Button>
        <span className="ml-auto flex items-center gap-2">
          <Input
            aria-label="New section name"
            className="h-9 w-40"
            placeholder="New section"
            value={f.newCat}
            onChange={(e) => setF({ ...f, newCat: e.target.value })}
          />
          <Button variant="outline" size="sm" onClick={addSection}>
            Add section
          </Button>
        </span>
      </div>
      {msg && (
        <p role="alert" className="text-sm text-destructive">
          {msg}
        </p>
      )}
    </div>
  );
}

function DishRow({
  item,
  all,
  pairings,
  tenantId,
  onToggle,
  onChanged,
}: {
  item: MenuItemRow;
  all: MenuItemRow[];
  pairings: PairingRow[];
  tenantId: string;
  onToggle: () => void;
  onChanged: () => Promise<void>;
}) {
  const remove = useServerFn(deleteMenuItem);
  const pair = useServerFn(savePairing);
  const unpair = useServerFn(deletePairing);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [type, setType] = useState<(typeof PAIR_TYPES)[number]["v"]>("beverage_pairing");
  const [pitch, setPitch] = useState("");
  const others = useMemo(() => all.filter((i) => i.id !== item.id), [all, item.id]);
  const nameOf = (id: string) => all.find((i) => i.id === id)?.name ?? "Removed dish";

  const add = async () => {
    if (!target) return;
    await pair({
      data: {
        tenantId,
        sourceItemId: item.id,
        pairedItemId: target,
        pairingType: type,
        pitchCopy: pitch || null,
      },
    });
    setTarget("");
    setPitch("");
    await onChanged();
  };

  return (
    <article className="glass-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{item.name}</p>
          <p className="text-xs text-muted-foreground">
            {formatZAR(item.priceCents)}
            {item.costPriceCents !== null
              ? ` · costs ${formatZAR(item.costPriceCents)}`
              : " · cost not set"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            {item.isAvailable ? "In stock" : "Sold out"}
            <Switch
              checked={item.isAvailable}
              onCheckedChange={onToggle}
              aria-label={`${item.name} in stock`}
            />
          </label>
          <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} aria-expanded={open}>
            <Sparkles className="size-4" /> Pairings{pairings.length ? ` (${pairings.length})` : ""}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${item.name}`}
            onClick={async () => {
              if (confirm(`Remove ${item.name} from the menu?`)) {
                await remove({ data: { tenantId, itemId: item.id } });
                await onChanged();
              }
            }}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {open && (
        <div className="mt-3 grid gap-3 border-t border-border pt-3">
          {pairings.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-card px-3 py-2 text-sm"
            >
              <span>
                {nameOf(p.pairedItemId)}
                {p.pitchCopy ? (
                  <span className="text-muted-foreground"> — {p.pitchCopy}</span>
                ) : null}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  await unpair({ data: { tenantId, pairingId: p.id } });
                  await onChanged();
                }}
              >
                Remove
              </Button>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-[1fr_9rem_1.4fr_auto]">
            <select
              aria-label="Paired dish"
              className={selectCls}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Pair with…</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Pairing type"
              className={selectCls}
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              {PAIR_TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
            <Input
              aria-label="Pitch"
              placeholder="Why it works (shown to guests)"
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
            />
            <Button onClick={add} disabled={!target}>
              Add
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
