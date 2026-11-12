export type EvidenceState = "VERIFIED" | "INFERRED" | "ESTIMATED" | "UNKNOWN";

export type ProviderKind =
  | "nahallm"
  | "agent_reach"
  | "jev"
  | "jev_social"
  | "demand_radar"
  | "content_os"
  | "video_engine"
  | "openpost"
  | "brightbean"
  | "mixpost"
  | "whatsapp_operator";

export type RevenueEmployeeMode = "disabled" | "shadow" | "approval_only" | "active";

export type EvidenceRecord = {
  id: string;
  sourceType: string;
  provider: string;
  evidenceState: EvidenceState;
  title: string;
  content: string;
  sourceUrl: string | null;
  observedAt: string;
  confidence: number | null;
};

export type RevenueOpportunity = {
  id: string;
  opportunityType: string;
  title: string;
  description: string;
  evidenceSummary: string | null;
  estimatedImpactCents: number | null;
  confidence: number | null;
  recommendedAction: string;
  status: "open" | "approved" | "executed" | "dismissed" | "expired";
  createdAt: string;
  metadata: Record<string, string | number | boolean | null | string[]>;
};

export type RevenueAction = {
  id: string;
  opportunityId: string | null;
  actionType: string;
  status: "pending_approval" | "approved" | "rejected" | "executed" | "failed";
  payload: Record<string, string | number | boolean | null | string[]>;
  resultSummary: string | null;
  externalRef: string | null;
  createdAt: string;
};

export type ProviderStatus = {
  provider: ProviderKind;
  configured: boolean;
  label: string;
  mode: "api" | "browser" | "service" | "native";
};

export type RevenueSnapshot = {
  mode: RevenueEmployeeMode;
  opportunities: RevenueOpportunity[];
  actions: RevenueAction[];
  evidence: EvidenceRecord[];
  providers: ProviderStatus[];
  latestRun: {
    id: string;
    status: "running" | "completed" | "failed";
    objective: string;
    summary: string | null;
    steps: number;
    toolCalls: number;
    opportunitiesFound: number;
    evidenceCount: number;
    startedAt: string;
    finishedAt: string | null;
  } | null;
};
