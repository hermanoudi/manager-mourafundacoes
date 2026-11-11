import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { clearDraft, listDrafts, loadDraft, saveDraft, type MeasurementDraft } from "@/lib/drafts";

const draft = (over: Partial<MeasurementDraft> = {}): MeasurementDraft => ({
  client_key: "11111111-2222-4333-8444-555555555555",
  job_id: 1,
  rig_id: 2,
  work_date: "2026-11-10",
  lines: [{ pile_code: "E-1", diameter_cm: 30, depth_m: "8.5" }],
  notes: null,
  photo_id: null,
  submit: false,
  saved_at: "2026-11-10T12:00:00.000Z",
  ...over,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("drafts", () => {
  it("salva e carrega pela chave mg_draft:<client_key>", () => {
    saveDraft(draft());
    expect(localStorage.getItem("mg_draft:11111111-2222-4333-8444-555555555555")).not.toBeNull();
    expect(loadDraft("11111111-2222-4333-8444-555555555555")).toEqual(draft());
    expect(loadDraft("outra")).toBeNull();
  });

  it("lista por obra, mais recente primeiro, ignorando outras chaves", () => {
    saveDraft(draft({ client_key: "a", saved_at: "2026-11-10T10:00:00.000Z" }));
    saveDraft(draft({ client_key: "b", saved_at: "2026-11-10T11:00:00.000Z" }));
    saveDraft(draft({ client_key: "c", job_id: 9 }));
    localStorage.setItem("outra-coisa", "{}");
    localStorage.setItem("mg_draft:quebrado", "{não é json");
    expect(listDrafts(1).map((d) => d.client_key)).toEqual(["b", "a"]);
    expect(listDrafts().map((d) => d.client_key).sort()).toEqual(["a", "b", "c"]);
  });

  it("remove o rascunho", () => {
    saveDraft(draft());
    clearDraft("11111111-2222-4333-8444-555555555555");
    expect(loadDraft("11111111-2222-4333-8444-555555555555")).toBeNull();
    expect(listDrafts()).toEqual([]);
  });

  it("não lança quando o localStorage falha", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    expect(() => saveDraft(draft())).not.toThrow();
    expect(loadDraft("x")).toBeNull();
    expect(() => clearDraft("x")).not.toThrow();
    expect(listDrafts()).toEqual([]);
  });
});
