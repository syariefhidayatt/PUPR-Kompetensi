import type { Metadata } from "next";
import { env } from "@/env";
import { googleSignInAction } from "@/server/auth/actions";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Masuk" };

const ERRORS: Record<string, string> = {
  EmailTaken: "Email ini sudah terdaftar. Silakan masuk dengan NIP dan kata sandi.",
  EmailUnverified: "Email Google Anda belum terverifikasi.",
  AccountDisabled: "Akun Anda dinonaktifkan. Hubungi administrator.",
  ServerError: "Terjadi kesalahan pada sistem. Hubungi administrator.",
  AccessDenied: "Akses ditolak.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const googleEnabled = Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET);
  // Kode error tak dikenal tidak ditampilkan mentah (hindari reflected content).
  const message = error ? (ERRORS[error] ?? "Gagal masuk. Silakan coba lagi.") : null;

  return (
    <div className="w-full max-w-sm space-y-6 pt-10">
      <header className="text-center">
        <h1 className="text-2xl font-semibold">{env.NEXT_PUBLIC_APP_NAME}</h1>
        <p className="mt-1 text-sm text-muted">Masuk untuk melanjutkan</p>
      </header>

      <div className="space-y-4 rounded-lg border border-border bg-card p-6">
        {message ? (
          <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {message}
          </p>
        ) : null}
        <LoginForm />
        {googleEnabled ? (
          <>
            <div className="flex items-center gap-3 text-xs text-muted">
              <span className="h-px flex-1 bg-border" /> atau <span className="h-px flex-1 bg-border" />
            </div>
            <form action={googleSignInAction}>
              <button
                type="submit"
                className="w-full rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-background"
              >
                Masuk dengan Google
              </button>
              <p className="mt-2 text-center text-xs text-muted">Untuk pegawai Pemerintah Daerah.</p>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
