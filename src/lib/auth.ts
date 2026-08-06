import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of session state for the UI. Auth is email magic link /
 * invite token only — the app never generates a password for anyone.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      setSession(next);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export type Membership = {
  organisation_id: string;
  role: "owner" | "admin" | "surveyor" | "viewer" | "supervisor";
};

export async function fetchMemberships(user: User | null): Promise<Membership[]> {
  if (!user) return [];
  const { data, error } = await supabase
    .from("memberships")
    .select("organisation_id, role")
    .eq("user_id", user.id);
  if (error) throw error;
  return (data ?? []) as Membership[];
}

/** Sends a one-time sign-in link. No password is ever created or transmitted. */
export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

/** First user to arrive creates their organisation and becomes its owner. */
export async function createOrganisation(name: string) {
  const { data, error } = await supabase.rpc("create_organisation", { _name: name });
  if (error) throw error;
  return data;
}

export async function setOwnPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() {
  await supabase.auth.signOut();
}
