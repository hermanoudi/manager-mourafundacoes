# Medição por grupos de estacas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A linha da medição deixa de ser "uma estaca identificada" e passa a ser um grupo `quantidade × diâmetro × profundidade`.

**Architecture:** `measurement_lines` ganha `quantity` e `pile_code` vira opcional (só legado). O domínio soma `quantity` nos totais, e as travas de estaca repetida saem. A API, a leitura da foto (que agrupa linhas iguais) e o editor da tela passam a falar em grupos.

**Tech Stack:** FastAPI + SQLAlchemy + Alembic + Postgres (backend, `uv`), Next 16 + React + Vitest + Playwright (frontend).

**Spec:** `docs/superpowers/specs/2026-11-14-medicao-por-grupos-design.md`

## Global Constraints
- Medidas: `Decimal`/`NUMERIC`, string no JSON; nunca `float`. Na tela, metragem em centésimos inteiros (`toHundredths`).
- Banco só via Alembic; a migration tem `downgrade()`; `tests/test_migrations.py::test_models_match_migrations` precisa passar.
- `domain/` usa só stdlib + pydantic; `application/` nunca importa `infrastructure/`.
- Interface em pt-BR; código e campos em inglês.
- `quantity`: inteiro de **1 a 999**.
- Viewports 360×780, 393×852, 1280×800, sem scroll horizontal; toque ≥ 44px.
- Commits em português: `tipo(escopo): descrição`, terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Ruff só em `backend/src backend/tests backend/migrations backend/scripts`.

## Review Focus
1. **Medição antiga (com código, quantidade 1)** reprovada, reaberta e reenviada mantém os códigos e os totais. Testes: Task 1 (API) e Task 3 (`fromSource`).
2. **Rascunho salvo no aparelho antes da mudança** (linhas sem `quantity`) abre com quantidade 1 e sem erro. Teste: Task 3.
3. **Reenvio idempotente**: `sameContent` compara a quantidade. Sem isso, dois grupos de quantidades diferentes seriam vistos como "mesmo conteúdo", ou um conteúdo igual seria visto como diferente (falso "alterações não aplicadas"). Teste: Task 3.
4. **Foto com linhas iguais somando mais de 999**: não junta além do limite; abre outro grupo. Teste: Task 2.
5. **Quantidade digitada inválida** ("0", "1,5", "abc", vazio) bloqueia o envio com mensagem na linha. A API recusa 0 e 1000 com 422. Testes: Task 1 e Task 3.

---

### Task 1: Backend — linha com quantidade (domínio, banco, API)

**Files:**
- Modify: `backend/src/moura_gestao/domain/measurements.py`
- Modify: `backend/src/moura_gestao/infrastructure/models.py:236-250` (`MeasurementLineModel`)
- Create: `backend/migrations/versions/0011_measurement_line_quantity.py`
- Modify: `backend/src/moura_gestao/infrastructure/repositories.py` (`_add_lines`, `_hydrate`; remover `pile_keys_in_job`)
- Modify: `backend/src/moura_gestao/application/ports.py:89` (remover `pile_keys_in_job`)
- Modify: `backend/src/moura_gestao/application/measurements.py:32-66` (`_validate`)
- Modify: `backend/src/moura_gestao/interfaces/http/schemas.py:328-336` (`MeasurementLineIO`)
- Modify: `backend/src/moura_gestao/interfaces/http/routes/measurements.py:50,80-84`
- Test: `backend/tests/domain/test_measurements.py`, `backend/tests/http/test_measurements.py`, `backend/tests/http/test_errors.py`, `backend/tests/factories.py` (onde houver `pile_code`)

**Interfaces:**
- Produces:
  - `MeasurementLine(quantity: int, diameter_cm: int, depth_m: Decimal, pile_code: str | None = None)` (frozen dataclass; **nova ordem dos campos**).
  - `totals_by_diameter(lines) -> list[tuple[int, int, Decimal]]`: (diâmetro, Σ quantity, Σ quantity×depth).
  - `total_meters(lines) -> Decimal`: Σ quantity×depth.
  - `total_piles(lines) -> int` e `Measurement.total_piles`: Σ quantity.
  - `QUANTITY_MIN = 1`, `QUANTITY_MAX = 999` em `domain/measurements.py`.
  - Removidos: `duplicate_piles`, `pile_key`, `MeasurementRepository.pile_keys_in_job`, erro `duplicate_pile`.
  - JSON da linha (entrada e saída): `{"quantity": int, "diameter_cm": int, "depth_m": "8.00", "pile_code": str | null}`. Na entrada, `pile_code` é opcional (normalizado com `normalize_pile_code` quando vier não vazio; `""`/ausente → `null`).
  - `MeasurementSummaryOut.total_piles: int`.

