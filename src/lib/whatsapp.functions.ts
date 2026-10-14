import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import * as wa from "./whatsapp.server";

const tenant = z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/);

const guard = async (tenantId: string) => {
  const { authorizeTenant } = await import("./tenant-auth.server");
  await authorizeTenant(tenantId);
};

export const connectWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, restaurantName: z.string().min(1).max(120) }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    return wa.bootstrap(data.tenantId, data.restaurantName);
  });

export const getWhatsAppStatus = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, waAccountId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    return wa.status(data.tenantId, data.waAccountId);
  });

export const refreshWhatsAppQr = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, waAccountId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    return wa.reconnect(data.tenantId, data.waAccountId);
  });

export const requestPairingCode = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ tenantId: tenant, waAccountId: z.string().min(1).max(100), phoneNumber: z.string().regex(/^\+?\d{9,15}$/) }).parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    return wa.pairingCode(data.tenantId, data.waAccountId, data.phoneNumber.replace(/\D/g, ""));
  });

export const sendWhatsAppText = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        tenantId: tenant,
        waAccountId: z.string().min(1).max(100),
        to: z.string().regex(/^\+?\d{9,15}$/),
        text: z.string().trim().min(1).max(1500),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    return wa.sendText(data.tenantId, data.waAccountId, data.to.replace(/\D/g, ""), data.text);
  });

export const disconnectWhatsApp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, waAccountId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    return wa.disconnect(data.tenantId, data.waAccountId);
  });

export const resetWhatsAppAccount = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ tenantId: tenant, waAccountId: z.string().min(1).max(100) }).parse(d))
  .handler(async ({ data }) => {
    await guard(data.tenantId);
    return wa.reset(data.tenantId, data.waAccountId);
  });
