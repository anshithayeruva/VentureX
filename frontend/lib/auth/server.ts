import { createNeonAuth } from "@neon/auth/next/server";

// Neon Auth (Managed Better Auth). NEON_AUTH_BASE_URL comes from `neon env pull`;
// NEON_AUTH_COOKIE_SECRET is this app's own secret for signed session cookies.
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
