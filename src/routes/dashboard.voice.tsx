import { createFileRoute } from "@tanstack/react-router";

import { VoiceOperator } from "@/components/app/voice-operator";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/voice")({
  head: () => dashMeta("Voice Operator", "Talk to Flavourly in real time."),
  component: VoicePage,
});

function VoicePage() {
  const { profile, ready } = useRestaurantProfile();

  if (!ready) return null;

  return (
    <>
      <PageTitle title="Voice Operator" sub="Ask Flavourly questions and turn restaurant intelligence into actions." />
      <VoiceOperator tenantId={profile.slug} restaurantName={profile.name} />
    </>
  );
}
