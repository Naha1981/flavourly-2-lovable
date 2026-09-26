import { createFileRoute } from "@tanstack/react-router";

import { MessageTriage } from "@/components/app/message-triage";
import { ReplyDrafter } from "@/components/app/reply-drafter";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/replies")({
  head: () => dashMeta("AI desk", "Analyse guest messages and draft on-brand replies for bookings, questions and complaints."),
  component: RepliesPage,
});

function RepliesPage() {
  const { profile, update, ready } = useRestaurantProfile();
  if (!ready) return null;
  return (
    <>
      <PageTitle title="AI desk" sub="Paste any guest message. See what it needs, then send a reply in your voice." />
      <section className="grid gap-4">
        <h2 className="font-medium text-foreground">1. What does this guest need?</h2>
        <MessageTriage profile={profile} />
      </section>
      <section className="mt-10 grid gap-4">
        <h2 className="font-medium text-foreground">2. Draft the reply</h2>
        <ReplyDrafter profile={profile} onDrafted={() => update({ aiTested: true })} />
      </section>
    </>
  );
}
