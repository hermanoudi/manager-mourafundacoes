"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataList } from "@/components/DataList";
import { STATUS_LABEL, type RigOut } from "@/components/DrillRigForm";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDecimalBR } from "@/lib/format";

type Page = { items: RigOut[]; total: number; page: number; page_size: number };

export default function PerfuratrizesPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data } = useQuery({
    queryKey: ["rigs", q, page],
    queryFn: () => api<Page>(`/api/drill-rigs?q=${encodeURIComponent(q)}&page=${page}`),
  });
  const canWrite = me?.role === "admin" || me?.role === "office";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Perfuratrizes</h1>
        {canWrite && (
          <Link href="/perfuratrizes/novo" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-medium text-white">
            Nova perfuratriz
          </Link>
        )}
      </div>
      <DataList
        items={data?.items ?? []}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        onSearch={(v) => { setQ(v); setPage(1); }}
        getKey={(r) => r.id}
        onSelect={(r) => router.push(`/perfuratrizes/${r.id}`)}
        columns={[
          { key: "name", label: "Nome" },
          { key: "max_diameter_cm", label: "Diâmetro máx.", render: (r) => `${r.max_diameter_cm} cm` },
          { key: "max_depth_m", label: "Profundidade máx.", render: (r) => `${formatDecimalBR(r.max_depth_m)} m` },
          { key: "status", label: "Status", render: (r) => STATUS_LABEL[r.status] },
        ]}
      />
    </div>
  );
}
