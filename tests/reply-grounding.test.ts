import { describe, expect, it } from "vitest";

import { buildMenuFacts } from "@/lib/reply-drafts.server";

describe("menu grounding for AI replies", () => {
  it("lists each dish with its rand price, dietary tags and sold-out flag", () => {
    const facts = buildMenuFacts([
      { name: "Lamb shank", description: null, price_cents: 24500, is_available: true, dietary_flags: ["halaal"] },
      { name: "Malva pudding", description: "With custard", price_cents: 8950, is_available: false, dietary_flags: [] },
    ]);
    expect(facts).toBe("- Lamb shank — R245 (halaal)\n- Malva pudding — R89.50 [SOLD OUT today]: With custard");
  });
});
