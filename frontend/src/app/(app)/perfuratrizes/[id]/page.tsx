"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import { DrillRigForm, RIG_TONE, STATUS_LABEL, type RigOut } from "@/components/DrillRigForm";
import { EntityHeader, Kpi, KpiGrid, panel, Pill, SectionHead } from "@/components/ui";
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
    <div className="max-w-5xl space-y-6">
      <EntityHeader title={data.name} meta={<Pill tone={RIG_TONE[data.status]}>{STATUS_LABEL[data.status]}</Pill>}>
        <KpiGrid>
          <Kpi label="Diâmetro máx." value={data.max_diameter_cm} unit="cm" />
          <Kpi label="Profundidade máx." value={`${formatDecimalBR(data.max_depth_m)} m`} />
        </KpiGrid>
      </EntityHeader>
      {data.notes && !canWrite && (
        <p className={`${panel} max-w-2xl px-4 py-3 text-sm`}>{data.notes}</p>
      )}
      {canWrite && (
        <section className="max-w-2xl">
          <SectionHead title="Dados da perfuratriz" />
          <div className={`${panel} p-4`}>
            <DrillRigForm
              initial={data}
              onSaved={(r) => {
                qc.setQueryData(["rig", id], r);
                qc.invalidateQueries({ queryKey: ["rigs"] });
              }}
            />
          </div>
        </section>
      )}
    </div>
  );
}
