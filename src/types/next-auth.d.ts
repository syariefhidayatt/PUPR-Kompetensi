import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      roles: string[];
      permissions: string[];
      idInstansi: string | null;
      authProvider: "LOCAL" | "GOOGLE";
      profileComplete: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    username?: string;
    roles?: string[];
    permissions?: string[];
    idInstansi?: string | null;
    authProvider?: "LOCAL" | "GOOGLE";
    profileComplete?: boolean;
  }
}
