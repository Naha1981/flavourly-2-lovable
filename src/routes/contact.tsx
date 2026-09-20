import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact sales — Flavourly" },
      {
        name: "description",
        content:
          "Talk to the Flavourly team about your restaurant, your covers and which plan pays for itself fastest.",
      },
      { property: "og:title", content: "Contact sales — Flavourly" },
      {
        property: "og:description",
        content: "Tell us about your restaurant and we'll come back to you the same day.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.1fr] lg:px-8">
          <div>
            <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              Let's talk covers
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Tell us how busy a normal Saturday is and we'll show you exactly where the missed
              money is hiding.
            </p>
            <ul className="mt-8 grid gap-4">
              <li className="flex items-start gap-3">
                <MessageCircle className="mt-0.5 h-5 w-5 text-primary" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-foreground">WhatsApp</p>
                  <p className="text-sm text-muted-foreground">Fastest during trading hours</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="mt-0.5 h-5 w-5 text-primary" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-foreground">hello@flavourly.app</p>
                  <p className="text-sm text-muted-foreground">Same-day replies, weekdays</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-primary" strokeWidth={1.5} />
                <div>
                  <p className="text-sm font-medium text-foreground">Johannesburg, South Africa</p>
                  <p className="text-sm text-muted-foreground">NahaLabs</p>
                </div>
              </li>
            </ul>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              setSent(true);
              toast.success("Thanks — we'll come back to you shortly.");
            }}
            className="rounded-2xl border border-border/70 bg-card p-7"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="name" label="Your name" placeholder="Warren Dlamini" />
              <Field id="restaurant" label="Restaurant" placeholder="Marble" />
              <Field id="email" label="Email" type="email" placeholder="you@restaurant.co.za" />
              <Field id="phone" label="Mobile" placeholder="082 000 0000" />
            </div>
            <div className="mt-4 grid gap-2">
              <Label htmlFor="message">What would you like to fix?</Label>
              <Textarea
                id="message"
                rows={5}
                placeholder="We miss a lot of WhatsApp bookings after 21:00 and Tuesdays are dead."
              />
            </div>
            <Button type="submit" className="mt-6 w-full rounded-full">
              {sent ? "Message sent" : "Send message"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              No sales spam. One reply from a real person.
            </p>
          </form>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({
  id,
  label,
  type = "text",
  placeholder,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} placeholder={placeholder} />
    </div>
  );
}
