import { createFileRoute, Link } from "@tanstack/react-router";

import { TeamPanel } from "@/components/app/team-panel";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { VenueSettings } from "@/components/app/venue-settings";
import { WhatsAppConnect } from "@/components/app/whatsapp-connect";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/settings")({
  head: () => dashMeta("Settings", "Restaurant profile and WhatsApp connection."),
  component: SettingsPage,
});

function SettingsPage() {
  const { profile, update, ready } = useRestaurantProfile();
  const [myId, setMyId] = useState("");
  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? "")); }, []);
  if (!ready) return null;
  return (
    <>
      <PageTitle title="Settings" />
      <section className="glass-card grid gap-2 rounded-2xl border border-border p-5">
        <h2 className="font-medium text-foreground">{profile.name}</h2>
        <p className="text-sm text-muted-foreground">{profile.city} · {profile.hours}</p>
        <Link to="/onboarding" search={{ step: "profile" }} className="text-sm font-medium text-primary">Edit profile</Link>
      </section>
      {myId && <TeamPanel myId={myId} />}
      <section className="glass-card mt-6 grid gap-4 rounded-2xl border border-border p-5">
        <h2 className="font-medium text-foreground">Venue, rewards and auto-replies</h2>
        <VenueSettings profile={profile} />
      </section>
      <section className="glass-card mt-6 grid gap-4 rounded-2xl border border-border p-5">
        <h2 className="font-medium text-foreground">WhatsApp</h2>
        <WhatsAppConnect profile={profile} update={update} />
      </section>
    </>
  );
}
