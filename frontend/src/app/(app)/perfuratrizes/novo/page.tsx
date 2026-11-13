"use client";

import { useRouter } from "next/navigation";

import { AccessDenied } from "@/components/AccessDenied";
import { DrillRigForm } from "@/components/DrillRigForm";
import { PageHeader, panel } from "@/components/ui";
import { useMe } from "@/lib/auth";

export default function NovaPerfuratrizPage() {
  const router = useRouter();
  const { data: me } = useMe();
  if (me && me.role === "operator") return <AccessDenied />;
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Nova perfuratriz" />
      <div className={`${panel} p-4`}>
        <DrillRigForm onSaved={(r) => router.push(`/perfuratrizes/${r.id}`)} />
      </div>
    </div>
  );
}
