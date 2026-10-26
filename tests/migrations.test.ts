import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const dir = join(process.cwd(), "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const normalise = (sql: string) => sql.replace(/\s+/g, " ").trim();

describe("supabase migrations", () => {
  it("have unique, correctly formatted version prefixes", () => {
    const versions = files.map((f) => f.split("_")[0]);
    expect(versions.every((v) => /^\d{14}$/.test(v ?? ""))).toBe(true);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("never contain two identical non-trivial migrations (Lovable re-emits duplicates that break fresh databases)", () => {
    const seen = new Map<string, string>();
    for (const file of files) {
      const body = normalise(readFileSync(join(dir, file), "utf8"));
      if (body.includes("Intentionally a no-op")) continue;
      const earlier = seen.get(body);
      expect(earlier, `${file} duplicates ${earlier}`).toBeUndefined();
      seen.set(body, file);
    }
  });
});
