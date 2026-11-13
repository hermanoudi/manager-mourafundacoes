"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AccessDenied } from "@/components/AccessDenied";
import { DataList } from "@/components/DataList";
import { ROLE_LABEL, UserForm } from "@/components/UserForm";
import { btnPrimary, btnQuiet, PageHeader, Pill } from "@/components/ui";
import { api } from "@/lib/api";
import type { UserOut } from "@/lib/auth";
import { isForbidden, messageFor } from "@/lib/errors";

type Page = { items: UserOut[]; total: number; page: number; page_size: number };

export default function UsuariosPage() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [page, setPage] = useState(1);
  const { data, error, isPending } = useQuery({
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
    <div className="max-w-5xl space-y-5">
      <PageHeader
        title="Usuários"
        description="Quem acessa o sistema e com qual papel."
        actions={
          <button
            type="button"
            aria-expanded={creating}
            onClick={() => setCreating((v) => !v)}
            className={creating ? btnQuiet : btnPrimary}
          >
            {creating ? "Fechar cadastro" : "Novo usuário"}
          </button>
        }
      />
      {creating && (
        <section aria-label="Novo usuário">
          <UserForm
            onCreated={() => {
              setCreating(false);
              qc.invalidateQueries({ queryKey: ["users"] });
            }}
          />
        </section>
      )}
      {toggle.error && <p role="alert" className="text-sm text-red-700">{messageFor(toggle.error)}</p>}
      <DataList
        items={data?.items ?? []}
        loading={isPending}
        total={data?.total}
        page={page}
        pageSize={data?.page_size}
        onPage={setPage}
        getKey={(u) => u.id}
        columns={[
          { key: "name", label: "Nome" },
          { key: "email", label: "E-mail", wide: true },
          { key: "role", label: "Papel", render: (u) => ROLE_LABEL[u.role] },
          {
            key: "active", label: "Situação", aside: true,
            render: (u) => <Pill tone={u.active ? "good" : "neutral"}>{u.active ? "Ativo" : "Inativo"}</Pill>,
          },
          {
            key: "actions",
            label: "",
            footer: true,
            render: (u) => (
              <button
                type="button"
                aria-label={`${u.active ? "Desativar" : "Ativar"} ${u.name}`}
                onClick={(e) => { e.stopPropagation(); toggle.mutate(u); }}
                className={`${btnQuiet} text-sm`}
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
