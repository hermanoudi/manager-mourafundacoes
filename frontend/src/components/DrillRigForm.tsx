"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { api, ApiError } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { formatDecimalBR, toApiDecimal } from "@/lib/format";
import { nullIfEmpty, rigSchema, type RigForm as Values } from "@/lib/schemas";

import { DecimalInput } from "./DecimalInput";
import { Field, inputClass, SubmitBar } from "./Field";

export type RigOut = {
  id: number; name: string; max_diameter_cm: number; max_depth_m: string;
  status: "active" | "maintenance" | "inactive"; notes: string | null;
};

export const STATUS_LABEL = { active: "Ativa", maintenance: "Manutenção", inactive: "Inativa" } as const;

const EMPTY: Values = {
  name: "", max_diameter_cm: "", max_depth_m: "",
  status: "active", notes: "",
};

function toValues(r: RigOut): Values {
  return {
    name: r.name, max_diameter_cm: String(r.max_diameter_cm),
    max_depth_m: formatDecimalBR(r.max_depth_m), status: r.status, notes: r.notes ?? "",
  };
}

export function DrillRigForm({
  initial,
  onSaved,
}: {
  initial?: RigOut;
  onSaved: (saved: RigOut) => void;
}) {
  const { register, control, handleSubmit, setError, formState } = useForm<Values>({
    resolver: zodResolver(rigSchema),
    defaultValues: initial ? toValues(initial) : EMPTY,
  });
  const { errors, isSubmitting } = formState;
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(v: Values) {
    setFormError(null);
    setSaved(false);
    const body = JSON.stringify({
      name: v.name.trim(), max_diameter_cm: Number(v.max_diameter_cm),
      max_depth_m: toApiDecimal(v.max_depth_m), status: v.status, notes: nullIfEmpty(v.notes),
    });
    try {
      const out = initial
        ? await api<RigOut>(`/api/drill-rigs/${initial.id}`, { method: "PATCH", body })
        : await api<RigOut>("/api/drill-rigs", { method: "POST", body });
      setSaved(true);
      onSaved(out);
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_rig_name") {
        setError("name", { message: messageFor(err) });
      } else {
        setFormError(messageFor(err));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-4" noValidate>
      <Field label="Nome" error={errors.name?.message}>
        <input className={inputClass} {...register("name")} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Diâmetro máx. (cm)" error={errors.max_diameter_cm?.message}>
          <input className={inputClass} inputMode="numeric" {...register("max_diameter_cm")} />
        </Field>
        <Field label="Profundidade máx. (m)" error={errors.max_depth_m?.message}>
          <Controller
            control={control}
            name="max_depth_m"
            render={({ field }) => <DecimalInput value={field.value} onChange={field.onChange} />}
          />
        </Field>
      </div>
      <Field label="Status">
        <select className={inputClass} {...register("status")}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </Field>
      <Field label="Observações">
        <textarea className={inputClass} rows={3} {...register("notes")} />
      </Field>
      <SubmitBar busy={isSubmitting} error={formError} saved={saved} />
    </form>
  );
}
