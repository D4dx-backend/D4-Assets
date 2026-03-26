// Extend NextAuth session types
import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: string;
      permissions?: Record<string, boolean>;
    };
  }

  interface User {
    id: string;
    role?: string;
    permissions?: { [key: string]: boolean };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    permissions?: Record<string, boolean>;
  }
}
