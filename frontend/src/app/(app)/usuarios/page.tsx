"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AccessDenied } from "@/components/AccessDenied";
import { DataList } from "@/components/DataList";
import { ROLE_LABEL, UserForm } from "@/components/UserForm";
import { api } from "@/lib/api";
import type { UserOut } from "@/lib/auth";
import { isForbidden, messageFor } from "@/lib/errors";

type Page = { items: UserOut[]; total: number; page: number; page_size: number };

export default function UsuariosPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error } = useQuery({
    queryKey: ["users", page],
    queryFn: () => api<Page>(`/api/users?page=${page}`),
    retry: false,
  });
  const toggle = useMutation({
    mutationFn: (u: UserOut) =>
      api(`/api/users/${u.id}`, { method: "PATCH", body: JSON.stringify({ active: !u.active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
  if (isForbidden(error)) return <AccessDenied />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Usuários</h1>
        <button
          type="button"
          onClick={() => setCreating((v) => !v)}
          className="min-h-11 rounded-lg bg-brand px-4 font-medium text-white"
        >
          Novo usuário
        </button>
      </div>
      {creating && (
        <UserForm
          onCreated={() => {
            setCreating(false);
            qc.invalidateQueries({ queryKey: ["users"] });
          }}
        />
      )}
      {toggle.error && <p role="alert" className="text-sm text-red-700">{messageFor(toggle.error)}</p>}
      <DataList
        items={data?.items ?? []}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        getKey={(u) => u.id}
        columns={[
          { key: "name", label: "Nome" },
          { key: "email", label: "E-mail" },
          { key: "role", label: "Papel", render: (u) => ROLE_LABEL[u.role] },
          { key: "active", label: "Situação", render: (u) => (u.active ? "Ativo" : "Inativo") },
          {
            key: "actions",
            label: "",
            render: (u) => (
              <button
                type="button"
                aria-label={`${u.active ? "Desativar" : "Ativar"} ${u.name}`}
                onClick={(e) => { e.stopPropagation(); toggle.mutate(u); }}
                className="inline-flex min-h-11 items-center rounded-lg border px-3 text-sm"
              >
                {u.active ? "Desativar" : "Ativar"}
              </button>
            ),
          },
        ]}
      />
    </div>
  );
}
