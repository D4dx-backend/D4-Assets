import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Allow public auth routes through without any check
  if (pathname.startsWith("/auth")) return;

  // req.auth is populated by NextAuth v5 when a valid JWT cookie is present
  if (!req.auth) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    return Response.redirect(loginUrl);
  }
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js).*)"],
};
