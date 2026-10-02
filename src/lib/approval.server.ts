import { db } from "./db.server";

export type ApprovalRequest = {
  id: string;
  outboxJobId: string;
  recipientPhone: string;
  messageText: string;
  riskLevel: "yellow" | "red";
  reason: string;
  status: "pending" | "approved" | "rejected" | "expired";
  requestedAt: string;
};

function mapRow(row: Record<string, unknown>): ApprovalRequest {
  return {
    id: String(row.id),
    outboxJobId: String(row.outbox_job_id),
    recipientPhone: String(row.recipient_phone),
    messageText: String(row.message_text),
    riskLevel: String(row.risk_level) as "yellow" | "red",
    reason: String(row.reason),
    status: String(row.status) as ApprovalRequest["status"],
    requestedAt: String(row.requested_at),
  };
}

export async function createApprovalRequest(input: {
  tenantId: string;
  outboxJobId: string;
  recipientPhone: string;
  messageText: string;
  riskLevel: "yellow" | "red";
  reason: string;
}) {
  const c = await db();
  const { data, error } = await c.from("approval_requests").insert({
    tenant_id: input.tenantId,
    outbox_job_id: input.outboxJobId,
    recipient_phone: input.recipientPhone,
    message_text: input.messageText,
    risk_level: input.riskLevel,
    reason: input.reason,
  }).select("*").single();
  if (error || !data) throw new Error(error?.message ?? "Approval request could not be created.");
  return mapRow(data as Record<string, unknown>);
}

export async function listPendingApprovals(tenantId: string) {
  const c = await db();
  const { data, error } = await c.from("approval_requests")
    .select("*").eq("tenant_id", tenantId).eq("status", "pending")
    .order("requested_at", { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapRow(row as Record<string, unknown>));
}

export async function resolveApproval(input: {
  tenantId: string;
  approvalId: string;
  approved: boolean;
  resolvedBy: string;
}) {
  const c = await db();
  const { data: request } = await c.from("approval_requests")
    .select("id, outbox_job_id, status")
    .eq("tenant_id", input.tenantId).eq("id", input.approvalId).maybeSingle();
  if (!request) return { ok: false as const, error: "Approval request not found." };
  if (request.status !== "pending") return { ok: false as const, error: "This approval has already been resolved." };

  const nextStatus = input.approved ? "approved" : "rejected";
  const { data: updated } = await c.from("approval_requests").update({
    status: nextStatus,
    resolved_at: new Date().toISOString(),
    resolved_by: input.resolvedBy,
  }).eq("tenant_id", input.tenantId).eq("id", input.approvalId).eq("status", "pending").select("id");
  if (!updated?.length) return { ok: false as const, error: "Another manager already resolved this request." };

  if (input.approved) {
    await c.from("outbox_jobs").update({
      status: "pending",
      scheduled_for: new Date().toISOString(),
      error: null,
    }).eq("tenant_id", input.tenantId).eq("id", request.outbox_job_id);
  } else {
    await c.from("outbox_jobs").update({
      status: "rejected",
      error: "Rejected by manager.",
    }).eq("tenant_id", input.tenantId).eq("id", request.outbox_job_id);
  }
  return { ok: true as const, status: nextStatus };
}
