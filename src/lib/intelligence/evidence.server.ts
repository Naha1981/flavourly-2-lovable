import { createHash } from "node:crypto";
import { db } from "../db.server";
import type { EvidenceRecord, EvidenceState, ProviderKind } from "./types";

export async function recordEvidence(input: {
  tenantId: string;
  sourceType: string;
  provider: ProviderKind | string;
  evidenceState: EvidenceState;
  title: string;
  content: string;
  sourceUrl?: string | null;
  observedAt?: string;
  publishedAt?: string | null;
  confidence?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const fingerprint = createHash("sha256")
    .update([
      input.tenantId,
      input.provider,
      input.sourceType,
      input.title,
      input.content,
      input.sourceUrl ?? "",
    ].join("\n"))
    .digest("hex");

  const c = await db();
  const { data: existing } = await c
    .from("intelligence_evidence")
    .select("id")
    .eq("tenant_id", input.tenantId)
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  if (existing) return { id: String(existing.id), created: false };

  const { data, error } = await c.from("intelligence_evidence").insert({
    tenant_id: input.tenantId,
    source_type: input.sourceType,
    provider: input.provider,
    evidence_state: input.evidenceState,
    title: input.title,
    content: input.content.slice(0, 20_000),
    source_url: input.sourceUrl ?? null,
    observed_at: input.observedAt ?? new Date().toISOString(),
    published_at: input.publishedAt ?? null,
    confidence: input.confidence ?? null,
    fingerprint,
    metadata: input.metadata ?? {},
  }).select("id").single();

  if (error || !data) throw new Error(error?.message ?? "Evidence could not be stored.");
  return { id: String(data.id), created: true };
}

export async function linkEvidence(opportunityId: string, evidenceId: string) {
  const c = await db();
  const { error } = await c.from("revenue_opportunity_evidence").upsert({
    opportunity_id: opportunityId,
    evidence_id: evidenceId,
  });
  if (error) throw new Error(error.message);
}

export async function listEvidence(tenantId: string, limit = 30): Promise<EvidenceRecord[]> {
  const c = await db();
  const { data, error } = await c.from("intelligence_evidence")
    .select("id, source_type, provider, evidence_state, title, content, source_url, observed_at, confidence")
    .eq("tenant_id", tenantId)
    .order("observed_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    sourceType: String(row.source_type),
    provider: String(row.provider),
    evidenceState: row.evidence_state as EvidenceState,
    title: String(row.title),
    content: String(row.content),
    sourceUrl: row.source_url ? String(row.source_url) : null,
    observedAt: String(row.observed_at),
    confidence: row.confidence === null ? null : Number(row.confidence),
  }));
}
