"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { AllocationEditor } from "@/components/AllocationEditor";
import { JobForm, type JobOut } from "@/components/JobForm";
import { PriceTableForm, PriceTableView, type PriceTableOut } from "@/components/PriceTableEditor";
import { StatusBadge, type JobStatus } from "@/components/StatusBadge";
import { Tabs, type TabDef } from "@/components/Tabs";
import {
  btnPrimary, btnSecondary, btnQuiet, EmptyPanel, EntityHeader, Facts, Kpi, KpiGrid, panel, PencilIcon, SectionHead,
} from "@/components/ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDateBR, formatDateTimeBR } from "@/lib/dates";
import { listDrafts } from "@/lib/drafts";
import { messageFor } from "@/lib/errors";
import {
  formatHundredthsGrouped, pilesLabel, sumHundredths, type MeasurementSummary,
} from "@/lib/measurements";

/** Avanço do ciclo de vida; o cancelamento fica separado, na aba Dados. */
const NEXT_STEP: Partial<Record<JobStatus, { label: string; to: JobStatus }>> = {
  planned: { label: "Iniciar obra", to: "in_progress" },
  in_progress: { label: "Concluir obra", to: "completed" },
};

type TabKey = "resumo" | "medicoes" | "precos" | "equipe" | "dados";

const btnEdit = `${btnQuiet} text-sm`;

type Page<T> = { items: T[]; total: number };

/** Todas as medições da obra (o operador recebe só as dele), mais recentes primeiro. */
async function fetchJobMeasurements(jobId: string): Promise<MeasurementSummary[]> {
  const all: MeasurementSummary[] = [];
  for (let page = 1; ; page++) {
    const p = await api<Page<MeasurementSummary>>(
      `/api/measurements?job_id=${jobId}&page_size=100&page=${page}`,
    );
    all.push(...p.items);
    if (p.items.length === 0 || all.length >= p.total) break;
  }
  return all.sort((a, b) => b.work_date.localeCompare(a.work_date) || b.id - a.id);
}

function Saved({ text }: { text: string | null }) {
  return text ? <p role="status" className="mb-3 text-sm text-green-800">{text}</p> : null;
}

/* ---------- Cabeçalho com indicadores ---------- */

function JobHeader({
  job, measurements, actions, ownOnly,
}: {
  job: JobOut; measurements: MeasurementSummary[] | undefined; actions: React.ReactNode; ownOnly: boolean;
}) {
  const sent = measurements?.filter((m) => m.status !== "draft") ?? [];
  const approved = sumHundredths(sent.filter((m) => m.status === "approved").map((m) => m.total_m));
  const pending = sumHundredths(sent.filter((m) => m.status === "submitted").map((m) => m.total_m));
  const last = sent[0]?.work_date;
  const loading = measurements === undefined;

  return (
    <EntityHeader
      title={job.name}
      meta={
        <>
          <StatusBadge kind="job" status={job.status} />
          <span className="min-w-0">
            {job.customer.name} · {job.address.city}/{job.address.state}
          </span>
        </>
      }
      actions={actions}
    >
      <KpiGrid busy={loading}>
        <Kpi label="Metros aprovados" value={loading ? "…" : formatHundredthsGrouped(approved)} unit="m" />
        <Kpi label="Em aprovação" value={loading ? "…" : formatHundredthsGrouped(pending)} unit="m" />
        <Kpi label="Medições" value={loading ? "…" : String(sent.length)} />
        <Kpi label="Última medição" value={loading ? "…" : last ? formatDateBR(last).slice(0, 5) : "—"} />
      </KpiGrid>
      {ownOnly && (
        <p className="text-sm text-stone-600">
          Números das medições lançadas por você.
        </p>
      )}
    </EntityHeader>
  );
}

/* ---------- Resumo ---------- */

