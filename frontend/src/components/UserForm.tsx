"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { api, ApiError } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { userSchema, type UserForm as Values } from "@/lib/schemas";

import { Field, inputClass } from "./Field";

export const ROLE_LABEL = { admin: "Administrador", office: "Escritório", operator: "Operador" } as const;

export function UserForm({ onCreated }: { onCreated: () => void }) {
  const { register, handleSubmit, setError, reset, formState } = useForm<Values>({
    resolver: zodResolver(userSchema),
    defaultValues: { name: "", email: "", password: "", role: "operator" },
  });
  const { errors, isSubmitting } = formState;
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(v: Values) {
    setFormError(null);
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify(v) });
      reset();
      onCreated();
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_email") {
        setError("email", { message: messageFor(err) });
      } else {
        setFormError(messageFor(err));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4 rounded-xl border bg-white p-4" noValidate>
      <Field label="Nome" error={errors.name?.message}>
        <input className={inputClass} {...register("name")} />
      </Field>
      <Field label="E-mail" error={errors.email?.message}>
        <input className={inputClass} inputMode="email" autoCapitalize="none" {...register("email")} />
      </Field>
      <Field label="Senha" error={errors.password?.message}>
        <input className={inputClass} type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Field label="Papel">
        <select className={inputClass} {...register("role")}>
          {Object.entries(ROLE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </Field>
      {formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-11 rounded-lg bg-brand hover:bg-brand-dark px-4 btn-label text-white disabled:opacity-60"
      >
        Criar usuário
      </button>
    </form>
  );
}
