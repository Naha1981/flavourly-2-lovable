/** Menu engineering matrix (Stars / Plowhorses / Puzzles / Dogs). Pure and deterministic. */
export type MatrixClass = "STAR" | "PLOWHORSE" | "PUZZLE" | "DOG";

export type MatrixInput = {
  id: string;
  name: string;
  priceCents: number;
  costPriceCents: number | null;
  salesCount30d: number;
  isAvailable: boolean;
};

export type MatrixItem = MatrixInput & {
  costKnown: boolean;
  unitCostCents: number;
  marginCents: number;
  marginPct: number;
  revenueCents30d: number;
  profitCents30d: number;
  cls: MatrixClass;
  action: string;
};

export type MatrixSummary = {
  items: MatrixItem[];
  avgVolume: number;
  avgMarginCents: number;
  /** Spec section 17: item sales x price is observed sales evidence. */
  revenueMeasureKind: "observed_sales";
  revenueCents30d: number;
  profitCents30d: number;
  missingCostCount: number;
  counts: Record<MatrixClass, number>;
};

/** Used only when no cost is recorded, and always flagged as an estimate in the UI. */
export const DEFAULT_FOOD_COST_RATIO = 0.35;

const ACTIONS: Record<MatrixClass, string> = {
  STAR: "Protect the recipe and feature it in marketing.",
  PLOWHORSE: "Popular but thin. Re-cost the recipe or nudge the price up.",
  PUZZLE: "Profitable but overlooked. Reposition it and pair it with best-sellers.",
  DOG: "Slow and thin. Rework it or consider removing it from the menu.",
};

export function classifyMenu(inputs: MatrixInput[]): MatrixSummary {
  const counts: Record<MatrixClass, number> = { STAR: 0, PLOWHORSE: 0, PUZZLE: 0, DOG: 0 };
  if (inputs.length === 0) {
    return {
      items: [],
      avgVolume: 0,
      avgMarginCents: 0,
      revenueMeasureKind: "observed_sales" as const,
      revenueCents30d: 0,
      profitCents30d: 0,
      missingCostCount: 0,
      counts,
    };
  }

  const base = inputs.map((i) => {
    const costKnown = i.costPriceCents !== null && i.costPriceCents !== undefined;
    const unitCostCents = costKnown
      ? (i.costPriceCents as number)
      : Math.round(i.priceCents * DEFAULT_FOOD_COST_RATIO);
    const marginCents = i.priceCents - unitCostCents;
    return {
      ...i,
      costKnown,
      unitCostCents,
      marginCents,
      marginPct: i.priceCents > 0 ? Math.round((marginCents / i.priceCents) * 100) : 0,
      revenueCents30d: i.salesCount30d * i.priceCents,
      profitCents30d: i.salesCount30d * marginCents,
    };
  });

  const avgVolume = base.reduce((s, i) => s + i.salesCount30d, 0) / base.length;
  const avgMarginCents = base.reduce((s, i) => s + i.marginCents, 0) / base.length;

  const items: MatrixItem[] = base.map((i) => {
    // Ties count as "high" so a single-item menu is a Star rather than a Dog.
    const highVol = i.salesCount30d >= avgVolume;
    const highMargin = i.marginCents >= avgMarginCents;
    const cls: MatrixClass = highVol
      ? highMargin
        ? "STAR"
        : "PLOWHORSE"
      : highMargin
        ? "PUZZLE"
        : "DOG";
    counts[cls] += 1;
    return { ...i, cls, action: ACTIONS[cls] };
  });

  return {
    items,
    avgVolume: Math.round(avgVolume),
    avgMarginCents: Math.round(avgMarginCents),
    revenueMeasureKind: "observed_sales" as const,
    revenueCents30d: items.reduce((s, i) => s + i.revenueCents30d, 0),
    profitCents30d: items.reduce((s, i) => s + i.profitCents30d, 0),
    missingCostCount: items.filter((i) => !i.costKnown).length,
    counts,
  };
}
