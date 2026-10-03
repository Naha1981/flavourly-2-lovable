import { db } from "../db.server";
import { askNahaLLM, providerStatuses, runExternalResearch } from "./providers.server";
import { linkEvidence, listEvidence, recordEvidence } from "./evidence.server";
import type { RevenueAction, RevenueEmployeeMode, RevenueOpportunity, RevenueSnapshot } from "./types";

type Config = {
  mode: RevenueEmployeeMode;
  maxSteps: number;
  maxToolCalls: number;
  dailyRunLimit: number;
  externalResearchEnabled: boolean;
};

const defaultConfig: Config = {
  mode: "approval_only",
  maxSteps: 12,
  maxToolCalls: 40,
  dailyRunLimit: 8,
  externalResearchEnabled: true,
};

const mapOpportunity = (row: Record<string, unknown>): RevenueOpportunity => ({
  id: String(row['id']),
  opportunityType: String(row['opportunity_type']),
  title: String(row['title']),
  description: String(row['description']),
  evidenceSummary: row['evidence_summary'] ? String(row['evidence_summary']) : null,
  estimatedImpactCents: row['estimated_impact_cents'] === null ? null : Number(row['estimated_impact_cents']),
  confidence: row['confidence'] === null ? null : Number(row['confidence']),
  recommendedAction: String(row['recommended_action']),
  status: row['status'] as RevenueOpportunity["status"],
  createdAt: String(row['created_at']),
  metadata: (row['metadata'] as Record<string, unknown> | null) ?? {},
});

const mapAction = (row: Record<string, unknown>): RevenueAction => ({
  id: String(row['id']),
  opportunityId: row['opportunity_id'] ? String(row['opportunity_id']) : null,
  actionType: String(row['action_type']),
  status: row['status'] as RevenueAction["status"],
  payload: (row['payload'] as Record<string, unknown> | null) ?? {},
  resultSummary: row['result_summary'] ? String(row['result_summary']) : null,
  externalRef: row['external_ref'] ? String(row['external_ref']) : null,
  createdAt: String(row['created_at']),
});

const money = (cents: number | null | undefined) =>
  cents == null
    ? "R0"
    : new Intl.NumberFormat("en-ZA", {
        style: "currency",
        currency: "ZAR",
        maximumFractionDigits: 0,
      }).format(cents / 100);

async function getConfig(tenantId: string): Promise<Config> {
  const c = await db();
  const { data } = await c.from("revenue_employee_config").select("*").eq("tenant_id", tenantId).maybeSingle();
  if (!data) return defaultConfig;
  return {
    mode: data.mode as RevenueEmployeeMode,
    maxSteps: Number(data.max_steps),
    maxToolCalls: Number(data.max_tool_calls),
    dailyRunLimit: Number(data.daily_run_limit),
    externalResearchEnabled: Boolean(data.external_research_enabled),
  };
}

export async function getRevenueEmployeeConfig(tenantId: string) {
  return getConfig(tenantId);
}

