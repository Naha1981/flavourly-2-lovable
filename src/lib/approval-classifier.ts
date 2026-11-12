export type ApprovalRiskLevel = "green" | "yellow" | "red";

export type ApprovalDecision =
  | { outcome: "auto_send"; riskLevel: "green" }
  | { outcome: "require_approval"; riskLevel: "yellow" | "red"; reason: string };

const RED_SIGNALS = [
  "refund","money back","reimburse","food poisoning","injury","sue","lawyer","legal",
  "chargeback","compensation","manager immediately",
];
const YELLOW_SIGNALS = [
  "discount","promo","offer","voucher","free drink","complimentary","special price",
  "deal","2-for-1","happy hour","sorry","apolog",
];

function hit(text: string, signals: string[]) {
  const lower = (text ?? "").toLowerCase();
  return signals.find((signal) => lower.includes(signal)) ?? null;
}

export function classifyMessageRisk(text: string): ApprovalRiskLevel {
  if (!text?.trim()) return "yellow";
  if (hit(text, RED_SIGNALS)) return "red";
  if (hit(text, YELLOW_SIGNALS)) return "yellow";
  return "green";
}

export function decideApproval(text: string): ApprovalDecision {
  const riskLevel = classifyMessageRisk(text);
  if (riskLevel === "green") return { outcome: "auto_send", riskLevel };
  return {
    outcome: "require_approval",
    riskLevel,
    reason:
      riskLevel === "red"
        ? "Financial, legal or service-sensitive wording requires manager review before dispatch."
        : "Promotional, offer or apology wording requires manager review before dispatch.",
  };
}
