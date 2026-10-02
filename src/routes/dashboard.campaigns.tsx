import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Send, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  createCampaign,
  getAudienceSize,
  listCampaigns,
  sendCampaign,
  type CampaignSummary,
} from "@/lib/campaigns.functions";
import { SEGMENT_LABEL } from "@/lib/campaigns";
import { useRestaurantProfile } from "@/lib/restaurant-profile";
import { formatZAR } from "@/lib/south-africa";
import { dashMeta, PageTitle } from "./dashboard";

export const Route = createFileRoute("/dashboard/campaigns")({
  head: () =>
    dashMeta(
      "Campaigns",
      "WhatsApp campaigns and the bookings and revenue they actually brought back.",
    ),
  component: CampaignsPage,
});

const selectCls = "h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const SEGMENTS = Object.keys(SEGMENT_LABEL) as Array<keyof typeof SEGMENT_LABEL>;

function CampaignsPage() {
  const { profile, ready } = useRestaurantProfile();
  const tenantId = profile.slug;
  const list = useServerFn(listCampaigns);
  const [items, setItems] = useState<CampaignSummary[] | null>(null);

  const reload = useCallback(
    async () => setItems(await list({ data: { tenantId } })),
    [list, tenantId],
  );
  useEffect(() => {
    if (ready) void reload();
  }, [ready, reload]);

  if (!ready || !items) return null;
  const totalRevenue = items.reduce((s, c) => s + c.revenueCents, 0);
  const totalBookings = items.reduce((s, c) => s + c.bookings, 0);

  return (
    <>
      <PageTitle
        title="Campaigns"
        sub={
          items.some((c) => c.status === "sent")
            ? `${formatZAR(totalRevenue)} in recorded guest spend and ${totalBookings} booking${totalBookings === 1 ? "" : "s"} in the 7 days after send.`
            : "Send your first campaign to see real results here."
        }
      />
      <NewCampaign tenantId={tenantId} onSaved={reload} />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((c) => (
          <CampaignCard key={c.id} campaign={c} tenantId={tenantId} onChanged={reload} />
        ))}
        {items.length === 0 && <p className="text-sm text-muted-foreground">No campaigns yet.</p>}
      </div>
    </>
  );
}

function NewCampaign({ tenantId, onSaved }: { tenantId: string; onSaved: () => Promise<void> }) {
  const create = useServerFn(createCampaign);
  const audience = useServerFn(getAudienceSize);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    segment: "dormant_30" as (typeof SEGMENTS)[number],
    a: "",
    b: "",
    useB: false,
  });
  const [size, setSize] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void audience({ data: { tenantId, segment: f.segment } }).then(setSize);
  }, [open, f.segment, audience, tenantId]);

  const submit = async () => {
    setMsg(null);
    if (!f.name.trim() || !f.a.trim()) return setMsg("Add a name and a message.");
    setBusy(true);
    try {
      const res = await create({
        data: {
          tenantId,
          name: f.name,
          segment: f.segment,
          messageA: f.a,
          messageB: f.useB && f.b.trim() ? f.b : null,
        },
      });
      if (!res.ok) return setMsg(res.error);
      setF({ name: "", segment: "dormant_30", a: "", b: "", useB: false });
      setOpen(false);
      await onSaved();
    } finally {
      setBusy(false);
    }
  };

  if (!open)
    return (
      <Button onClick={() => setOpen(true)}>
        <Plus className="size-4" /> New campaign
      </Button>
    );
  return (
    <div className="glass-card grid gap-4 rounded-2xl border border-border p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="c-name">Campaign name</Label>
          <Input
            id="c-name"
            value={f.name}
            onChange={(e) => setF({ ...f, name: e.target.value })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="c-seg">Send to</Label>
          <select
            id="c-seg"
            className={selectCls}
            value={f.segment}
            onChange={(e) => setF({ ...f, segment: e.target.value as typeof f.segment })}
          >
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {SEGMENT_LABEL[s]}
              </option>
            ))}
          </select>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5" />{" "}
            {size === null ? "…" : `${size} guest${size === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="c-a">Message{f.useB ? " (variant A)" : ""}</Label>
        <Textarea
          id="c-a"
          rows={3}
          value={f.a}
          onChange={(e) => setF({ ...f, a: e.target.value })}
          placeholder="We've missed you! Come back this week for..."
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={f.useB}
          onChange={(e) => setF({ ...f, useB: e.target.checked })}
        />{" "}
        Test a second message (A/B)
      </label>
      {f.useB && (
        <div className="grid gap-1.5">
          <Label htmlFor="c-b">Message (variant B)</Label>
          <Textarea
            id="c-b"
            rows={3}
            value={f.b}
            onChange={(e) => setF({ ...f, b: e.target.value })}
          />
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button onClick={submit} disabled={busy}>
          {busy ? "Saving…" : "Save as draft"}
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
      {msg && (
        <p role="alert" className="text-sm text-destructive">
          {msg}
        </p>
      )}
    </div>
  );
}

function CampaignCard({
  campaign: c,
  tenantId,
  onChanged,
}: {
  campaign: CampaignSummary;
  tenantId: string;
  onChanged: () => Promise<void>;
}) {
  const send = useServerFn(sendCampaign);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const launch = async () => {
    if (!confirm(`Send "${c.name}" now? Automated sends only go out 07:00–20:00 SAST.`)) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await send({ data: { tenantId, campaignId: c.id } });
      setMsg(
        r.ok
          ? r.heldForApproval
            ? `${r.queued} queued and ${r.heldForApproval} held for manager approval.`
            : `Queued for ${r.audience} guests.`
          : r.error,
      );
      await onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="glass-card grid gap-4 rounded-2xl border border-border p-5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-medium text-foreground">{c.name}</h2>
          <p className="text-xs text-muted-foreground">{SEGMENT_LABEL[c.segment]}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs ${c.status === "sent" ? "bg-forest-soft text-forest" : "bg-secondary text-muted-foreground"}`}
        >
          {c.status === "sent" ? "Sent" : "Draft"}
        </span>
      </div>
      <p className="whitespace-pre-wrap rounded-xl bg-card p-3 text-sm text-muted-foreground">
        {c.messageA}
      </p>
      {c.messageB && (
        <p className="whitespace-pre-wrap rounded-xl bg-card p-3 text-sm text-muted-foreground">
          {c.messageB}
        </p>
      )}

      {c.status === "sent" ? (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-[11px] text-muted-foreground">Sent to</dt>
              <dd className="font-display text-lg text-foreground">{c.sentCount}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Booked within 7 days</dt>
              <dd className="font-display text-lg text-foreground">{c.bookings}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-muted-foreground">Guest spend recorded</dt>
              <dd className="font-display text-lg text-forest">{formatZAR(c.revenueCents)}</dd>
            </div>
          </dl>
          {c.variantB && (
            <p className="text-xs text-muted-foreground">
              Variant B: {c.variantB.sentCount} sent · {c.variantB.bookings} booked ·{" "}
              {formatZAR(c.variantB.revenueCents)} recorded
            </p>
          )}
        </>
      ) : (
        <Button onClick={launch} disabled={busy}>
          <Send className="size-4" /> {busy ? "Sending…" : "Send campaign"}
        </Button>
      )}
      {msg && (
        <p role="status" className="text-sm text-muted-foreground">
          {msg}
        </p>
      )}
    </article>
  );
}
