import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("package manager hygiene", () => {
  it("bun.lock only references the public npm registry (Lovable's private sandbox mirror is unreachable from CI)", () => {
    const lock = readFileSync(join(root, "bun.lock"), "utf8");
    const hosts = [...new Set([...lock.matchAll(/https?:\/\/([^/"\s]+)/g)].map((m) => m[1]))];
    expect(hosts.filter((host) => host !== "registry.npmjs.org")).toEqual([]);
  });

  it("uses a single lockfile (a stale package-lock.json next to bun.lock makes `npm ci` fail)", () => {
    expect(existsSync(join(root, "package-lock.json"))).toBe(false);
  });

  it("pins the audited transitive security overrides", () => {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { overrides?: Record<string, string> };
    for (const name of ["js-yaml", "nanoid", "source-map-js", "undici"]) expect(pkg.overrides?.[name], name).toBeTruthy();
  });
});
