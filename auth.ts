import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import type { NextAuthConfig } from "next-auth";

export const authConfig: NextAuthConfig = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        mpin: { label: "MPIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.mpin) return null;

        await connectDB();

        const user = await User.findOne({
          email: credentials.email,
          isActive: true,
        }).select("+mpin");

        if (!user) return null;

        const isValid = await user.compareMpin(credentials.mpin as string);
        if (!isValid) return null;

        // Convert Mongoose subdocument to a plain object to avoid circular JSON
        const raw = user.permissions as unknown as { toObject?: () => Record<string, boolean> } & Record<string, boolean>;
        const perms: Record<string, boolean> = raw.toObject ? raw.toObject() : { ...raw };
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: perms,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
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
  pages: {
    signIn: "/auth/login",
  },
  session: { strategy: "jwt" },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
