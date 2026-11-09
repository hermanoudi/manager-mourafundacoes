"use client";

import { useRouter } from "next/navigation";

import { CustomerForm } from "@/components/CustomerForm";

export default function NovoClientePage() {
  const router = useRouter();
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Novo cliente</h1>
      <CustomerForm onSaved={() => router.push("/clientes")} />
    </div>
  );
}
