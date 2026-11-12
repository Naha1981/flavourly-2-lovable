/** Saved facts only. A binding is not a current provider connection or delivery receipt. */
export function onboardingChecklist(profile: {
  name: string;
  hours: string;
  waAccountId: string | null;
  aiTested: boolean;
}) {
  return [
    { label: "Restaurant profile saved", done: Boolean(profile.name && profile.hours) },
    { label: "WhatsApp number saved", done: Boolean(profile.waAccountId?.trim()) },
    { label: "AI draft tried (nothing sent)", done: profile.aiTested },
  ];
}
