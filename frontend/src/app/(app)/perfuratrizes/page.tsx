"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { DataList } from "@/components/DataList";
import { RIG_TONE, STATUS_LABEL, type RigOut } from "@/components/DrillRigForm";
import { btnPrimary, PageHeader, Pill } from "@/components/ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { formatDecimalBR } from "@/lib/format";

type Page = { items: RigOut[]; total: number; page: number; page_size: number };

export default function PerfuratrizesPage() {
  const router = useRouter();
  const { data: me } = useMe();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, isPending } = useQuery({
    queryKey: ["rigs", q, page],
    queryFn: () => api<Page>(`/api/drill-rigs?q=${encodeURIComponent(q)}&page=${page}`),
  });
  const canWrite = me?.role === "admin" || me?.role === "office";

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        title="Perfuratrizes"
        actions={canWrite && <Link href="/perfuratrizes/novo" className={btnPrimary}>Nova perfuratriz</Link>}
      />
      <DataList
        items={data?.items ?? []}
        loading={isPending}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        onSearch={(v) => { setQ(v); setPage(1); }}
        getKey={(r) => r.id}
        onSelect={(r) => router.push(`/perfuratrizes/${r.id}`)}
        emptyText={q ? "Nenhuma perfuratriz encontrada para essa busca." : "Nenhuma perfuratriz cadastrada."}
        columns={[
          { key: "name", label: "Nome" },
          { key: "max_diameter_cm", label: "Diâmetro máx.", numeric: true, render: (r) => `${r.max_diameter_cm} cm` },
          { key: "max_depth_m", label: "Profundidade máx.", numeric: true, render: (r) => `${formatDecimalBR(r.max_depth_m)} m` },
          {
            key: "status", label: "Status", aside: true,
            render: (r) => <Pill tone={RIG_TONE[r.status]}>{STATUS_LABEL[r.status]}</Pill>,
          },
        ]}
      />
    </div>
  );
}
