"use client";

import { createAuthClient } from "@neon/auth/next";

// Talks to the same-origin proxy at /api/auth/[...path]; takes no arguments.
export const authClient = createAuthClient();

/** No-op subscribe for useSyncExternalStore: the page origin never changes. */
export function noSubscribe(): () => void {
  return () => {};
}

/**
 * Neon Auth's session cookies are `__Secure-` cookies, which browsers only keep on
 * https:// pages or on http://localhost. On any other plain-http address (e.g. the dev
 * server's LAN IP) sign-in "succeeds" but the session is silently dropped.
 */
export function insecureOriginWarning(): string | null {
  if (typeof window === "undefined") return null;
  const { protocol, hostname, port } = window.location;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  if (protocol === "https:" || isLocalhost) return null;
  return (
    `Sign-in can't be kept on ${window.location.origin}. Open the site at ` +
    `http://localhost${port ? `:${port}` : ""} instead (or use https).`
  );
}

/** After sign-in/sign-up: did the browser actually keep the session cookie? */
export async function sessionWasKept(): Promise<boolean> {
  try {
    const { data } = await authClient.getSession();
    return Boolean(data?.user);
  } catch {
    return false;
  }
}

/**
 * Short-lived Neon Auth JWT for calling the FastAPI backend
 * (`Authorization: Bearer <jwt>`). Returns null when signed out.
 */
export async function getApiToken(): Promise<string | null> {
  try {
    const { data, error } = await authClient.token();
    if (error || !data?.token) return null;
    return data.token;
  } catch {
    return null;
  }
}
