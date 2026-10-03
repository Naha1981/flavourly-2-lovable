import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { demoRestaurant } from "./mock-data";
import {
  getRestaurantProfile,
  updateRestaurantProfile,
  type RestaurantProfileRecord,
} from "./restaurant-profile.functions";

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

export const defaultProfile: RestaurantProfile = {
  slug: demoRestaurant.slug,
  name: demoRestaurant.name,
  ownerName: "",
  city: demoRestaurant.city,
  cuisine: demoRestaurant.cuisine,
  hours: "",
  averageCheck: 0,
  notes: "",
  managerPhone: "",
  waAccountId: null,
  waConnected: false,
  testSent: false,
  aiTested: false,
};

export const slugify = (v: string) =>
  v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "restaurant";

/** Legacy no-op kept so older callers do not write tenant state into the browser. */
export function patchStoredProfile(_patch: Partial<RestaurantProfile>) {
  return;
}

function mergeRecord(record: RestaurantProfileRecord): RestaurantProfile {
  return {
    ...defaultProfile,
    slug: record.tenantId,
    name: record.name,
    ownerName: record.ownerName,
    city: record.city,
    cuisine: record.cuisine,
    hours: record.hours,
    averageCheck: record.averageCheck,
    notes: record.notes,
    managerPhone: record.managerPhone,
    waAccountId: record.waAccountId,
  };
}

export function useRestaurantProfile() {
  const load = useServerFn(getRestaurantProfile);
  const save = useServerFn(updateRestaurantProfile);
  const [profile, setProfile] = useState<RestaurantProfile>(defaultProfile);
  const [ready, setReady] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    load()
      .then((record) => {
        if (!active || !record) return;
        setProfile((prev) => ({
          ...mergeRecord(record),
          testSent: prev.testSent,
          aiTested: prev.aiTested,
          waConnected: prev.waConnected,
        }));
      })
      .catch((error) => console.error("restaurant profile load failed", error))
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [load]);

  const persist = useCallback(async (value: RestaurantProfile) => {
    await save({
      data: {
        tenantId: value.slug,
        name: value.name,
        ownerName: value.ownerName,
        city: value.city,
        cuisine: value.cuisine,
        hours: value.hours,
        averageCheck: value.averageCheck,
        notes: value.notes,
        managerPhone: value.managerPhone,
        waAccountId: value.waAccountId,
      },
    });
  }, [save]);

  const saveNow = useCallback(async (patch: Partial<RestaurantProfile> = {}) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    const next = { ...profile, ...patch, slug: profile.slug };
    setProfile(next);
    await persist(next);
  }, [persist, profile]);

  const update = useCallback(
    (patch: Partial<RestaurantProfile>) => {
      setProfile((prev) => {
        const next = { ...prev, ...patch, slug: prev.slug };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          void persist(next).catch((error) => console.error("restaurant profile save failed", error));
        }, 500);
        return next;
      });
    },
    [persist],
  );

  return { profile, update, saveNow, ready };
}