- [ ] **Step 1: Testes de domínio que falham** (em `tests/domain/test_measurements.py`):

```python
def test_totals_multiply_quantity():
    lines = [
        MeasurementLine(30, 30, Decimal("8.00")),
        MeasurementLine(10, 35, Decimal("10.00")),
        MeasurementLine(2, 30, Decimal("8.50")),
    ]
    assert totals_by_diameter(lines) == [(30, 32, Decimal("257.00")), (35, 10, Decimal("100.00"))]
    assert total_meters(lines) == Decimal("357.00")
    assert total_piles(lines) == 42

def test_legacy_line_keeps_code():
    assert MeasurementLine(1, 30, Decimal("8"), "E-1").pile_code == "E-1"
```
Remova `test_totals_by_diameter` e qualquer teste de `pile_key`/`duplicate_piles`. Fica só o teste de `normalize_pile_code`.

- [ ] **Step 2:** `cd backend && uv run pytest tests/domain/test_measurements.py -q`. Esperado: FAIL (a assinatura antiga não multiplica).

- [ ] **Step 3: Implementar o domínio** conforme Interfaces. `Measurement.total_piles` é uma property, como `total_m`.

- [ ] **Step 4: Modelo + migration 0011** (`down_revision = '0010'`):
  - Modelo: `quantity: Mapped[int]` (sem server_default) com `CheckConstraint("quantity BETWEEN 1 AND 999", name="quantity_range")`; `pile_code: Mapped[str | None] = mapped_column(String(20))`.
  - `upgrade()`: `add_column quantity INTEGER NOT NULL server_default '1'`, depois `alter_column(server_default=None)`; `create_check_constraint(op.f('ck_measurement_lines_quantity_range'), ...)` com o mesmo nome que a convenção de nomes do `Base` gera (confira em `models.py` qual `naming_convention` está em uso e use o nome resultante); `alter_column pile_code nullable=True`.
  - `downgrade()`: expande grupos e gera códigos, nesta ordem:
    ```sql
    INSERT INTO measurement_lines (measurement_id, position, pile_code, diameter_cm, depth_m, quantity)
    SELECT measurement_id, position, NULL, diameter_cm, depth_m, 1
    FROM measurement_lines, generate_series(2, quantity);
    UPDATE measurement_lines SET pile_code = 'L' || id WHERE pile_code IS NULL;
    ```
    Depois: `pile_code` volta a NOT NULL, o check é removido e `quantity` sai.

- [ ] **Step 5: Repositório e aplicação.**
  - `_add_lines` grava `quantity` e `pile_code`. `_hydrate` monta `MeasurementLine(ln.quantity, ln.diameter_cm, ln.depth_m, ln.pile_code)`.
  - Apague `pile_keys_in_job` (repositório e port).
  - Em `_validate`, tire as duas checagens de estaca repetida. As mensagens de limite da perfuratriz passam a usar a posição: `f"Linha {i}: diâmetro {d} cm fora do limite da perfuratriz ({MIN}–{max} cm)"` e `f"Linha {i}: profundidade {p} m acima do limite da perfuratriz ({max} m)"`, com `i` começando em 1.

- [ ] **Step 6: Schemas e rotas.**
  - `MeasurementLineIO`: `quantity: int = Field(ge=1, le=999)`, `pile_code: OptionalPileCode = None` (validador: vazio/espaços → `None`, senão `normalize_pile_code`), mais `diameter_cm` e `depth_m` como hoje.
  - `_lines()` e a serialização passam a levar `quantity` e `pile_code`.
  - `DiameterTotalOut` continua igual (agora `piles` é Σ quantity). Inclua `total_piles` no summary.

