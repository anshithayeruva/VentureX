import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

/*
 * Runs before every page:
 * 1. A strict Content-Security-Policy with a fresh nonce per request. Next.js reads the nonce
 *    from the request's CSP header and puts it on its own scripts, so only our scripts run.
 * 2. Signed-out visitors to the founder, investor and deal-room portals go to /login.
 *    Everything else (landing, /login, /register, /forgot-password) stays public.
 */

const PORTALS = ["/founder", "/investor", "/dealroom", "/admin"];
const requireSignIn = auth.middleware({ loginUrl: "/login" });

/** The API's origin and its WebSocket twin (deal rooms use live updates). */
function apiOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
  try {
    const { origin, protocol } = new URL(raw);
    const ws = origin.replace(/^http/, protocol === "https:" ? "wss" : "ws");
    return [origin, ws];
  } catch {
    return [];
  }
}

function contentSecurityPolicy(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' lets our nonced scripts load the app's chunks; nothing else runs.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Inline style attributes (chart and bar widths) need 'unsafe-inline' for styles only.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' blob: data:",
    `connect-src 'self' ${apiOrigins().join(" ")}${isDev ? " ws: http://localhost:*" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export default async function proxy(request: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);

  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);

  const path = request.nextUrl.pathname;
  const isPortal = PORTALS.some((p) => path === p || path.startsWith(`${p}/`));
  // The auth check copies the request's headers into its pass-through response, so the nonce
  // survives; its redirects and refreshed session cookies are kept as they are.
  const response = isPortal
    ? await requireSignIn(new NextRequest(request, { headers }))
    : NextResponse.next({ request: { headers } });

  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Every page; not API routes, build assets or the icon (they need no CSP or auth check).
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
