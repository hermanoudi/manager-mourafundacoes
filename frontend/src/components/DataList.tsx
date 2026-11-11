"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type Column<T> = { key: string; label: string; render?: (item: T) => React.ReactNode };

type Props<T> = {
  items: T[];
  columns: Column<T>[];
  onSelect?: (item: T) => void;
  getKey: (item: T) => string | number;
  search?: string;
  onSearch?: (q: string) => void;
  page?: number;
  pageSize?: number;
  total?: number;
  onPage?: (page: number) => void;
  emptyText?: string;
};

function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 768px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 768px)").matches,
    () => false,
  );
}

function Card({
  interactive, onClick, children,
}: { interactive: boolean; onClick: () => void; children: React.ReactNode }) {
  const cls = "block min-h-11 w-full rounded-lg bg-white p-3 text-left shadow-sm";
  return interactive ? (
    <button type="button" onClick={onClick} className={cls}>{children}</button>
  ) : (
    <div className={cls}>{children}</div>
  );
}

function cell<T>(c: Column<T>, item: T): React.ReactNode {
  return c.render ? c.render(item) : String((item as Record<string, unknown>)[c.key] ?? "");
}

export function DataList<T>({
  items, columns, onSelect, getKey, search, onSearch, page = 1, pageSize = 20, total, onPage,
  emptyText = "Nenhum registro encontrado.",
}: Props<T>) {
  const isDesktop = useIsDesktop();
  const [q, setQ] = useState(search ?? "");

  useEffect(() => {
    if (!onSearch) return;
    const t = setTimeout(() => onSearch(q), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const lastPage = Math.max(1, Math.ceil((total ?? items.length) / pageSize));

  return (
    <div className="space-y-3">
      {onSearch && (
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Buscar…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="min-h-11 w-full rounded-lg border border-stone-300 px-3 text-base"
        />
      )}
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-stone-600">{emptyText}</p>
      ) : isDesktop ? (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-stone-600">
              {columns.map((c) => (
                <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={getKey(item)}
                onClick={() => onSelect?.(item)}
                tabIndex={onSelect ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onSelect && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    onSelect(item);
                  }
                }}
                className="min-h-11 cursor-pointer border-b hover:bg-stone-100"
              >
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-3">{cell(c, item)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={getKey(item)}>
              <Card interactive={!!onSelect} onClick={() => onSelect?.(item)}>
                {columns.map((c, i) => (
                  <div key={c.key} className={i === 0 ? "font-medium" : "text-sm text-stone-600"}>
                    {i > 0 && c.label && <span className="text-stone-600">{c.label}: </span>}
                    {cell(c, item)}
                  </div>
                ))}
              </Card>
            </li>
          ))}
        </ul>
      )}
      {onPage && (
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-stone-600">
            {page} / {lastPage}
          </span>
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => onPage(page + 1)}
            className="min-h-11 rounded-lg border px-4 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      )}
    </div>
  );
}
