"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useMemo, useSyncExternalStore } from "react";

import { StatusBadge, type JobStatus } from "@/components/StatusBadge";
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

const ROW =
  "flex min-h-14 items-center justify-between gap-3 px-4 py-2 text-left hover:bg-stone-50";

function Section({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-lg font-medium">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const LIST = "divide-y overflow-hidden rounded-lg bg-white shadow-sm";

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg bg-white p-4 text-sm text-stone-700 shadow-sm">{children}</p>;
}

/** Obras em execução: o ponto de partida de toda medição. Uma só obra vira o atalho direto. */
function LaunchSection({ jobs, loading, primary }: { jobs: JobItem[]; loading: boolean; primary: boolean }) {
  if (loading) return <p className="text-sm text-stone-700">Carregando…</p>;
  if (jobs.length === 0) {
    return (
      <Empty>
        Nenhuma obra em execução. Para lançar medições, a obra precisa estar{" "}
        <span className="font-medium">em execução</span>; peça ao escritório para iniciá-la.
      </Empty>
    );
  }
  if (jobs.length === 1 && primary) {
    const job = jobs[0];
    return (
      <Link
        href={`/obras/${job.id}/medicoes/nova`}
        className="flex min-h-16 flex-col justify-center rounded-lg bg-brand px-4 py-3 text-white hover:bg-brand-dark"
      >
        <span className="text-lg font-semibold">Nova medição</span>
        <span className="truncate text-sm text-white/90">{job.name}</span>
      </Link>
    );
  }
  return (
    <ul className={LIST}>
      {jobs.map((job) => (
        <li key={job.id}>
          <Link href={`/obras/${job.id}/medicoes/nova`} className={ROW}>
            <span className="min-w-0">
              <span className="block truncate font-medium">{job.name}</span>
              <span className="block truncate text-sm text-stone-700">{job.customer_name} · {job.city}</span>
            </span>
            <span className="shrink-0 text-sm font-medium text-brand">Lançar</span>
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
              <span className="block truncate font-medium">{m.job.name}</span>
              <span data-numeric className="block truncate text-sm text-stone-700">
                {formatDateBR(m.work_date)} · {m.rig.name} · {formatMeters(m.total_m)}
              </span>
              {showReason && m.rejection_reason && (
                <span className="mt-0.5 block truncate text-sm text-red-900">{m.rejection_reason}</span>
              )}
            </span>
            <StatusBadge kind="measurement" status={m.status} />
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
                <span className="block truncate font-medium">{job?.name ?? `Obra #${d.job_id}`}</span>
                <span data-numeric className="block truncate text-sm text-stone-700">
                  {formatDateBR(d.work_date)} · {pilesLabel(d.lines.length)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-medium text-amber-900">
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
  const canLaunch = me?.role === "admin" || me?.role === "operator";

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
    enabled: me?.role === "operator",
  });
  const jobs = useQuery({
    queryKey: ["jobs", "", "in_progress", 1],
    queryFn: () => api<JobPage>("/api/jobs?q=&page=1&status=in_progress"),
    enabled: canLaunch,
  });

  const jobItems = jobs.data?.items ?? [];
  const queueItems = queue.data?.items ?? [];
  const rejectedItems = rejected.data?.items ?? [];
  const firstName = me?.name.split(" ")[0];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Início</h1>
        {firstName && <p className="text-sm text-stone-700">Olá, {firstName}.</p>}
      </div>

      {reviewer && (
        <Section
          title="Para aprovar"
          aside={
            (queue.data?.total ?? 0) > queueItems.length && (
              <Link href="/medicoes" className="text-sm font-medium text-brand underline">
                Ver todas ({queue.data?.total})
              </Link>
            )
          }
        >
          {queue.isPending ? (
            <p className="text-sm text-stone-700">Carregando…</p>
          ) : queueItems.length === 0 ? (
            <Empty>Nenhuma medição aguardando aprovação. Quando um operador enviar, ela aparece aqui.</Empty>
          ) : (
            <MeasurementRows items={queueItems} />
          )}
        </Section>
      )}

      {me?.role === "operator" && (
        <Section title="Lançar medição">
          <LaunchSection jobs={jobItems} loading={jobs.isPending} primary />
        </Section>
      )}

      {me?.role === "operator" && rejectedItems.length > 0 && (
        <Section title="Rejeitadas — corrigir e reenviar">
          <MeasurementRows items={rejectedItems} showReason />
        </Section>
      )}

      {drafts.length > 0 && (
        <Section title="Rascunhos neste aparelho">
          <DraftRows drafts={drafts} jobs={jobItems} />
        </Section>
      )}

      {me?.role === "admin" && (
        <Section title="Lançar medição">
          <LaunchSection jobs={jobItems} loading={jobs.isPending} primary={false} />
        </Section>
      )}


    </div>
  );
}
