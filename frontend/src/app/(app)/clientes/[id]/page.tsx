"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { AccessDenied } from "@/components/AccessDenied";
import { CustomerForm, type CustomerOut } from "@/components/CustomerForm";
import { api } from "@/lib/api";
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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{data.name}</h1>
      <CustomerForm
        initial={data}
        onSaved={(c) => {
          qc.setQueryData(["customer", id], c);
          qc.invalidateQueries({ queryKey: ["customers"] });
        }}
      />
    </div>
  );
}
