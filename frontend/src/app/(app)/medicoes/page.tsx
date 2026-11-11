"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataList } from "@/components/DataList";
import { inputClass } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDateBR } from "@/lib/dates";
import { formatMeters, type MeasurementSummary } from "@/lib/measurements";

type Page = { items: MeasurementSummary[]; total: number; page: number; page_size: number };

const FILTERS = [
  { value: "", label: "Todas" },
  { value: "draft", label: "Rascunhos" },
  { value: "submitted", label: "Enviadas" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Rejeitadas" },
];

export default function MedicoesPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const reviewer = me?.role === "admin" || me?.role === "office";
  // Escritório abre na fila de aprovação ("Enviadas"); operador vê todas as suas.
  const [chosen, setChosen] = useState<string | null>(null);
  const status = chosen ?? (reviewer ? "submitted" : "");
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["measurements", status, page],
    queryFn: () => api<Page>(`/api/measurements?page=${page}${status ? `&status=${status}` : ""}`),
    enabled: !!me,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {reviewer && status === "submitted" ? "Medições — fila de aprovação" : "Medições"}
      </h1>
      <label className="block max-w-xs text-sm font-medium">
        Status
        <select
          className={inputClass}
          value={status}
          disabled={!me}
          onChange={(e) => { setChosen(e.target.value); setPage(1); }}
        >
          {FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
      </label>
      <DataList
        items={data?.items ?? []}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        getKey={(m) => m.id}
        onSelect={(m) => router.push(`/medicoes/${m.id}`)}
        emptyText="Nenhuma medição encontrada."
        columns={[
          { key: "job", label: "Obra", render: (m) => m.job.name },
          { key: "work_date", label: "Data", render: (m) => formatDateBR(m.work_date) },
          { key: "rig", label: "Perfuratriz", render: (m) => m.rig.name },
          { key: "total_m", label: "Total", render: (m) => formatMeters(m.total_m) },
          { key: "created_by", label: "Lançada por", render: (m) => m.created_by.name },
          {
            key: "status", label: "Status",
            render: (m) => <StatusBadge kind="measurement" status={m.status} />,
          },
        ]}
      />
    </div>
  );
}
