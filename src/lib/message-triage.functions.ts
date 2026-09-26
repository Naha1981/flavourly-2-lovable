import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { triageMessage } from "./message-triage.server";

const schema = z.object({
  message: z.string().trim().min(1).max(2000),
  guestName: z.string().max(80).optional(),
  restaurant: z.object({
    name: z.string().min(1).max(120),
    hours: z.string().max(200).optional(),
    notes: z.string().max(600).optional(),
  }),
});

export const analyseMessage = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => schema.parse(d))
  .handler(async ({ data }) => triageMessage(data));
