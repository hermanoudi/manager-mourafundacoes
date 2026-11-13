import { cloneElement, isValidElement, useId } from "react";

import { btnPrimary, btnQuiet } from "./ui";

export const inputClass =
  "mt-1.5 block min-h-11 w-full rounded-lg border border-stone-400 bg-white px-3 text-base";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const errorId = useId();
  // O erro fica ligado ao controle: leitor de tela anuncia o campo como inválido, com o motivo.
  const control =
    error && isValidElement<Record<string, unknown>>(children)
      ? cloneElement(children, { "aria-invalid": true, "aria-describedby": errorId })
      : children;
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      {control}
      {error && (
        <span id={errorId} className="mt-1 block text-sm font-normal text-red-700">
          {error}
        </span>
      )}
    </label>
  );
}

export function SubmitBar({
  busy, error, saved, onCancel,
}: { busy: boolean; error?: string | null; saved?: boolean; onCancel?: () => void }) {
  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-800">Salvo</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="submit"
          disabled={busy}
          className={`${btnPrimary} w-full md:w-auto`}
        >
          {busy ? "Salvando…" : "Salvar"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`${btnQuiet} w-full md:w-auto`}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}
