import { verify } from "@node-rs/argon2";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { z } from "zod";
import { env } from "@/env";
import { audit } from "@/server/audit";
import { authConfig } from "@/server/auth/auth.config";
import { loadSnapshot } from "@/server/auth/snapshot";
import { db } from "@/server/db";
import { logger } from "@/server/logger";
import { clientIp, rateLimit } from "@/server/ratelimit";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(200),
});

const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  providers: [
    ...(googleEnabled
      ? [
          Google({
            clientId: env.AUTH_GOOGLE_ID!,
            clientSecret: env.AUTH_GOOGLE_SECRET!,
            authorization: { params: { prompt: "select_account" } },
          }),
        ]
      : []),
    Credentials({
      credentials: { username: {}, password: {} },
      async authorize(raw, request) {
        const ip = clientIp(request.headers);
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        // Dua lapis: per IP (credential stuffing) dan per akun (brute force satu akun).
        const okIp = await rateLimit(`login:ip:${ip}`, 20, 900);
        const okUser = await rateLimit(`login:user:${username.toLowerCase()}`, 8, 900);
        if (!okIp || !okUser) {
          await audit("login_throttled", { ip, meta: { username } });
          return null;
        }

        const user = await db.user.findUnique({ where: { username } });
        // Pesan gagal SELALU generik: tidak membocorkan apakah akun ada / Google-only / nonaktif.
        if (!user || !user.statusAktif || !user.passwordHash) {
          await audit("login_failed", { ip, meta: { username } });
          return null;
        }
        let valid = false;
        try {
          valid = await verify(user.passwordHash, password);
        } catch (err) {
          logger.error({ err }, "verifikasi password gagal (hash tidak valid?)");
        }
        if (!valid) {
          await audit("login_failed", { ip, actor: user.username, meta: { username } });
          return null;
        }

        await audit("login", { ip, actor: user.username, entitas: "User", entitasId: String(user.id) });
        return { id: String(user.id), name: user.nama, email: user.email };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,

    async signIn({ account, profile }) {
      if (account?.provider !== "google") return true;

      // Hanya terima email yang terverifikasi Google (anti account-takeover, D4).
      if (profile?.email_verified !== true) return "/login?error=EmailUnverified";

      const sub = account.providerAccountId;
      const email = typeof profile.email === "string" ? profile.email.toLowerCase() : null;

      const existing = await db.user.findUnique({ where: { googleId: sub } });
      if (existing) {
        if (!existing.statusAktif) return "/login?error=AccountDisabled";
        await audit("login_google", { actor: existing.username, entitas: "User", entitasId: String(existing.id) });
        return true;
      }

      // Tidak auto-link ke akun lokal ber-email sama (D4).
      if (email && (await db.user.findUnique({ where: { email }, select: { id: true } }))) {
        return "/login?error=EmailTaken";
      }

      const role = await db.role.findUnique({ where: { kode: "pegawai" } });
      if (!role) {
        logger.error("role 'pegawai' belum ada — jalankan `npm run db:seed`");
        return "/login?error=ServerError";
      }

      try {
        const created = await db.user.create({
          data: {
            username: `g-${sub}`,
            nama: typeof profile.name === "string" && profile.name ? profile.name : (email ?? "Pengguna"),
            email,
            googleId: sub,
            authProvider: "GOOGLE",
            passwordHash: null,
            roles: { create: { roleId: role.id } },
          },
        });
        await audit("register_google", { actor: created.username, entitas: "User", entitasId: String(created.id) });
        return true;
      } catch (err) {
        // Balapan dua login pertama bersamaan → unique violation.
        logger.error({ err }, "registrasi Google gagal");
        return "/login?error=EmailTaken";
      }
    },

    async jwt({ token, user, account, trigger }) {
      let userId: bigint | null = null;
      if (account) {
        if (account.provider === "google") {
          const u = await db.user.findUnique({ where: { googleId: account.providerAccountId }, select: { id: true } });
          userId = u?.id ?? null;
        } else if (user?.id) {
          userId = BigInt(user.id);
        }
      } else if (trigger === "update" && token.uid) {
        userId = BigInt(token.uid as string);
      }

      if (userId !== null) {
        const snap = await loadSnapshot(userId);
        if (snap) {
          const { name, ...rest } = snap;
          Object.assign(token, rest, { name });
        }
      }
      return token;
    },
  },
});
