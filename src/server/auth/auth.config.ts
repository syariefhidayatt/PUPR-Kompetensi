import type { NextAuthConfig } from "next-auth";

/**
 * Config yang aman untuk Edge (dipakai middleware): TANPA prisma/argon2.
 * Logika yang menyentuh DB ada di auth.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  providers: [],
  callbacks: {
    session({ session, token }) {
      session.user = {
        ...session.user,
        // Cast eksplisit: augmentation JWT bisa tidak terbaca (token jatuh ke tipe longgar), jadi tipe dipaksa di sini.
        id: (token.uid as string) ?? "",
        username: (token.username as string) ?? "",
        roles: (token.roles as string[]) ?? [],
        permissions: (token.permissions as string[]) ?? [],
        idInstansi: (token.idInstansi as string | null) ?? null,
        authProvider: (token.authProvider as "LOCAL" | "GOOGLE") ?? "LOCAL",
        profileComplete: (token.profileComplete as boolean) ?? false,
      };
      return session;
    },

    // Gate kasar. Otorisasi sebenarnya tetap dicek di setiap action/handler (guards.ts).
    authorized({ auth, request: { nextUrl } }) {
      const path = nextUrl.pathname;
      const user = auth?.user?.id ? auth.user : null;

      const isPublic = path === "/login" || path.startsWith("/api/auth") || path === "/api/health" || path.startsWith("/api/cron/");
      if (isPublic) {
        if (user && path === "/login") {
          return Response.redirect(new URL(user.profileComplete ? "/" : "/onboarding", nextUrl));
        }
        return true;
      }

      if (!user) return false; // → redirect ke /login

      // Gate profil belum lengkap (D5): hanya /onboarding yang boleh diakses.
      if (!user.profileComplete) {
        return path === "/onboarding" ? true : Response.redirect(new URL("/onboarding", nextUrl));
      }
      if (path === "/onboarding") return Response.redirect(new URL("/", nextUrl));
      return true;
    },
  },
} satisfies NextAuthConfig;
