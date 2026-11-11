"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { DroppedEditsAlert } from "@/components/DroppedEditsAlert";
import { inputClass } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDateBR, formatDateTimeBR } from "@/lib/dates";
import { clearDraft, loadDraft } from "@/lib/drafts";
import { messageFor } from "@/lib/errors";
import { clearSentFlash, peekSentFlash } from "@/lib/flash";
import { formatDecimalBR } from "@/lib/format";
import { formatMeters, pilesLabel, sameContent, type MeasurementOut } from "@/lib/measurements";

const BTN = "min-h-11 rounded-lg px-4 font-medium disabled:opacity-60";

/** Momento de alívio logo após lançar: o que foi registrado, em números, e para onde foi. */
function SentBanner({ id }: { id: number }) {
  const [flash] = useState(() => peekSentFlash(id));
  useEffect(() => {
    if (flash) clearSentFlash();
  }, [flash]);
  if (!flash) return null;
  const approved = flash.status === "approved";
  return (
    <div role="status" className="flex items-center gap-3 rounded-lg bg-green-50 p-3 text-green-950">
      <svg
        viewBox="0 0 24 24"
        width="28"
        height="28"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="mg-check shrink-0 text-green-800"
      >
        <path d="M5 12.5l4.5 4.5L19 7.500" />
      </svg>
      <div className="min-w-0">
        <p className="font-medium">{approved ? "Medição lançada e aprovada" : "Medição enviada"}</p>
        <p data-numeric className="text-sm">
          {`${pilesLabel(flash.piles)} · ${formatMeters(flash.total_m)}`}
          {approved ? "" : " — aguardando aprovação do escritório"}
        </p>
      </div>
    </div>
  );
}

