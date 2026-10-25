import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const samplePath = join(root, ".env.example");
const sourceExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const ignoredDirs = new Set([".git", "node_modules", "dist", ".output", ".tanstack", "coverage", ".wrangler"]);
const ignoredViteBuiltins = new Set(["MODE", "DEV", "PROD", "SSR", "BASE_URL", "ASSETS_INLINE_LIMIT"]);

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) results.push(...walk(join(dir, entry.name)));
      continue;
    }
    const extension = entry.name.includes(".") ? "." + entry.name.split(".").pop() : "";
    if (sourceExtensions.has(extension) && entry.name !== "check-env-example.mjs") results.push(join(dir, entry.name));
  }
  return results;
}

const sample = readFileSync(samplePath, "utf8");
const declared = new Set();
const duplicates = new Set();
for (const line of sample.split(/\r?\n/)) {
  const match = /^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);
  if (!match) continue;
  const name = match[1];
  if (declared.has(name)) duplicates.add(name);
  declared.add(name);
}

const patterns = [
  /process\.env(?:\[['"]([A-Z][A-Z0-9_]*)['"]\]|\.([A-Z][A-Z0-9_]*))/g,
  /import\.meta\.env(?:\[['"]([A-Z][A-Z0-9_]*)['"]\]|\.([A-Z][A-Z0-9_]*))/g,
  /\benv\(\s*['"]([A-Z][A-Z0-9_]*)['"]\s*\)/g,
];
const referenced = new Map();
for (const file of walk(root)) {
  const content = readFileSync(file, "utf8");
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    for (const match of content.matchAll(pattern)) {
      const name = match[1] ?? match[2];
      if (!name || ignoredViteBuiltins.has(name)) continue;
      const locations = referenced.get(name) ?? [];
      locations.push(relative(root, file));
      referenced.set(name, locations);
    }
  }
}
const missing = [...referenced.keys()].filter((name) => !declared.has(name)).sort();
const uniqueMissing = [...new Set(missing)];
if (duplicates.size || uniqueMissing.length) {
  if (duplicates.size) console.error("Duplicate .env.example entries:", [...duplicates].sort().join(", "));
  if (uniqueMissing.length) {
    console.error("Environment variables referenced by code but missing from .env.example:");
    for (const name of uniqueMissing) console.error(" - " + name + " (" + [...new Set(referenced.get(name))].join(", ") + ")");
  }
  process.exitCode = 1;
} else {
  console.log(`Environment example OK: ${declared.size} unique entries cover ${referenced.size} referenced variables.`);
}
