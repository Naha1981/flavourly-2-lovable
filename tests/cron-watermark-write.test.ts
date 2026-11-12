import { describe, it, expect } from "vitest";
import { setCronWatermark, getCronWatermark } from "../src/lib/tenants.server";
import { createFakeDb } from "./helpers/fake-db";
describe("durable cron progress", () => {
  it("atomically replaces the same job and keeps other jobs", async () => {
    const c = createFakeDb();
    await setCronWatermark(c as never, "outbox", "a");
    await setCronWatermark(c as never, "other", "z");
    await setCronWatermark(c as never, "outbox", "b");
    expect(await getCronWatermark(c as never, "outbox")).toBe("b");
    expect(c.rows("cron_state")).toHaveLength(2);
  });
  it("database refusal is not silently treated as success", async () => {
    const c = {
      from: () => ({ upsert: async () => ({ error: { message: "permission denied" } }) }),
    };
    await expect(setCronWatermark(c as never, "outbox", "a")).rejects.toThrow(
      "Cron progress was not saved",
    );
  });
  it("network refusal is not silently treated as success", async () => {
    const c = {
      from: () => ({
        upsert: async () => {
          throw Error("offline");
        },
      }),
    };
    await expect(setCronWatermark(c as never, "outbox", "a")).rejects.toThrow("offline");
  });
});
