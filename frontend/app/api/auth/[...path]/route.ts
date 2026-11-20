import { auth } from "@/lib/auth/server";

// Proxies sign-up, sign-in, sessions and tokens to Neon Auth.
export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
