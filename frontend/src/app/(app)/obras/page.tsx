"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataList } from "@/components/DataList";
import { JOB_STATUS_LABEL, StatusBadge, type JobStatus } from "@/components/StatusBadge";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { inputClass } from "@/components/Field";

type JobSummary = {
  id: number; name: string; customer_name: string; city: string; status: JobStatus;
  start_date: string | null;
};
type Page = { items: JobSummary[]; total: number; page: number; page_size: number };

export default function ObrasPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["jobs", q, status, page],
    queryFn: () =>
      api<Page>(`/api/jobs?q=${encodeURIComponent(q)}&page=${page}${status ? `&status=${status}` : ""}`),
  });
  const canWrite = me?.role === "admin" || me?.role === "office";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Obras</h1>
        {canWrite && (
          <Link href="/obras/nova" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-medium text-white hover:bg-brand-dark">
            Nova obra
          </Link>
        )}
      </div>
      <label className="block max-w-xs text-sm font-medium">
        Status
        <select
          className={inputClass}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Todos</option>
          {Object.entries(JOB_STATUS_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </label>
      <DataList
        items={data?.items ?? []}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        onSearch={(v) => { setQ(v); setPage(1); }}
        getKey={(j) => j.id}
        onSelect={(j) => router.push(`/obras/${j.id}`)}
        columns={[
          { key: "name", label: "Obra" },
          { key: "customer_name", label: "Cliente" },
          { key: "city", label: "Cidade" },
          { key: "status", label: "Status", render: (j) => <StatusBadge kind="job" status={j.status} /> },
        ]}
      />
    </div>
  );
}
