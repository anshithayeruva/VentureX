import { auth } from "@/lib/auth/server";

// Signed-out visitors to the founder, investor and deal-room portals are sent to /login.
// Everything else (landing page, /login, /register, /forgot-password, /api/auth) stays public.
export default auth.middleware({
  loginUrl: "/login",
});

export const config = {
  matcher: ["/founder/:path*", "/investor/:path*", "/dealroom/:path*"],
};
