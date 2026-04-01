import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Export NextAuth's auth handler directly as the proxy.
// Route protection is handled by the `authorized` callback in auth.config.ts.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
