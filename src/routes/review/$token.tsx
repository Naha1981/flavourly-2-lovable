import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/review/$token")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { followReviewLink } = await import("@/lib/review-requests.server");
        const target = await followReviewLink(params.token);
        return target
          ? new Response(null, {
              status: 302,
              headers: {
                Location: target,
                "Cache-Control": "no-store",
                "Referrer-Policy": "no-referrer",
                "X-Robots-Tag": "noindex",
              },
            })
          : new Response("This review link is unavailable. Please ask the restaurant.", {
              status: 404,
            });
      },
    },
  },
});
