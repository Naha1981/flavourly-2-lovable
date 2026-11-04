import { describe, expect, it } from "vitest";

import { decideHandoff, HANDOFF_TEXT } from "../src/lib/support-chat.server";

describe("support chat handoff", () => {
  it("hands off to a person when the assistant isn't confident", () => {
    const d = decideHandoff({ answer: "Maybe Tuesday?", confident: false, reason: "unknown" });
    expect(d).toEqual({ handoff: true, text: HANDOFF_TEXT });
  });
  it("hands off when the assistant fails to answer", () => {
    expect(decideHandoff(null).handoff).toBe(true);
  });
  it("answers directly when confident", () => {
    expect(decideHandoff({ answer: "Yes, the curry is vegan.", confident: true, reason: "" })).toEqual({ handoff: false, text: "Yes, the curry is vegan." });
  });
});