export async function setRevenueEmployeeMode(tenantId: string, mode: RevenueEmployeeMode) {
  const c = await db();
  const { error } = await c.from("revenue_employee_config").upsert({
    tenant_id: tenantId,
    mode,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  return getConfig(tenantId);
}

async function dailyRunCount(tenantId: string) {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const c = await db();
  const { count, error } = await c
    .from("revenue_agent_runs")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("started_at", since.toISOString());
  if (error) throw new Error(error.message);
  return Number(count ?? 0);
}

async function createOpportunity(input: {
  tenantId: string;
  opportunityType: string;
  title: string;
  description: string;
  evidenceSummary: string;
  estimatedImpactCents?: number | null;
  confidence: number;
  recommendedAction: string;
  metadata?: Record<string, unknown>;
  evidenceIds: string[];
}) {
  const c = await db();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await c
    .from("revenue_opportunities")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("title", input.title)
    .eq("status", "open")
    .gte("created_at", cutoff)
    .maybeSingle();

  if (existing) return mapOpportunity(existing as Record<string, unknown>);

  const { data, error } = await c
    .from("revenue_opportunities")
    .insert({
      tenant_id: input.tenantId,
      opportunity_type: input.opportunityType,
      title: input.title,
      description: input.description,
      evidence_summary: input.evidenceSummary,
      estimated_impact_cents: input.estimatedImpactCents ?? null,
      confidence: input.confidence,
      recommended_action: input.recommendedAction,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Opportunity could not be created.");
  for (const evidenceId of input.evidenceIds) await linkEvidence(String(data.id), evidenceId);

  const { error: actionError } = await c.from("revenue_actions").insert({
    tenant_id: input.tenantId,
    opportunity_id: data.id,
    action_type: "create_campaign_draft",
    status: "pending_approval",
    approval_required: true,
    payload: {
      campaignName: input.title,
      segment: input.metadata?.segment ?? "dormant_30",
      message: input.metadata?.message ?? input.recommendedAction,
    },
  });
  if (actionError) throw new Error(actionError.message);

  return mapOpportunity(data as Record<string, unknown>);
}

async function localAnalysis(tenantId: string, restaurantName: string) {
  const c = await db();
  const [menuRes, customersRes, incidentsRes, reservationsRes] = await Promise.all([
    c
      .from("menu_items")
      .select("id, name, price_cents, cost_price_cents, sales_count_30d, is_available")
      .eq("tenant_id", tenantId)
      .eq("is_available", true)
      .limit(500),
    c
      .from("customers")
      .select("id, total_spend_cents, last_visit_at, is_vip, visit_count")
      .eq("tenant_id", tenantId)
      .limit(5000),
    c
      .from("reputation_incidents")
      .select("id, rating, resolution_status, created_at")
      .eq("tenant_id", tenantId)
      .in("resolution_status", ["open", "investigating"])
      .limit(500),
    c
      .from("reservations")
      .select("reservation_date, party_size, status")
      .eq("tenant_id", tenantId)
      .gte("reservation_date", new Date(Date.now() - 56 * 86400000).toISOString().slice(0, 10))
      .limit(5000),
  ]);

  const opportunities: RevenueOpportunity[] = [];
  const evidenceIds: string[] = [];

  const lowMargin = (menuRes.data ?? [])
    .filter((item) => item.cost_price_cents !== null && Number(item.price_cents) > 0)
    .map((item) => ({
      ...item,
      marginPct: (Number(item.price_cents) - Number(item.cost_price_cents)) / Number(item.price_cents),
    }))
    .filter((item) => item.marginPct < 0.4)
    .sort((a, b) => Number(b.sales_count_30d) - Number(a.sales_count_30d));

  if (lowMargin[0]) {
    const item = lowMargin[0];
    const evidence = await recordEvidence({
      tenantId,
      sourceType: "restaurant_data",
      provider: "flavourly",
      evidenceState: "VERIFIED",
      title: "Low-margin menu item: " + item.name,
      content:
        item.name +
        " is priced at " +
        money(Number(item.price_cents)) +
        " with recorded cost " +
        money(Number(item.cost_price_cents)) +
        ". Gross margin is approximately " +
        Math.round(item.marginPct * 100) +
        "% across " +
        Number(item.sales_count_30d) +
        " recorded sales in 30 days.",
      confidence: 1,
      metadata: { itemId: item.id, marginPct: item.marginPct },
    });
    evidenceIds.push(evidence.id);
    opportunities.push(
      await createOpportunity({
        tenantId,
        opportunityType: "margin_leak",
        title: "Review " + item.name + " margin",
        description: "A currently available menu item is below the 40% gross-margin threshold used by the Revenue Employee.",
        evidenceSummary:
          "Verified menu data shows " +
          item.name +
          " at roughly " +
          Math.round(item.marginPct * 100) +
          "% gross margin.",
        estimatedImpactCents: Math.max(
          0,
          Math.round((0.4 - item.marginPct) * Number(item.price_cents) * Math.max(1, Number(item.sales_count_30d))),
        ),
        confidence: 0.98,
        recommendedAction: "Validate ingredient cost and portioning before pushing more demand to this item.",
        metadata: {
          segment: "all",
          message: "Flavourly found a margin opportunity around " + item.name + ". Review the item before promoting it more heavily.",
        },
        evidenceIds: [evidence.id],
      }),
    );
  }

  const dormant = (customersRes.data ?? []).filter(
    (customer) => customer.last_visit_at && Date.now() - new Date(String(customer.last_visit_at)).getTime() >= 60 * 86400000,
  );
  if (dormant.length) {
    const historicalSpend = dormant.reduce((sum, row) => sum + Number(row['total_spend_cents'] ?? 0), 0);
    const evidence = await recordEvidence({
      tenantId,
      sourceType: "customer_data",
      provider: "flavourly",
      evidenceState: "VERIFIED",
      title: dormant.length + " dormant guests",
      content:
        "Verified customer data shows " +
        dormant.length +
        " guests with no recorded visit in at least 60 days. Historical spend in this cohort is " +
        money(historicalSpend) +
        ".",
      confidence: 1,
      metadata: { dormantCount: dormant.length, historicalSpendCents: historicalSpend },
    });
    evidenceIds.push(evidence.id);
    opportunities.push(
      await createOpportunity({
        tenantId,
        opportunityType: "retention",
        title: "Reactivate " + dormant.length + " dormant guests",
        description: "A known customer cohort has moved beyond the 60-day return window.",
        evidenceSummary: "Verified customer data: " + dormant.length + " dormant guests and " + money(historicalSpend) + " historical spend.",
        estimatedImpactCents: Math.round(historicalSpend * 0.08),
        confidence: 0.9,
        recommendedAction: "Draft a small reactivation campaign first, then measure bookings and revenue before scaling.",
        metadata: {
          segment: "dormant_60",
          message: "Hi {{name}}, we have missed you at " + restaurantName + ". Reply BOOK and we will help you choose a table.",
        },
        evidenceIds: [evidence.id],
      }),
    );
  }

  const incidents = incidentsRes.data ?? [];
  if (incidents.length) {
    const severe = incidents.filter((row) => Number(row['rating']) <= 2).length;
    const evidence = await recordEvidence({
      tenantId,
      sourceType: "reputation",
      provider: "flavourly",
      evidenceState: "VERIFIED",
      title: incidents.length + " unresolved reputation incidents",
      content: incidents.length + " feedback incidents remain open; " + severe + " are rated 1-2 stars.",
      confidence: 1,
      metadata: { openCount: incidents.length, severeCount: severe },
    });
    evidenceIds.push(evidence.id);
    opportunities.push(
      await createOpportunity({
        tenantId,
        opportunityType: "reputation",
        title: "Resolve " + incidents.length + " open guest-recovery issues",
        description: "Unresolved negative feedback should be handled before broad promotional activity is increased.",
        evidenceSummary: "Verified reputation data shows " + incidents.length + " open incidents, including " + severe + " rated 1-2 stars.",
        confidence: 0.95,
        recommendedAction: "Review the incident queue and complete service recovery before pushing a larger campaign.",
        metadata: {
          segment: "all",
          message: "Hi {{name}}, we are following up on your recent visit because your feedback matters to us.",
        },
        evidenceIds: [evidence.id],
      }),
    );
  }

  const upcomingCovers = (reservationsRes.data ?? [])
    .filter((row) => new Date(String(row['reservation_date']) + "T12:00:00").getTime() >= Date.now() - 7 * 86400000)
    .reduce((sum, row) => sum + Number(row['party_size'] ?? 0), 0);
  if (upcomingCovers) {
    const evidence = await recordEvidence({
      tenantId,
      sourceType: "reservation_data",
      provider: "flavourly",
      evidenceState: "VERIFIED",
      title: "Current reservation picture",
      content: "The current planning window contains " + upcomingCovers + " reserved covers.",
      confidence: 1,
      metadata: { covers: upcomingCovers },
    });
    evidenceIds.push(evidence.id);
  }

  return { opportunities, evidenceIds };
}

function extractSignals(data: unknown) {
  if (!data || typeof data !== "object") return [];
  const value = data as Record<string, unknown>;
  const list = Array.isArray(value.signals) ? value.signals : Array.isArray(value.results) ? value.results : [];
  return list.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    return [
      {
        title: String(row['title'] ?? row['type'] ?? "External signal"),
        content: String(row['content'] ?? row['text'] ?? row['summary'] ?? "Observed external signal."),
        url: row['url'] ? String(row['url']) : null,
        confidence: row['confidence'] === undefined ? 0.55 : Number(row['confidence']),
      },
    ];
  });
}

async function summarise(
  profile: { name: string; city: string; cuisine: string },
  opportunities: RevenueOpportunity[],
  external: unknown[],
) {
  const llm = await askNahaLLM([
    {
      role: "system",
      content:
        "You are the Flavourly Revenue Employee. Summarise only the supplied evidence. Separate verified facts from inference and recommendations. Never invent revenue, customer counts, prices or external demand. Keep the answer under 180 words.",
    },
    {
      role: "user",
      content: JSON.stringify({
        restaurant: profile,
        opportunities: opportunities.map((item) => ({
          title: item.title,
          description: item.description,
          confidence: item.confidence,
          estimatedImpactCents: item.estimatedImpactCents,
          recommendation: item.recommendedAction,
        })),
        external,
      }).slice(0, 28000),
    },
  ]);
  if (llm) return llm;
  if (!opportunities.length) {
    return "No material opportunity was found in the current restaurant data. Configure external providers when you want Flavourly to investigate public demand and competitor signals.";
  }
  return opportunities
    .slice(0, 3)
    .map((item) => item.title + ": " + item.recommendedAction)
    .join("\n");
}

export async function runRevenueEmployee(input: { tenantId: string; objective?: string }) {
  const config = await getConfig(input.tenantId);
  if (config.mode === "disabled") {
    return { ok: false as const, error: "Revenue Employee is disabled for this restaurant." };
  }
  if ((await dailyRunCount(input.tenantId)) >= config.dailyRunLimit) {
    return { ok: false as const, error: "Daily Revenue Employee run limit reached." };
  }

  const c = await db();
  const { data: profile } = await c
    .from("tenant_profiles")
    .select("name, city, cuisine")
    .eq("tenant_id", input.tenantId)
    .maybeSingle();
  if (!profile) return { ok: false as const, error: "Restaurant profile is not configured." };

  const objective =
    input.objective?.trim() ||
    "Find the most useful revenue, margin, customer, reputation or demand opportunities for this restaurant today.";

  const { data: run, error: runError } = await c
    .from("revenue_agent_runs")
    .insert({ tenant_id: input.tenantId, objective, mode: config.mode })
    .select("id")
    .single();
  if (runError || !run) throw new Error(runError?.message ?? "Revenue Employee run could not start.");

  try {
    const local = await localAnalysis(input.tenantId, String(profile.name));
    const externalResults = config.externalResearchEnabled
      ? await runExternalResearch({
          tenantId: input.tenantId,
          restaurantName: String(profile.name),
          city: String(profile.city ?? ""),
          objective,
        })
      : [];

    let externalEvidenceCount = 0;
    for (const result of externalResults) {
      if (!result.ok) continue;
      for (const signal of extractSignals(result.data)) {
        const stored = await recordEvidence({
          tenantId: input.tenantId,
          sourceType: "external_research",
          provider: result.provider,
          evidenceState: "INFERRED",
          title: signal.title,
          content: signal.content,
          sourceUrl: signal.url,
          confidence: signal.confidence,
          metadata: { provider: result.provider },
        });
        if (stored.created) externalEvidenceCount += 1;
      }
    }

    const summary = await summarise(
      { name: String(profile.name), city: String(profile.city ?? ""), cuisine: String(profile.cuisine ?? "") },
      local.opportunities,
      externalResults.filter((item) => item.ok),
    );

    await c
      .from("revenue_agent_runs")
      .update({
        status: "completed",
        steps: Math.min(config.maxSteps, 4 + local.opportunities.length),
        tool_calls: Math.min(config.maxToolCalls, 4 + externalResults.length),
        opportunities_found: local.opportunities.length,
        evidence_count: local.evidenceIds.length + externalEvidenceCount,
        summary,
        finished_at: new Date().toISOString(),
        metadata: {
          externalProviders: externalResults.filter((item) => item.ok).map((item) => item.provider),
          objective,
        },
      })
      .eq("id", run.id);

    return {
      ok: true as const,
      runId: String(run.id),
      summary,
      opportunities: local.opportunities.length,
    };
  } catch (error) {
    await c
      .from("revenue_agent_runs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Revenue Employee run failed.",
      })
      .eq("id", run.id);
    throw error;
  }
}

export async function listRevenueEmployeeSnapshot(tenantId: string): Promise<RevenueSnapshot> {
  const [config, evidence] = await Promise.all([getConfig(tenantId), listEvidence(tenantId)]);
  const c = await db();
  const [oppRes, actionRes, runRes] = await Promise.all([
    c
      .from("revenue_opportunities")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(50),
    c
      .from("revenue_actions")
      .select("*")
      .eq("tenant_id", tenantId)
      .in("status", ["pending_approval", "approved", "executed"])
      .order("created_at", { ascending: false })
      .limit(50),
    c
      .from("revenue_agent_runs")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("started_at", { ascending: false })
      .limit(1),
  ]);

  return {
    mode: config.mode,
    opportunities: (oppRes.data ?? []).map((row) => mapOpportunity(row as Record<string, unknown>)),
    actions: (actionRes.data ?? []).map((row) => mapAction(row as Record<string, unknown>)),
    evidence,
    providers: providerStatuses(),
    latestRun: runRes.data?.[0]
      ? {
          id: String(runRes.data[0].id),
          status: runRes.data[0].status as "running" | "completed" | "failed",
          objective: String(runRes.data[0].objective),
          summary: runRes.data[0].summary ? String(runRes.data[0].summary) : null,
          steps: Number(runRes.data[0].steps),
          toolCalls: Number(runRes.data[0].tool_calls),
          opportunitiesFound: Number(runRes.data[0].opportunities_found),
          evidenceCount: Number(runRes.data[0].evidence_count),
          startedAt: String(runRes.data[0].started_at),
          finishedAt: runRes.data[0].finished_at ? String(runRes.data[0].finished_at) : null,
        }
      : null,
  };
}

export async function approveRevenueAction(input: { tenantId: string; actionId: string; approvedBy: string }) {
  const c = await db();
  const { data: action } = await c
    .from("revenue_actions")
    .select("*")
    .eq("tenant_id", input.tenantId)
    .eq("id", input.actionId)
    .maybeSingle();

  if (!action) return { ok: false as const, error: "Action not found." };
  if (action['status'] !== "pending_approval") return { ok: false as const, error: "This action has already been resolved." };
  if (!input.approvedBy.trim()) return { ok: false as const, error: "Approver identity is required." };

  const payload = (action['payload'] as Record<string, unknown>) ?? {};
  if (action['action_type'] !== "create_campaign_draft") {
    return { ok: false as const, error: "Unsupported Revenue Employee action." };
  }

  const { data: campaign, error } = await c
    .from("campaigns")
    .insert({
      tenant_id: input.tenantId,
      name: String(payload.campaignName ?? "Flavourly Revenue Employee Campaign"),
      segment: String(payload.segment ?? "dormant_30"),
      message_a: String(payload.message ?? "Flavourly recommends a controlled guest follow-up."),
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !campaign) {
    await c
      .from("revenue_actions")
      .update({ status: "failed", error: error?.message ?? "Campaign draft could not be created." })
      .eq("tenant_id", input.tenantId)
      .eq("id", input.actionId);
    return { ok: false as const, error: error?.message ?? "Campaign draft could not be created." };
  }

  await c
    .from("revenue_actions")
    .update({
      status: "executed",
      approved_by: input.approvedBy,
      approved_at: new Date().toISOString(),
      executed_at: new Date().toISOString(),
      external_ref: String(campaign.id),
      result_summary: "Campaign draft created. No customer messages were sent.",
    })
    .eq("tenant_id", input.tenantId)
    .eq("id", input.actionId);

  if (action['opportunity_id']) {
    await c
      .from("revenue_opportunities")
      .update({ status: "executed", addressed_at: new Date().toISOString() })
      .eq("tenant_id", input.tenantId)
      .eq("id", action['opportunity_id']);
  }

  return { ok: true as const, result: "Campaign draft created. Review it in Campaigns before sending." };
}

export async function askRevenueEmployee(input: { tenantId: string; question: string }) {
  const snapshot = await listRevenueEmployeeSnapshot(input.tenantId);
  const answer = await askNahaLLM([
    {
      role: "system",
      content:
        "Answer the restaurant-owner question using only the supplied Flavourly evidence. Label facts and recommendations. Never invent figures or external signals.",
    },
    {
      role: "user",
      content: JSON.stringify({
        question: input.question,
        latestRun: snapshot.latestRun,
        evidence: snapshot.evidence.slice(0, 15),
        opportunities: snapshot.opportunities.slice(0, 8),
      }).slice(0, 30000),
    },
  ]);
  return (
    answer ??
    (snapshot.latestRun?.summary
      ? snapshot.latestRun.summary + "\n\nUse the open opportunities as the current action list."
      : "Run the Revenue Employee first so I have a current evidence set to answer from.")
  );
}
