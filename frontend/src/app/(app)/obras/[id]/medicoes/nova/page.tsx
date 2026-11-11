"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import type { JobOut } from "@/components/JobForm";
import { MeasurementForm } from "@/components/MeasurementForm";
import { api } from "@/lib/api";
import { messageFor } from "@/lib/errors";
import type { MeasurementOut } from "@/lib/measurements";
import { newUuid } from "@/lib/uuid";

function NovaMedicao() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const draftKey = params.get("rascunho");
  const editId = params.get("medicao");
  // client_key de uma medição nova: gerado uma vez; o rascunho reaberto (?rascunho=) reusa o dele.
  const [freshKey] = useState(() => newUuid());

  const job = useQuery({
    queryKey: ["job", id],
    queryFn: () => api<JobOut>(`/api/jobs/${id}`),
    retry: false,
  });
  const editing = useQuery({
    queryKey: ["measurement", editId],
    queryFn: () => api<MeasurementOut>(`/api/measurements/${editId}`),
    enabled: !!editId && !draftKey,
    retry: false,
  });

  const error = job.error ?? editing.error;
  if (error) return <p role="alert">{messageFor(error)}</p>;
  if (!job.data || (editId && !draftKey && !editing.data)) return <p>Carregando…</p>;

  const server = draftKey ? null : (editing.data ?? null);
  if (server && server.status !== "draft" && server.status !== "rejected") {
    return (
      <p className="py-6">
        Esta medição não pode mais ser alterada.{" "}
        <Link href={`/medicoes/${server.id}`} className="text-brand underline">Ver medição</Link>
      </p>
    );
  }
  const clientKey = draftKey ?? server?.client_key ?? freshKey;

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{server ? "Editar medição" : "Lançar medição"}</h1>
        <p className="break-words text-sm text-stone-600">{job.data.name}</p>
      </div>
      {job.data.status !== "in_progress" && (
        <p role="alert" className="text-sm text-red-700">
          A obra precisa estar em execução para lançar medições
        </p>
      )}
      <MeasurementForm key={clientKey} job={job.data} clientKey={clientKey} server={server} />
    </div>
  );
}

export default function NovaMedicaoPage() {
  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <NovaMedicao />
    </Suspense>
  );
}
