"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { StatusBadge, type JobStatus } from "@/components/StatusBadge";
import { btnPrimary, EmptyPanel, EntityHeader, Kpi, KpiGrid, panel, SectionHead } from "@/components/ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDateBR } from "@/lib/dates";
import { listDrafts, type MeasurementDraft } from "@/lib/drafts";
import { formatMeters, pilesLabel, type MeasurementSummary } from "@/lib/measurements";

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

type MeasurementPage = { items: MeasurementSummary[]; total: number };
type JobItem = { id: number; name: string; customer_name: string; city: string; status: JobStatus };
type JobPage = { items: JobItem[]; total: number };

const ROW = "flex min-h-14 items-center justify-between gap-3 px-4 py-3 text-left hover:bg-stone-50";
const LIST = `${panel} divide-y overflow-hidden`;

const TODAY = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", weekday: "long", day: "numeric", month: "long",
});

/** Obras em execução: o ponto de partida de toda medição. */
function LaunchList({ jobs, loading }: { jobs: JobItem[]; loading: boolean }) {
  if (loading) return <EmptyPanel>Carregando…</EmptyPanel>;
  if (jobs.length === 0) {
    return (
      <EmptyPanel>
        Nenhuma obra em execução. Para lançar medições, a obra precisa estar{" "}
        <span className="font-medium text-secondary-dark">em execução</span>; peça ao escritório para iniciá-la.
      </EmptyPanel>
    );
  }
  return (
    <ul className={LIST}>
      {jobs.map((job) => (
        <li key={job.id}>
          <Link href={`/obras/${job.id}/medicoes/nova`} className={ROW}>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{job.name}</span>
              <span className="block truncate text-sm text-stone-600">{job.customer_name} · {job.city}</span>
            </span>
            <span className="shrink-0 font-medium text-brand">Lançar</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function MeasurementRows({ items, showReason }: { items: MeasurementSummary[]; showReason?: boolean }) {
  return (
    <ul className={LIST}>
      {items.map((m) => (
        <li key={m.id}>
          <Link href={`/medicoes/${m.id}`} className={ROW}>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{m.job.name}</span>
              <span data-numeric className="block truncate text-sm text-stone-600">
                {formatDateBR(m.work_date)} · {m.rig.name} · {m.created_by.name}
              </span>
              {showReason && m.rejection_reason && (
                <span className="mt-0.5 block truncate text-sm text-red-900">{m.rejection_reason}</span>
              )}
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1">
              <span className="font-semibold tabular-nums">{formatMeters(m.total_m)}</span>
              <StatusBadge kind="measurement" status={m.status} />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function DraftRows({ drafts, jobs }: { drafts: MeasurementDraft[]; jobs: JobItem[] }) {
  return (
    <ul className={LIST}>
      {drafts.map((d) => {
        const job = jobs.find((j) => j.id === d.job_id);
        return (
          <li key={d.client_key}>
            <Link href={`/obras/${d.job_id}/medicoes/nova?rascunho=${d.client_key}`} className={ROW}>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{job?.name ?? `Obra #${d.job_id}`}</span>
                <span data-numeric className="block truncate text-sm text-stone-600">
                  {formatDateBR(d.work_date)} · {pilesLabel(d.lines.length)}
                </span>
              </span>
              <span className="shrink-0 font-medium text-amber-900">
                {d.submit ? "Envio pendente" : "Continuar"}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function HomePage() {
  const { data: me } = useMe();
  const reviewer = me?.role === "admin" || me?.role === "office";
  const operator = me?.role === "operator";
  const canLaunch = me?.role === "admin" || operator;

  // Rascunhos vivem no aparelho (localStorage): só existem depois da hidratação.
  const draftsJson = useSyncExternalStore(subscribeStorage, () => JSON.stringify(listDrafts()), () => "[]");
  const drafts = useMemo(() => JSON.parse(draftsJson) as MeasurementDraft[], [draftsJson]);

  const queue = useQuery({
    queryKey: ["measurements", "submitted", 1],
    queryFn: () => api<MeasurementPage>("/api/measurements?page=1&status=submitted"),
    enabled: reviewer,
  });
  const rejected = useQuery({
    queryKey: ["measurements", "rejected", 1],
    queryFn: () => api<MeasurementPage>("/api/measurements?page=1&status=rejected"),
    enabled: operator,
  });
  const jobs = useQuery({
    queryKey: ["jobs", "", "in_progress", 1],
    queryFn: () => api<JobPage>("/api/jobs?q=&page=1&status=in_progress"),
    enabled: !!me,
  });

  const jobItems = jobs.data?.items ?? [];
  const queueItems = queue.data?.items ?? [];
  const rejectedItems = rejected.data?.items ?? [];
  const firstName = me?.name.split(" ")[0];
  const count = (q: { data?: { total: number } }) => (q.data ? String(q.data.total) : "…");
  const singleJob = operator && jobItems.length === 1 ? jobItems[0] : null;

  return (
    <div className="max-w-5xl space-y-8">
      <EntityHeader
        title={firstName ? `Olá, ${firstName}` : "Início"}
        meta={<span className="first-letter:uppercase">{TODAY.format(new Date())}</span>}
        actions={singleJob && (
          <Link href={`/obras/${singleJob.id}/medicoes/nova`} className={`${btnPrimary} min-h-12`}>
            Nova medição
          </Link>
        )}
      >
        {me && (
          <KpiGrid>
            {reviewer && <Kpi label="Para aprovar" value={count(queue)} />}
            <Kpi label="Obras em execução" value={count(jobs)} />
            {operator && <Kpi label="Rejeitadas" value={count(rejected)} />}
            <Kpi label="Rascunhos no aparelho" value={drafts.length} />
          </KpiGrid>
        )}
      </EntityHeader>

      {reviewer && (
        <section>
          <SectionHead
            title="Para aprovar"
            action={(queue.data?.total ?? 0) > queueItems.length && (
              <Link href="/medicoes" className="min-h-11 px-2 py-2.5 text-sm font-medium text-brand">
                Ver todas ({queue.data?.total})
              </Link>
            )}
          />
          {queue.isPending ? (
            <EmptyPanel>Carregando…</EmptyPanel>
          ) : queueItems.length === 0 ? (
            <EmptyPanel>Nenhuma medição aguardando aprovação. Quando um operador enviar, ela aparece aqui.</EmptyPanel>
          ) : (
            <MeasurementRows items={queueItems} />
          )}
        </section>
      )}

      {operator && rejectedItems.length > 0 && (
        <section>
          <SectionHead title="Rejeitadas — corrigir e reenviar" />
          <MeasurementRows items={rejectedItems} showReason />
        </section>
      )}

      {drafts.length > 0 && (
        <section>
          <SectionHead title="Rascunhos neste aparelho" />
          <DraftRows drafts={drafts} jobs={jobItems} />
        </section>
      )}

      {canLaunch && !singleJob && (
        <section>
          <SectionHead title="Lançar medição" />
          <LaunchList jobs={jobItems} loading={jobs.isPending} />
        </section>
      )}
    </div>
  );
}
