"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { panel } from "./ui";

export type Column<T> = {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
  /** No celular, vai para o canto direito do cartão (status, ação). */
  aside?: boolean;
  /** Alinha à direita com algarismos tabulares (metros, valores). */
  numeric?: boolean;
  /** No celular, ocupa a largura toda do cartão (e-mail, endereço). */
  wide?: boolean;
  /** No celular, fica no rodapé do cartão (botões de ação). */
  footer?: boolean;
};

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
  loading?: boolean;
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

function cell<T>(c: Column<T>, item: T): React.ReactNode {
  return c.render ? c.render(item) : String((item as Record<string, unknown>)[c.key] ?? "");
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
      <circle cx="9" cy="9" r="6" />
      <path d="M14 14l4 4" />
    </svg>
  );
}

/** Cartão do celular: título, valor ao lado (status/ação) e os demais campos rotulados em grade. */
function MobileCard<T>({ item, columns }: { item: T; columns: Column<T>[] }) {
  const [title, ...rest] = columns;
  const asides = rest.filter((c) => c.aside);
  const footers = rest.filter((c) => c.footer);
  const fields = rest.filter((c) => !c.aside && !c.footer);
  return (
    <>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0 break-words font-semibold">{cell(title, item)}</span>
        {asides.length > 0 && (
          <span className="flex shrink-0 flex-col items-end gap-1">
            {asides.map((c) => <span key={c.key}>{cell(c, item)}</span>)}
          </span>
        )}
      </span>
      {fields.length > 0 && (
        <span className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
          {fields.map((c) => (
            <span key={c.key} className={`min-w-0 ${c.wide ? "col-span-2" : ""}`}>
              <span className="eyebrow block text-xs">{c.label}</span>
              <span className={`block break-words text-sm ${c.numeric ? "tabular-nums" : ""}`}>{cell(c, item)}</span>
            </span>
          ))}
        </span>
      )}
      {footers.length > 0 && (
        <span className="mt-3 flex flex-wrap gap-2">
          {footers.map((c) => <span key={c.key}>{cell(c, item)}</span>)}
        </span>
      )}
    </>
  );
}

export function DataList<T>({
  items, columns, onSelect, getKey, search, onSearch, page = 1, pageSize = 20, total, onPage,
  emptyText = "Nenhum registro encontrado.", loading,
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
        <div className="relative">
          <SearchIcon />
          <input
            type="search"
            aria-label="Buscar"
            placeholder="Buscar…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-stone-400 bg-white pl-10 pr-3 text-base"
          />
        </div>
      )}
      {items.length === 0 ? (
        <p className={`${panel} px-4 py-8 text-center text-sm text-stone-600`}>
          {loading ? "Carregando…" : emptyText}
        </p>
      ) : isDesktop ? (
        <div className={`${panel} overflow-hidden`}>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-brand">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} scope="col" className={`eyebrow px-4 pb-2 pt-3.5 ${c.numeric ? "text-right" : ""}`}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-tint/70">
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
                  className={onSelect ? "cursor-pointer hover:bg-stone-50" : undefined}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={`px-4 py-3 ${i === 0 ? "font-medium" : ""} ${c.numeric ? "text-right tabular-nums" : ""}`}
                    >
                      {cell(c, item)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className={`${panel} divide-y divide-brand-tint/70 overflow-hidden`}>
          {items.map((item) => (
            <li key={getKey(item)}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="block min-h-14 w-full px-4 py-3 text-left hover:bg-stone-50"
                >
                  <MobileCard item={item} columns={columns} />
                </button>
              ) : (
                <div className="px-4 py-3">
                  <MobileCard item={item} columns={columns} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {onPage && lastPage > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPage(page - 1)}
            className="btn-label min-h-11 rounded-lg border border-stone-400 bg-white px-4 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="text-sm text-stone-600 tabular-nums">
            Página {page} de {lastPage}
          </span>
          <button
            type="button"
            disabled={page >= lastPage}
            onClick={() => onPage(page + 1)}
            className="btn-label min-h-11 rounded-lg border border-stone-400 bg-white px-4 disabled:opacity-40"
          >
            Próxima
          </button>
        </nav>
      )}
    </div>
  );
}
