"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataList } from "@/components/DataList";
import { StatusBadge } from "@/components/StatusBadge";
import { FilterChips, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDateBR } from "@/lib/dates";
import { formatMeters, type MeasurementSummary } from "@/lib/measurements";

type Page = { items: MeasurementSummary[]; total: number; page: number; page_size: number };
type Filter = "" | "draft" | "submitted" | "approved" | "rejected";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "", label: "Todas" },
  { value: "submitted", label: "Enviadas" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Rejeitadas" },
  { value: "draft", label: "Rascunhos" },
];

export default function MedicoesPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const reviewer = me?.role === "admin" || me?.role === "office";
  // Escritório abre na fila de aprovação ("Enviadas"); operador vê todas as suas.
  const [chosen, setChosen] = useState<Filter | null>(null);
  const status: Filter = chosen ?? (reviewer ? "submitted" : "");
  const [page, setPage] = useState(1);
  const { data, isPending } = useQuery({
    queryKey: ["measurements", status, page],
    queryFn: () => api<Page>(`/api/measurements?page=${page}${status ? `&status=${status}` : ""}`),
    enabled: !!me,
  });

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        title="Medições"
        description={
          reviewer && status === "submitted"
            ? "Fila de aprovação: medições enviadas pelos operadores."
            : undefined
        }
      />
      <FilterChips
        label="Filtrar por status"
        options={FILTERS}
        value={status}
        disabled={!me}
        onChange={(v) => { setChosen(v); setPage(1); }}
      />
      <DataList
        items={data?.items ?? []}
        loading={isPending}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        getKey={(m) => m.id}
        onSelect={(m) => router.push(`/medicoes/${m.id}`)}
        emptyText={
          reviewer && status === "submitted"
            ? "Nenhuma medição aguardando aprovação."
            : "Nenhuma medição encontrada."
        }
        columns={[
          { key: "job", label: "Obra", render: (m) => m.job.name },
          { key: "work_date", label: "Data", render: (m) => formatDateBR(m.work_date) },
          { key: "rig", label: "Perfuratriz", render: (m) => m.rig.name },
          { key: "created_by", label: "Lançada por", render: (m) => m.created_by.name },
          {
            key: "total_m", label: "Total", numeric: true, aside: true,
            render: (m) => <span className="font-semibold">{formatMeters(m.total_m)}</span>,
          },
          {
            key: "status", label: "Status", aside: true,
            render: (m) => <StatusBadge kind="measurement" status={m.status} />,
          },
        ]}
      />
    </div>
  );
}
