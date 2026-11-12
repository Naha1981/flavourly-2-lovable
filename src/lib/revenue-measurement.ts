/**
 * Spec section 17 revenue measurement: every rand figure carries a measure
 * kind, and the kinds are reported separately, never summed into one number.
 * A single combined "revenue" total across kinds is exactly the mistake this
 * module exists to prevent.
 *
 * - observed_sales: from connected transaction/payment evidence.
 * - linked_revenue: associated under a stated attribution rule (association,
 *   not proof of causation).
 * - estimated_opportunity: forecast, not earned money.
 * - incremental_sales: above a defensible baseline/comparison.
 * - contribution: after relevant variable costs.
 */
export const REVENUE_MEASURE_KINDS = [
  "observed_sales",
  "linked_revenue",
  "estimated_opportunity",
  "incremental_sales",
  "contribution",
] as const;

export type RevenueMeasureKind = (typeof REVENUE_MEASURE_KINDS)[number];

export type RevenueMeasure = {
  kind: RevenueMeasureKind;
  amountCents: number;
  /** Where the number came from, e.g. "campaign_attribution" or "menu_matrix". */
  source: string;
  /** Required for linked_revenue and incremental_sales. */
  attributionRule?: string;
  /** Required for incremental_sales: the baseline or comparison group. */
  baselineRule?: string;
};

export function validateMeasure(m: RevenueMeasure): RevenueMeasure {
  if ((m.kind === "linked_revenue" || m.kind === "incremental_sales") && !m.attributionRule)
    throw new Error(`${m.kind} requires a stated attribution rule.`);
  if (m.kind === "incremental_sales" && !m.baselineRule)
    throw new Error("incremental_sales requires a stated baseline/comparison.");
  return m;
}

/** Per-kind totals. There is deliberately no combined total field. */
export type RevenueMeasurementReport = Record<RevenueMeasureKind, number>;

export function summarizeMeasures(measures: RevenueMeasure[]): RevenueMeasurementReport {
  const totals = Object.fromEntries(
    REVENUE_MEASURE_KINDS.map((k) => [k, 0]),
  ) as RevenueMeasurementReport;
  for (const raw of measures) {
    const m = validateMeasure(raw);
    totals[m.kind] += m.amountCents;
  }
  return totals;
}
