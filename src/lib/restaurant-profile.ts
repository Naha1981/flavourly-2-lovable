import { useCallback, useEffect, useState } from "react";

import { demoRestaurant } from "./mock-data";

/**
 * Restaurant workspace profile. Stored in the browser for now; swap load/save
 * for backend calls when a database is connected — the hook API stays the same.
 */
export type RestaurantProfile = {
  slug: string;
  name: string;
  ownerName: string;
  city: string;
  cuisine: string;
  hours: string;
  averageCheck: number;
  notes: string;
  managerPhone: string;
  waAccountId: string | null;
  waConnected: boolean;
  testSent: boolean;
  aiTested: boolean;
};

const KEY = "flavourly.profile.v1";

export const defaultProfile: RestaurantProfile = {
  slug: demoRestaurant.slug,
  name: demoRestaurant.name,
  ownerName: "Warren",
  city: demoRestaurant.city,
  cuisine: demoRestaurant.cuisine,
  hours: "Tue–Sun 12:00–22:00, closed Mondays",
  averageCheck: 615,
  notes: "Private room seats 40. Corkage R80. Parking in the basement.",
  managerPhone: "",
  waAccountId: null,
  waConnected: false,
  testSent: false,
  aiTested: false,
};

export const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "restaurant";

export function useRestaurantProfile() {
  const [profile, setProfile] = useState<RestaurantProfile>(defaultProfile);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setProfile({ ...defaultProfile, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const update = useCallback((patch: Partial<RestaurantProfile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { profile, update, ready };
}
