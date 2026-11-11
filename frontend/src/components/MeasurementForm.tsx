"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DroppedEditsAlert } from "@/components/DroppedEditsAlert";
import { Field, inputClass } from "@/components/Field";
import type { JobOut } from "@/components/JobForm";
import { LinesEditor, validateLines, type LineInput } from "@/components/LinesEditor";
import { api } from "@/lib/api";
import { todaySP } from "@/lib/dates";
import { clearDraft, loadDraft, saveDraft, type MeasurementDraft } from "@/lib/drafts";
import { messageFor } from "@/lib/errors";
import { formatDecimalBR, toApiDecimal } from "@/lib/format";
import { editsDropped, type MeasurementIn, type MeasurementOut } from "@/lib/measurements";
import { nullIfEmpty } from "@/lib/schemas";

type Values = { rigId: string; workDate: string; lines: LineInput[]; notes: string };
/** Envio tentado e não confirmado: `submit` é o que reenviar; `offline` = falha de rede agora. */
type Retry = { submit: boolean; offline: boolean };

function fromSource(src: MeasurementIn | MeasurementOut | null, job: JobOut): Values {
  const diameters = job.contracted_diameters;
  if (!src) {
    return {
      rigId: job.rigs.length === 1 ? String(job.rigs[0].id) : "",
      workDate: todaySP(),
      lines: [{
        pile_code: "",
        diameter_cm: diameters.length ? String(diameters[0]) : "",
        custom: diameters.length === 0,
        depth_m: "",
      }],
      notes: "",
    };
  }
  const rigId = "rig" in src ? src.rig.id : src.rig_id;
  return {
    rigId: rigId == null ? "" : String(rigId),
    workDate: src.work_date,
    lines: src.lines.map((l) => ({
      pile_code: l.pile_code,
      diameter_cm: l.diameter_cm == null ? "" : String(l.diameter_cm),
      custom: l.diameter_cm != null && !diameters.includes(l.diameter_cm),
      depth_m: formatDecimalBR(l.depth_m),
    })),
    notes: src.notes ?? "",
  };
}

function problem(v: Values, rig: JobOut["rigs"][number] | null): string | null {
  if (!rig) return "Selecione a perfuratriz";
  if (!v.workDate) return "Informe a data do serviço";
  if (v.workDate > todaySP()) return "A data não pode ser futura";
  const lines = validateLines(v.lines, rig);
  if (!lines.complete) return "Preencha estaca, diâmetro e profundidade em todas as linhas";
  if (!lines.valid) return "Corrija as linhas destacadas";
  return null;
}

type Props = {
  job: JobOut;
  clientKey: string;
  /** Medição do servidor sendo editada (rascunho ou rejeitada); o rascunho local tem prioridade. */
  server?: MeasurementOut | null;
};

/**
 * Lançamento por digitação. O rascunho fica no aparelho a cada mudança e "Salvar rascunho"/"Enviar"
 * sempre fazem POST com o mesmo client_key (o servidor faz upsert); o rascunho local só é apagado
 * depois que o servidor confirma.
 */
