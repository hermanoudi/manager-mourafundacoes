"use client";

import { useState } from "react";

import { DecimalInput } from "@/components/DecimalInput";
import { Field, inputClass } from "@/components/Field";
import {
  MIN_DIAMETER_CM, formatHundredths, nextPileCode, pileKey, pilesLabel, toHundredths,
} from "@/lib/measurements";

/**
 * Linha em edição: tudo string pt-BR; `custom` = diâmetro "Outro" (fora da lista contratada);
 * `photo_error` = linha lida da foto que o servidor não entendeu — vale até o operador mexer nela.
 */
export type LineInput = {
  pile_code: string;
  diameter_cm: string;
  depth_m: string;
  custom?: boolean;
  photo_error?: string;
};
export type RigLimits = { max_diameter_cm: number; max_depth_m: string };

const OTHER = "other";

function lineError(line: LineInput, index: number, lines: LineInput[], rig: RigLimits | null) {
  if (line.photo_error) return line.photo_error;
  const key = pileKey(line.pile_code);
  if (key && lines.slice(0, index).some((l) => pileKey(l.pile_code) === key)) return "Estaca repetida";
  if (line.diameter_cm !== "") {
    const d = Number(line.diameter_cm);
    const max = rig?.max_diameter_cm ?? 120;
    if (!Number.isInteger(d) || d < MIN_DIAMETER_CM || d > max) {
      return `Diâmetro fora do limite da perfuratriz (${MIN_DIAMETER_CM}–${max} cm)`;
    }
  }
  if (line.depth_m !== "") {
    const h = toHundredths(line.depth_m);
    if (h === null) return "Profundidade inválida (use até 2 casas decimais)";
    if (h === 0) return "A profundidade deve ser maior que zero";
    const max = rig ? toHundredths(rig.max_depth_m) : null;
    if (max !== null && h > max) {
      return `Profundidade acima do limite da perfuratriz (${formatHundredths(max)} m)`;
    }
  }
  return null;
}

/** Erros por linha (null = ok) e se todas as linhas estão completas. */
export function validateLines(lines: LineInput[], rig: RigLimits | null) {
  const errors = lines.map((l, i) => lineError(l, i, lines, rig));
  const complete =
    lines.length > 0 &&
    lines.every((l) => l.pile_code.trim() !== "" && l.diameter_cm !== "" && l.depth_m !== "");
  return { errors, complete, valid: complete && errors.every((e) => e === null) };
}

export function totals(lines: LineInput[]) {
  const byDiameter = new Map<number, { piles: number; h: number }>();
  for (const l of lines) {
    const d = Number(l.diameter_cm);
    const h = toHundredths(l.depth_m);
    if (l.diameter_cm === "" || !Number.isInteger(d) || h === null) continue;
    const t = byDiameter.get(d) ?? { piles: 0, h: 0 };
    byDiameter.set(d, { piles: t.piles + 1, h: t.h + h });
  }
  const rows = [...byDiameter.entries()].sort(([a], [b]) => a - b);
  return {
    rows,
    piles: rows.reduce((s, [, t]) => s + t.piles, 0),
    h: rows.reduce((s, [, t]) => s + t.h, 0),
  };
}

type Props = {
  lines: LineInput[];
  onChange: (lines: LineInput[]) => void;
  diameters: number[];
  rig: RigLimits | null;
};

/** Profundidade é o número que o operador digita o dia todo: maior e mais legível sob sol. */
const depthClass =
  "mt-1 block min-h-14 w-full rounded-lg border border-stone-300 bg-white px-3 text-xl font-medium tabular-nums";

