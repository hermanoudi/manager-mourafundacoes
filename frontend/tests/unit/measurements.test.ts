import { describe, expect, it } from "vitest";

import {
  formatHundredthsGrouped, sameContent, sumHundredths, type MeasurementIn, type MeasurementOut,
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
});

const payload = (over: Partial<MeasurementIn> = {}): MeasurementIn => ({
  client_key: "k",
  job_id: 1,
  rig_id: 2,
  work_date: "2026-11-10",
  lines: [
    { pile_code: "e-1", diameter_cm: 30, depth_m: "8.5" },
    { pile_code: "E-2", diameter_cm: 40, depth_m: "12" },
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
  total_m: "20.50",
  totals_by_diameter: [],
  uncontracted_diameters: [],
  created_by: { id: 3, name: "Op" },
  submitted_at: null,
  reviewed_by: null,
  reviewed_at: null,
  rejection_reason: null,
  photo_id: null,
  notes: null,
  lines: [
    { pile_code: "E-1", diameter_cm: 30, depth_m: "8.50" },
    { pile_code: "E-2", diameter_cm: 40, depth_m: "12.00" },
  ],
  ...over,
});

describe("sameContent", () => {
  it("considera iguais código normalizado e profundidade em centésimos", () => {
    expect(sameContent(payload(), out())).toBe(true);
  });

  it("trata observação vazia como nula", () => {
    expect(sameContent(payload({ notes: "" }), out({ notes: null }))).toBe(true);
  });

  it("acusa profundidade diferente", () => {
    const lines = [...payload().lines];
    lines[1] = { ...lines[1], depth_m: "13" };
    expect(sameContent(payload({ lines }), out())).toBe(false);
  });

  it("acusa diâmetro, estaca, data, perfuratriz, observação e número de linhas diferentes", () => {
    const base = payload().lines;
    expect(sameContent(payload({ lines: [{ ...base[0], diameter_cm: 40 }, base[1]] }), out())).toBe(false);
    expect(sameContent(payload({ lines: [{ ...base[0], pile_code: "E-3" }, base[1]] }), out())).toBe(false);
    expect(sameContent(payload({ lines: [base[0]] }), out())).toBe(false);
    expect(sameContent(payload({ work_date: "2026-11-09" }), out())).toBe(false);
    expect(sameContent(payload({ rig_id: 9 }), out())).toBe(false);
    expect(sameContent(payload({ notes: "x" }), out())).toBe(false);
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
