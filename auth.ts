import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { connectDB } from "@/lib/mongodb";
import User from "@/lib/models/User";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        mpin: { label: "MPIN", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.mpin) return null;

        const email = (credentials.email as string).toLowerCase().trim();
        const mpin  = credentials.mpin as string;

        // ── .env admin: always works without seed ──────────────────────────
        const adminEmail = process.env.ADMIN_EMAIL?.toLowerCase().trim();
        const adminMpin  = process.env.ADMIN_MPIN;
        if (adminEmail && adminMpin && email === adminEmail && mpin === adminMpin) {
          return {
            id: "env-admin",
            name: "System Admin",
            email: adminEmail,
            role: "admin",
            permissions: {
              assets: true, events: true, movements: true,
              persons: true, reports: true, categories: true, users: true,
            },
          };
        }

        // ── Regular DB users ───────────────────────────────────────────────
        await connectDB();

        const user = await User.findOne({
          email,
          isActive: true,
        }).select("+mpin");

        if (!user) return null;

        const isValid = await user.compareMpin(mpin);
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
});


