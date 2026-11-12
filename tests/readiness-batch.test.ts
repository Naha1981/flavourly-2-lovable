import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import {
  SALES_EMAIL,
  SALES_EMAIL_HREF,
  SALES_PHONE_DISPLAY,
  SALES_PHONE_HREF,
} from "../src/lib/contact";
const source = (p: string) => readFileSync("src/" + p, "utf8");
describe("truthful pilot readiness", () => {
  it("uses only the approved business contact identity and opens user-controlled apps", () => {
    expect(SALES_EMAIL).toBe("ai-solutions@nahalabs.co.za");
    expect(SALES_EMAIL_HREF).toBe("mailto:" + SALES_EMAIL);
    expect(SALES_PHONE_DISPLAY).toBe("061 298 0377");
    expect(SALES_PHONE_HREF).toBe("tel:+27612980377");
    const s = source("routes/contact.tsx");
    expect(s).toContain("Nothing is sent automatically");
    expect(s).toContain("SALES_EMAIL_HREF");
    expect(s).toContain("SALES_PHONE_HREF");
    expect(s).not.toMatch(/gmail\.com|067|toast.success/);
  });
  it("reads saved menu for Today without invented money or booking totals", () => {
    const s = source("routes/dashboard.index.tsx");
    expect(s).toContain("listMenuAdmin");
    expect(s).toContain("menu.items.length");
    expect(s).toContain("profile.name");
    expect(s).not.toContain("mock-data");
    expect(s).toMatch(/does not claim revenue,\s+bookings or message delivery/);
  });
  it("does not convert missing database reads into empty success", () => {
    expect(source("lib/inbox.functions.ts")).toContain("no empty result is assumed");
    expect(source("lib/menu.functions.ts")).toContain("cats.error || items.error || pairs.error");
    expect(source("routes/dashboard.inbox.tsx")).toContain("Inbox could not refresh");
    expect(source("routes/dashboard.billing.tsx")).toContain("Billing could not load");
  });
  it("keeps legacy subscription contracts and the checkout pause untouched", () => {
    expect(source("lib/billing/provider.ts")).toContain("starter: 49_900");
    expect(source("lib/billing.functions.ts")).toContain("Self-serve checkout is paused");
  });
  it("manager-authorizes activation reads and never mutates or calls providers", () => {
    const f = source("lib/activation-readiness.functions.ts");
    expect(f).toContain("authorizeTenant(data.tenantId, MANAGERS)");
    const s = source("lib/activation-readiness.server.ts");
    expect(s).toContain('"wa_reply_usage"');
    expect(s).toContain('.eq("tenant_id", tenantId)');
    expect(s).not.toMatch(/\.insert\(|\.update\(|\.delete\(|fetch\(/);
    expect(s).not.toMatch(/process\.env\[[^\]]+\]\s*=(?!=)/);
    expect(source("components/app/activation-readiness.tsx")).toContain("not proof of delivery");
  });
});