- [ ] **Step 7: Testes HTTP** (em `tests/http/test_measurements.py`). Atualize os payloads existentes para `{"quantity": 1, ...}` sem `pile_code` e adicione:
  - `test_create_grouped_lines`: linhas `[{"quantity": 30, "diameter_cm": 30, "depth_m": "8"}, {"quantity": 10, "diameter_cm": 35, "depth_m": "10"}]` → 201; `total_m == "340.00"`; `total_piles == 40`; `totals_by_diameter == [{"diameter_cm": 30, "piles": 30, "meters": "240.00"}, {"diameter_cm": 35, "piles": 10, "meters": "100.00"}]`; cada linha sai com `"pile_code": None`.
  - `test_quantity_out_of_range_is_422`: `quantity` 0 e 1000 → 422.
  - `test_same_group_twice_and_across_measurements_is_allowed`: duas linhas idênticas na mesma medição → 201, e a mesma linha em outra medição da obra → 201 (antes era `duplicate_pile`).
  - `test_legacy_pile_code_round_trips`: criar com `{"quantity": 1, "pile_code": "e-7", ...}` → a saída traz `"pile_code": "E-7"`; reprovar, reenviar via PATCH com as linhas devolvidas → o código continua `"E-7"`.
  - `test_rig_limit_message_uses_line_number`: a 2ª linha acima da profundidade máxima → a mensagem começa com `"Linha 2:"`.
  - Remova/ajuste os testes de `duplicate_pile`/"Estaca repetida" (`test_measurements.py`, `test_errors.py`).

- [ ] **Step 8: Verificar.** `docker compose --profile test up -d db_test`, depois `cd backend && uv run pytest -q && uv run ruff check src tests migrations scripts`. Esperado: tudo verde, incluindo `test_migrations.py` (roundtrip e models×migrations).

- [ ] **Step 9: Commit.** `feat(medicoes): linha da medição vira grupo com quantidade`

---

### Task 2: Backend — foto das anotações lê e agrupa quantidades

**Files:**
- Modify: `backend/src/moura_gestao/domain/photos.py` (`RawLine`)
- Modify: `backend/src/moura_gestao/application/photos.py` (`ExtractedLine`, `_normalize_line`, `normalize_extracted`)
- Modify: `backend/src/moura_gestao/infrastructure/extractors.py` (`PROMPT`, extrator falso)
- Modify: `backend/src/moura_gestao/interfaces/http/schemas.py` (`ExtractedLineOut`), `backend/src/moura_gestao/interfaces/http/routes/photos.py:56-66`
- Test: `backend/tests/test_extractors.py`, `backend/tests/http/test_photos.py`, novo `backend/tests/domain/test_photo_extraction.py` (ou onde já houver testes de `normalize_extracted`; use `grep -rn normalize_extracted backend/tests`)

**Interfaces:**
- Consumes: `QUANTITY_MIN`, `QUANTITY_MAX` da Task 1.
- Produces:
  - `RawLine(quantity: str, diameter: str, depth: str)`, sem `pile_code`.
  - `ExtractedLine(quantity: int | None, diameter_cm: int | None, depth_m: Decimal | None, valid: bool, error: str | None = None)`.
  - JSON `ExtractedLineOut`: `{quantity, diameter_cm, depth_m, valid, error}`.

- [ ] **Step 1: Testes que falham** (normalização):

```python
def test_groups_equal_valid_lines_in_first_order():
    ex = normalize_extracted([
        RawLine(quantity="1", diameter="Ø30", depth="8"),
        RawLine(quantity="1", diameter="35", depth="10"),
        RawLine(quantity="2", diameter="30", depth="8,0"),
    ])
    assert [(l.quantity, l.diameter_cm, l.depth_m) for l in ex.lines] == [
        (3, 30, Decimal("8.00")), (1, 35, Decimal("10.00"))]

def test_quantity_parsing():
    # "" → 1; "30 estacas" → 30; "10x" → 10; "0", "1,5", "mil" → inválida com erro de quantidade
    ...

def test_invalid_lines_are_not_merged():
    ex = normalize_extracted([RawLine(quantity="1", diameter="30", depth="ilegível")] * 2)
    assert len(ex.lines) == 2 and not any(l.valid for l in ex.lines)

def test_merge_never_exceeds_999():
    ex = normalize_extracted([RawLine(quantity="600", diameter="30", depth="8")] * 2)
    assert [l.quantity for l in ex.lines] == [600, 600]
```
Escreva os quatro com asserts concretos. Para `test_quantity_parsing`, a mensagem de erro deve conter `"quantidade"`.

- [ ] **Step 2:** `uv run pytest <arquivo> -q`. Esperado: FAIL.

