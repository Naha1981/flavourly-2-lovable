import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Check, CheckCircle2, Circle } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { ReplyDrafter } from "@/components/app/reply-drafter";
import { WhatsAppConnect } from "@/components/app/whatsapp-connect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { slugify, useRestaurantProfile } from "@/lib/restaurant-profile";

const steps = ["profile", "whatsapp", "test", "done"] as const;
type Step = (typeof steps)[number];
const labels: Record<Step, string> = { profile: "Your restaurant", whatsapp: "Link WhatsApp", test: "Test a reply", done: "Go live" };

export const Route = createFileRoute("/onboarding")({
  validateSearch: z.object({ step: z.enum(steps).catch("profile").default("profile") }),
  head: () => ({
    meta: [
      { title: "Set up your restaurant — Flavourly" },
      { name: "description", content: "Set up your Flavourly workspace: restaurant profile, WhatsApp link and your first AI reply." },
      { property: "og:title", content: "Set up your restaurant — Flavourly" },
      { property: "og:description", content: "Three short steps to put Flavourly to work." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

function Onboarding() {
  const { step } = Route.useSearch();
  const navigate = useNavigate({ from: "/onboarding" });
  const { profile, update, ready } = useRestaurantProfile();
  const go = (s: Step) => navigate({ search: { step: s } });
  const idx = steps.indexOf(step);

  const checklist = [
    { label: "Restaurant profile saved", done: Boolean(profile.name && profile.hours) },
    { label: "WhatsApp linked", done: profile.waConnected },
    { label: "First AI reply tested", done: profile.aiTested },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Link to="/"><Logo /></Link>
        <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">Skip for now</Link>
      </header>
      <main className="mx-auto grid max-w-5xl gap-8 px-5 pb-16 lg:grid-cols-[220px_1fr]">
        <ol className="flex gap-2 overflow-x-auto lg:grid lg:content-start lg:gap-1">
          {steps.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => go(s)}
                className={`flex w-full items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm lg:rounded-lg ${s === step ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground"}`}
              >
                <span className={`grid size-5 place-items-center rounded-full text-[11px] ${i < idx ? "bg-forest text-primary-foreground" : "border border-border"}`}>
                  {i < idx ? <Check className="size-3" /> : i + 1}
                </span>
                {labels[s]}
              </button>
            </li>
          ))}
        </ol>

        <section className="glass-card rounded-2xl border border-border p-5 sm:p-8">
          {!ready ? null : step === "profile" ? (
            <form
              className="grid gap-5"
              onSubmit={(e) => {
                e.preventDefault();
                go("whatsapp");
              }}
            >
              <Heading title="Tell us about your restaurant" sub="This is how Flavourly will talk about you to guests." />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="name" label="Restaurant name" value={profile.name} onChange={(v) => update({ name: v, slug: slugify(v) })} required />
                <Field id="owner" label="Your first name" value={profile.ownerName} onChange={(v) => update({ ownerName: v })} />
                <Field id="city" label="Area / city" value={profile.city} onChange={(v) => update({ city: v })} />
                <Field id="cuisine" label="Cuisine" value={profile.cuisine} onChange={(v) => update({ cuisine: v })} />
                <Field id="hours" label="Opening hours" value={profile.hours} onChange={(v) => update({ hours: v })} required />
                <Field id="check" label="Average spend per guest (R)" type="number" value={String(profile.averageCheck || "")} onChange={(v) => update({ averageCheck: Number(v) || 0 })} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">House notes guests often ask about</Label>
                <Textarea id="notes" rows={3} value={profile.notes} onChange={(e) => update({ notes: e.target.value })} />
              </div>
              <Button type="submit" size="lg" className="w-full rounded-full sm:w-fit">Continue</Button>
            </form>
          ) : step === "whatsapp" ? (
            <div className="grid gap-6">
              <Heading title="Link your restaurant WhatsApp" sub="Guests keep messaging the number they already know." />
              <WhatsAppConnect profile={profile} update={update} />
              <div className="flex gap-3">
                <Button variant="outline" className="rounded-full" onClick={() => go("profile")}>Back</Button>
                <Button className="rounded-full" onClick={() => go("test")}>{profile.waConnected ? "Continue" : "I'll do this later"}</Button>
              </div>
            </div>
          ) : step === "test" ? (
            <div className="grid gap-6">
              <Heading title="See a reply in your voice" sub="Pick a sample or paste a real message. Nothing is sent." />
              <ReplyDrafter profile={profile} compact onDrafted={() => update({ aiTested: true })} />
              <div className="flex gap-3">
                <Button variant="outline" className="rounded-full" onClick={() => go("whatsapp")}>Back</Button>
                <Button className="rounded-full" onClick={() => go("done")}>Continue</Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-6">
              <Heading title="Your activation checklist" sub="Finish these and Flavourly starts earning for you." />
              <ul className="grid gap-3">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                    {c.done ? <CheckCircle2 className="size-5 text-forest" /> : <Circle className="size-5 text-muted-foreground" />}
                    <span className={c.done ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
                  </li>
                ))}
              </ul>
              <Button asChild size="lg" className="w-full rounded-full sm:w-fit">
                <Link to="/dashboard">Open my dashboard</Link>
              </Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <h1 className="font-display text-2xl text-foreground sm:text-3xl">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{sub}</p>
    </div>
  );
}

function Field(p: { id: string; label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={p.id}>{p.label}</Label>
      <Input id={p.id} type={p.type} required={p.required} value={p.value} onChange={(e) => p.onChange(e.target.value)} />
    </div>
  );
}
