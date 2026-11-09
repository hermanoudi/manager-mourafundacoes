"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { customerSchema, nullIfEmpty, type CustomerForm as Values } from "@/lib/schemas";

import { DocumentInput } from "./DocumentInput";
import { Field, inputClass, SubmitBar } from "./Field";

export type CustomerOut = {
  id: number;
  document: string;
  name: string;
  trade_name: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
  notes: string | null;
  address: {
    zip_code: string; street: string; number: string; complement: string | null;
    district: string; city: string; state: string; ibge_city_code: string | null;
  };
};

const EMPTY: Values = {
  document: "", name: "", trade_name: "", email: "", phone: "", contact_name: "", notes: "",
  zip_code: "", street: "", number: "", complement: "", district: "", city: "", state: "",
  ibge_city_code: "",
};

export function toValues(c: CustomerOut): Values {
  return {
    document: c.document, name: c.name, trade_name: c.trade_name ?? "", email: c.email ?? "",
    phone: c.phone ?? "", contact_name: c.contact_name ?? "", notes: c.notes ?? "",
    zip_code: c.address.zip_code, street: c.address.street, number: c.address.number,
    complement: c.address.complement ?? "", district: c.address.district, city: c.address.city,
    state: c.address.state, ibge_city_code: c.address.ibge_city_code ?? "",
  };
}

function toPayload(v: Values) {
  return {
    document: v.document, name: v.name.trim(), trade_name: nullIfEmpty(v.trade_name),
    email: nullIfEmpty(v.email), phone: nullIfEmpty(v.phone),
    contact_name: nullIfEmpty(v.contact_name), notes: nullIfEmpty(v.notes),
    address: {
      zip_code: v.zip_code, street: v.street.trim(), number: v.number.trim(),
      complement: nullIfEmpty(v.complement), district: v.district.trim(), city: v.city.trim(),
      state: v.state.trim().toUpperCase(), ibge_city_code: nullIfEmpty(v.ibge_city_code),
    },
  };
}

export function CustomerForm({
  initial,
  onSaved,
}: {
  initial?: CustomerOut;
  onSaved: (saved: CustomerOut) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(customerSchema),
    defaultValues: initial ? toValues(initial) : EMPTY,
  });
  const { register, control, handleSubmit, setValue, setError, formState } = form;
  const { errors, isSubmitting } = formState;
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function lookupCep(raw: string) {
    const cep = raw.replace(/\D/g, "");
    if (cep.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      if (!res.ok) return;
      const d = await res.json();
      if (d.erro) return;
      setValue("street", d.logradouro ?? "");
      setValue("district", d.bairro ?? "");
      setValue("city", d.localidade ?? "");
      setValue("state", d.uf ?? "");
      setValue("ibge_city_code", d.ibge ?? "");
    } catch {
      // ViaCEP fora do ar não bloqueia o cadastro
    }
  }

  async function onSubmit(values: Values) {
    setFormError(null);
    setSaved(false);
    try {
      const out = initial
        ? await api<CustomerOut>(`/api/customers/${initial.id}`, {
            method: "PATCH", body: JSON.stringify(toPayload(values)),
          })
        : await api<CustomerOut>("/api/customers", {
            method: "POST", body: JSON.stringify(toPayload(values)),
          });
      setSaved(true);
      onSaved(out);
    } catch (err) {
      if (err instanceof ApiError && err.code === "duplicate_document") {
        setError("document", { message: messageFor(err) });
      } else {
        setFormError(messageFor(err));
      }
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-4" noValidate>
      <Field label="CPF/CNPJ" error={errors.document?.message}>
        <Controller
          control={control}
          name="document"
          render={({ field }) => <DocumentInput value={field.value} onChange={field.onChange} />}
        />
      </Field>
      <Field label="Nome / Razão social" error={errors.name?.message}>
        <input className={inputClass} {...register("name")} />
      </Field>
      <Field label="Nome fantasia">
        <input className={inputClass} {...register("trade_name")} />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="E-mail">
          <input className={inputClass} type="email" inputMode="email" {...register("email")} />
        </Field>
        <Field label="Telefone">
          <input className={inputClass} type="tel" {...register("phone")} />
        </Field>
      </div>
      <Field label="Contato">
        <input className={inputClass} {...register("contact_name")} />
      </Field>

      <fieldset className="space-y-4 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Endereço</legend>
        <Field label="CEP" error={errors.zip_code?.message}>
          <input
            className={inputClass}
            inputMode="numeric"
            autoComplete="postal-code"
            {...register("zip_code", { onBlur: (e) => lookupCep(e.target.value) })}
          />
        </Field>
        <Field label="Rua" error={errors.street?.message}>
          <input className={inputClass} {...register("street")} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Número" error={errors.number?.message}>
            <input className={inputClass} {...register("number")} />
          </Field>
          <Field label="Complemento">
            <input className={inputClass} {...register("complement")} />
          </Field>
        </div>
        <Field label="Bairro" error={errors.district?.message}>
          <input className={inputClass} {...register("district")} />
        </Field>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <Field label="Cidade" error={errors.city?.message}>
              <input className={inputClass} {...register("city")} />
            </Field>
          </div>
          <Field label="UF" error={errors.state?.message}>
            <input className={inputClass} maxLength={2} autoCapitalize="characters" {...register("state")} />
          </Field>
        </div>
        <Field label="Código IBGE" error={errors.ibge_city_code?.message}>
          <input className={inputClass} inputMode="numeric" {...register("ibge_city_code")} />
        </Field>
      </fieldset>

      <Field label="Observações">
        <textarea className={inputClass} rows={3} {...register("notes")} />
      </Field>
      <SubmitBar busy={isSubmitting} error={formError} saved={saved} />
    </form>
  );
}
