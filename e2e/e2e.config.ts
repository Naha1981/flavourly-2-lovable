import type { E2EConfig } from "e2e";
import { web } from "@e2e-dev/web";
import { gateway } from "ai";

const baseUrl = process.env.E2E_BASE_URL ?? "http://127.0.0.1:4173";

export default {
  projectId: "com.nahalabs.flavourly",
  tests: "tests/**/*.e2e.ts",
  targets: [{ name: "web", platform: "web", engine: web(), app: {
    url: baseUrl,
    command: { executable: "npm", args: ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4173"], reuseExisting: true }
  }}],
  timeout: 180_000,
  actionTimeout: 45_000,
  agents: {
    default: {
      model: gateway(process.env.E2E_MODEL ?? "openai/gpt-6-luna-fast"),
      system: "You are a careful QA agent testing Flavourly. Complete the stated business goal using the real UI. Never send a real customer message, purchase anything, or alter production data. Prefer visible UI controls and verify the requested outcome."
    }
  }
} satisfies E2EConfig;
