import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { LinesEditor, linesFromApi, validateLines, type LineInput } from "@/components/LinesEditor";
import type { MeasurementLineIn } from "@/lib/measurements";

const RIG = { max_diameter_cm: 60, max_depth_m: "22.00" };

function Harness({ initial }: { initial: LineInput[] }) {
  const [lines, setLines] = useState(initial);
  return <LinesEditor lines={lines} onChange={setLines} diameters={[30, 40]} rig={RIG} />;
}

const line = (quantity: string, depth_m = "", diameter_cm = "30"): LineInput => ({
  quantity, diameter_cm, depth_m,
});

const row = (n: number) => within(screen.getByRole("group", { name: `Grupo ${n}` }));

describe("LinesEditor", () => {
  it("cartão tem Qtd, Diâmetro e Profundidade e mostra o subtotal do grupo", async () => {
    render(<Harness initial={[line("")]} />);
    await userEvent.type(row(1).getByLabelText("Qtd"), "30");
    await userEvent.type(row(1).getByLabelText("Profundidade (m)"), "8");
    expect(row(1).getByLabelText("Diâmetro")).toHaveValue("30");
    expect(row(1).getByText("30 × 8,00 m = 240,00 m")).toBeInTheDocument();
    const totals = screen.getByTestId("lines-totals");
    expect(within(totals).getByText("Total: 30 estacas · 240,00 m")).toBeInTheDocument();
  });

  it("Qtd aceita só dígitos (no máximo 3)", async () => {
    render(<Harness initial={[line("")]} />);
    await userEvent.type(row(1).getByLabelText("Qtd"), "1a2,34");
    expect(row(1).getByLabelText("Qtd")).toHaveValue("123");
  });

  it("'Adicionar grupo' copia o diâmetro e deixa a quantidade vazia", async () => {
    render(<Harness initial={[line("30", "8", "40")]} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar grupo" }));
    expect(row(2).getByLabelText("Diâmetro")).toHaveValue("40");
    expect(row(2).getByLabelText("Qtd")).toHaveValue("");
  });

  it("linha da foto com erro fica destacada até ser editada", async () => {
    const read = { ...line("1", "", "40"), photo_error: "Profundidade não reconhecida (ilegível)" };
    render(<Harness initial={[line("1", "8"), read]} />);
    expect(row(2).getByText("Profundidade não reconhecida (ilegível)")).toBeInTheDocument();
    await userEvent.type(row(2).getByLabelText("Profundidade (m)"), "10");
    expect(row(2).queryByText(/não reconhecida/)).toBeNull();
  });

  it("acusa profundidade acima do limite da perfuratriz", async () => {
    render(<Harness initial={[line("1")]} />);
    await userEvent.type(row(1).getByLabelText("Profundidade (m)"), "23");
    expect(row(1).getByText(/acima do limite da perfuratriz \(22,00 m\)/)).toBeInTheDocument();
  });

  it("acusa diâmetro 'Outro' fora do limite da perfuratriz", async () => {
    render(<Harness initial={[line("1", "5")]} />);
    await userEvent.selectOptions(row(1).getByLabelText("Diâmetro"), "Outro");
    await userEvent.type(row(1).getByLabelText("Outro diâmetro (cm)"), "70");
    expect(row(1).getByText(/fora do limite da perfuratriz \(25–60 cm\)/)).toBeInTheDocument();
  });

  it("soma quantidade × profundidade por diâmetro sem float", async () => {
    render(<Harness initial={[line("2", "8,5"), line("3", "12"), line("1", "10", "40")]} />);
    const totals = screen.getByTestId("lines-totals");
    expect(within(totals).getByText("Ø 30 cm: 5 estacas · 53,00 m")).toBeInTheDocument();
    expect(within(totals).getByText("Ø 40 cm: 1 estaca · 10,00 m")).toBeInTheDocument();
    expect(within(totals).getByText("Total: 6 estacas · 63,00 m")).toBeInTheDocument();
  });
});

describe("validateLines", () => {
  it("quantidade fora de 1 a 999 é erro na linha", () => {
    for (const q of ["0", "1000", "1,5", "abc"]) {
      const { errors } = validateLines([line(q, "8")], RIG);
      expect(errors[0], q).toBe("Quantidade inválida (1 a 999)");
    }
    expect(validateLines([line("999", "8")], RIG).valid).toBe(true);
  });

  it("grupo sem quantidade não está completo", () => {
    expect(validateLines([line("", "8")], RIG).complete).toBe(false);
  });
});

describe("linesFromApi", () => {
  it("linha de rascunho antigo sem quantidade abre com 1 e preserva o código", () => {
    const legacy = [{ pile_code: "E-1", diameter_cm: 30, depth_m: "8.5" }] as unknown as MeasurementLineIn[];
    expect(linesFromApi(legacy, [30, 40])).toEqual([
      { quantity: "1", diameter_cm: "30", custom: false, depth_m: "8,5", pile_code: "E-1" },
    ]);
  });

  it("diâmetro fora da lista contratada vira 'Outro'", () => {
    const [l] = linesFromApi([{ quantity: 4, diameter_cm: 35, depth_m: "10" }], [30, 40]);
    expect(l).toMatchObject({ quantity: "4", diameter_cm: "35", custom: true });
  });
});
