import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { generateReplyDraft } from "./reply-drafts.server";

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
  intent: z.enum(["auto", "booking", "faq", "complaint"]),
  guestName: z.string().max(80).optional(),
  restaurant: z.object({
    name: z.string().min(1).max(120),
    city: z.string().max(120).optional(),
    cuisine: z.string().max(120).optional(),
    hours: z.string().max(200).optional(),
    averageCheck: z.number().optional(),
    ownerName: z.string().max(80).optional(),
    notes: z.string().max(600).optional(),
  }),
});

export const draftReply = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./tenant-auth.server");
    await requireUser();
    return generateReplyDraft(data);
  });
