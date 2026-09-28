import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/gemini-live/token")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { tenantId?: string };
        if (!body.tenantId) return Response.json({ ok: false, error: "tenantId is required" }, { status: 400 });

        const { createGeminiLiveToken } = await import("@/lib/gemini-live.functions");
        const result = await createGeminiLiveToken({ data: { tenantId: body.tenantId } });
        return Response.json(result);
      },
    },
  },
});
