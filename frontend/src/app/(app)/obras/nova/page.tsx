"use client";

import { useRouter } from "next/navigation";

import { AccessDenied } from "@/components/AccessDenied";
import { JobForm } from "@/components/JobForm";
import { useMe } from "@/lib/auth";

export default function NovaObraPage() {
  const router = useRouter();
  const { data: me } = useMe();
  if (me && me.role === "operator") return <AccessDenied />;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Nova obra</h1>
      <JobForm onSaved={(j) => router.push(`/obras/${j.id}`)} />
    </div>
  );
}
