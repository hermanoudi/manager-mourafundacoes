import { describe, expect, it } from "vitest";

import {
  formatHundredthsGrouped, formatMeters, pilesIn, sameContent, sumHundredths, type MeasurementIn, type MeasurementOut,
} from "@/lib/measurements";

describe("sumHundredths / formatHundredthsGrouped", () => {
  it("soma metragens da API sem float e ignora inválidas", () => {
    expect(sumHundredths(["0.1", "0.2", "19.25", "x"])).toBe(1955);
    expect(sumHundredths([])).toBe(0);
  });
  it("formata com milhar e duas casas", () => {
    expect(formatHundredthsGrouped(123456789)).toBe("1.234.567,89");
    expect(formatHundredthsGrouped(5)).toBe("0,05");
  });
  it("formatMeters agrupa milhar como o resto da interface", () => {
    expect(formatMeters("1234.5")).toBe("1.234,50 m");
    expect(formatMeters("20.5")).toBe("20,50 m");
  });
});

const payload = (over: Partial<MeasurementIn> = {}): MeasurementIn => ({
  client_key: "k",
  job_id: 1,
  rig_id: 2,
  work_date: "2026-11-10",
  lines: [
    { quantity: 3, diameter_cm: 30, depth_m: "8.5" },
    { quantity: 1, diameter_cm: 40, depth_m: "12" },
  ],
  notes: null,
  photo_id: null,
  submit: true,
  ...over,
});

const out = (over: Partial<MeasurementOut> = {}): MeasurementOut => ({
  id: 7,
  client_key: "k",
  job: { id: 1, name: "Obra" },
  rig: { id: 2, name: "Rig" },
  work_date: "2026-11-10",
  status: "submitted",
  total_m: "37.50",
  total_piles: 4,
  totals_by_diameter: [],
  uncontracted_diameters: [],
  created_by: { id: 3, name: "Op" },
  entered_by: { id: 3, name: "Op" },
  submitted_at: null,
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  photo_id: null,
  notes: null,
  lines: [
    { quantity: 3, pile_code: null, diameter_cm: 30, depth_m: "8.50" },
    { quantity: 1, pile_code: null, diameter_cm: 40, depth_m: "12.00" },
  ],
  ...over,
});

describe("sameContent", () => {
  it("considera iguais profundidade em centésimos e linhas em outra ordem", () => {
    expect(sameContent(payload(), out())).toBe(true);
    const [a, b] = payload().lines;
    expect(sameContent(payload({ lines: [b, a] }), out())).toBe(true);
  });

  it("acusa quantidade diferente", () => {
    const [a, b] = payload().lines;
    expect(sameContent(payload({ lines: [{ ...a, quantity: 2 }, b] }), out())).toBe(false);
  });

  it("linha de rascunho antigo sem quantidade vale 1", () => {
    const [a, b] = payload().lines;
    const legacy = { pile_code: "E-2", diameter_cm: b.diameter_cm, depth_m: b.depth_m } as MeasurementIn["lines"][number];
    expect(sameContent(payload({ lines: [a, legacy] }), out())).toBe(true);
  });

  it("quantidade inválida nunca é igual", () => {
    const [a, b] = payload().lines;
    expect(sameContent(payload({ lines: [a, { ...b, quantity: null }] }), out())).toBe(false);
    expect(sameContent(payload({ lines: [a, { ...b, quantity: 0 }] }), out())).toBe(false);
  });

  it("trata observação vazia como nula", () => {
    expect(sameContent(payload({ notes: "" }), out({ notes: null }))).toBe(true);
  });

  it("acusa profundidade diferente", () => {
    const lines = [...payload().lines];
    lines[1] = { ...lines[1], depth_m: "13" };
    expect(sameContent(payload({ lines }), out())).toBe(false);
  });

  it("acusa diâmetro, data, perfuratriz, observação e número de linhas diferentes", () => {
    const base = payload().lines;
    expect(sameContent(payload({ lines: [{ ...base[0], diameter_cm: 40 }, base[1]] }), out())).toBe(false);
    expect(sameContent(payload({ lines: [base[0]] }), out())).toBe(false);
    expect(sameContent(payload({ work_date: "2026-11-09" }), out())).toBe(false);
    expect(sameContent(payload({ rig_id: 9 }), out())).toBe(false);
    expect(sameContent(payload({ notes: "x" }), out())).toBe(false);
  });

  it("acusa operador trocado pelo admin; sem operador no payload (operador) não compara", () => {
    expect(sameContent(payload({ operator_id: 4 }), out())).toBe(false);
    expect(sameContent(payload({ operator_id: 3 }), out())).toBe(true);
    expect(sameContent(payload(), out())).toBe(true);
  });

  it("acusa foto diferente (foto anexada depois de um envio sem resposta)", () => {
    const photo = "0b6c1f1e-6f2a-4d8e-9a51-2f4c6a1b7e90";
    expect(sameContent(payload({ photo_id: photo }), out())).toBe(false);
    expect(sameContent(payload({ photo_id: photo }), out({ photo_id: photo }))).toBe(true);
  });

  it("linha incompleta do rascunho nunca é igual", () => {
    const base = payload().lines;
    expect(sameContent(payload({ lines: [{ ...base[0], diameter_cm: null }, base[1]] }), out())).toBe(false);
  });
});

describe("pilesIn", () => {
  it("soma as quantidades; linha antiga sem quantidade vale 1; incompleta não conta", () => {
    const lines = [
      { quantity: 30, diameter_cm: 30, depth_m: "8" },
      { quantity: null, diameter_cm: 30, depth_m: "" },
      { pile_code: "E-1", diameter_cm: 30, depth_m: "8" },
    ] as MeasurementIn["lines"];
    expect(pilesIn(lines)).toBe(31);
  });
});
