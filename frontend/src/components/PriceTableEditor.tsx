"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { messageFor } from "@/lib/errors";
import { formatDecimalBR, toApiDecimal } from "@/lib/format";
import { formatMoneyBR } from "@/lib/money";
import { priceTableSchema, type PriceTableForm as Values } from "@/lib/schemas";

import { DecimalInput } from "./DecimalInput";
import { Field, inputClass, SubmitBar } from "./Field";

export type PriceTableOut = {
  mobilization_fee: string;
  minimum_amount: string | null;
  max_tabled_depth_m: string;
  items: { diameter_cm: number; price_per_m: string }[];
};

function toValues(t: PriceTableOut): Values {
  return {
    mobilization_fee: formatDecimalBR(t.mobilization_fee),
    minimum_amount: t.minimum_amount ? formatDecimalBR(t.minimum_amount) : "",
    max_tabled_depth_m: formatDecimalBR(t.max_tabled_depth_m),
    items: t.items.map((i) => ({
      diameter_cm: String(i.diameter_cm), price_per_m: formatDecimalBR(i.price_per_m),
    })),
  };
}

function toPayload(v: Values): PriceTableOut {
  return {
    mobilization_fee: toApiDecimal(v.mobilization_fee),
    minimum_amount: v.minimum_amount === "" ? null : toApiDecimal(v.minimum_amount),
    max_tabled_depth_m: toApiDecimal(v.max_tabled_depth_m),
    items: [...v.items]
      .sort((a, b) => Number(a.diameter_cm) - Number(b.diameter_cm))
      .map((i) => ({ diameter_cm: Number(i.diameter_cm), price_per_m: toApiDecimal(i.price_per_m) })),
  };
}

/** Resumo somente leitura da tabela. */
export function PriceTableView({ table }: { table: PriceTableOut }) {
  return (
    <div className="max-w-xl space-y-3 rounded-lg bg-white p-3 text-sm shadow-sm">
      <dl className="grid grid-cols-2 gap-2">
        <dt className="text-stone-600">Mobilização</dt>
        <dd>{formatMoneyBR(table.mobilization_fee)}</dd>
        <dt className="text-stone-600">Valor mínimo</dt>
        <dd>{table.minimum_amount ? formatMoneyBR(table.minimum_amount) : "Sem mínimo"}</dd>
        <dt className="text-stone-600">Profundidade tabelada</dt>
        <dd>até {formatDecimalBR(table.max_tabled_depth_m)} m</dd>
      </dl>
      <ul className="divide-y">
        {table.items.map((i) => (
          <li key={i.diameter_cm} className="flex justify-between py-1.5">
            <span>{i.diameter_cm} cm</span>
            <span>{formatMoneyBR(i.price_per_m)}/m</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Resumo + formulário de edição (quando `onSave` é informado). */
export function PriceTableEditor({
  table,
  onSave,
}: {
  table: PriceTableOut;
  onSave?: (t: PriceTableOut) => Promise<void>;
}) {
  if (!onSave) return <PriceTableView table={table} />;
  return (
    <div className="space-y-4">
      <PriceTableView table={table} />
      <PriceTableForm table={table} onSave={onSave} />
    </div>
  );
}

function PriceTableForm({
  table, onSave,
}: { table: PriceTableOut; onSave: (t: PriceTableOut) => Promise<void> }) {
  const { control, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(priceTableSchema),
    defaultValues: toValues(table),
  });
  const { errors, isSubmitting } = formState;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const [formError, setFormError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newDiameter, setNewDiameter] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  function addRow() {
    const d = newDiameter.trim();
    if (!/^\d+$/.test(d) || +d < 25 || +d > 80) return setAddError("Diâmetro entre 25 e 80 cm");
    if (fields.some((f) => f.diameter_cm === d)) return setAddError("Diâmetro repetido");
    setAddError(null);
    append({ diameter_cm: d, price_per_m: "" });
    setNewDiameter("");
  }

  async function submit(v: Values) {
    setFormError(null);
    setSaved(false);
    try {
      await onSave(toPayload(v));
      setSaved(true);
    } catch (err) {
      setFormError(messageFor(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="max-w-xl space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Taxa de mobilização (R$)" error={errors.mobilization_fee?.message}>
          <Controller
            control={control}
            name="mobilization_fee"
            render={({ field }) => <DecimalInput value={field.value} onChange={field.onChange} />}
          />
        </Field>
        <Field label="Valor mínimo (R$)" error={errors.minimum_amount?.message}>
          <Controller
            control={control}
            name="minimum_amount"
            render={({ field }) => <DecimalInput value={field.value} onChange={field.onChange} />}
          />
        </Field>
      </div>
      <Field label="Profundidade máxima tabelada (m)" error={errors.max_tabled_depth_m?.message}>
        <Controller
          control={control}
          name="max_tabled_depth_m"
          render={({ field }) => <DecimalInput value={field.value} onChange={field.onChange} />}
        />
      </Field>

      <fieldset className="space-y-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Preço por metro</legend>
        {fields.map((f, i) => (
          <div key={f.id}>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-sm">{f.diameter_cm} cm</span>
            <Controller
              control={control}
              name={`items.${i}.price_per_m`}
              render={({ field }) => (
                <DecimalInput
                  aria-label={`Preço por metro, ${f.diameter_cm} cm`}
                  value={field.value}
                  onChange={field.onChange}
                  className={`${inputClass} mt-0 min-w-0 flex-1`}
                />
              )}
            />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label={`Remover ${f.diameter_cm} cm`}
              className="min-h-11 min-w-11 rounded-lg border text-lg"
            >
              ×
            </button>
          </div>
          {errors.items?.[i]?.price_per_m?.message && (
            <p className="mt-1 text-sm text-red-700">{errors.items[i]?.price_per_m?.message}</p>
          )}
          </div>
        ))}
        <div className="flex items-end gap-2">
          <label className="block flex-1 text-sm font-medium">
            Novo diâmetro (cm)
            <input
              className={inputClass}
              inputMode="numeric"
              value={newDiameter}
              onChange={(e) => setNewDiameter(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button type="button" onClick={addRow} className="min-h-11 rounded-lg border px-4">
            Adicionar
          </button>
        </div>
        {addError && <p className="text-sm text-red-700">{addError}</p>}
      </fieldset>
      <SubmitBar busy={isSubmitting} error={formError} saved={saved} />
    </form>
  );
}
