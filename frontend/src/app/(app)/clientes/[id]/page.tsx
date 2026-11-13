"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { AccessDenied } from "@/components/AccessDenied";
import { CustomerForm, type CustomerOut } from "@/components/CustomerForm";
import { EntityHeader, panel, SectionHead } from "@/components/ui";
import { api } from "@/lib/api";
import { formatDocument } from "@/lib/documents";
import { isForbidden, messageFor } from "@/lib/errors";

export default function ClientePage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => api<CustomerOut>(`/api/customers/${id}`),
    retry: false,
  });
  if (isForbidden(error)) return <AccessDenied />;
  if (error) return <p role="alert">{messageFor(error)}</p>;
  if (!data) return <p>Carregando…</p>;
  return (
    <div className="max-w-5xl space-y-6">
      <EntityHeader
        title={data.name}
        meta={
          <span>
            {formatDocument(data.document)} · {data.address.city}/{data.address.state}
          </span>
        }
      />
      <section className="max-w-2xl">
        <SectionHead title="Dados do cliente" />
        <div className={`${panel} p-4`}>
          <CustomerForm
            initial={data}
            onSaved={(c) => {
              qc.setQueryData(["customer", id], c);
              qc.invalidateQueries({ queryKey: ["customers"] });
            }}
          />
        </div>
      </section>
    </div>
  );
}
