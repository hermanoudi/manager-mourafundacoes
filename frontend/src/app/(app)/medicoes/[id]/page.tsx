"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { DroppedEditsAlert } from "@/components/DroppedEditsAlert";
import { inputClass } from "@/components/Field";
import { Notice } from "@/components/Notice";
import { StatusBadge } from "@/components/StatusBadge";
import {
  btnDanger, btnPrimary, btnSecondary, EntityHeader, Facts, Kpi, KpiGrid, panel, SectionHead,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDateBR, formatDateTimeBR } from "@/lib/dates";
import { clearDraft, loadDraft } from "@/lib/drafts";
import { messageFor } from "@/lib/errors";
import { clearSentFlash, peekSentFlash } from "@/lib/flash";
import { formatDecimalBR } from "@/lib/format";
import {
  formatHundredthsGrouped, formatMeters, pilesLabel, sameContent, sumHundredths, type MeasurementOut,
} from "@/lib/measurements";

const BTN = "btn-label min-h-11 rounded-lg px-5 disabled:opacity-60";

/** Momento de alívio logo após lançar: o que foi registrado, em números, e para onde foi. */
function SentBanner({ id }: { id: number }) {
  const [flash] = useState(() => peekSentFlash(id));
  useEffect(() => {
    if (flash) clearSentFlash();
  }, [flash]);
  if (!flash) return null;
  const approved = flash.status === "approved";
  return (
    <div role="status" className="flex items-center gap-3 rounded-xl bg-green-50 p-4 text-green-950">
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
        <p className="font-semibold">{approved ? "Medição lançada e aprovada" : "Medição enviada"}</p>
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
  const router = useRouter();
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
  const isAdmin = me?.role === "admin";
  const isAuthor = me?.id === m.created_by.id;
  // O admin corrige, envia e exclui a medição de qualquer autor.
  const canEdit = (isAuthor || isAdmin) && (m.status === "draft" || m.status === "rejected");
  // Só a medição do próprio admin nasce aprovada ao enviar; a de outro autor vai para a fila.
  const sendLabel = isAdmin && isAuthor ? "Lançar e aprovar" : m.status === "rejected" ? "Reenviar" : "Enviar";
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

  async function remove() {
    if (!m || !window.confirm("Excluir esta medição? Essa ação não pode ser desfeita.")) return;
    setBusy(true);
    setActionError(null);
    try {
      await api(`/api/measurements/${id}`, { method: "DELETE" });
      clearDraft(m.client_key);
      await qc.invalidateQueries({ queryKey: ["measurements"] });
      router.replace(`/obras/${m.job.id}?aba=medicoes`);
    } catch (err) {
      setActionError(messageFor(err));
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

  const actions = (canReview || canEdit) && (
    <>
      {canReview && (
        <>
          <button type="button" disabled={busy} onClick={() => void act("approve")} className={btnPrimary}>
            Aprovar
          </button>
          <button type="button" disabled={busy} onClick={() => setRejecting(true)} className={btnDanger}>
            Rejeitar
          </button>
        </>
      )}
      {canEdit && (
        <>
          <button type="button" disabled={busy} onClick={() => void act("submit")} className={btnPrimary}>
            {sendLabel}
          </button>
          <Link href={`/obras/${m.job.id}/medicoes/nova?medicao=${m.id}`} className={btnSecondary}>
            Editar
          </Link>
          <button type="button" disabled={busy} onClick={() => void remove()} className={btnDanger}>
            Excluir
          </button>
        </>
      )}
    </>
  );

  const facts: [string, React.ReactNode][] = [
    ["Obra", <Link key="o" href={`/obras/${m.job.id}`} className="text-brand underline underline-offset-2">{m.job.name}</Link>],
    ["Perfuratriz", m.rig.name],
    ["Data do serviço", formatDateBR(m.work_date)],
    ["Lançada por", m.created_by.name],
  ];
  if (m.submitted_at) facts.push(["Enviada em", formatDateTimeBR(m.submitted_at)]);
  if (m.reviewed_by) facts.push(["Revisada por", `${m.reviewed_by.name} em ${formatDateTimeBR(m.reviewed_at)}`]);
  if (m.notes) facts.push(["Observações", m.notes]);

  return (
    <div className="min-w-0 max-w-5xl space-y-6">
      <SentBanner id={m.id} />

      <EntityHeader
        title={`Medição de ${formatDateBR(m.work_date)}`}
        meta={
          <>
            <StatusBadge kind="measurement" status={m.status} />
            <span className="min-w-0">{m.job.name} · {m.rig.name}</span>
          </>
        }
        actions={actions}
      >
        <KpiGrid>
          <Kpi label="Estacas" value={m.lines.length} />
          <Kpi label="Total" value={formatHundredthsGrouped(sumHundredths([m.total_m]))} unit="m" />
        </KpiGrid>
      </EntityHeader>

      {rejecting && (
        <div className={`${panel} max-w-2xl space-y-3 p-4`}>
          <label className="block">
            <span className="eyebrow">Motivo da rejeição</span>
            <textarea rows={3} maxLength={500} className={`${inputClass} py-2`} value={reason}
              onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" disabled={busy} onClick={confirmReject}
              className={`${BTN} bg-red-700 text-white hover:bg-red-800`}>
              Confirmar rejeição
            </button>
            <button type="button" onClick={() => { setRejecting(false); setActionError(null); }}
              className={`${BTN} text-stone-700 hover:bg-stone-100`}>
              Cancelar
            </button>
          </div>
        </div>
      )}
      {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}

      {m.status === "rejected" && m.rejection_reason && (
        <Notice tone="error" className="max-w-2xl">
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

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0">
          <SectionHead title="Estacas" />
          {uncontracted.size > 0 && (
            <Notice tone="warn" className="mb-3">
              Diâmetros sem preço contratado na obra:{" "}
              {m.uncontracted_diameters.map((d) => `${d} cm`).join(", ")}
            </Notice>
          )}
          <div className={`${panel} overflow-hidden`}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-brand">
                <tr>
                  <th scope="col" className="eyebrow px-4 pb-2 pt-3.5 ">Estaca</th>
                  <th scope="col" className="eyebrow px-4 pb-2 pt-3.5 ">Diâmetro</th>
                  <th scope="col" className="eyebrow px-4 pb-2 pt-3.5 text-right ">Profundidade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-tint/70">
                {m.lines.map((l) => {
                  const off = uncontracted.has(l.diameter_cm);
                  return (
                    <tr key={l.pile_code} className={off ? "bg-amber-50" : undefined}
                      data-uncontracted={off || undefined}>
                      <td className="break-all px-4 py-2.5 font-medium">{l.pile_code}</td>
                      <td className="px-4 py-2.5 tabular-nums">
                        {l.diameter_cm} cm{off && <span className="block text-xs text-amber-800">fora da tabela</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{formatDecimalBR(l.depth_m)} m</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-secondary-dark text-sm">
                {m.totals_by_diameter.map((t) => (
                  <tr key={t.diameter_cm}>
                    <th scope="row" colSpan={2} className="px-4 py-1.5 text-left font-normal text-stone-700">
                      {`Ø ${t.diameter_cm} cm · ${pilesLabel(t.piles)}`}
                    </th>
                    <td className="px-4 py-1.5 text-right tabular-nums">{formatMeters(t.meters)}</td>
                  </tr>
                ))}
                <tr className="border-t">
                  <td colSpan={3} className="px-4 py-2.5">
                    <p data-testid="measurement-total" className="flex justify-between gap-3 font-semibold tabular-nums">
                      <span>Total: {pilesLabel(m.lines.length)}</span>
                      <span>{formatMeters(m.total_m)}</span>
                    </p>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <aside className="min-w-0 space-y-8">
          <section>
            <SectionHead title="Detalhes" />
            <Facts items={facts} />
          </section>
          {m.photo_id && (
            <section>
              <SectionHead title="Foto da folha" />
              <a href={`/api/photos/${m.photo_id}`} target="_blank" rel="noreferrer" className="block">
                {/* eslint-disable-next-line @next/next/no-img-element -- foto autenticada servida pela API */}
                <img src={`/api/photos/${m.photo_id}`} alt="Foto da folha de medição"
                  className="max-h-[70vh] w-full rounded-xl border bg-white object-contain" />
              </a>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
