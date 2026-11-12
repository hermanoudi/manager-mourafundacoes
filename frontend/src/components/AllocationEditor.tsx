"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { api } from "@/lib/api";
import { messageFor } from "@/lib/errors";

import type { JobOut } from "./JobForm";

type Named = { id: number; name: string };

function Checks({ legend, options, selected, onToggle }: {
  legend: string; options: Named[]; selected: number[]; onToggle: (id: number) => void;
}) {
  return (
    <fieldset className="space-y-1">
      <legend className="text-sm font-medium">{legend}</legend>
      {options.length === 0 && <p className="text-sm text-stone-600">Nenhum disponível.</p>}
      {options.map((o) => (
        <label key={o.id} className="flex min-h-11 items-center gap-3 text-base">
          <input
            type="checkbox"
            className="size-5"
            checked={selected.includes(o.id)}
            onChange={() => onToggle(o.id)}
          />
          {o.name}
        </label>
      ))}
    </fieldset>
  );
}

/** Somente leitura para operador; edição para escritório/admin enquanto a obra não está encerrada. */
export function AllocationEditor({
  job, canEdit, onSaved,
}: { job: JobOut; canEdit: boolean; onSaved: (j: JobOut) => void }) {
  const { data: rigPage } = useQuery({
    queryKey: ["rigs-active"],
    queryFn: () => api<{ items: Named[] }>("/api/drill-rigs?status=active&page_size=100"),
    enabled: canEdit,
  });
  const { data: operators } = useQuery({
    queryKey: ["operators"],
    queryFn: () => api<Named[]>("/api/operators"),
    enabled: canEdit,
  });
  const [rigIds, setRigIds] = useState(job.rigs.map((r) => r.id));
  const [opIds, setOpIds] = useState(job.operators.map((o) => o.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (!canEdit) {
    return (
      <dl className="grid max-w-2xl grid-cols-2 gap-2 rounded-lg bg-white p-3 text-sm shadow-sm">
        <dt className="text-stone-600">Perfuratrizes</dt>
        <dd>{job.rigs.map((r) => r.name).join(", ") || "—"}</dd>
        <dt className="text-stone-600">Operadores</dt>
        <dd>{job.operators.map((o) => o.name).join(", ") || "—"}</dd>
      </dl>
    );
  }

  const rigOptions = [
    ...(rigPage?.items ?? []),
    ...job.rigs.filter((r) => !(rigPage?.items ?? []).some((a) => a.id === r.id)),
  ];
  const toggle = (set: React.Dispatch<React.SetStateAction<number[]>>) => (id: number) => {
    setSaved(false);
    set((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const out = await api<JobOut>(`/api/jobs/${job.id}/allocation`, {
        method: "PUT", body: JSON.stringify({ rig_ids: rigIds, operator_ids: opIds }),
      });
      setSaved(true);
      onSaved(out);
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-4 rounded-lg bg-white p-3 shadow-sm">
      <Checks legend="Perfuratrizes" options={rigOptions} selected={rigIds} onToggle={toggle(setRigIds)} />
      <Checks legend="Operadores" options={operators ?? []} selected={opIds} onToggle={toggle(setOpIds)} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {saved && <p className="text-sm text-green-800">Alocação salva</p>}
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-brand px-4 font-medium text-white hover:bg-brand-dark disabled:opacity-60 md:w-auto"
      >
        {busy ? "Salvando…" : "Salvar alocação"}
      </button>
    </div>
  );
}
