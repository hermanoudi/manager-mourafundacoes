"use client";

import { useEffect, useId, useRef } from "react";

export type TabDef<K extends string> = { key: K; label: string; badge?: string };

/** Abas com teclado (setas, Home, End) e o padrão ARIA tablist/tab/tabpanel. */
export function Tabs<K extends string>({
  tabs, active, onChange, label, children,
}: {
  tabs: TabDef<K>[];
  active: K;
  onChange: (k: K) => void;
  label: string;
  children: React.ReactNode;
}) {
  const base = useId();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const idx = tabs.findIndex((t) => t.key === active);

  // Em telas estreitas a lista pode rolar: mantém a aba ativa à vista.
  useEffect(() => {
    refs.current[active]?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [active]);

  function onKeyDown(e: React.KeyboardEvent) {
    const last = tabs.length - 1;
    const to =
      e.key === "ArrowRight" ? (idx === last ? 0 : idx + 1)
      : e.key === "ArrowLeft" ? (idx === 0 ? last : idx - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (to === null) return;
    e.preventDefault();
    onChange(tabs[to].key);
    refs.current[tabs[to].key]?.focus();
  }

  return (
    <div>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="-mx-4 flex overflow-x-auto border-b px-2 [scrollbar-width:none] sm:gap-1 md:mx-0 md:px-0"
      >
        {tabs.map((t) => {
          const selected = t.key === active;
          return (
            <button
              key={t.key}
              ref={(el) => { refs.current[t.key] = el; }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${base}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.key)}
              className={`-mb-px inline-flex min-h-12 flex-1 shrink-0 items-center justify-center gap-1.5 border-b-[3px] px-1.5 btn-label text-base transition-colors sm:flex-none sm:px-3 ${
                selected
                  ? "border-brand text-brand"
                  : "border-transparent text-stone-600 hover:text-secondary-dark"
              }`}
            >
              {t.label}
              {t.badge && (
                <span className="hidden rounded-md bg-stone-200 px-1.5 font-sans text-xs font-semibold tabular-nums tracking-normal text-stone-700 sm:inline">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-tab-${active}`}
        className="pt-6"
      >
        {children}
      </div>
    </div>
  );
}
