"use client";

import { createAuthClient } from "@neon/auth/next";

// Talks to the same-origin proxy at /api/auth/[...path]; takes no arguments.
export const authClient = createAuthClient();

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
