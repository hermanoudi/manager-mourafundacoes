"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";

import { api, ApiError } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { jobSchema, nullIfEmpty, type JobForm as Values } from "@/lib/schemas";

import {
  AddressFields, addressPayload, addressToValues, EMPTY_ADDRESS, type AddressOut,
} from "./AddressFields";
import { Field, inputClass, SubmitBar } from "./Field";
import type { PriceTableOut } from "./PriceTableEditor";
import type { JobStatus } from "./StatusBadge";

export type JobOut = {
  id: number;
  name: string;
  customer: { id: number; name: string };
  address: AddressOut;
  status: JobStatus;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  prices: PriceTableOut | null;
  contracted_diameters: number[];
  rigs: { id: number; name: string; max_diameter_cm: number; max_depth_m: string }[];
  operators: { id: number; name: string }[];
};

type CustomerPage = { items: { id: number; name: string }[] };

const EMPTY: Values = {
  name: "", customer_id: "", start_date: "", end_date: "", notes: "", ...EMPTY_ADDRESS,
};

function toValues(j: JobOut): Values {
  return {
    name: j.name, customer_id: String(j.customer.id), start_date: j.start_date ?? "",
    end_date: j.end_date ?? "", notes: j.notes ?? "", ...addressToValues(j.address),
  };
}

function CustomerPicker({ value, onChange, error }: {
  value: string; onChange: (v: string) => void; error?: string;
}) {
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["customers-picker", q],
    queryFn: () => api<CustomerPage>(`/api/customers?q=${encodeURIComponent(q)}&page_size=50`),
  });
  return (
    <div className="space-y-2">
      <Field label="Pesquisar por nome">
        <input
          type="search"
          className={inputClass}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </Field>
      <Field label="Cliente" error={error}>
        <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Selecione…</option>
          {(data?.items ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function JobForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: JobOut;
  onSaved: (saved: JobOut) => void;
  onCancel?: () => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(jobSchema),
    defaultValues: initial ? toValues(initial) : EMPTY,
  });
  const { register, control, handleSubmit, setError, setValue, formState } = form;
  const customerId = useWatch({ control, name: "customer_id" });
  const { errors, isSubmitting } = formState;
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const locked = initial?.status === "completed" || initial?.status === "cancelled";

  async function onSubmit(v: Values) {
    setFormError(null);
    setSaved(false);
    if (!initial && v.customer_id === "") {
      setError("customer_id", { message: "Selecione o cliente" });
      return;
    }
    const common = {
      name: v.name.trim(), address: addressPayload(v), start_date: nullIfEmpty(v.start_date),
      end_date: nullIfEmpty(v.end_date), notes: nullIfEmpty(v.notes),
    };
    try {
      const out = initial
        ? await api<JobOut>(`/api/jobs/${initial.id}`, {
            method: "PATCH", body: JSON.stringify(common),
          })
        : await api<JobOut>("/api/jobs", {
            method: "POST", body: JSON.stringify({ ...common, customer_id: Number(v.customer_id) }),
          });
      setSaved(true);
      onSaved(out);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_dates") {
        setError("end_date", { message: messageFor(err) });
      } else {
        setFormError(messageFor(err));
      }
    }
  }

  return (
    <FormProvider {...form}>
      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4" noValidate>
        <Field label="Nome da obra" error={errors.name?.message}>
          <input className={inputClass} {...register("name")} />
        </Field>
        {!initial && (
          <CustomerPicker
            value={customerId}
            onChange={(v) => setValue("customer_id", v, { shouldValidate: true })}
            error={errors.customer_id?.message}
          />
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início" error={errors.start_date?.message}>
            <input type="date" className={inputClass} {...register("start_date")} />
          </Field>
          <Field label="Término" error={errors.end_date?.message}>
            <input type="date" className={inputClass} {...register("end_date")} />
          </Field>
        </div>
        <AddressFields />
        <Field label="Observações">
          <textarea className={inputClass} rows={3} {...register("notes")} />
        </Field>
        {locked ? (
          <p className="text-sm text-stone-600">Obra encerrada: dados bloqueados para edição.</p>
        ) : (
          <SubmitBar busy={isSubmitting} error={formError} saved={saved && !onCancel} onCancel={onCancel} />
        )}
      </form>
    </FormProvider>
  );
}
