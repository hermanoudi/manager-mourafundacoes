"use client";

import { useRouter } from "next/navigation";

import { AccessDenied } from "@/components/AccessDenied";
import { JobForm } from "@/components/JobForm";
import { PageHeader, panel } from "@/components/ui";
import { useMe } from "@/lib/auth";

export default function NovaObraPage() {
  const router = useRouter();
  const { data: me } = useMe();
  if (me && me.role === "operator") return <AccessDenied />;
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader
        title="Nova obra"
        description="A tabela de preços padrão é copiada para a obra; você ajusta depois, na aba Preços."
      />
      <div className={`${panel} p-4`}>
        <JobForm onSaved={(j) => router.push(`/obras/${j.id}`)} />
      </div>
    </div>
  );
}
