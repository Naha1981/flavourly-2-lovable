import { test, expect } from "e2e";

test("prospect can open a prepared restaurant preview", async ({ app, agent, screen }) => {
  await app.open("/");
  await agent.act("open the prepared restaurant preview for Marble JHB");
  await expect(screen.getByText("your app is waiting")).toBeVisible();
  await expect(screen.getByText("Already built for you")).toBeVisible();
});

test("restaurant owner can move through onboarding to the WhatsApp step", async ({ app, agent, screen }) => {
  await app.open("/onboarding?step=profile");

  await agent.act(
    "complete the restaurant profile: restaurant name Marble JHB, owner name Thabiso, area Johannesburg, cuisine Grill, opening hours 10:00-22:00, and average spend 250",
  );
  await expect(screen.getByLabelText("Restaurant name")).toHaveValue("Marble JHB");
  await expect(screen.getByLabelText("Opening hours")).toHaveValue("10:00-22:00");

  await agent.act("continue to the WhatsApp setup step");
  await expect(screen.getByRole("heading", { name: "Link your restaurant WhatsApp" })).toBeVisible();

  await agent.act("choose the option to do WhatsApp later and continue to the test step");
  await expect(screen.getByRole("heading", { name: "See a reply in your voice" })).toBeVisible();
});
