"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataList } from "@/components/DataList";
import { JOB_STATUS_LABEL, StatusBadge, type JobStatus } from "@/components/StatusBadge";
import { btnPrimary, FilterChips, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";

type JobSummary = {
  id: number; name: string; customer_name: string; city: string; status: JobStatus;
  start_date: string | null;
};
type Page = { items: JobSummary[]; total: number; page: number; page_size: number };

const FILTERS: { value: "" | JobStatus; label: string }[] = [
  { value: "", label: "Todas" },
  ...(Object.entries(JOB_STATUS_LABEL) as [JobStatus, string][]).map(([value, label]) => ({ value, label })),
];

export default function ObrasPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"" | JobStatus>("");
  const [page, setPage] = useState(1);
  const { data, isPending } = useQuery({
    queryKey: ["jobs", q, status, page],
    queryFn: () =>
      api<Page>(`/api/jobs?q=${encodeURIComponent(q)}&page=${page}${status ? `&status=${status}` : ""}`),
  });
  const canWrite = me?.role === "admin" || me?.role === "office";

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        title="Obras"
        actions={canWrite && <Link href="/obras/nova" className={btnPrimary}>Nova obra</Link>}
      />
      <FilterChips
        label="Filtrar por status"
        options={FILTERS}
        value={status}
        onChange={(v) => { setStatus(v); setPage(1); }}
      />
      <DataList
        items={data?.items ?? []}
        loading={isPending}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        onSearch={(v) => { setQ(v); setPage(1); }}
        getKey={(j) => j.id}
        onSelect={(j) => router.push(`/obras/${j.id}`)}
        emptyText={q || status ? "Nenhuma obra com esse filtro." : "Nenhuma obra cadastrada."}
        columns={[
          { key: "name", label: "Obra" },
          { key: "customer_name", label: "Cliente" },
          { key: "city", label: "Cidade" },
          {
            key: "status", label: "Status", aside: true,
            render: (j) => <StatusBadge kind="job" status={j.status} />,
          },
        ]}
      />
    </div>
  );
}
