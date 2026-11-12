import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([".git", "node_modules", "dist", ".output", ".tanstack", "coverage", ".wrangler"]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
const patterns = [
  { label: "focused test", regex: /\b(?:describe|it|test|suite|spec|fit|fdescribe)\.only\s*\(/g },
  { label: "skipped test", regex: /\b(?:describe|it|test|suite|spec|xit|xdescribe)\.skip\s*\(/g },
];

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!ignoredDirs.has(entry.name)) results.push(...walk(join(dir, entry.name)));
    } else {
      const extension = entry.name.includes(".") ? "." + entry.name.split(".").pop() : "";
      if (extensions.has(extension)) results.push(join(dir, entry.name));
    }
  }
  return results;
}
const failures = [];
for (const file of walk(root)) {
  const content = readFileSync(file, "utf8");
  for (const { label, regex } of patterns) {
    regex.lastIndex = 0;
    for (const match of content.matchAll(regex)) {
      const line = content.slice(0, match.index).split("\n").length;
      failures.push(`${relative(root, file)}:${line}: ${label}`);
    }
  }
}
if (failures.length) {
  console.error("Focused or skipped tests are not allowed:");
  for (const failure of failures) console.error(" - " + failure);
  process.exitCode = 1;
} else {
  console.log("Test focus check OK: no .only or .skip test declarations found.");
}
