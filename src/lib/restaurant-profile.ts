import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

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
  slug: "",
  name: "",
  ownerName: "",
  city: "",
  cuisine: "",
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
  v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "restaurant";

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
  const [error, setError] = useState<string | null>(null);
  const profileRef = useRef<RestaurantProfile>(defaultProfile);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let active = true;
    load()
      .then((record) => {
        if (!active) return;
        if (!record) {
          setError("No restaurant is linked to this account. Please sign in again.");
          return;
        }
        const next = mergeRecord(record);
        profileRef.current = next;
        setProfile(next);
        setError(null);
      })
      .catch(() => {
        if (active) setError("Your restaurant could not load. Reload to try again.");
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [load]);

  const persist = useCallback(
    async (value: RestaurantProfile) => {
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
      setError(null);
    },
    [save],
  );

  const queueSave = useCallback(
    (value: RestaurantProfile) => {
      const task = saveQueue.current.catch(() => undefined).then(() => persist(value));
      saveQueue.current = task;
      return task;
    },
    [persist],
  );

  const saveNow = useCallback(
    async (patch: Partial<RestaurantProfile> = {}) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      const next = { ...profileRef.current, ...patch, slug: profileRef.current.slug };
      profileRef.current = next;
      setProfile(next);
      try {
        await queueSave(next);
      } catch (failure) {
        setError("Your changes could not be saved. Please try again.");
        throw failure;
      }
    },
    [queueSave],
  );

  const update = useCallback(
    (patch: Partial<RestaurantProfile>) => {
      const next = { ...profileRef.current, ...patch, slug: profileRef.current.slug };
      profileRef.current = next;
      setProfile(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        void queueSave(next).catch(() =>
          setError("Your changes could not be saved. Please try again."),
        );
      }, 500);
    },
    [queueSave],
  );

  return { profile, update, saveNow, ready, error };
}
