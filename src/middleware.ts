import NextAuth from "next-auth";
import { authConfig } from "@/server/auth/auth.config";

// Instance Edge-safe: hanya membaca JWT dan menjalankan callback `authorized`.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
