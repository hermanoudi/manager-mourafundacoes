import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { PasswordInput } from "@/components/PasswordInput";

describe("PasswordInput", () => {
  it("começa oculta e alterna para texto ao clicar no olho", async () => {
    render(<PasswordInput id="pw" name="password" aria-label="Senha" />);
    const input = screen.getByLabelText("Senha", { selector: "input" });
    expect(input).toHaveAttribute("type", "password");

    const toggle = screen.getByRole("button", { name: "Mostrar senha" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await userEvent.type(input, "segredo123");
    await userEvent.click(toggle);

    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveValue("segredo123");
    const hide = screen.getByRole("button", { name: "Ocultar senha" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(hide);
    expect(input).toHaveAttribute("type", "password");
  });

  it("o botão não envia o formulário", () => {
    render(<PasswordInput id="pw" name="password" aria-label="Senha" />);
    expect(screen.getByRole("button", { name: "Mostrar senha" })).toHaveAttribute("type", "button");
  });
});
