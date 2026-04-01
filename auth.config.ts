import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no mongoose, no Node.js-only modules.
// Used in middleware (Edge runtime) and merged into auth.ts for the full config.
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/auth/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = ((user as { role?: string }).role) ?? "operator";
        token.permissions = (user as { permissions?: Record<string, boolean> }).permissions;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.permissions = token.permissions as Record<string, boolean>;
      }
      return session;
    },
  },
  session: { strategy: "jwt" },
  providers: [], // Providers are added in auth.ts (Node.js runtime only)
};
