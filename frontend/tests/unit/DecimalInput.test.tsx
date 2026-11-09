import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { DecimalInput } from "@/components/DecimalInput";

function Harness({ spy }: { spy: (v: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <DecimalInput
      aria-label="Profundidade"
      value={value}
      onChange={(v) => {
        spy(v);
        setValue(v);
      }}
    />
  );
}

describe("DecimalInput", () => {
  it("aceita vírgula e entrega string pt-BR", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.type(screen.getByLabelText("Profundidade"), "22,5");
    expect(spy).toHaveBeenLastCalledWith("22,5");
    expect(screen.getByLabelText("Profundidade")).toHaveValue("22,5");
  });
  it("não aceita letras e usa teclado decimal", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    const input = screen.getByLabelText("Profundidade");
    await userEvent.type(input, "ab1");
    expect(input).toHaveValue("1");
    expect(input).toHaveAttribute("inputmode", "decimal");
  });
  it("troca ponto por vírgula na exibição", async () => {
    const spy = vi.fn();
    render(<Harness spy={spy} />);
    await userEvent.type(screen.getByLabelText("Profundidade"), "2.5");
    expect(screen.getByLabelText("Profundidade")).toHaveValue("2,5");
  });
});
