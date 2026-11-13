"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AccessDenied } from "@/components/AccessDenied";
import { PriceTableForm, PriceTableView, type PriceTableOut } from "@/components/PriceTableEditor";
import { btnQuiet, PageHeader, panel, PencilIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { messageFor } from "@/lib/errors";

export default function TabelaPrecosPage() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const allowed = me?.role === "admin" || me?.role === "office";
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
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
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Tabela de preços"
        description="Tabela padrão copiada para cada nova obra. Alterações não afetam obras já criadas."
        actions={!editing && (
          <button type="button" onClick={() => { setEditing(true); setSaved(false); }} className={btnQuiet}>
            <PencilIcon /> Editar preços
          </button>
        )}
      />
      {saved && <p role="status" className="text-sm text-green-800">Tabela salva</p>}
      {editing ? (
        <div className={`${panel} p-4`}>
          <PriceTableForm
            table={data}
            onCancel={() => setEditing(false)}
            onSave={async (t) => {
              const out = await api<PriceTableOut>("/api/price-table", {
                method: "PUT", body: JSON.stringify(t),
              });
              qc.setQueryData(["price-table"], out);
              setEditing(false);
              setSaved(true);
            }}
          />
        </div>
      ) : (
        <PriceTableView table={data} />
      )}
    </div>
  );
}
