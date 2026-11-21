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
  // Tokens last ~15 minutes; reuse one until shortly before it expires, and share a single
  // in-flight request so a page firing many API calls fetches only one token.
  if (cachedToken && cachedToken.expiresAt - Date.now() > TOKEN_REFRESH_MARGIN_MS) return cachedToken.token;
  pendingToken ??= fetchToken().finally(() => {
    pendingToken = null;
  });
  return pendingToken;
}

/** Forget the cached token (call on sign-in, sign-out or a 401 from the API). */
export function clearApiToken(): void {
  cachedToken = null;
}

const TOKEN_REFRESH_MARGIN_MS = 60_000;
let cachedToken: { token: string; expiresAt: number } | null = null;
let pendingToken: Promise<string | null> | null = null;

async function fetchToken(): Promise<string | null> {
  // Call the same-origin Neon Auth endpoint directly (what authClient.token() does), with a
  // timeout: a token request that never settles must not block every API call behind it.
  try {
    const res = await fetch("/api/auth/token", {
      credentials: "include",
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const data = res.ok ? await res.json() : null;
    if (!data?.token) {
      cachedToken = null;
      return null;
    }
    cachedToken = { token: data.token, expiresAt: tokenExpiry(data.token) };
    return data.token;
  } catch {
    cachedToken = null;
    return null;
  }
}

/** JWT `exp` in ms; if unreadable, treat the token as short-lived (2 minutes). */
function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (typeof payload.exp === "number") return payload.exp * 1000;
  } catch {
    // fall through
  }
  return Date.now() + 2 * 60_000;
}
