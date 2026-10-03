export type CompetitorMenuItem = {
  name: string;
  priceCents?: number | null;
  category?: string | null;
};

export type MenuComparison = {
  matched: string[];
  onlyRestaurant: string[];
  onlyCompetitor: string[];
  overlapPercent: number;
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function compareMenus(
  restaurantItems: Array<{ name: string }>,
  competitorItems: CompetitorMenuItem[],
): MenuComparison {
  const restaurant = new Map(restaurantItems.map((item) => [normalize(item.name), item.name]));
  const competitor = new Map(competitorItems.map((item) => [normalize(item.name), item.name]));
  const matched = [...restaurant.keys()]
    .filter((key) => competitor.has(key))
    .map((key) => restaurant.get(key))
    .filter((value): value is string => Boolean(value));
  const onlyRestaurant = [...restaurant.keys()]
    .filter((key) => !competitor.has(key))
    .map((key) => restaurant.get(key))
    .filter((value): value is string => Boolean(value));
  const onlyCompetitor = [...competitor.keys()]
    .filter((key) => !restaurant.has(key))
    .map((key) => competitor.get(key))
    .filter((value): value is string => Boolean(value));
  const denominator = new Set([...restaurant.keys(), ...competitor.keys()]).size;
  return {
    matched,
    onlyRestaurant,
    onlyCompetitor,
    overlapPercent: denominator ? Math.round((matched.length / denominator) * 100) : 0,
  };
}

export function pricePosition(
  restaurantPriceCents: number,
  competitorPricesCents: number[],
) {
  const valid = competitorPricesCents.filter((value) => Number.isFinite(value) && value >= 0);
  if (!valid.length) return { medianCents: null, deltaPercent: null };
  const sorted = [...valid].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return {
    medianCents: median,
    deltaPercent: median ? Math.round(((restaurantPriceCents - median) / median) * 1000) / 10 : null,
  };
}
