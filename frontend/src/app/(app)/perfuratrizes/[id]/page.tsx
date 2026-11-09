"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { DrillRigForm, STATUS_LABEL, type RigOut } from "@/components/DrillRigForm";
import { api } from "@/lib/api";
import { useMe } from "@/lib/auth";
import { messageFor } from "@/lib/errors";
import { formatDecimalBR } from "@/lib/format";

export default function PerfuratrizPage() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data, error } = useQuery({
    queryKey: ["rig", id],
    queryFn: () => api<RigOut>(`/api/drill-rigs/${id}`),
    retry: false,
  });
  if (error) return <p role="alert">{messageFor(error)}</p>;
  if (!data) return <p>Carregando…</p>;
  const canWrite = me?.role === "admin" || me?.role === "office";

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{data.name}</h1>
      <dl className="grid max-w-xl grid-cols-2 gap-2 rounded-lg bg-white p-3 text-sm shadow-sm">
        <dt className="text-stone-500">Diâmetro máx.</dt>
        <dd>{data.max_diameter_cm} cm</dd>
        <dt className="text-stone-500">Profundidade máx.</dt>
        <dd>{formatDecimalBR(data.max_depth_m)} m</dd>
        <dt className="text-stone-500">Status</dt>
        <dd>{STATUS_LABEL[data.status]}</dd>
      </dl>
      {canWrite && (
        <DrillRigForm
          initial={data}
          onSaved={(r) => {
            qc.setQueryData(["rig", id], r);
            qc.invalidateQueries({ queryKey: ["rigs"] });
          }}
        />
      )}
    </div>
  );
}