- [ ] **Step 3: Implementar.**
  - `_quantity(raw: str) -> int`: regex `^(\d+)\s*(?:x|un|estacas?)?$` (case-insensitive) depois do strip; vazio → 1; fora de 1–999 → `ValueError("quantidade não reconhecida (…)")`.
  - Agrupamento em `normalize_extracted`, depois do corte em `MAX_EXTRACTED_LINES`: percorre na ordem; uma linha válida soma na primeira linha válida já vista com o mesmo `(diameter_cm, depth_m)` se o total ficar ≤ 999; senão, entra como linha nova. Linhas inválidas entram sempre como linha nova, na posição em que aparecem.

- [ ] **Step 4: Prompt e extrator falso.**
  - O `PROMPT` pede, por linha: `quantity` (quantas estacas a linha representa, exatamente como escrito; "1" quando a folha lista uma estaca por linha), `diameter` e `depth`. Mantém "não calcule, não some". Tira `pile_code`.
  - O extrator falso devolve `RawLine(quantity="1", diameter="30", depth="8,5")`, `RawLine(quantity="1", diameter="30", depth="12,0")`, `RawLine(quantity="1", diameter="40", depth="ilegível")`. Ajuste `test_extractors.py` e `test_photos.py` ao novo formato (por exemplo, assert de `quantity` no lugar de `pile_code`).

- [ ] **Step 5:** `uv run pytest -q && uv run ruff check src tests migrations scripts`. Esperado: verde.

- [ ] **Step 6: Commit.** `feat(fotos): leitura da foto traz quantidade e agrupa estacas iguais`

---

### Task 3: Frontend — editor por grupos e formulário

**Files:**
- Modify: `frontend/src/lib/measurements.ts`
- Modify: `frontend/src/components/LinesEditor.tsx`
- Modify: `frontend/src/components/MeasurementForm.tsx` (`fromSource`, `fromExtracted`, `isBlank`, `problem`, `toPayload`, `flashSent`)
- Test: `frontend/tests/unit/measurements.test.ts`, `frontend/tests/unit/LinesEditor.test.tsx`, `frontend/tests/unit/drafts.test.ts`

**Interfaces:**
- Consumes: o JSON das Tasks 1 e 2.
- Produces:
  - `MeasurementLineIn = { quantity: number | null; diameter_cm: number | null; depth_m: string; pile_code?: string | null }`.
  - `MeasurementOut.lines: { quantity: number; diameter_cm: number; depth_m: string; pile_code: string | null }[]`; `MeasurementSummary.total_piles: number`.
  - `ExtractedLine = { quantity: number | null; diameter_cm; depth_m; valid; error }`.
  - `LineInput = { quantity: string; diameter_cm: string; depth_m: string; custom?: boolean; photo_error?: string; pile_code?: string | null }`. `pile_code` só é carregado, nunca editado.
  - `QUANTITY_MAX = 999` em `lib/measurements.ts`; `lineMeters(quantity: number, h: number) -> number` (centésimos).
  - Removidos: `pileKey`, `nextPileCode`.

- [ ] **Step 1: Testes que falham.**
  - `measurements.test.ts`: `sameContent` dá **false** quando só a quantidade difere e **true** com as mesmas linhas em outra ordem; uma linha do payload sem `quantity` (rascunho antigo) é comparada como 1.
  - `LinesEditor.test.tsx`: renderiza o cartão com rótulos "Qtd", "Diâmetro", "Profundidade (m)" e o título "Grupo 1". Qtd 30, Ø30, 8 → mostra `30 × 8 m = 240,00 m` no cartão e `Total: 30 estacas · 240,00 m`. `validateLines` dá erro `"Quantidade inválida (1 a 999)"` para `"0"`, `"1000"`, `"1,5"` e `"abc"`. "Adicionar grupo" cria um grupo com o diâmetro do anterior e a quantidade vazia. Uma linha sem quantidade deixa `complete=false`.
  - `drafts.test.ts` (ou o teste do `fromSource`, se ele for exportado): um rascunho com `lines: [{pile_code: "E-1", diameter_cm: 30, depth_m: "8"}]`, sem `quantity`, abre com `quantity: "1"` e preserva `pile_code: "E-1"` no payload.

- [ ] **Step 2:** `cd frontend && npm run test:unit`. Esperado: FAIL nesses testes.

