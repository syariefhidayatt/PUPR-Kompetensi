"use client";

import { useActionState } from "react";
import { Field, SubmitButton, inputClass } from "@/components/ui/form";
import { loginAction, type LoginState } from "@/server/auth/actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, null);
  return (
    <form action={action} className="space-y-4">
      {state?.error ? (
        <p role="alert" className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {state.error}
        </p>
      ) : null}
      <Field label="NIP / Username" htmlFor="username">
        <input id="username" name="username" autoComplete="username" required className={inputClass} />
      </Field>
      <Field label="Kata sandi" htmlFor="password">
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputClass}
        />
      </Field>
      <SubmitButton pending={pending}>Masuk</SubmitButton>
    </form>
  );
}
