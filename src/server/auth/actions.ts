"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/server/auth/auth";

export type LoginState = { error?: string } | null;

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      username: String(formData.get("username") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return { error: "NIP atau kata sandi salah, atau terlalu banyak percobaan. Coba lagi nanti." };
    }
    throw e; // NEXT_REDIRECT harus dilempar ulang
  }
  return null;
}

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