- [ ] **Step 3: `lib/measurements.ts`.** Aplique os tipos acima. `lineSig` = `` `${l.quantity ?? 1}|${l.diameter_cm}|${toHundredths(l.depth_m)}` ``. `sameContent` retorna false se alguma linha tiver `quantity` fora de 1–999 (como já faz com diâmetro nulo). A comparação de `pile_code` sai.

- [ ] **Step 4: `LinesEditor`.**
  - O campo "Estaca" vira **"Qtd"**: `inputMode="numeric"`, só dígitos, máximo de 3.
  - "Linha N" vira **"Grupo N"** (inclusive no `aria-label` e nas mensagens "Remover grupo N" e "Grupo N removido").
  - O botão vira "Adicionar grupo".
  - `totals` soma `q` estacas e `q*h` centésimos.
  - Abaixo dos campos, o subtotal do cartão aparece só quando a linha é válida: `` `${q} × ${formatHundredths(h)} m = ${formatHundredthsGrouped(q*h)} m` ``.
  - `lineError` ganha a checagem de quantidade, primeiro de tudo, depois do `photo_error`.
  - Ao adicionar um grupo: `{quantity: "", diameter_cm: last.diameter_cm, custom: last.custom, depth_m: ""}`.
  - O layout continua com 3 colunas no desktop. No celular, Qtd e Diâmetro ficam lado a lado e a Profundidade vai para a linha de baixo (`col-span-2`), mantendo o `depthClass` grande.

- [ ] **Step 5: `MeasurementForm`.**
  - `fromSource` mapeia `quantity: String(l.quantity ?? 1)` e preserva `pile_code`.
  - `fromExtracted` usa `quantity: l.quantity == null ? "" : String(l.quantity)`.
  - `isBlank` passa a ser `quantity === "" && depth_m === ""`; o grupo inicial começa com `quantity: ""`.
  - `toPayload` envia `quantity: l.quantity === "" ? null : Number(l.quantity)` e `pile_code` só se existir.
  - A mensagem de `problem` passa a ser `"Preencha quantidade, diâmetro e profundidade em todos os grupos"`; a de linha inválida, `"Corrija os grupos destacados"`.
  - `flashSent` recebe `m.total_piles` no lugar de `values.lines.length`.

- [ ] **Step 6:** `npm run test:unit && npx tsc --noEmit && npm run lint`. Esperado: verde.

- [ ] **Step 7: Commit.** `feat(web): lançamento da medição por grupos de estacas`

---

### Task 4: Frontend — detalhe/listas e E2E

**Files:**
- Modify: `frontend/src/app/(app)/medicoes/[id]/page.tsx:194,246-285`
- Modify: o card de medição que usa `pilesLabel(m.lines.length)` (`grep -rn "lines.length" frontend/src/app`)
- Modify: `frontend/tests/e2e/helpers.ts`, `frontend/tests/e2e/medicoes.spec.ts`, `frontend/tests/e2e/foto.spec.ts`

**Interfaces:**
- Consumes: `MeasurementOut.total_piles`, `lines[].quantity`, `lines[].pile_code` da Task 3.

- [ ] **Step 1: Detalhe.**
  - Tabela com as colunas **Qtd · Diâmetro · Profundidade · Metros** (Metros = `formatMeters` de `quantity × depth`, calculado em centésimos).
  - Coluna **Estaca** à esquerda só quando alguma linha tiver `pile_code`.
  - A `key` da linha passa a ser o índice.
  - Kpi "Estacas" e "Total:" usam `m.total_piles`.
  - Os cards/listas que contavam `lines.length` passam a usar `total_piles`.

- [ ] **Step 2: E2E.**
  - Os helpers de preenchimento passam a preencher "Qtd" no lugar de "Estaca".
  - Em `medicoes.spec.ts`, cenário novo: lançar `30 × Ø30 × 8` e `10 × Ø35 × 10`, enviar e ver no detalhe `Total: 40 estacas` e `340,00 m`.
  - Ajuste os cenários de "estaca repetida" (remova-os).
  - Em `foto.spec.ts`, ajuste o que o extrator falso devolve: `Ø30 8,5` e `Ø30 12,0` continuam dois grupos (profundidades diferentes), mais a linha ilegível.

- [ ] **Step 3:** `docker compose up -d --build`, depois `cd frontend && npx playwright test && npm run build`. Esperado: verde nos três viewports (no iPhone/WebKit, falha por dependência do sistema já conhecida não conta; registre se acontecer).

- [ ] **Step 4: Commit.** `feat(web): detalhe da medição mostra grupos e total de estacas`
