import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
const source = (path: string) => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
describe("public claims remain fail-closed during pilot acceptance", () => {
  it("does not publish unsupported customer testimonials", () => {
    const s = source("routes/stories.tsx");
    expect(s).toContain("No verified customer results");
    for (const v of ["R38,200", "Coobs", "Sotano", "Warren, Owner"]) expect(s).not.toContain(v);
  });
  it("labels the claim preview and uses Starter", () => {
    const s = source("routes/claim.$slug.tsx");
    expect(s).toContain("Sample only - not connected");
    expect(s).toContain('plan: "starter"');
    expect(s).not.toContain("already loaded");
    expect(s).not.toContain("14-day");
  });
  it("keeps trial and WhatsApp claims aligned", () => {
    expect(source("routes/legal.terms.tsx")).toContain("seven-day trial");
    expect(source("components/app/whatsapp-connect.tsx")).toContain("pilot cap 25 per day");
    expect(source("routes/product.tsx")).toContain(
      "A booking request is not a confirmed reservation",
    );
  });
  it("does not seed a new profile or dashboard with invented records", () => {
    const p = source("lib/restaurant-profile.ts");
    expect(p).not.toContain("demoRestaurant");
    expect(p).toContain('name: ""');
    expect(source("routes/dashboard.index.tsx")).not.toContain("mock-data");
    expect(source("routes/index.tsx")).toContain("Illustrative product examples only");
  });
  it("does not pretend an enquiry was sent", () => {
    const s = source("routes/contact.tsx");
    expect(s).toContain("This page does not send messages");
    expect(s).not.toContain("toast.success");
    expect(s).not.toContain("Message sent");
  });
});
