import { describe, expect, it } from "vitest";

import { classifyMessageRisk, decideApproval } from "@/lib/approval-classifier";

describe("approval classifier", () => {
  it("auto-sends routine operational replies", () => {
    expect(classifyMessageRisk("Your table is available at 19:00.")).toBe("green");
    expect(decideApproval("Your table is available at 19:00.").outcome).toBe("auto_send");
  });

  it("holds promotional wording for review", () => {
    expect(classifyMessageRisk("We are sorry. We can offer a complimentary dessert.")).toBe("yellow");
  });

  it("holds financial and legal wording at red", () => {
    expect(classifyMessageRisk("We will issue a full refund for your complaint.")).toBe("red");
    expect(decideApproval("We will issue a full refund for your complaint.").outcome).toBe("require_approval");
  });
});
