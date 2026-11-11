"use client";

import Link from "next/link";

/** O servidor já tinha a medição enviada com outro conteúdo: o rascunho local fica até o usuário decidir. */
export function DroppedEditsAlert({ measurementId, onDiscard }: { measurementId: number; onDiscard: () => void }) {
  return (
    <div role="alert" className="space-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      <p>Esta medição já tinha sido enviada; suas alterações não foram aplicadas.</p>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/medicoes/${measurementId}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-amber-700 px-4 font-medium text-amber-900"
        >
          Ver medição enviada
        </Link>
        <button
          type="button"
          onClick={onDiscard}
          className="min-h-11 rounded-lg bg-amber-700 px-4 font-medium text-white"
        >
          Descartar rascunho local
        </button>
      </div>
    </div>
  );
}
