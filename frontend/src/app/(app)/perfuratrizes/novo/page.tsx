"use client";

import { useRouter } from "next/navigation";

import { AccessDenied } from "@/components/AccessDenied";
import { DrillRigForm } from "@/components/DrillRigForm";
import { useMe } from "@/lib/auth";

export default function NovaPerfuratrizPage() {
  const router = useRouter();
  const { data: me } = useMe();
  if (me && me.role === "operator") return <AccessDenied />;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nova perfuratriz</h1>
      <DrillRigForm onSaved={(r) => router.push(`/perfuratrizes/${r.id}`)} />
    </div>
  );
}
