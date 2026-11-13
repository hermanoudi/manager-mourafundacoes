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
  /** Na tabela global: mobilização em Uberlândia-MG. Na obra: null = a negociar. */
  mobilization_fee: string | null;
  minimum_amount: string | null;
  max_tabled_depth_m: string;
  items: { diameter_cm: number; price_per_m: string }[];
};

/** `global`: tabela de referência (mobilização de Uberlândia); `job`: tabela contratada da obra. */
type Scope = "global" | "job";

const HOME_CITY = "Uberlândia-MG";

function toValues(t: PriceTableOut): Values {
  return {
    mobilization_fee: t.mobilization_fee ? formatDecimalBR(t.mobilization_fee) : "",
    minimum_amount: t.minimum_amount ? formatDecimalBR(t.minimum_amount) : "",
    max_tabled_depth_m: formatDecimalBR(t.max_tabled_depth_m),
    items: t.items.map((i) => ({
      diameter_cm: String(i.diameter_cm), price_per_m: formatDecimalBR(i.price_per_m),
    })),
  };
}

function toPayload(v: Values): PriceTableOut {
  return {
    mobilization_fee: v.mobilization_fee === "" ? null : toApiDecimal(v.mobilization_fee),
    minimum_amount: v.minimum_amount === "" ? null : toApiDecimal(v.minimum_amount),
    max_tabled_depth_m: toApiDecimal(v.max_tabled_depth_m),
    items: [...v.items]
      .sort((a, b) => Number(a.diameter_cm) - Number(b.diameter_cm))
      .map((i) => ({ diameter_cm: Number(i.diameter_cm), price_per_m: toApiDecimal(i.price_per_m) })),
  };
}

/** Resumo somente leitura da tabela. */
export function PriceTableView({ table, scope = "job" }: { table: PriceTableOut; scope?: Scope }) {
  const mobilization =
    scope === "global"
      ? ["Mobilização (Uberlândia-MG)", table.mobilization_fee ? formatMoneyBR(table.mobilization_fee) : "—"]
      : ["Mobilização", table.mobilization_fee ? formatMoneyBR(table.mobilization_fee) : "A negociar"];
  return (
    <div className="max-w-2xl overflow-hidden border border-t-2 border-t-brand bg-white text-sm">
      <dl className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[
          mobilization,
          ["Valor mínimo", table.minimum_amount ? formatMoneyBR(table.minimum_amount) : "Sem mínimo"],
          ["Profundidade tabelada", `até ${formatDecimalBR(table.max_tabled_depth_m)} m`],
        ].map(([k, v]) => (
          <div key={k} className="flex min-w-0 items-baseline justify-between gap-3 px-4 py-2.5 sm:block sm:py-3">
            <dt className="text-stone-700 sm:eyebrow">{k}</dt>
            <dd className="font-display text-xl font-bold tabular-nums sm:mt-1">{v}</dd>
          </div>
        ))}
      </dl>
      <table className="w-full border-t border-brand-tint">
        <thead className="border-b border-brand text-left">
          <tr>
            <th scope="col" className="eyebrow px-4 pb-2 pt-3">Diâmetro</th>
            <th scope="col" className="eyebrow px-4 pb-2 pt-3 text-right">Preço por metro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-tint/70">
          {table.items.map((i) => (
            <tr key={i.diameter_cm}>
              <th scope="row" className="px-4 py-2.5 text-left font-sans font-semibold">{i.diameter_cm} cm</th>
              <td className="px-4 py-2.5 text-right tabular-nums">{formatMoneyBR(i.price_per_m)}/m</td>
            </tr>
          ))}
        </tbody>
      </table>
      {scope === "global" && (
        <p className="border-t border-brand-tint px-4 py-2.5 text-stone-700">
          Fora de {HOME_CITY}, a mobilização é negociada em cada obra.
        </p>
      )}
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

export function PriceTableForm({
  table, onSave, onCancel, scope = "job",
}: {
  table: PriceTableOut;
  onSave: (t: PriceTableOut) => Promise<void>;
  onCancel?: () => void;
  scope?: Scope;
}) {
  const { control, handleSubmit, formState, setError } = useForm<Values>({
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
    if (scope === "global" && v.mobilization_fee === "") {
      setError("mobilization_fee", { message: `Informe a mobilização em ${HOME_CITY}` });
      return;
    }
    try {
      await onSave(toPayload(v));
      setSaved(true);
    } catch (err) {
      setFormError(messageFor(err));
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="max-w-2xl space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Field
            label={scope === "global" ? `Mobilização em ${HOME_CITY} (R$)` : "Taxa de mobilização (R$)"}
            error={errors.mobilization_fee?.message}
          >
            <Controller
              control={control}
              name="mobilization_fee"
              render={({ field }) => <DecimalInput value={field.value} onChange={field.onChange} />}
            />
          </Field>
          <p className="mt-1 text-sm text-stone-600">
            {scope === "global"
              ? "Em outras cidades a obra começa com mobilização a negociar."
              : "Deixe em branco enquanto estiver a negociar."}
          </p>
        </div>
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
        <legend className="eyebrow px-1">Preço por metro</legend>
        {fields.map((f, i) => (
          <div key={f.id}>
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-sm font-medium">{f.diameter_cm} cm</span>
            <Controller
              control={control}
              name={`items.${i}.price_per_m`}
              render={({ field }) => (
                <DecimalInput
                  aria-label={`Preço por metro, ${f.diameter_cm} cm`}
                  value={field.value}
                  onChange={field.onChange}
                  className={`${inputClass} !mt-0 min-w-0 flex-1`}
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
          <label className="block flex-1">
            <span className="eyebrow">Novo diâmetro (cm)</span>
            <input
              className={inputClass}
              inputMode="numeric"
              value={newDiameter}
              onChange={(e) => setNewDiameter(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <button type="button" onClick={addRow} className="btn-label min-h-11 rounded-lg border border-stone-400 bg-white px-4">
            Adicionar
          </button>
        </div>
        {addError && <p className="text-sm text-red-700">{addError}</p>}
      </fieldset>
      <SubmitBar busy={isSubmitting} error={formError} saved={saved && !onCancel} onCancel={onCancel} />
    </form>
  );
}
