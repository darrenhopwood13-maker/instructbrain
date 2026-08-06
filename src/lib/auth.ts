import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of session state for the UI. Two ways in: email + password,
 * or a one-time email link for someone on site who cannot type a password
 * one-handed. The app never generates or displays a password for anyone.
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

/* ------------------------------------------------------------------ */
/* Passwords                                                           */
/* ------------------------------------------------------------------ */

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Local rules only. Supabase's own strength and leaked-password checks run
 * server-side and come back through `describeAuthError`.
 */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (password.trim().length === 0) return "A password cannot be only spaces.";
  return null;
}

/**
 * Turns a Supabase auth failure into something a person can act on. A generic
 * "something went wrong" is exactly what locks someone out of their own account.
 */
export function describeAuthError(error: unknown): string {
  if (!error) return "Please try again.";
  const raw = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: string } | null)?.code ?? "";
  const status = (error as { status?: number } | null)?.status;
  const text = `${code} ${raw}`.toLowerCase();

  if (text.includes("invalid login credentials") || code === "invalid_credentials") {
    return "That email and password do not match. Check the password, or use a sign-in link instead.";
  }
  if (text.includes("email not confirmed") || code === "email_not_confirmed") {
    return "That email has not been confirmed yet. Open the confirmation link we emailed you, then sign in.";
  }
  if (code === "user_not_found" || text.includes("user not found")) {
    return "We have no account for that email address. Create one, or check for a typo.";
  }
  if (code === "user_already_exists" || text.includes("already registered")) {
    return "An account already exists for that email. Sign in instead, or reset the password.";
  }
  if (code === "weak_password" || text.includes("password should be at least")) {
    return `That password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters and avoid common words.`;
  }
  if (text.includes("pwned") || text.includes("leaked") || text.includes("compromised")) {
    return "That password has appeared in a known data breach. Please choose a different one.";
  }
  if (code === "same_password" || text.includes("should be different from the old password")) {
    return "The new password must be different from your current one.";
  }
  if (status === 429 || text.includes("rate limit") || text.includes("too many requests")) {
    return "Too many attempts. Email sending is rate-limited on the default provider — wait a few minutes and try again.";
  }
  if (text.includes("session") && text.includes("missing")) {
    return "Your sign-in link has expired. Request a new one.";
  }
  return raw || "Please try again.";
}

/** Sends a one-time sign-in link. No password is ever created or transmitted. */
export async function sendMagicLink(email: string) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
}

/** Returns whether the account still needs to confirm its email address. */
export async function signUpWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  });
  if (error) throw error;
  return { needsConfirmation: data.session === null };
}

export async function signInWithPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
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

/** Changing a password in-app re-checks the current one first. */
export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email;
  if (!email) throw new Error("You are not signed in.");
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthError) throw reauthError;
  await setOwnPassword(newPassword);
}

export async function signOut() {
  // `global` revokes the refresh token everywhere, not just this tab.
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error && !`${error.message}`.toLowerCase().includes("session")) throw error;
  if (typeof window !== "undefined") {
    for (const key of Object.keys(window.localStorage)) {
      if (key.startsWith("sb-")) window.localStorage.removeItem(key);
    }
  }
}
