import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { LinesEditor, type LineInput } from "@/components/LinesEditor";

const RIG = { max_diameter_cm: 60, max_depth_m: "22.00" };

function Harness({ initial }: { initial: LineInput[] }) {
  const [lines, setLines] = useState(initial);
  return <LinesEditor lines={lines} onChange={setLines} diameters={[30, 40]} rig={RIG} />;
}

const line = (pile_code: string, depth_m = "", diameter_cm = "30"): LineInput => ({
  pile_code, diameter_cm, depth_m,
});

const row = (n: number) => within(screen.getByRole("group", { name: `Linha ${n}` }));

describe("LinesEditor", () => {
  it("'Adicionar estaca' sugere o próximo código", async () => {
    render(<Harness initial={[line("E-12", "8")]} />);
    await userEvent.click(screen.getByRole("button", { name: "Adicionar estaca" }));
    expect(row(2).getByLabelText("Estaca")).toHaveValue("E-13");
    expect(row(2).getByLabelText("Diâmetro")).toHaveValue("30");
  });

  it("acusa estaca repetida pela mesma chave do backend", async () => {
    render(<Harness initial={[line("E-12", "8"), line("", "")]} />);
    await userEvent.type(row(2).getByLabelText("Estaca"), "e12");
    expect(row(2).getByText("Estaca repetida")).toBeInTheDocument();
    expect(row(1).queryByText("Estaca repetida")).toBeNull();
  });

  it("acusa profundidade acima do limite da perfuratriz", async () => {
    render(<Harness initial={[line("E-1")]} />);
    await userEvent.type(row(1).getByLabelText("Profundidade (m)"), "23");
    expect(row(1).getByText(/acima do limite da perfuratriz \(22,00 m\)/)).toBeInTheDocument();
  });

  it("acusa diâmetro 'Outro' fora do limite da perfuratriz", async () => {
    render(<Harness initial={[line("E-1", "5")]} />);
    await userEvent.selectOptions(row(1).getByLabelText("Diâmetro"), "Outro");
    await userEvent.type(row(1).getByLabelText("Outro diâmetro (cm)"), "70");
    expect(row(1).getByText(/fora do limite da perfuratriz \(25–60 cm\)/)).toBeInTheDocument();
  });

  it("soma estacas e metros por diâmetro sem float", async () => {
    render(<Harness initial={[line("E-1"), line("E-2")]} />);
    await userEvent.type(row(1).getByLabelText("Profundidade (m)"), "8,5");
    await userEvent.type(row(2).getByLabelText("Profundidade (m)"), "12");
    const totals = screen.getByTestId("lines-totals");
    expect(within(totals).getByText("Ø 30 cm: 2 estacas · 20,50 m")).toBeInTheDocument();
    expect(within(totals).getByText("Total: 2 estacas · 20,50 m")).toBeInTheDocument();
  });
});
