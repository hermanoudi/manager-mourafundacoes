"use client";

import { useRouter } from "next/navigation";

import { CustomerForm } from "@/components/CustomerForm";
import { PageHeader, panel } from "@/components/ui";

export default function NovoClientePage() {
  const router = useRouter();
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Novo cliente" />
      <div className={`${panel} p-4`}>
        <CustomerForm onSaved={() => router.push("/clientes")} />
      </div>
    </div>
  );
}
