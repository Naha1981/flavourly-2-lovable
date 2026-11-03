import { describe, expect, it } from "vitest";
import { onboardingChecklist } from "./onboarding-checklist";

const saved = {
  name: "SYNTHETIC QA",
  hours: "09:00-17:00",
  waAccountId: "account-verified",
  aiTested: false,
};
describe("onboarding saved-fact checklist", () => {
  it("keeps a saved number checked after reload without a transient waConnected flag", () => {
    expect(onboardingChecklist(saved)[1]).toEqual({ label: "WhatsApp number saved", done: true });
  });
  it.each([null, "", "   "])("does not mark an absent binding %s saved", (waAccountId) => {
    expect(onboardingChecklist({ ...saved, waAccountId })[1]?.done).toBe(false);
  });
  it("never presents a draft as sent or delivered", () => {
    expect(onboardingChecklist({ ...saved, aiTested: true })[2]).toEqual({
      label: "AI draft tried (nothing sent)",
      done: true,
    });
  });
});
