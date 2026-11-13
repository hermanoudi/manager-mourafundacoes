"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccessDenied } from "@/components/AccessDenied";
import type { CustomerOut } from "@/components/CustomerForm";
import { DataList } from "@/components/DataList";
import { btnPrimary, PageHeader } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDocument } from "@/lib/documents";
import { isForbidden } from "@/lib/errors";

type Page = { items: CustomerOut[]; total: number; page: number; page_size: number };

export default function ClientesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery({
    queryKey: ["customers", q, page],
    queryFn: () => api<Page>(`/api/customers?q=${encodeURIComponent(q)}&page=${page}`),
    retry: false,
  });
  if (isForbidden(error)) return <AccessDenied />;

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        title="Clientes"
        actions={<Link href="/clientes/novo" className={btnPrimary}>Novo cliente</Link>}
      />
      <DataList
        items={data?.items ?? []}
        loading={isPending}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        onSearch={(v) => { setQ(v); setPage(1); }}
        getKey={(c) => c.id}
        onSelect={(c) => router.push(`/clientes/${c.id}`)}
        emptyText={q ? "Nenhum cliente encontrado para essa busca." : "Nenhum cliente cadastrado."}
        columns={[
          { key: "name", label: "Nome" },
          { key: "document", label: "CPF/CNPJ", render: (c) => formatDocument(c.document) },
          { key: "city", label: "Cidade", render: (c) => `${c.address.city}/${c.address.state}` },
          { key: "phone", label: "Telefone", render: (c) => c.phone || "—" },
        ]}
      />
    </div>
  );
}
