"use client";

import { useFormContext } from "react-hook-form";

import { nullIfEmpty } from "@/lib/schemas";

import { Field, inputClass } from "./Field";

export type AddressOut = {
  zip_code: string; street: string; number: string; complement: string | null;
  district: string; city: string; state: string; ibge_city_code: string | null;
};

/** Campos de endereço no formulário (todos strings; vazio = ausente). */
export type AddressValues = {
  zip_code: string; street: string; number: string; complement: string;
  district: string; city: string; state: string; ibge_city_code: string;
};

export const EMPTY_ADDRESS: AddressValues = {
  zip_code: "", street: "", number: "", complement: "", district: "", city: "", state: "",
  ibge_city_code: "",
};

export function addressToValues(a: AddressOut): AddressValues {
  return {
    zip_code: a.zip_code, street: a.street, number: a.number, complement: a.complement ?? "",
    district: a.district, city: a.city, state: a.state, ibge_city_code: a.ibge_city_code ?? "",
  };
}

export function addressPayload(v: AddressValues) {
  return {
    zip_code: v.zip_code, street: v.street.trim(), number: v.number.trim(),
    complement: nullIfEmpty(v.complement), district: v.district.trim(), city: v.city.trim(),
    state: v.state.trim().toUpperCase(), ibge_city_code: nullIfEmpty(v.ibge_city_code),
  };
}

/** Bloco de endereço com preenchimento por CEP (ViaCEP). Requer um FormProvider acima. */
export function AddressFields() {
  const { register, setValue, formState: { errors } } = useFormContext<AddressValues>();

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

  return (
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
  );
}
