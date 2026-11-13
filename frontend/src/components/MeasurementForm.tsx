"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DroppedEditsAlert } from "@/components/DroppedEditsAlert";
import { Field, inputClass } from "@/components/Field";
import type { JobOut } from "@/components/JobForm";
import { LinesEditor, totals, validateLines, type LineInput } from "@/components/LinesEditor";
import { Notice } from "@/components/Notice";
import { PhotoCapture } from "@/components/PhotoCapture";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { todaySP } from "@/lib/dates";
import { clearDraft, loadDraft, saveDraft, type MeasurementDraft } from "@/lib/drafts";
import { messageFor } from "@/lib/errors";
import { formatDecimalBR, toApiDecimal } from "@/lib/format";
import {
  editsDropped, formatHundredths, pilesLabel, type ExtractedLine, type Extraction, type MeasurementIn,
  type MeasurementOut,
} from "@/lib/measurements";
import { flashSent } from "@/lib/flash";
import { nullIfEmpty } from "@/lib/schemas";

type Values = {
  /** Operador responsável (só o admin escolhe; o operador lança no próprio nome). */
  operatorId: string;
  rigId: string;
  workDate: string;
  lines: LineInput[];
  notes: string;
  photoId: string | null;
};
/** Envio tentado e não confirmado: `submit` é o que reenviar; `offline` = falha de rede agora. */
type Retry = { submit: boolean; offline: boolean };

function fromSource(src: MeasurementIn | MeasurementOut | null, job: JobOut): Values {
  const diameters = job.contracted_diameters;
  if (!src) {
    return {
      operatorId: job.operators.length === 1 ? String(job.operators[0].id) : "",
      rigId: job.rigs.length === 1 ? String(job.rigs[0].id) : "",
      workDate: todaySP(),
      lines: [{
        pile_code: "",
        diameter_cm: diameters.length ? String(diameters[0]) : "",
        custom: diameters.length === 0,
        depth_m: "",
      }],
      notes: "",
      photoId: null,
    };
  }
  const rigId = "rig" in src ? src.rig.id : src.rig_id;
  const operatorId = "created_by" in src ? src.created_by.id : src.operator_id;
  return {
    operatorId: operatorId == null ? "" : String(operatorId),
    rigId: rigId == null ? "" : String(rigId),
    workDate: src.work_date,
    lines: src.lines.map((l) => ({
      pile_code: l.pile_code,
      diameter_cm: l.diameter_cm == null ? "" : String(l.diameter_cm),
      custom: l.diameter_cm != null && !diameters.includes(l.diameter_cm),
      depth_m: formatDecimalBR(l.depth_m),
    })),
    notes: src.notes ?? "",
    photoId: src.photo_id ?? null,
  };
}

/** Linha lida da foto → linha do editor; a inválida vem marcada com o motivo do servidor. */
function fromExtracted(l: ExtractedLine, diameters: number[]): LineInput {
  return {
    pile_code: l.pile_code,
    diameter_cm: l.diameter_cm == null ? "" : String(l.diameter_cm),
    custom: l.diameter_cm == null ? diameters.length === 0 : !diameters.includes(l.diameter_cm),
    depth_m: l.depth_m == null ? "" : formatDecimalBR(l.depth_m),
    photo_error: l.valid ? undefined : (l.error ?? "Linha não reconhecida"),
  };
}

const isBlank = (l: LineInput) => l.pile_code.trim() === "" && l.depth_m === "";
const hasPhotoErrors = (v: Values) => v.lines.some((l) => l.photo_error);

