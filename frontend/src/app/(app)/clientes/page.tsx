"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { AccessDenied } from "@/components/AccessDenied";
import type { CustomerOut } from "@/components/CustomerForm";
import { DataList } from "@/components/DataList";
import { api } from "@/lib/api";
import { formatDocument } from "@/lib/documents";
import { isForbidden } from "@/lib/errors";

type Page = { items: CustomerOut[]; total: number; page: number; page_size: number };

export default function ClientesPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const { data, error } = useQuery({
    queryKey: ["customers", q, page],
    queryFn: () => api<Page>(`/api/customers?q=${encodeURIComponent(q)}&page=${page}`),
    retry: false,
  });
  if (isForbidden(error)) return <AccessDenied />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <Link href="/clientes/novo" className="inline-flex min-h-11 items-center rounded-lg bg-brand px-4 font-medium text-white">
          Novo cliente
        </Link>
      </div>
      <DataList
        items={data?.items ?? []}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        onSearch={(v) => { setQ(v); setPage(1); }}
        getKey={(c) => c.id}
        onSelect={(c) => router.push(`/clientes/${c.id}`)}
        columns={[
          { key: "name", label: "Nome" },
          { key: "document", label: "CPF/CNPJ", render: (c) => formatDocument(c.document) },
          { key: "city", label: "Cidade", render: (c) => `${c.address.city}/${c.address.state}` },
          { key: "phone", label: "Telefone" },
        ]}
      />
    </div>
  );
}
