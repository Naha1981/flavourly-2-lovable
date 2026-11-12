import { describe, expect, it } from "vitest";
import { redactExport, validateDeleteConfirmation } from "@/lib/privacy";
import { readFileSync } from "node:fs";
describe("workspace privacy boundaries", () => {
  it("removes nested credentials without removing guest content", () => {
    expect(
      redactExport({
        name: "Synthetic QA",
        wa_operator_tenant_token: "do-not-export",
        rows: [{ phone: "test", api_key: "secret", metadata: { password: "secret" } }],
      }),
    ).toEqual({
      name: "Synthetic QA",
      wa_operator_tenant_token: "[redacted]",
      rows: [{ phone: "test", api_key: "[redacted]", metadata: "[redacted]" }],
    });
  });
  it("requires exact explicit deletion confirmation", () => {
    expect(() => validateDeleteConfirmation("qa", "DELETE qa")).not.toThrow();
    for (const v of ["", "delete qa", "DELETE other", "qa"])
      expect(() => validateDeleteConfirmation("qa", v)).toThrow();
  });
  it("keeps SQL owner and role guards and schema-drift rollback", () => {
    const s = readFileSync(
      new URL("../supabase/migrations/20261101061000_workspace_privacy.sql", import.meta.url),
      "utf8",
    );
    expect(s).toContain("role='owner'");
    expect(s).toContain("FROM PUBLIC,anon,authenticated");
    expect(s).toContain("Unreviewed tenant table");
    expect(s).toContain("SHARE ROW EXCLUSIVE");
    expect(s).toContain("Cancel and verify external subscription");
  });
});
