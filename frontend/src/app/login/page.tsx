"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense, useState } from "react";

import { PasswordInput } from "@/components/PasswordInput";

import { ApiError } from "@/lib/api";
import { login, safeNext } from "@/lib/auth";

/** Ícone de traço dentro do campo, à esquerda. */
function FieldIcon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.75"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-secondary">
      <path d={d} />
    </svg>
  );
}

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
    <form onSubmit={onSubmit} className="w-full max-w-md space-y-6">
      <Image src="/brand/logo.png" alt="Moura Fundações" width={239} height={81} unoptimized priority className="h-12 w-auto" />
      <div className="space-y-1.5">
        <h1 className="text-4xl font-extrabold leading-none">Entre na sua conta</h1>
        <p className="text-stone-600">Use o e-mail e a senha do seu cadastro.</p>
      </div>
      <label className="block">
        <span className="eyebrow">E-mail</span>
        <span className="relative mt-1.5 block">
          <FieldIcon d="M3 6h18v12H3zM3 7l9 6 9-6" />
          <input
            name="email"
            type="text"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            required
            className="block min-h-12 w-full rounded-lg border border-stone-400 bg-white pl-11 pr-3 text-base"
          />
        </span>
      </label>
      <div>
        <label htmlFor="password" className="eyebrow">Senha</label>
        <div className="relative mt-1.5">
          <FieldIcon d="M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            className="block min-h-12 w-full rounded-lg border border-stone-400 bg-white py-2 pl-11 pr-12 text-base"
          />
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="btn-label flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 text-lg text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {busy ? "Entrando…" : "Entrar"}
        {!busy && (
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 10h12M11 5l5 5-5 5" />
          </svg>
        )}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-white px-4 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