export function LinesEditor({ lines, onChange, diameters, rig }: Props) {
  const { errors } = validateLines(lines, rig);
  const sum = totals(lines);
  /** Última linha removida, para desfazer: um toque errado não perde a anotação. */
  const [removed, setRemoved] = useState<{ line: LineInput; index: number; n: number } | null>(null);

  function remove(i: number) {
    setRemoved({ line: lines[i], index: i, n: i + 1 });
    onChange(lines.filter((_, j) => j !== i));
  }

  function undo() {
    if (!removed) return;
    const next = [...lines];
    next.splice(Math.min(removed.index, next.length), 0, removed.line);
    onChange(next);
    setRemoved(null);
  }
  // Editar a linha conta como revisão: some o erro da leitura e valem as validações normais.
  const set = (i: number, patch: Partial<LineInput>) =>
    onChange(lines.map((l, j) => (j === i ? { ...l, ...patch, photo_error: undefined } : l)));

  function add() {
    const last = lines.at(-1);
    onChange([
      ...lines,
      {
        pile_code: last ? nextPileCode(last.pile_code) : "",
        diameter_cm: last ? last.diameter_cm : diameters.length ? String(diameters[0]) : "",
        custom: last ? last.custom : diameters.length === 0,
        depth_m: "",
      },
    ]);
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-3">
        {lines.map((line, i) => {
          const n = i + 1;
          const custom = line.custom || diameters.length === 0;
          return (
            <li key={i}>
              <div
                role="group"
                aria-label={`Linha ${n}`}
                className={`rounded-lg p-3 shadow-sm ${
                  line.photo_error ? "bg-red-50 ring-2 ring-red-500" : errors[i] ? "bg-white ring-2 ring-red-300" : "bg-white"
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-stone-700">Linha {n}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      aria-label={`Remover linha ${n}`}
                      onClick={() => remove(i)}
                      className="-mr-2 min-h-11 rounded-lg px-3 text-sm font-medium text-stone-700 hover:bg-stone-100"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 items-start gap-2 md:grid-cols-3">
                  <div className="col-span-2 md:col-span-1">
                    <Field label="Estaca">
                      <input
                        className={inputClass}
                        aria-invalid={errors[i] ? true : undefined}
                        aria-describedby={errors[i] ? `line-${i}-error` : undefined}
                        value={line.pile_code}
                        maxLength={20}
                        autoCapitalize="characters"
                        autoComplete="off"
                        onChange={(e) => set(i, { pile_code: e.target.value })}
                      />
                    </Field>
                  </div>
                  <div className="min-w-0 space-y-2">
                    <Field label="Diâmetro">
                      <select
                        className={inputClass}
                        value={custom ? OTHER : line.diameter_cm}
                        onChange={(e) =>
                          set(
                            i,
                            e.target.value === OTHER
                              ? { custom: true, diameter_cm: "" }
                              : { custom: false, diameter_cm: e.target.value },
                          )
                        }
                      >
                        {!custom && line.diameter_cm === "" && <option value="">Selecione</option>}
                        {diameters.map((d) => (
                          <option key={d} value={String(d)}>{d} cm</option>
                        ))}
                        <option value={OTHER}>Outro</option>
                      </select>
                    </Field>
                    {custom && (
                      <Field label="Outro diâmetro (cm)">
                        <input
                          className={inputClass}
                          inputMode="numeric"
                          autoComplete="off"
                          value={line.diameter_cm}
                          onChange={(e) => set(i, { diameter_cm: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                        />
                      </Field>
                    )}
                  </div>
                  <div className="min-w-0">
                    <Field label="Profundidade (m)">
                      <DecimalInput
                        className={depthClass}
                        aria-invalid={errors[i] ? true : undefined}
                        aria-describedby={errors[i] ? `line-${i}-error` : undefined}
                        value={line.depth_m}
                        onChange={(v) => set(i, { depth_m: v })}
                      />
                    </Field>
                  </div>
                </div>
                {errors[i] && (
                  <p id={`line-${i}-error`} className="mt-2 text-sm font-medium text-red-700">
                    {errors[i]}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {removed && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg bg-stone-800 py-1 pl-4 pr-1 text-sm text-white"
        >
          <span>{`Linha ${removed.n} removida`}</span>
          <button
            type="button"
            onClick={undo}
            className="min-h-11 rounded-lg px-4 font-medium text-brand-tint hover:bg-stone-700"
          >
            Desfazer
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={add}
        className="min-h-12 w-full rounded-lg border border-brand px-4 font-medium text-brand md:w-auto"
      >
        Adicionar estaca
      </button>
      <div data-testid="lines-totals" data-numeric className="rounded-lg bg-brand-soft p-3 text-sm text-stone-900">
        {sum.rows.map(([d, t]) => (
          <p key={d}>{`Ø ${d} cm: ${pilesLabel(t.piles)} · ${formatHundredths(t.h)} m`}</p>
        ))}
        <p className="mt-1 text-base font-semibold text-brand-dark">{`Total: ${pilesLabel(sum.piles)} · ${formatHundredths(sum.h)} m`}</p>
      </div>
    </div>
  );
}