export default function MedicaoPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: m, error } = useQuery({
    queryKey: ["measurement", id],
    queryFn: () => api<MeasurementOut>(`/api/measurements/${id}`),
    retry: false,
  });
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [staleDraft, setStaleDraft] = useState<string | null>(null);

  if (error) return <p role="alert">{messageFor(error)}</p>;
  if (!m) return <p>Carregando…</p>;

  const canReview = (me?.role === "admin" || me?.role === "office") && m.status === "submitted";
  const canEdit = me?.id === m.created_by.id && (m.status === "draft" || m.status === "rejected");
  const uncontracted = new Set(m.uncontracted_diameters);

  async function act(path: string, body?: unknown) {
    setBusy(true);
    setActionError(null);
    try {
      const saved = await api<MeasurementOut | null>(`/api/measurements/${id}/${path}`, {
        method: "POST",
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      if (!saved || typeof saved.id !== "number") throw new TypeError("resposta incompleta");
      qc.setQueryData(["measurement", id], saved);
      if (path === "submit") {
        // Rascunho local da mesma medição: some se bate com o enviado; senão o usuário decide.
        const local = loadDraft(saved.client_key);
        if (local && sameContent(local, saved)) clearDraft(saved.client_key);
        else if (local) setStaleDraft(saved.client_key);
      }
      await qc.invalidateQueries({ queryKey: ["measurements"] });
      setRejecting(false);
    } catch (err) {
      setActionError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  function confirmReject() {
    if (reason.trim().length < 3) {
      setActionError("Informe o motivo da rejeição");
      return;
    }
    void act("reject", { reason: reason.trim() });
  }

  return (
    <div className="min-w-0 max-w-3xl space-y-6">
      <SentBanner id={m.id} />

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold">Medição #{m.id}</h1>
        <StatusBadge kind="measurement" status={m.status} />
      </div>

      {m.status === "rejected" && m.rejection_reason && (
        <Notice tone="error">
          <p className="font-medium">Motivo da rejeição</p>
          <p className="break-words">{m.rejection_reason}</p>
        </Notice>
      )}

      {staleDraft && (
        <DroppedEditsAlert
          measurementId={m.id}
          onDiscard={() => {
            clearDraft(staleDraft);
            setStaleDraft(null);
          }}
        />
      )}

      {(canReview || canEdit) && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {canReview && (
              <>
                <button type="button" disabled={busy} onClick={() => void act("approve")}
                  className={`${BTN} bg-brand text-white hover:bg-brand-dark`}>
                  Aprovar
                </button>
                <button type="button" disabled={busy} onClick={() => setRejecting(true)}
                  className={`${BTN} border border-red-300 text-red-700`}>
                  Rejeitar
                </button>
              </>
            )}
            {canEdit && (
              <>
                <Link href={`/obras/${m.job.id}/medicoes/nova?medicao=${m.id}`}
                  className={`${BTN} inline-flex items-center border border-brand text-brand`}>
                  Editar
                </Link>
                <button type="button" disabled={busy} onClick={() => void act("submit")}
                  className={`${BTN} bg-brand text-white hover:bg-brand-dark`}>
                  Reenviar
                </button>
              </>
            )}
          </div>
          {rejecting && (
            <div className="space-y-2 rounded-lg bg-white p-3 shadow-sm">
              <label className="block text-sm font-medium">
                Motivo da rejeição
                <textarea rows={3} maxLength={500} className={`${inputClass} py-2`} value={reason}
                  onChange={(e) => setReason(e.target.value)} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={confirmReject}
                  className={`${BTN} bg-red-700 text-white`}>
                  Confirmar rejeição
                </button>
                <button type="button" onClick={() => { setRejecting(false); setActionError(null); }}
                  className={`${BTN} border border-stone-300`}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
        </div>
      )}

      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg bg-white p-3 text-sm shadow-sm">
        <dt className="text-stone-600">Obra</dt>
        <dd className="break-words">
          <Link href={`/obras/${m.job.id}`} className="text-brand underline">{m.job.name}</Link>
        </dd>
        <dt className="text-stone-600">Perfuratriz</dt>
        <dd className="break-words">{m.rig.name}</dd>
        <dt className="text-stone-600">Data do serviço</dt>
        <dd>{formatDateBR(m.work_date)}</dd>
        <dt className="text-stone-600">Lançada por</dt>
        <dd className="break-words">{m.created_by.name}</dd>
        {m.submitted_at && (
          <>
            <dt className="text-stone-600">Enviada em</dt>
            <dd>{formatDateTimeBR(m.submitted_at)}</dd>
          </>
        )}
        {m.reviewed_by && (
          <>
            <dt className="text-stone-600">Revisada por</dt>
            <dd className="break-words">{m.reviewed_by.name} em {formatDateTimeBR(m.reviewed_at)}</dd>
          </>
        )}
        {m.notes && (
          <>
            <dt className="text-stone-600">Observações</dt>
            <dd className="break-words">{m.notes}</dd>
          </>
        )}
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Estacas</h2>
        {uncontracted.size > 0 && (
          <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            Diâmetros sem preço contratado na obra:{" "}
            {m.uncontracted_diameters.map((d) => `${d} cm`).join(", ")}
          </p>
        )}
        <table className="w-full rounded-lg bg-white text-left text-sm shadow-sm">
          <thead>
            <tr className="border-b text-stone-600">
              <th className="px-3 py-2 font-medium">Estaca</th>
              <th className="px-3 py-2 font-medium">Diâmetro</th>
              <th className="px-3 py-2 text-right font-medium">Profundidade</th>
            </tr>
          </thead>
          <tbody>
            {m.lines.map((l) => {
              const off = uncontracted.has(l.diameter_cm);
              return (
                <tr key={l.pile_code} className={`border-b last:border-0 ${off ? "bg-amber-50" : ""}`}
                  data-uncontracted={off || undefined}>
                  <td className="break-all px-3 py-2">{l.pile_code}</td>
                  <td className="px-3 py-2">
                    {l.diameter_cm} cm{off && <span className="block text-xs text-amber-800">fora da tabela</span>}
                  </td>
                  <td className="px-3 py-2 text-right">{formatDecimalBR(l.depth_m)} m</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="rounded-lg bg-stone-100 p-3 text-sm">
          {m.totals_by_diameter.map((t) => (
            <p key={t.diameter_cm}>{`Ø ${t.diameter_cm} cm: ${pilesLabel(t.piles)} · ${formatMeters(t.meters)}`}</p>
          ))}
          <p data-testid="measurement-total" className="font-medium">
            {`Total: ${pilesLabel(m.lines.length)} · ${formatMeters(m.total_m)}`}
          </p>
        </div>
      </section>

      {m.photo_id && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Foto da folha</h2>
          {/* eslint-disable-next-line @next/next/no-img-element -- foto autenticada servida pela API */}
          <img src={`/api/photos/${m.photo_id}`} alt="Foto da folha de medição"
            className="max-h-[70vh] w-full rounded-lg object-contain shadow-sm" />
        </section>
      )}
    </div>
  );
}