function problem(v: Values, rig: JobOut["rigs"][number] | null, pickOperator: boolean): string | null {
  if (hasPhotoErrors(v)) return "Corrija ou remova as linhas lidas da foto destacadas";
  if (pickOperator && !v.operatorId) return "Selecione o operador";
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
 * Lançamento por digitação ou pela foto das anotações (a IA só preenche as linhas para revisão;
 * `photo_id` vai junto no rascunho e no envio). O rascunho fica no aparelho a cada mudança e
 * "Salvar rascunho"/"Enviar" sempre fazem POST com o mesmo client_key (o servidor faz upsert); o
 * rascunho local só é apagado depois que o servidor confirma.
 */
export function MeasurementForm({ job, clientKey, server = null }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const { data: me } = useMe();
  // Medição enviada pelo admin já sai aprovada, de qualquer autor (regra do servidor); o botão avisa.
  const isAdmin = me?.role === "admin";
  const sendLabel = isAdmin ? "Lançar e aprovar" : "Enviar";
  const [local] = useState(() => loadDraft(clientKey));
  const [values, setValues] = useState<Values>(() => fromSource(local ?? server, job));
  const [retry, setRetry] = useState<Retry | null>(() =>
    local?.submit ? { submit: true, offline: false } : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropped, setDropped] = useState<MeasurementOut | null>(null);
  const [maxDate] = useState(() => todaySP());
  /** Linhas vieram da foto (agora ou num rascunho reaberto): mostra o aviso de conferência. */
  const [fromPhoto, setFromPhoto] = useState(() => values.photoId !== null);
  const [photoWarnings, setPhotoWarnings] = useState<string[]>([]);
  /** Foto sendo lida: enviar agora levaria `photo_id: null` e a foto nunca seria anexada. */
  const [reading, setReading] = useState(false);

  const rig = job.rigs.find((r) => String(r.id) === values.rigId) ?? null;
  const sum = totals(values.lines);
  // Autor atual fora da equipe (desalocado, ou medição antiga do próprio admin): continua na lista.
  const operators =
    server && !job.operators.some((o) => o.id === server.created_by.id)
      ? [...job.operators, server.created_by]
      : job.operators;

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
      photo_id: v.photoId,
      submit,
      ...(isAdmin ? { operator_id: v.operatorId ? Number(v.operatorId) : null } : {}),
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

  /**
   * Resposta da foto chega depois de segundos: aplica sobre o estado mais recente (o operador pode
   * ter digitado enquanto lia). Persistir no updater é idempotente (mesmo rascunho, mesma URL).
   */
  function update(fn: (v: Values) => Values) {
    setError(null);
    setValues((prev) => {
      const next = fn(prev);
      persist(next, retry?.submit ?? false);
      return next;
    });
  }

  function applyExtraction(photoId: string, extraction: Extraction) {
    setFromPhoto(true);
    setPhotoWarnings(extraction.warnings);
    update((prev) => {
      // A linha em branco inicial dá lugar às lidas; o que já foi digitado fica antes delas.
      const read = extraction.lines.map((l) => fromExtracted(l, job.contracted_diameters));
      const lines = [...prev.lines.filter((l) => !isBlank(l)), ...read];
      return { ...prev, photoId, lines: lines.length ? lines : prev.lines };
    });
  }

  function attachPhoto(photoId: string | null) {
    if (photoId) update((prev) => ({ ...prev, photoId }));
  }

  async function send(submit: boolean) {
    if (submit && reading) return;
    const msg = problem(values, rig, isAdmin);
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
      flashSent(m.id, m.status, values.lines.length, m.total_m);
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
      className="max-w-3xl space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        void send(true);
      }}
    >
      {server?.status === "rejected" && server.rejection_reason && (
        <Notice tone="error">
          <p>Motivo da rejeição: {server.rejection_reason}</p>
        </Notice>
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
        <Notice tone="warn" role="status">
          <p>
            {retry.offline
              ? "Sem conexão — a medição ficou salva neste aparelho"
              : "Envio pendente — a medição ficou salva neste aparelho"}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(retry.submit)}
            className="mt-1 min-h-11 rounded-lg bg-amber-800 px-4 btn-label text-white disabled:opacity-60"
          >
            Reenviar
          </button>
        </Notice>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {isAdmin && (
          <div className="md:col-span-2">
            <Field label="Operador">
              <select
                className={inputClass}
                value={values.operatorId}
                onChange={(e) => change({ operatorId: e.target.value })}
              >
                {values.operatorId === "" && <option value="">Selecione</option>}
                {operators.map((o) => (
                  <option key={o.id} value={String(o.id)}>{o.name}</option>
                ))}
              </select>
            </Field>
          </div>
        )}
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
        <PhotoCapture
          jobId={job.id}
          prominent={!fromPhoto}
          onExtracted={applyExtraction}
          onError={(_code, photoId) => attachPhoto(photoId)}
          onReadingChange={setReading}
        />
        {fromPhoto && (
          <Notice tone="warn" role="note">
            <p className="font-medium">Confira as linhas lidas da foto antes de enviar</p>
            {photoWarnings.map((w) => <p key={w}>{w}</p>)}
          </Notice>
        )}
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

      {/* Barra de ações fixa acima da navegação: Enviar e o total ficam ao alcance do polegar. */}
      <div
        data-testid="action-bar"
        className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 space-y-2 border-t bg-white px-4 py-3 shadow-[0_-4px_12px_rgb(0_0_0/0.06)] md:bottom-0 md:mx-0 md:rounded-lg md:border"
      >
        {error && <Notice tone="error" role="alert">{error}</Notice>}
        {reading && <p className="text-sm text-stone-700">Aguarde a leitura da foto para enviar</p>}
        <p data-numeric className="text-sm font-medium text-stone-900 md:hidden">
          {`${pilesLabel(sum.piles)} · ${formatHundredths(sum.h)} m`}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void send(false)}
            className="min-h-12 flex-1 whitespace-nowrap rounded-lg border border-brand px-3 btn-label text-brand disabled:opacity-60 md:flex-none md:px-4"
          >
            Salvar rascunho
          </button>
          <button
            type="submit"
            disabled={busy || reading || hasPhotoErrors(values)}
            className="min-h-12 flex-1 whitespace-nowrap rounded-lg bg-brand px-3 btn-label text-white hover:bg-brand-dark disabled:opacity-60 md:flex-none md:px-4"
          >
            {busy ? "Enviando…" : sendLabel}
          </button>
        </div>
      </div>
    </form>
  );
}
