"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { ApiError } from "@/lib/api";
import { login, safeNext } from "@/lib/auth";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await login(String(form.get("email")), String(form.get("password")));
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow">
      <h1 className="text-xl font-semibold">Moura Gestão</h1>
      <label className="block text-sm font-medium">
        E-mail
        <input
          name="email"
          type="text"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          required
          className="mt-1 block min-h-11 w-full rounded-lg border border-stone-300 px-3 text-base"
        />
      </label>
      <label className="block text-sm font-medium">
        Senha
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 block min-h-11 w-full rounded-lg border border-stone-300 px-3 text-base"
        />
      </label>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-brand px-4 font-medium text-white disabled:opacity-60"
      >
        {busy ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
