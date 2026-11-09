export const inputClass =
  "mt-1 block min-h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-base";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {error && <span className="mt-1 block text-sm font-normal text-red-700">{error}</span>}
    </label>
  );
}

export function SubmitBar({ busy, error, saved }: { busy: boolean; error?: string | null; saved?: boolean }) {
  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && <p className="text-sm text-green-700">Salvo</p>}
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full rounded-lg bg-brand hover:bg-brand-dark px-4 font-medium text-white disabled:opacity-60 md:w-auto"
      >
        {busy ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