export function MeasurementForm({ job, clientKey, server = null }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const [local] = useState(() => loadDraft(clientKey));
  const [values, setValues] = useState<Values>(() => fromSource(local ?? server, job));
  const [retry, setRetry] = useState<Retry | null>(() =>
    local?.submit ? { submit: true, offline: false } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropped, setDropped] = useState<MeasurementOut | null>(null);
  const [maxDate] = useState(() => todaySP());

  const photoId = local?.photo_id ?? server?.photo_id ?? null;
  const rig = job.rigs.find((r) => String(r.id) === values.rigId) ?? null;

  function toPayload(v: Values, submit: boolean): MeasurementIn {
    return {
      client_key: clientKey,
      job_id: job.id,
      rig_id: v.rigId ? Number(v.rigId) : null,
      work_date: v.workDate,
      lines: v.lines.map((l) => ({
        pile_code: l.pile_code.trim(),
        diameter_cm: l.diameter_cm === "" ? null : Number(l.diameter_cm),
        depth_m: toApiDecimal(l.depth_m),
      })),
      notes: nullIfEmpty(v.notes),
      photo_id: photoId,
      submit,
    };
  }

  function persist(v: Values, submit: boolean) {
    const draft: MeasurementDraft = { ...toPayload(v, submit), saved_at: new Date().toISOString() };
    saveDraft(draft);
    // Recarregar a página reabre o mesmo rascunho (mesmo client_key).
    const query = server ? `medicao=${server.id}` : `rascunho=${clientKey}`;
    const url = `/obras/${job.id}/medicoes/nova?${query}`;
    if (window.location.pathname + window.location.search !== url) {
      window.history.replaceState(null, "", url);
    }
  }

  function change(patch: Partial<Values>) {
    const next = { ...values, ...patch };
    setValues(next);
    setError(null);
    persist(next, retry?.submit ?? false);
  }

  async function send(submit: boolean) {
    const msg = problem(values, rig);
    if (msg) {
      setError(msg);
      return;
    }
    persist(values, submit);
    setBusy(true);
    setError(null);
    setDropped(null);
    const payload = toPayload(values, submit);
    try {
      const m = await api<MeasurementOut | null>("/api/measurements", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      // Corpo truncado/ilegível: o servidor não confirmou nada, o rascunho fica.
      if (!m || typeof m.id !== "number") throw new TypeError("resposta incompleta");
      qc.setQueryData(["measurement", String(m.id)], m);
      await qc.invalidateQueries({ queryKey: ["measurements"] });
      if (editsDropped(payload, m)) {
        setRetry(null);
        setDropped(m);
        setBusy(false);
        return;
      }
      clearDraft(clientKey);
      router.push(`/medicoes/${m.id}`);
    } catch (err) {
      if (err instanceof TypeError) {
        setRetry({ submit, offline: true });
      } else {
        setRetry(null);
        persist(values, false);
        setError(messageFor(err));
      }
      setBusy(false);
    }
  }

  return (
    <form
      className="max-w-3xl space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send(true);
      }}
    >
      {server?.status === "rejected" && server.rejection_reason && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Motivo da rejeição: {server.rejection_reason}
        </p>
      )}
      {dropped && (
        <DroppedEditsAlert
          measurementId={dropped.id}
          onDiscard={() => {
            clearDraft(clientKey);
            router.push(`/medicoes/${dropped.id}`);
          }}
        />
      )}
      {retry && (
        <div role="status" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            {retry.offline
              ? "Sem conexão — a medição ficou salva neste aparelho"
              : "Envio pendente — a medição ficou salva neste aparelho"}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(retry.submit)}
            className="min-h-11 rounded-lg bg-amber-700 px-4 font-medium text-white disabled:opacity-60"
          >
            Reenviar
          </button>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Perfuratriz">
          <select
            className={inputClass}
            value={values.rigId}
            onChange={(e) => change({ rigId: e.target.value })}
          >
            {values.rigId === "" && <option value="">Selecione</option>}
            {job.rigs.map((r) => (
              <option key={r.id} value={String(r.id)}>{r.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Data do serviço">
          <input
            type="date"
            className={inputClass}
            max={maxDate}
            value={values.workDate}
            onChange={(e) => change({ workDate: e.target.value })}
          />
        </Field>
      </div>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">Estacas</h2>
        <LinesEditor
          lines={values.lines}
          onChange={(lines) => change({ lines })}
          diameters={job.contracted_diameters}
          rig={rig}
        />
      </section>

      <Field label="Observações">
        <textarea
          rows={2}
          className={`${inputClass} py-2`}
          value={values.notes}
          onChange={(e) => change({ notes: e.target.value })}
        />
      </Field>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex flex-col gap-2 md:flex-row">
        <button
          type="button"
          disabled={busy}
          onClick={() => void send(false)}
          className="min-h-11 rounded-lg border border-brand px-4 font-medium text-brand disabled:opacity-60"
        >
          Salvar rascunho
        </button>
        <button
          type="submit"
          disabled={busy}
          className="min-h-11 rounded-lg bg-brand px-4 font-medium text-white hover:bg-brand-dark disabled:opacity-60"
        >
          {busy ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
