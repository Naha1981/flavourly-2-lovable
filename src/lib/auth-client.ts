import { supabase } from "@/integrations/supabase/client";
import { createWorkspace, getAuthConfig, myWorkspace, type Workspace } from "./workspace.functions";
import { patchStoredProfile } from "./restaurant-profile";

export const isAuthRequired = async () => {
  try {
    return (await getAuthConfig()).required;
  } catch {
    return false; // if the server can't say, keep the app usable
  }
};

/** Loads (or, on first sign-in, creates) the caller's workspace and points the dashboard at it. */
export async function enterWorkspace(fallbackName?: string): Promise<Workspace | null> {
  let ws = await myWorkspace();
  if (!ws) {
    const { data } = await supabase.auth.getUser();
    const name = fallbackName ?? (data.user?.user_metadata?.["restaurant"] as string | undefined);
    if (!name) return null;
    ws = await createWorkspace({ data: { restaurantName: name } });
  }
  patchStoredProfile({ slug: ws.tenantId, name: ws.name });
  return ws;
}

export const signOut = async () => {
  await supabase.auth.signOut();
};
