"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, FormProvider, useForm } from "react-hook-form";

import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import { customerSchema, nullIfEmpty, type CustomerForm as Values } from "@/lib/schemas";

import { AddressFields, addressPayload, addressToValues, EMPTY_ADDRESS, type AddressOut } from "./AddressFields";
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
  address: AddressOut;
};

const EMPTY: Values = {
  document: "", name: "", trade_name: "", email: "", phone: "", contact_name: "", notes: "",
  ...EMPTY_ADDRESS,
};

export function toValues(c: CustomerOut): Values {
  return {
    document: c.document, name: c.name, trade_name: c.trade_name ?? "", email: c.email ?? "",
    phone: c.phone ?? "", contact_name: c.contact_name ?? "", notes: c.notes ?? "",
    ...addressToValues(c.address),
  };
}

function toPayload(v: Values) {
  return {
    document: v.document, name: v.name.trim(), trade_name: nullIfEmpty(v.trade_name),
    email: nullIfEmpty(v.email), phone: nullIfEmpty(v.phone),
    contact_name: nullIfEmpty(v.contact_name), notes: nullIfEmpty(v.notes),
    address: addressPayload(v),
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
  const { register, control, handleSubmit, setError, formState } = form;
  const { errors, isSubmitting } = formState;
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
    <FormProvider {...form}>
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

      <AddressFields />

      <Field label="Observações">
        <textarea className={inputClass} rows={3} {...register("notes")} />
      </Field>
      <SubmitBar busy={isSubmitting} error={formError} saved={saved} />
    </form>
    </FormProvider>
  );
}
