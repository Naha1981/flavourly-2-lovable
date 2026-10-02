import { supabase } from "@/integrations/supabase/client";
import { createWorkspace, getAuthConfig, myWorkspace, type Workspace } from "./workspace.functions";

export const isAuthRequired = async () => {
  try {
    return (await getAuthConfig()).required;
  } catch {
    return false;
  }
};

/** Loads (or, on first sign-in, creates) the caller workspace. */
export async function enterWorkspace(fallbackName?: string): Promise<Workspace | null> {
  let ws = await myWorkspace();
  if (!ws) {
    const { data } = await supabase.auth.getUser();
    const name = fallbackName ?? (data.user?.user_metadata?.["restaurant"] as string | undefined);
    if (!name) return null;
    ws = await createWorkspace({ data: { restaurantName: name } });
  }
  return ws;
}

export const signOut = async () => {
  await supabase.auth.signOut();
};