"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AccessDenied } from "@/components/AccessDenied";
import { PriceTableEditor, type PriceTableOut } from "@/components/PriceTableEditor";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { messageFor } from "@/lib/errors";

export default function TabelaPrecosPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const allowed = me?.role === "admin" || me?.role === "office";
  const { data, error } = useQuery({
    queryKey: ["price-table"],
    queryFn: () => api<PriceTableOut>("/api/price-table"),
    enabled: allowed,
    retry: false,
  });
  if (me && !allowed) return <AccessDenied />;
  if (error) return <p role="alert">{messageFor(error)}</p>;
  if (!data) return <p>Carregando…</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Tabela de preços</h1>
      <p className="max-w-xl text-sm text-stone-600">
        Tabela padrão copiada para cada nova obra. Alterações não afetam obras já criadas.
      </p>
      <PriceTableEditor
        table={data}
        onSave={async (t) => {
          const out = await api<PriceTableOut>("/api/price-table", {
            method: "PUT", body: JSON.stringify(t),
          });
          qc.setQueryData(["price-table"], out);
        }}
      />
    </div>
  );
}