/** Rascunhos de medição guardados neste aparelho (localStorage) para a obra. */
function LocalDrafts({ jobId }: { jobId: number }) {
  const drafts = listDrafts(jobId);
  if (drafts.length === 0) return null;
  return (
    <section aria-labelledby="local-drafts">
      <SectionHead id="local-drafts" title="Rascunhos neste aparelho" />
      <ul className={`${panel} divide-y`}>
        {drafts.map((d) => (
          <li key={d.client_key}>
            <Link
              href={`/obras/${jobId}/medicoes/nova?rascunho=${d.client_key}`}
              className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-stone-50"
            >
              <span>
                <span className="font-medium">{formatDateBR(d.work_date)} · {pilesLabel(d.lines.length)}</span>
                <span className="block text-stone-600">
                  {d.submit ? "Envio pendente · " : ""}salvo em {formatDateTimeBR(d.saved_at)}
                </span>
              </span>
              <span className="font-medium text-brand">Continuar</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CheckItem({ done, label, onGo }: { done: boolean; label: string; onGo: () => void }) {
  return (
    <li className="flex min-h-12 items-center gap-3 px-4">
      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full ${
          done ? "bg-green-100 text-green-800" : "border-2 border-stone-300"
        }`}
      >
        {done && (
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.25"
            strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 8.5l3.5 3.5L13 4.5" />
          </svg>
        )}
      </span>
      <span className={`flex-1 text-sm ${done ? "text-stone-600" : "font-medium"}`}>
        {label}
        <span className="sr-only">{done ? " (feito)" : " (pendente)"}</span>
      </span>
      {!done && (
        <button type="button" onClick={onGo} className="min-h-11 px-2 text-sm font-medium text-brand">
          Resolver
        </button>
      )}
    </li>
  );
}

function ProductionByDiameter({ measurements }: { measurements: MeasurementSummary[] }) {
  const rows = new Map<number, { piles: number; h: number }>();
  for (const m of measurements.filter((x) => x.status === "approved")) {
    for (const t of m.totals_by_diameter) {
      const r = rows.get(t.diameter_cm) ?? { piles: 0, h: 0 };
      r.piles += t.piles;
      r.h += sumHundredths([t.meters]);
      rows.set(t.diameter_cm, r);
    }
  }
  const list = [...rows.entries()].sort(([a], [b]) => a - b);
  if (list.length === 0) {
    return (
      <EmptyPanel>
        Nenhuma medição aprovada ainda. A produção por diâmetro aparece aqui.
      </EmptyPanel>
    );
  }
  const totalPiles = list.reduce((a, [, r]) => a + r.piles, 0);
  const totalH = list.reduce((a, [, r]) => a + r.h, 0);
  return (
    <div className={`${panel} overflow-hidden`}>
      <table className="w-full text-sm">
        <thead className="border-b border-brand text-left">
          <tr>
            <th scope="col" className="eyebrow px-4 pb-2 pt-3.5 ">Diâmetro</th>
            <th scope="col" className="eyebrow px-4 pb-2 pt-3.5 text-right ">Estacas</th>
            <th scope="col" className="eyebrow px-4 pb-2 pt-3.5 text-right ">Metros</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-brand-tint/70">
          {list.map(([d, r]) => (
            <tr key={d}>
              <th scope="row" className="px-4 py-2.5 text-left font-normal">{d} cm</th>
              <td className="px-4 py-2.5 text-right">{r.piles}</td>
              <td className="px-4 py-2.5 text-right">{formatHundredthsGrouped(r.h)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t-2 border-secondary-dark font-semibold">
          <tr>
            <th scope="row" className="px-4 py-2.5 text-left">Total</th>
            <td className="px-4 py-2.5 text-right">{totalPiles}</td>
            <td className="px-4 py-2.5 text-right">{formatHundredthsGrouped(totalH)} m</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function MeasurementRows({ items }: { items: MeasurementSummary[] }) {
  return (
    <ul className={`${panel} divide-y`}>
      {items.map((m) => (
        <li key={m.id}>
          <Link
            href={`/medicoes/${m.id}`}
            className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-stone-50"
          >
            <span className="min-w-0">
              <span className="block font-medium tabular-nums">{formatDateBR(m.work_date)}</span>
              <span className="block truncate text-sm text-stone-600">
                {m.rig.name} · {m.created_by.name}
              </span>
            </span>
            <span className="flex flex-col items-end gap-1">
              <span className="font-semibold tabular-nums">{formatHundredthsGrouped(sumHundredths([m.total_m]))} m</span>
              <StatusBadge kind="measurement" status={m.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function JobFacts({ job }: { job: JobOut }) {
  const a = job.address;
  const items: [string, string][] = [
    ["Cliente", job.customer.name],
    ["Endereço", `${a.street}, ${a.number}${a.complement ? ` (${a.complement})` : ""} — ${a.district}, ${a.city}/${a.state}`],
    ["Período", `${formatDateBR(job.start_date)} a ${formatDateBR(job.end_date)}`],
    ["Perfuratrizes", job.rigs.map((r) => r.name).join(", ") || "—"],
    ["Operadores", job.operators.map((o) => o.name).join(", ") || "—"],
  ];
  if (job.notes) items.push(["Observações", job.notes]);
  return <Facts items={items} />;
}

/* ---------- Página ---------- */

export default function ObraPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const search = useSearchParams();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: job, error } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api<JobOut>(`/api/jobs/${id}`),
    retry: false,
  });
  const { data: measurements } = useQuery({
    queryKey: ["job-measurements", id],
    queryFn: () => fetchJobMeasurements(id),
    enabled: !!job,
  });
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<TabKey | null>(null);
  const [saved, setSaved] = useState<{ tab: TabKey; text: string } | null>(null);

  if (error) return <p role="alert">{messageFor(error)}</p>;
  if (!job) return <p>Carregando…</p>;
  const canWrite = me?.role === "admin" || me?.role === "office";
  const closed = job.status === "completed" || job.status === "cancelled";
  const next = canWrite ? NEXT_STEP[job.status] : undefined;
  const canCancel = canWrite && !closed;

  const tabs: TabDef<TabKey>[] = [
    { key: "resumo", label: "Resumo" },
    {
      key: "medicoes", label: "Medições",
      badge: measurements ? String(measurements.filter((m) => m.status !== "draft").length) : undefined,
    },
    ...(canWrite ? [{ key: "precos" as const, label: "Preços" }] : []),
    { key: "equipe", label: "Equipe" },
    { key: "dados", label: "Dados" },
  ];
  const requested = search.get("aba") as TabKey | null;
  const tab: TabKey = tabs.some((t) => t.key === requested) ? requested! : "resumo";

  function goTab(k: TabKey, edit = false) {
    setEditing(edit ? k : null);
    setSaved(null);
    router.replace(k === "resumo" ? `/obras/${id}` : `/obras/${id}?aba=${k}`, { scroll: false });
  }

  const update = (j: JobOut) => {
    qc.setQueryData(["job", id], j);
    qc.invalidateQueries({ queryKey: ["jobs"] });
  };
  const finishEdit = (t: TabKey, text: string) => (j: JobOut) => {
    update(j);
    setEditing(null);
    setSaved({ tab: t, text });
  };

  async function changeStatus(to: JobStatus, label: string) {
    if (to === "cancelled" && !window.confirm("Cancelar esta obra? Essa ação não pode ser desfeita.")) return;
    setActionError(null);
    try {
      update(await api<JobOut>(`/api/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status: to }) }));
    } catch (err) {
      setActionError(`${label}: ${messageFor(err)}`);
    }
  }

  const sent = measurements?.filter((m) => m.status !== "draft") ?? [];
  const missingTeam = job.rigs.length === 0 || job.operators.length === 0;

  const actions =
    job.status === "in_progress" || next ? (
      <>
        {job.status === "in_progress" && (
          <Link href={`/obras/${job.id}/medicoes/nova`} className={`${btnPrimary} min-h-12 md:min-h-11`}>
            Lançar medição
          </Link>
        )}
        {next && (
          <button type="button" onClick={() => changeStatus(next.to, next.label)} className={btnSecondary}>
            {next.label}
          </button>
        )}
      </>
    ) : null;

  return (
    <div className="min-w-0 max-w-5xl space-y-6">
      <JobHeader job={job} measurements={measurements} actions={actions} ownOnly={me?.role === "operator"} />

      {actionError && (
        <div role="alert" className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="flex-1">{actionError}</span>
          {missingTeam && canWrite && !closed && (
            <button type="button" onClick={() => { setActionError(null); goTab("equipe", true); }}
              className="min-h-11 font-medium underline underline-offset-2">
              Alocar equipe
            </button>
          )}
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={(k) => goTab(k)} label="Seções da obra">
        {tab === "resumo" && (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-8">
              <LocalDrafts jobId={job.id} />

              {canWrite && job.status === "planned" && (
                <section>
                  <SectionHead title="Para iniciar a obra" />
                  <ul className={`${panel} divide-y`}>
                    <CheckItem done={!!job.prices?.items.length} label="Tabela contratada" onGo={() => goTab("precos", true)} />
                    <CheckItem done={job.rigs.length > 0} label="Perfuratriz alocada" onGo={() => goTab("equipe", true)} />
                    <CheckItem done={job.operators.length > 0} label="Operador alocado" onGo={() => goTab("equipe", true)} />
                  </ul>
                </section>
              )}

              <section>
                <SectionHead title="Produção aprovada por diâmetro" />
                {measurements ? (
                  <ProductionByDiameter measurements={measurements} />
                ) : (
                  <EmptyPanel>Carregando…</EmptyPanel>
                )}
              </section>

              <section>
                <SectionHead
                  title="Últimas medições"
                  action={sent.length > 5 ? (
                    <button type="button" onClick={() => goTab("medicoes")} className="min-h-11 px-2 text-sm font-medium text-brand">
                      Ver todas
                    </button>
                  ) : undefined}
                />
                {sent.length > 0 ? (
                  <MeasurementRows items={sent.slice(0, 5)} />
                ) : (
                  <EmptyPanel>
                    {measurements ? "Nenhuma medição lançada nesta obra." : "Carregando…"}
                  </EmptyPanel>
                )}
              </section>
            </div>

            <aside className="min-w-0">
              <SectionHead title="Obra" />
              <JobFacts job={job} />
            </aside>
          </div>
        )}

        {tab === "medicoes" && (
          <section className="max-w-3xl">
            <SectionHead title="Medições da obra" />
            {sent.length > 0 ? (
              <MeasurementRows items={sent} />
            ) : (
              <EmptyPanel>
                {measurements ? "Nenhuma medição lançada nesta obra." : "Carregando…"}
              </EmptyPanel>
            )}
          </section>
        )}

        {tab === "precos" && canWrite && (
          <section className="max-w-2xl">
            <SectionHead
              title="Tabela contratada"
              action={job.prices && !closed && editing !== "precos" ? (
                <button type="button" onClick={() => { setEditing("precos"); setSaved(null); }} className={btnEdit}>
                  <PencilIcon /> Editar preços
                </button>
              ) : undefined}
            />
            {saved?.tab === "precos" && <Saved text={saved.text} />}
            {closed && <p className="mb-3 text-sm text-stone-600">Obra encerrada: a tabela não pode mais mudar.</p>}
            {!job.prices ? (
              <EmptyPanel>Obra sem tabela contratada.</EmptyPanel>
            ) : editing === "precos" ? (
              <div className={`${panel} p-4`}>
                <PriceTableForm
                  table={job.prices}
                  onCancel={() => setEditing(null)}
                  onSave={async (t: PriceTableOut) => {
                    finishEdit("precos", "Tabela salva")(
                      await api<JobOut>(`/api/jobs/${id}/prices`, { method: "PUT", body: JSON.stringify(t) }),
                    );
                  }}
                />
              </div>
            ) : (
              <PriceTableView table={job.prices} />
            )}
          </section>
        )}

        {tab === "equipe" && (
          <section className="max-w-2xl">
            <SectionHead
              title="Equipe alocada"
              action={canWrite && !closed && editing !== "equipe" ? (
                <button type="button" onClick={() => { setEditing("equipe"); setSaved(null); }} className={btnEdit}>
                  <PencilIcon /> Editar equipe
                </button>
              ) : undefined}
            />
            {saved?.tab === "equipe" && <Saved text={saved.text} />}
            {editing === "equipe" ? (
              <AllocationEditor
                job={job}
                canEdit
                onCancel={() => setEditing(null)}
                onSaved={finishEdit("equipe", "Alocação salva")}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 text-sm text-stone-600">Perfuratrizes</h3>
                  <ul className={`${panel} divide-y text-sm`}>
                    {job.rigs.length === 0 && <li className="px-4 py-3 text-stone-600">Nenhuma alocada.</li>}
                    {job.rigs.map((r) => (
                      <li key={r.id} className="px-4 py-3">
                        <span className="block font-medium">{r.name}</span>
                        <span className="block text-stone-600 tabular-nums">
                          até {r.max_diameter_cm} cm · {r.max_depth_m.replace(".", ",")} m
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="mb-2 text-sm text-stone-600">Operadores</h3>
                  <ul className={`${panel} divide-y text-sm`}>
                    {job.operators.length === 0 && <li className="px-4 py-3 text-stone-600">Nenhum alocado.</li>}
                    {job.operators.map((o) => (
                      <li key={o.id} className="px-4 py-3 font-medium">{o.name}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}

        {tab === "dados" && (
          <div className="max-w-2xl space-y-10">
            <section>
              <SectionHead
                title="Dados da obra"
                action={canWrite && !closed && editing !== "dados" ? (
                  <button type="button" onClick={() => { setEditing("dados"); setSaved(null); }} className={btnEdit}>
                    <PencilIcon /> Editar dados
                  </button>
                ) : undefined}
              />
              {saved?.tab === "dados" && <Saved text={saved.text} />}
              {closed && <p className="mb-3 text-sm text-stone-600">Obra encerrada: dados bloqueados para edição.</p>}
              {editing === "dados" ? (
                <div className={`${panel} p-4`}>
                  <JobForm
                    key={`${job.status}-${job.id}`}
                    initial={job}
                    onCancel={() => setEditing(null)}
                    onSaved={finishEdit("dados", "Dados salvos")}
                  />
                </div>
              ) : (
                <JobFacts job={job} />
              )}
            </section>

            {canCancel && (
              <section className="rounded-xl border border-red-200 p-4">
                <h2 className="font-semibold text-red-900">Cancelar obra</h2>
                <p className="mt-1 text-sm text-stone-700">
                  Encerra a obra sem concluí-la. Essa ação não pode ser desfeita.
                </p>
                <button
                  type="button"
                  onClick={() => changeStatus("cancelled", "Cancelar obra")}
                  className="mt-3 min-h-11 w-full rounded-lg border border-red-300 px-4 font-medium text-red-700 hover:bg-red-50 sm:w-auto"
                >
                  Cancelar obra
                </button>
              </section>
            )}
          </div>
        )}
      </Tabs>
    </div>
  );
}
