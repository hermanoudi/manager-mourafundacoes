"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { AllocationEditor } from "@/components/AllocationEditor";
import { JobForm, type JobOut } from "@/components/JobForm";
import { PriceTableEditor, type PriceTableOut } from "@/components/PriceTableEditor";
import { StatusBadge, type JobStatus } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDateBR, formatDateTimeBR } from "@/lib/dates";
import { listDrafts } from "@/lib/drafts";
import { messageFor } from "@/lib/errors";
import { pilesLabel } from "@/lib/measurements";

const ACTIONS: Record<JobStatus, { label: string; to: JobStatus; danger?: boolean }[]> = {
  planned: [
    { label: "Iniciar obra", to: "in_progress" },
    { label: "Cancelar obra", to: "cancelled", danger: true },
  ],
  in_progress: [
    { label: "Concluir obra", to: "completed" },
    { label: "Cancelar obra", to: "cancelled", danger: true },
  ],
  completed: [],
  cancelled: [],
};


/** Rascunhos de medição guardados neste aparelho (localStorage) para a obra. */
function LocalDrafts({ jobId }: { jobId: number }) {
  const drafts = listDrafts(jobId);
  if (drafts.length === 0) return null;
  return (
    <section aria-labelledby="local-drafts" className="space-y-2">
      <h2 id="local-drafts" className="text-lg font-medium">Rascunhos neste aparelho</h2>
      <ul className="space-y-2">
        {drafts.map((d) => (
          <li key={d.client_key}>
            <Link
              href={`/obras/${jobId}/medicoes/nova?rascunho=${d.client_key}`}
              className="block min-h-11 rounded-lg bg-white p-3 text-sm shadow-sm"
            >
              <span className="font-medium">
                {formatDateBR(d.work_date)} · {pilesLabel(d.lines.length)}
              </span>
              <span className="block text-stone-500">
                {d.submit ? "Envio pendente · " : ""}salvo em {formatDateTimeBR(d.saved_at)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ObraPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data: job, error } = useQuery({
    queryKey: ["job", id],
    queryFn: () => api<JobOut>(`/api/jobs/${id}`),
    retry: false,
  });
  const [actionError, setActionError] = useState<string | null>(null);

  if (error) return <p role="alert">{messageFor(error)}</p>;
  if (!job) return <p>Carregando…</p>;
  const canWrite = me?.role === "admin" || me?.role === "office";
  const closed = job.status === "completed" || job.status === "cancelled";

  const update = (j: JobOut) => {
    qc.setQueryData(["job", id], j);
    qc.invalidateQueries({ queryKey: ["jobs"] });
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

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-xl font-semibold">{job.name}</h1>
        <StatusBadge kind="job" status={job.status} />
      </div>

      {(canWrite && ACTIONS[job.status].length > 0) || job.status === "in_progress" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {job.status === "in_progress" && (
              <Link
                href={`/obras/${job.id}/medicoes/nova`}
                className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-medium text-white hover:bg-brand-dark"
              >
                Lançar medição
              </Link>
            )}
            {canWrite &&
              ACTIONS[job.status].map((a) => (
                <button
                  key={a.to}
                  type="button"
                  onClick={() => changeStatus(a.to, a.label)}
                  className={`min-h-11 rounded-lg border px-4 font-medium ${
                    a.danger ? "border-red-300 text-red-700" : "border-brand text-brand"
                  }`}
                >
                  {a.label}
                </button>
              ))}
          </div>
          {actionError && <p role="alert" className="text-sm text-red-700">{actionError}</p>}
        </div>
      ) : null}

      <LocalDrafts jobId={job.id} />

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Dados</h2>
        {canWrite ? (
          <JobForm key={`${job.status}-${job.id}`} initial={job} onSaved={update} />
        ) : (
          <dl className="grid max-w-xl grid-cols-2 gap-2 rounded-lg bg-white p-3 text-sm shadow-sm">
            <dt className="text-stone-500">Cliente</dt>
            <dd className="break-words">{job.customer.name}</dd>
            <dt className="text-stone-500">Endereço</dt>
            <dd className="break-words">
              {job.address.street}, {job.address.number} — {job.address.district},{" "}
              {job.address.city}/{job.address.state}
            </dd>
            <dt className="text-stone-500">Início</dt>
            <dd>{formatDateBR(job.start_date)}</dd>
            <dt className="text-stone-500">Término</dt>
            <dd>{formatDateBR(job.end_date)}</dd>
            {job.notes && (
              <>
                <dt className="text-stone-500">Observações</dt>
                <dd className="break-words">{job.notes}</dd>
              </>
            )}
          </dl>
        )}
      </section>

      {job.prices && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Tabela contratada</h2>
          {closed && <p className="text-sm text-stone-500">Obra encerrada: a tabela não pode mais mudar.</p>}
          <PriceTableEditor
            table={job.prices}
            onSave={
              canWrite && !closed
                ? async (t: PriceTableOut) => {
                    update(await api<JobOut>(`/api/jobs/${id}/prices`, {
                      method: "PUT", body: JSON.stringify(t),
                    }));
                  }
                : undefined
            }
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Alocação</h2>
        <AllocationEditor
          job={job}
          canEdit={canWrite && !closed}
          onSaved={update}
        />
      </section>
    </div>
  );
}
