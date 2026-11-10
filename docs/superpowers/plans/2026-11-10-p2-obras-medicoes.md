# P2 Obras + Medições — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cadastrar obras com tabela de preço contratada (snapshot), alocar perfuratrizes e operadores, e permitir que o operador lance medições pelo celular (digitação ou foto → IA extrai → revisão), com envio resiliente a sinal ruim e aprovação/rejeição pelo escritório.

**Architecture:** Segue o P1: `domain/` (regras puras: transições de status, validação de linhas, normalização de estaca), `application/` (casos de uso + portas `NotesExtractor` e `FileStorage`), `infrastructure/` (SQLAlchemy, Gemini, disco local/S3), `interfaces/http/`. Tabela de preço global é só sugestão: copiada para a obra na criação. Medição é idempotente por `client_key` (UUID gerado no aparelho), e o rascunho fica no `localStorage` até o servidor confirmar. A IA só devolve linhas sugeridas (strings); nada é gravado como medição sem confirmação humana.

**Tech Stack:** o do P1 + `google-genai` (SDK oficial do Gemini, versão estável mais recente no `uv add`), `boto3` (S3-compatível: Railway Bucket ou Cloudflare R2), `python-multipart` (upload), `moto[s3]` (dev, teste do adaptador S3).

**Spec:** `docs/superpowers/specs/2026-11-09-sistema-gestao-design.md` (§4 itens 3 e 4, §5, §8 conectividade). Plano anterior: `docs/superpowers/plans/2026-11-09-p1-fundacao.md` (padrões de arquivo, fixtures e contrato de erros).

## Global Constraints

- Dinheiro `Decimal`/`NUMERIC(14,2)`, `ROUND_HALF_UP`; metros `NUMERIC(10,2)`; JSON sempre string (`"12.50"`); nunca `float`.
- Entrada numérica aceita vírgula pt-BR (`"12,5"`) via `parse_decimal_br` (backend) e `toApiDecimal` (frontend).
- Banco **somente Alembic**; migrations novas começam em `0005`; toda migration tem `downgrade()`; `test_models_match_migrations` continua verde (índices funcionais/parciais declarados em `models.py`).
- Interface pt-BR; código, rotas, tabelas e campos em inglês. Papéis `admin`, `office`, `operator`.
- Fuso de negócio `America/Sao_Paulo`; `work_date`/`start_date` são `DATE`; timestamps `TIMESTAMPTZ` UTC.
- Viewports 360×780, 393×852, 1280×800; toque ≥44px; sem scroll horizontal.
- Segredos só via env (`SecretStr`); **todas as settings novas são opcionais** (testes, compose e CI atuais não podem quebrar).
- Camadas: `domain/` só stdlib + pydantic; `application/` nunca importa `infrastructure/` (Gemini e S3 só atrás de portas).
- A IA **só extrai**: o tipo de saída do extrator não tem campo de valor; nenhuma medição é criada pela extração.
- Commits em português `tipo(escopo): descrição`; ruff só em `backend/src backend/tests backend/migrations backend/scripts`.
- Next 16: ler `frontend/node_modules/next/dist/docs/` antes de mexer em convenções; o proxy é `src/proxy.ts`.

## Decisões tomadas (revisar antes de executar)

1. **Diâmetro fora da tabela contratada** não bloqueia o operador: envio é aceito; a **aprovação** falha com 409 `diameter_not_contracted` até o escritório incluir o diâmetro na tabela da obra. A tela de revisão destaca essas linhas.
2. **Limites das linhas** vêm da perfuratriz da medição: `25 ≤ diâmetro ≤ rig.max_diameter_cm` e `0 < profundidade ≤ rig.max_depth_m` (o 25–80 cm/22 m do site é comercial, não regra do sistema).
3. **Medição rejeitada** volta a ser editável pelo autor; editar move para `draft`; reenviar → `submitted`. Aprovada é imutável.
4. **Estaca única por obra** entre medições não rejeitadas, comparando por chave sem pontuação (`"E-12"` = `"e12"` = `"E 12"`) → 409 `duplicate_pile`.
5. **Operador não vê dinheiro**: `JobOut.prices` é `null` para `operator`; ele recebe só `contracted_diameters`.
6. **Obra só entra em execução** com ≥1 perfuratriz e ≥1 operador alocados; medição só em obra `in_progress`; obra só conclui sem medições `submitted` pendentes.
7. **Tabela global** semeada com `pricing.md`: 30/35/40 cm → 10,00; 50 → 14,00; 60 → 18,00; 70 → 30,00; mobilização 400,00; profundidade máx. tabelada 15,00 m; mínimo `null` (não definido).
8. **Fotos** ficam guardadas (auditoria) via `FileStorage`: disco local em dev/teste (volume no compose), S3-compatível em prod (o disco do Railway é efêmero). O front reduz a imagem para JPEG ≤2000 px antes de enviar; servidor aceita até 8 MB.

## Review Focus

1. **Reenvio com sinal ruim** — o `POST` chega ao servidor mas a resposta se perde; o operador toca "Reenviar" → mesma medição (200), nunca duplicada; rascunho sobrevive a recarregar a página → testes em Task 3 e Task 6.
2. **Estaca repetida com grafia diferente** — `"E-12"` numa medição e `"e12"` em outra da mesma obra → 409 `duplicate_pile`; se a primeira foi rejeitada, a segunda passa → Task 3.
3. **Operador não alocado acessando por URL/ID** — `GET /api/jobs/{id}`, `GET /api/measurements/{id}`, `POST /api/measurements` e upload de foto → 404 `not_found` (não vaza existência) → Tasks 2, 3 e 4.
4. **"Hoje" no fuso de SP** — às 23h30 em SP já é amanhã em UTC; `work_date` de hoje (SP) é aceito e amanhã é 422 `future_date`; o front sugere a data de SP → Task 3 (`today_sp`) e Task 6 (`todaySP`).
5. **Foto do iPhone / IA fora do ar** — HEIC ou foto de 6 MB vira JPEG reduzido no aparelho; se o Gemini falhar, a foto fica salva, o usuário vê "Não foi possível ler a foto" e digita as linhas → Tasks 4 e 7. Também: `crypto.randomUUID` não existe fora de contexto seguro (HTTP na rede local) → fallback em Task 6.

---

## File Structure

```
backend/
  migrations/versions/0005_price_table.py  0006_jobs.py  0007_measurements.py  0008_photos.py
  src/moura_gestao/
    domain/pricing.py        # PriceTable, PriceItem, validate_items
    domain/jobs.py           # Job, JobStatus, can_transition
    domain/measurements.py   # Measurement, MeasurementLine, MeasurementStatus, pile_key, totals
    domain/dates.py          # today_sp
    application/pricing.py  jobs.py  measurements.py  photos.py
    application/ports.py     # + PriceTableRepository, JobRepository, MeasurementRepository,
                             #   PhotoRepository, FileStorage, NotesExtractor
    infrastructure/storage.py     # LocalFileStorage, S3FileStorage
    infrastructure/extractors.py  # GeminiNotesExtractor, FakeNotesExtractor
    infrastructure/{config,models,repositories}.py      # modificados
    interfaces/http/routes/{price_table,jobs,measurements,photos,operators}.py
    interfaces/http/{errors,schemas,app,deps}.py       # modificados
  tests/factories.py  tests/domain/test_{jobs,measurements,dates}.py
  tests/http/test_{price_table,jobs,measurements,photos}.py  tests/test_storage.py
frontend/
  src/app/(app)/tabela-precos/page.tsx
  src/app/(app)/obras/{page.tsx,nova/page.tsx,[id]/page.tsx,[id]/medicoes/nova/page.tsx}
  src/app/(app)/medicoes/{page.tsx,[id]/page.tsx}
  src/components/{AddressFields,PriceTableEditor,JobForm,AllocationEditor,
                  MeasurementForm,LinesEditor,PhotoCapture,StatusBadge}.tsx
  src/lib/{money.ts,dates.ts,drafts.ts,image.ts,uuid.ts}
  tests/unit/{money,dates,drafts,uuid,LinesEditor}.test.ts(x)
  tests/e2e/{obras,medicoes,foto}.spec.ts
```

## API contract (P2)

Mesmas convenções do P1 (`{"detail","code"}`, `Page[T]`, `PageParams`).

| Método e rota | Papéis | Corpo / resposta |
|---|---|---|
| `GET/PUT /api/price-table` | admin, office | `PriceTableIO` |
| `GET /api/operators` | admin, office | `[{id, name}]` operadores ativos, ordem por nome |
| `GET /api/jobs?q=&status=&page=` | todos (operator: só alocadas) | `Page[JobSummary{id,name,customer_name,city,status,start_date}]` |
| `POST /api/jobs`, `PATCH /api/jobs/{id}` | admin, office | `JobIn` / `JobPatch` → `JobOut` |
| `GET /api/jobs/{id}` | todos (operator não alocado → 404) | `JobOut` |
| `PUT /api/jobs/{id}/prices` | admin, office | `PriceTableIO` → `JobOut` |
| `PUT /api/jobs/{id}/allocation` | admin, office | `{rig_ids:int[], operator_ids:int[]}` → `JobOut` |
| `GET /api/measurements?job_id=&status=&page=` | todos (operator: obras alocadas) | `Page[MeasurementSummary]` ordenado `work_date DESC, id DESC` |
| `POST /api/measurements` | todos (operator alocado) | `MeasurementIn` → 201 `MeasurementOut` (200 se `client_key` já existe do mesmo usuário) |
| `GET/PATCH/DELETE /api/measurements/{id}` | autor ou admin/office | PATCH/DELETE só em `draft`/`rejected` |
| `POST /api/measurements/{id}/submit` | autor ou admin/office | idempotente |
| `POST /api/measurements/{id}/approve` · `/reject {reason}` | admin, office | approve idempotente |
| `POST /api/jobs/{id}/photos` (multipart `file`) | quem pode medir na obra | 201 `{photo_id, extraction: Extraction|null, extraction_error: str|null}` |
| `POST /api/photos/{id}/extract` | idem | `Extraction` |
| `GET /api/photos/{id}` | quem vê a obra | bytes da imagem com `Content-Type` |

- `PriceTableIO`: `{mobilization_fee:"400.00", minimum_amount:"1500.00"|null, max_tabled_depth_m:"15.00", items:[{diameter_cm:int, price_per_m:"10.00"}]}`; itens ordenados por diâmetro, diâmetro 25–80 sem repetição (422), preço > 0.
- `JobIn`: `{name, customer_id, address: AddressIn (do P1), start_date?: date, notes?, prices?: PriceTableIO}` — sem `prices`, copia a tabela global.
- `JobOut`: `{id, name, customer:{id,name}, address, status, start_date, end_date, notes, prices: PriceTableIO|null, contracted_diameters:int[], rigs:[{id,name,max_diameter_cm,max_depth_m}], operators:[{id,name}], created_at}`.
- `JobPatch`: `{name?, address?, start_date?, end_date?, notes?, status?}`.
- `MeasurementIn`: `{client_key: uuid, job_id, rig_id, work_date: date, lines:[{pile_code, diameter_cm:int, depth_m:str}] (1..200), notes?, photo_id?: uuid, submit?: bool=false}`. `MeasurementPatch`: `{rig_id?, work_date?, lines?, notes?}`.
- `MeasurementOut`: `{id, client_key, job:{id,name}, rig:{id,name}, work_date, status, lines:[{pile_code, diameter_cm, depth_m:"12.50"}], total_m:"20.50", totals_by_diameter:[{diameter_cm, piles:int, meters:"…"}], uncontracted_diameters:int[], created_by:{id,name}, submitted_at, reviewed_by:{id,name}|null, reviewed_at, rejection_reason, photo_id, notes}`. `MeasurementSummary` = sem `lines`.
- `Extraction`: `{lines:[{pile_code:str, diameter_cm:int|null, depth_m:str|null, valid:bool, error:str|null}], warnings:str[]}`.
- Códigos novos e status HTTP (mapeados **explicitamente** em `errors.py`): 409 → `invalid_status_transition`, `job_not_ready`, `job_locked`, `job_not_in_progress`, `rig_not_allocated`, `rig_unavailable`, `invalid_operator`, `measurement_locked`, `diameter_not_contracted`, `pending_measurements`, `duplicate_pile`, `duplicate_client_key`; 422 → `line_exceeds_rig`, `future_date`; 413 `file_too_large`; 415 `unsupported_media_type`; 502 `extraction_failed`; 503 `extraction_unavailable`.

---

### Task 1: Tabela de preços global, mapa de erros e fixture multiusuário

**Files:**
- Create: `backend/src/moura_gestao/domain/pricing.py`, `application/pricing.py`, `infrastructure/pricing_seed.py`, `interfaces/http/routes/price_table.py`, `migrations/versions/0005_price_table.py`, `backend/tests/factories.py`
- Modify: `infrastructure/models.py`, `infrastructure/repositories.py`, `application/ports.py`, `interfaces/http/{schemas,errors,app}.py`, `backend/tests/conftest.py`
- Test: `backend/tests/http/test_price_table.py`, `backend/tests/http/test_errors.py`

**Interfaces:**
- Produces:
  - `PriceItem(diameter_cm: int, price_per_m: Decimal)`, `PriceTable(mobilization_fee: Decimal, minimum_amount: Decimal | None, max_tabled_depth_m: Decimal, items: list[PriceItem])` (dataclasses). `validate_items(items) -> list[PriceItem]` ordena e levanta `ValueError` em diâmetro repetido/fora de 25–80 ou preço ≤ 0.
  - Tabelas: `price_table` (linha única `id=1` com CHECK `id = 1`; `mobilization_fee NUMERIC(14,2)`, `minimum_amount NUMERIC(14,2) NULL`, `max_tabled_depth_m NUMERIC(10,2)`, `updated_at`) e `price_table_items` (`diameter_cm` PK int, `price_per_m NUMERIC(14,2)`). `0005` cria e **insere a semente** da Decisão 7 (`downgrade` dropa).
  - `PriceTableRepository` Protocol: `get() -> PriceTable`, `replace(table: PriceTable) -> PriceTable`. Casos de uso `get_price_table`, `replace_price_table`.
  - Schema `PriceTableIO` (pydantic) reutilizado pelas Tasks 2 e 5: valores de dinheiro aceitam `"10,5"` e saem `"10.50"` (padrão do `Depth` do P1, com `quantize_money`).
  - `errors.py`: `STATUS` passa a conter todos os códigos da seção "Códigos novos" com seu status; `status_for` mantém o fallback `duplicate_*`→409 e 400 para desconhecido.
  - Fixture `login_user(email: str, role: str) -> tuple[AsyncClient, int]` (cria usuário com e-mail dado e devolve client logado + `user_id`); `login_as` passa a delegar para ela.
  - `tests/factories.py`: `async def make_customer(client) -> int`, `make_rig(client, **over) -> int` (default `max_diameter_cm=80`, `max_depth_m="22"`), usados nas Tasks 2–4.

- [ ] **Step 1: Write failing tests** (`test_price_table.py`):
  - `test_seeded_table_matches_pricing_md`: office `GET` → `mobilization_fee=="400.00"`, `minimum_amount is None`, `max_tabled_depth_m=="15.00"`, itens `[(30,"10.00"),(35,"10.00"),(40,"10.00"),(50,"14.00"),(60,"18.00"),(70,"30.00")]`. (O TRUNCATE do conftest apagaria a semente: a constante `SEED` e a função `seed_price_table(conn)` ficam em `infrastructure/pricing_seed.py`, usadas pela migration `0005` **e** pelo conftest, que reaplica a semente após cada TRUNCATE. `seed_price_table` usa `sa.table()`/`sa.text`, **nunca** os modelos ORM — senão uma coluna futura em `models.py` quebra a `0005` num banco novo.)
  - `test_put_replaces_with_comma_values`: `PUT` com `{"mobilization_fee":"450,00","minimum_amount":"1.500,00","max_tabled_depth_m":"15","items":[{"diameter_cm":80,"price_per_m":"45,5"},{"diameter_cm":25,"price_per_m":"9"}]}` → 200, itens ordenados `[25, 80]`, `"45.50"`, `minimum_amount=="1500.00"`.
  - `test_duplicate_or_out_of_range_diameter_422`: diâmetros `[30, 30]` → 422; `[90]` → 422; preço `"0"` → 422.
  - `test_operator_forbidden_403`.
- [ ] **Step 2: Write failing test** `test_errors.py::test_new_codes_have_explicit_status`: para cada par da seção de códigos, `status_for(code) == status`.
- [ ] **Step 3:** Run `cd backend && uv run pytest tests/http/test_price_table.py tests/http/test_errors.py -q` → FAIL.
- [ ] **Step 4:** Implement (autogenerate `0005`, revisar, acrescentar a semente com `op.bulk_insert`).
- [ ] **Step 5:** Run `uv run pytest -q` → PASS (inclui `test_models_match_migrations` e `test_upgrade_downgrade_roundtrip`); `uv run ruff check src tests migrations scripts` limpo.
- [ ] **Step 6: Commit** `feat(precos): tabela de preços global semeada e mapa de erros do P2`

### Task 2: Obras — cadastro, snapshot de preços, alocação e status

**Files:**
- Create: `domain/jobs.py`, `application/jobs.py`, `interfaces/http/routes/{jobs,operators}.py`, `migrations/versions/0006_jobs.py`
- Modify: `models.py`, `repositories.py` (+ `SqlUserRepository.list_active_operators()`), `ports.py`, `schemas.py`, `app.py`
- Test: `backend/tests/domain/test_jobs.py`, `backend/tests/http/test_jobs.py`

**Interfaces:**
- Consumes: `PriceTable`, `PriceTableIO`, `AddressIn`/`AddressOut` do P1, `DrillRigRepository`, `login_user`, factories.
- Produces:
  - `JobStatus(StrEnum)`: `PLANNED="planned"`, `IN_PROGRESS="in_progress"`, `COMPLETED="completed"`, `CANCELLED="cancelled"`. `can_transition(src, dst) -> bool` — permitidas: planned→in_progress, planned→cancelled, in_progress→completed, in_progress→cancelled.
  - Tabelas: `jobs` (`id`, `name` varchar(160), `customer_id` FK, colunas de endereço iguais às de `customers`, `status` varchar(12) CHECK, `start_date`/`end_date` DATE null, `mobilization_fee`, `minimum_amount` null, `max_tabled_depth_m`, `notes`, `created_at`, `updated_at`); `job_prices` (PK `job_id`+`diameter_cm`, `price_per_m`, FK `ON DELETE CASCADE`); `job_rigs` (PK `job_id`+`rig_id`); `job_operators` (PK `job_id`+`user_id`).
  - `JobRepository` Protocol: `add(job) -> Job`, `get(job_id) -> Job | None`, `update(job) -> Job`, `list(params, status, operator_id: int | None) -> Page[JobSummary]`, `set_prices(job_id, PriceTable)`, `set_allocation(job_id, rig_ids, operator_ids)`, `is_operator_allocated(job_id, user_id) -> bool`.
  - Caso de uso `get_job_for(user: User, job_id) -> Job` — operador não alocado → `NotFound` (usado também nas Tasks 3 e 4).
  - Regras: `PATCH status` inválido → `invalid_status_transition`; →`in_progress` sem rig ou operador → `job_not_ready` (a regra `pending_measurements` ao concluir entra na Task 3). `PUT prices` em obra `completed`/`cancelled` → `job_locked`. Alocação: rig não `active` → `rig_unavailable`; usuário inexistente, inativo ou não `operator` → `invalid_operator`. `end_date < start_date` → 422.

- [ ] **Step 1: Write failing tests** (`test_jobs.py` domínio): tabela verdade de `can_transition` (as 4 permitidas `True`; `completed→in_progress`, `cancelled→planned`, `planned→completed` `False`).
- [ ] **Step 2: Write failing tests** (`test_jobs.py` http):
  - `test_create_job_snapshots_global_table`: cria obra sem `prices` → `prices` igual à global; depois `PUT /api/price-table` mudando 30 cm para `"99.00"` → `GET` da obra ainda mostra `"10.00"`.
  - `test_create_job_with_custom_prices`: `prices.items=[{"diameter_cm":45,"price_per_m":"12,5"}]` → `contracted_diameters==[45]`, `"12.50"`.
  - `test_status_flow`: planned→in_progress sem alocação → 409 `job_not_ready`; aloca 1 rig + 1 operador → 200; →planned → 409 `invalid_status_transition`.
  - `test_allocation_rules`: rig `maintenance` → 409 `rig_unavailable`; user `office` como operador → 409 `invalid_operator`.
  - `test_prices_locked_after_completion`: obra `completed` → `PUT prices` → 409 `job_locked`.
  - `test_operator_sees_only_allocated_jobs_without_prices`: operadores A (alocado) e B (não) via `login_user`; A lista 1 obra e `GET` traz `prices is None` e `contracted_diameters` preenchido; B lista 0 e `GET /api/jobs/{id}` → 404.
  - `test_operator_cannot_create_job_403`; `test_search_by_name_and_customer`; `test_filter_by_status`.
  - `test_operators_endpoint_lists_active_operators_only`.
- [ ] **Step 3:** Run `uv run pytest tests/domain/test_jobs.py tests/http/test_jobs.py -q` → FAIL.
- [ ] **Step 4:** Implement (autogenerate `0006`, revisar).
- [ ] **Step 5:** Run `uv run pytest -q` → PASS; ruff limpo.
- [ ] **Step 6: Commit** `feat(obras): obras com tabela contratada, alocação e status`

### Task 3: Medições — lançamento idempotente, envio, aprovação e rejeição

**Files:**
- Create: `domain/measurements.py`, `domain/dates.py`, `application/measurements.py`, `interfaces/http/routes/measurements.py`, `migrations/versions/0007_measurements.py`
- Modify: `models.py`, `repositories.py`, `ports.py`, `schemas.py`, `app.py`, `application/jobs.py` (regra `pending_measurements`)
- Test: `backend/tests/domain/test_measurements.py`, `backend/tests/domain/test_dates.py`, `backend/tests/http/test_measurements.py`

**Interfaces:**
- Consumes: `get_job_for`, `JobRepository`, `DrillRigRepository`, `parse_decimal_br`, `quantize_measure`.
- Produces:
  - `MeasurementStatus(StrEnum)` `draft|submitted|approved|rejected`. `MeasurementLine(pile_code: str, diameter_cm: int, depth_m: Decimal)`. `normalize_pile_code(raw) -> str` (strip, upper, espaços internos colapsados; vazio → `ValueError`; máx. 20). `pile_key(code) -> str` (só `[A-Z0-9]`). `totals_by_diameter(lines) -> list[tuple[int, int, Decimal]]`.
  - `today_sp(now: datetime) -> date` — converte `now` (aware) para `ZoneInfo("America/Sao_Paulo")`.
  - Tabelas: `measurements` (`id`, `client_key` UUID **único**, `job_id` FK, `rig_id` FK, `work_date` DATE, `status` varchar(12) CHECK, `created_by` FK users, `submitted_at`, `reviewed_by` FK null, `reviewed_at`, `rejection_reason` text, `notes`, `created_at`, `updated_at`; índice `(job_id, status)`); `measurement_lines` (`id`, `measurement_id` FK CASCADE, `position` int, `pile_code` varchar(20), `diameter_cm` int CHECK 20–120, `depth_m NUMERIC(10,2)` CHECK > 0).
  - `MeasurementRepository` Protocol: `add`, `get`, `get_by_client_key`, `update` (substitui linhas), `delete`, `list(params, job_id, status, operator_id)`, `pile_keys_in_job(job_id, exclude_id) -> dict[str, str]` (chave → código já gravado, só `status != rejected`), `count_by_status(job_id, status) -> int`.
  - Regras em `application/measurements.py` (todas com `user: User` e `now: datetime`):
    - criar/editar: obra visível (`get_job_for`) e `in_progress` (`job_not_in_progress`); rig alocado na obra (`rig_not_allocated`); cada linha dentro dos limites do rig (`line_exceeds_rig`, `detail` cita a estaca); estaca repetida na própria medição → 422 `validation_error`; colisão de `pile_key` com outra medição → `duplicate_pile` (`detail` lista os códigos); `work_date > today_sp(now)` → `future_date`.
    - `client_key` existente (**upsert**, HTTP 200): mesmo autor e status `draft`/`rejected` → aplica o payload como edição (e envia se `submit=True`); mesmo autor e `submitted`/`approved` → devolve a existente sem alterar; outro autor → `duplicate_client_key`. Assim o aparelho sempre faz `POST` com o mesmo `client_key` e nunca precisa do `id`.
    - `submit=True` na criação = criar + enviar na mesma transação.
    - editar/excluir só `draft`/`rejected` (`measurement_locked`) e só autor ou admin/office (outro operador alocado → 403 `forbidden`; não alocado → 404); editar `rejected` → `draft` e limpa `rejection_reason`.
    - `submit`: `draft|rejected → submitted` (grava `submitted_at`); já `submitted` → devolve igual; `approved` → `measurement_locked`.
    - `approve` (admin/office): `submitted → approved`; já `approved` → igual; qualquer diâmetro fora de `contracted_diameters` → `diameter_not_contracted`.
    - `reject(reason: 3..500 chars)`: `submitted → rejected`.
  - Rota injeta `now = datetime.now(UTC)`; `POST` responde 201 na criação e 200 no replay.

- [ ] **Step 1: Write failing tests** (domínio):
  - `test_pile_key_ignores_punctuation_and_case`: `pile_key("E-12") == pile_key(" e 12 ") == "E12"`; `normalize_pile_code("  e-12 ") == "E-12"`; `normalize_pile_code("")` levanta.
  - `test_totals_by_diameter`: linhas `(E1,30,"8.50")`, `(E2,30,"12.00")`, `(E3,40,"10.25")` → `[(30,2,Decimal("20.50")),(40,1,Decimal("10.25"))]`.
  - `test_today_sp_late_night`: `today_sp(datetime(2026,11,11,2,30,tzinfo=UTC)) == date(2026,11,10)`.
- [ ] **Step 2: Write failing tests** (`test_measurements.py`; fixture local cria obra `in_progress` com rig 80 cm/22 m, tabela 30/40 cm e operadores A alocado e B não):
  - `test_operator_creates_draft_with_comma_depth`: linha `{"pile_code":"e-1","diameter_cm":30,"depth_m":"8,5"}` → 201, `status=="draft"`, `pile_code=="E-1"`, `depth_m=="8.50"`, `total_m=="8.50"`.
  - `test_replay_same_client_key_returns_same`: dois `POST` idênticos com `submit:true` → 201 e 200, mesmo `id`; `GET ?job_id=` → `total==1`. Mesmo `client_key` por outro usuário → 409 `duplicate_client_key`.
  - `test_upsert_draft_then_submit_same_key`: `POST` draft com 1 linha; `POST` mesmo `client_key` com 2 linhas e `submit:true` → 200, `status=="submitted"`, 2 linhas.
  - `test_other_allocated_operator_cannot_edit_403`: operador C também alocado vê (`GET` 200) a medição de A, mas PATCH/DELETE → 403 `forbidden`.
  - `test_duplicate_pile_across_measurements`: medição 1 com `"E-12"`; medição 2 com `"e12"` → 409 `duplicate_pile`; rejeita a 1 → medição 2 passa.
  - `test_duplicate_pile_inside_same_measurement_422`.
  - `test_line_exceeds_rig_limits_422`: diâmetro 90 ou profundidade `"22,5"` → 422 `line_exceeds_rig`.
  - `test_rig_not_allocated_409`; `test_job_not_in_progress_409` (obra `planned`).
  - `test_future_date_422`: `work_date = today_sp(now)+1 dia` → 422 `future_date`; hoje → 201.
  - `test_unallocated_operator_gets_404`: B faz `GET /api/measurements/{id}` e `POST` na obra → 404; B lista → 0 itens.
  - `test_submit_idempotent_and_locks`: submit duas vezes → 200 e `submitted_at` igual; PATCH depois → 409 `measurement_locked`.
  - `test_approve_requires_contracted_diameter`: linha de 50 cm enviada → `uncontracted_diameters==[50]`; approve → 409 `diameter_not_contracted`; office inclui 50 cm em `PUT /api/jobs/{id}/prices` → approve 200; approve de novo → 200; PATCH/DELETE → 409.
  - `test_reject_then_edit_returns_to_draft`: reject `{"reason":"Profundidade da E-3 ilegível"}` → `rejected`; autor PATCH → `draft`, `rejection_reason is None`; submit → `submitted`. Reject com `reason=""` → 422.
  - `test_operator_cannot_approve_403`.
  - `test_complete_job_with_pending_measurement_409`: medição `submitted` → `PATCH /api/jobs/{id}` `status=completed` → 409 `pending_measurements`.
- [ ] **Step 3:** Run `uv run pytest tests/domain tests/http/test_measurements.py -q` → FAIL.
- [ ] **Step 4:** Implement (autogenerate `0007`, revisar).
- [ ] **Step 5:** Run `uv run pytest -q` → PASS; ruff limpo.
- [ ] **Step 6: Commit** `feat(medicoes): diário de perfuração com envio idempotente e aprovação`

### Task 4: Fotos, storage e extração por IA (Gemini)

**Files:**
- Create: `application/photos.py`, `infrastructure/storage.py`, `infrastructure/extractors.py`, `interfaces/http/routes/photos.py`, `migrations/versions/0008_photos.py`
- Modify: `ports.py`, `config.py`, `models.py` (`measurements.photo_id` FK null), `repositories.py`, `schemas.py` (`MeasurementIn.photo_id`), `application/measurements.py` (photo precisa ser da mesma obra → 422), `app.py`, `deps.py` (`get_storage`, `get_extractor`), `pyproject.toml`, `.env.example`, `docker-compose.yml` (volume `uploads` em `/app/var/uploads` no serviço `api`), `AGENTS.md` (variáveis de deploy)
- Test: `backend/tests/http/test_photos.py`, `backend/tests/test_storage.py`, `backend/tests/test_settings.py`

**Interfaces:**
- Consumes: `get_job_for`, `parse_decimal_br`, `normalize_pile_code`.
- Produces:
  - Settings novas (todas opcionais): `notes_extractor: Literal["gemini","fake"] = "gemini"`, `gemini_api_key: SecretStr | None = None`, `gemini_model: str = "gemini-3.5-flash-lite"`, `extraction_timeout_s: int = 30`, `storage_backend: Literal["local","s3"] = "local"`, `storage_local_dir: str = "var/uploads"`, `s3_endpoint_url`, `s3_bucket`, `s3_region: str = "auto"`, `s3_access_key_id: str | None`, `s3_secret_access_key: SecretStr | None`, `max_upload_mb: int = 8`. Validator: `environment="prod"` exige `storage_backend="s3"` com bucket e credenciais.
  - `FileStorage` Protocol: `async put(key: str, data: bytes, content_type: str) -> None`, `async get(key: str) -> bytes`. `LocalFileStorage(base_dir)` (recusa `..` na chave); `S3FileStorage(...)` com `boto3` em `asyncio.to_thread`.
  - `RawLine(pile_code: str, diameter: str, depth: str)` (pydantic, só strings — nenhum campo de valor). `NotesExtractor` Protocol: `async extract(image: bytes, content_type: str) -> list[RawLine]`; erro/timeout → `DomainError(code="extraction_failed")`.
  - `GeminiNotesExtractor(api_key, model, timeout_s)`: `google-genai` com cliente assíncrono, imagem como parte inline e **saída estruturada** (schema = lista de `RawLine`); prompt pt-BR: extrair só identificador da estaca, diâmetro (cm) e profundidade (m) como escritos, sem calcular, sem inventar linhas ilegíveis. **Consulte a documentação da versão instalada do `google-genai`** para a chamada de imagem + `response_schema`; não copie de memória. Sem `gemini_api_key` → `DomainError(code="extraction_unavailable")`.
  - `FakeNotesExtractor` (para e2e/CI): devolve sempre `[("E-1","30","8,5"), ("E-2","30","12,0"), ("E-3","40","ilegível")]`.
  - `normalize_extracted(raw: list[RawLine]) -> Extraction` (application): diâmetro aceita `"Ø40"`, `"40cm"`, `"40 cm"` → 40; profundidade via `parse_decimal_br`; falha numa linha → `valid=False` com `error` pt-BR e as outras seguem; >200 linhas → trunca e adiciona warning.
  - Tabela `photos` (`id` UUID PK, `job_id` FK, `uploaded_by` FK, `storage_key`, `content_type`, `size_bytes`, `created_at`). Chave `photos/{job_id}/{uuid}.{ext}`.
  - `upload_photo(...)`: tipos `image/jpeg|png|webp|heic|heif` (senão `unsupported_media_type`), tamanho > `max_upload_mb` → `file_too_large` (ler em blocos e parar ao passar do limite). Grava foto, depois extrai; falha de extração **não** desfaz a foto: resposta 201 com `extraction=null` e `extraction_error=<code>`.

- [ ] **Step 1: Write failing tests** (`test_storage.py`): `LocalFileStorage` put/get em `tmp_path` e rejeição de `"../x"`; `S3FileStorage` put/get com `moto` (`mock_aws`).
- [ ] **Step 2: Write failing tests** (`test_settings.py`): settings do P1 continuam válidas sem as novas variáveis; `environment="prod"` com `storage_backend="local"` → `ValidationError`.
- [ ] **Step 3: Write failing tests** (`test_photos.py`; override de `get_storage` → `LocalFileStorage(tmp_path)` e `get_extractor` → fakes):
  - `test_upload_and_extract_with_fake`: JPEG pequeno → 201; 3 linhas, `E-3` `valid==False`; `depth_m` da E-1 `=="8.50"`; nenhuma medição criada (`GET /api/measurements` → 0).
  - `test_extraction_failure_keeps_photo`: extractor que levanta `extraction_failed` → 201, `extraction is None`, `extraction_error=="extraction_failed"`; `POST /api/photos/{id}/extract` com fake bom → 200.
  - `test_missing_api_key_503`: `GeminiNotesExtractor(api_key=None, ...)` → `extraction_error=="extraction_unavailable"` no upload e 503 no `/extract`.
  - `test_rejects_pdf_415` e `test_rejects_oversized_413` (`max_upload_mb=1`, 2 MB).
  - `test_unallocated_operator_404` (upload, extract e GET da foto).
  - `test_get_photo_returns_bytes_and_type`.
  - `test_measurement_with_photo_from_other_job_422`.
  - `test_normalize_extracted_variants`: `"Ø40"`, `"40cm"` → 40; `"12,5"` → `"12.50"`; `"abc"` → `valid False`.
- [ ] **Step 4:** Run `uv run pytest tests/test_storage.py tests/test_settings.py tests/http/test_photos.py -q` → FAIL.
- [ ] **Step 5:** `uv add google-genai boto3 python-multipart` e `uv add --dev "moto[s3]"`; implement (autogenerate `0008`, revisar). Atualizar `.env.example`, compose e a seção Deploy do `AGENTS.md` (`GEMINI_API_KEY`, `GEMINI_MODEL`, `STORAGE_BACKEND=s3`, `S3_*`).
- [ ] **Step 6:** Run `uv run pytest -q` → PASS; ruff limpo.
- [ ] **Step 7 (manual, opcional):** com `GEMINI_API_KEY` real, `curl -F file=@foto-anotacao.jpg` contra a API local → linhas coerentes. Registrar resultado no commit.
- [ ] **Step 8: Commit** `feat(medicoes): upload de foto com extração por IA atrás de portas`
- [ ] **Step 9 (manual, com o usuário, ANTES de fazer deploy deste commit):** o validator de prod exige S3 — sem isso o healthcheck do Railway falha. Criar o bucket (Railway Bucket ou R2), definir `STORAGE_BACKEND=s3`, `S3_ENDPOINT_URL`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` e `GEMINI_API_KEY` no serviço da API; só então fazer o deploy.

### Task 5: Frontend — tabela de preços e obras

**Files:**
- Create: `src/app/(app)/tabela-precos/page.tsx`, `src/app/(app)/obras/{page.tsx,nova/page.tsx,[id]/page.tsx}`, `src/components/{AddressFields,PriceTableEditor,JobForm,AllocationEditor,StatusBadge}.tsx`, `src/lib/money.ts`
- Modify: `src/components/CustomerForm.tsx` (extrair `AddressFields` com ViaCEP — mesmo comportamento, e2e de clientes continua verde), `src/components/NavItems.ts`, `src/lib/errors.ts`, `src/lib/schemas.ts`
- Test: `tests/unit/{money.test.ts,NavItems.test.ts}`, `tests/e2e/obras.spec.ts`

**Interfaces:**
- Consumes: contrato P2; `DataList`, `DecimalInput`, `Field`, `api`, `messageFor`, `useMe`.
- Produces:
  - `formatMoneyBR(s: string) -> string` (`"1234.5"` → `"R$ 1.234,50"`).
  - `NAV_ITEMS` ganha, nesta ordem após Início: Obras `/obras` (todos), Medições `/medicoes` (todos), Tabela de preços `/tabela-precos` (admin, office).
  - `errors.ts`: mensagem pt-BR para cada código novo (ex.: `job_not_ready` → "Aloque ao menos uma perfuratriz e um operador antes de iniciar a obra", `duplicate_pile` → "Estaca já lançada nesta obra", `diameter_not_contracted` → "Há diâmetros fora da tabela contratada da obra", `future_date` → "A data não pode ser futura", `extraction_failed` → "Não foi possível ler a foto. Digite as linhas.").
  - `StatusBadge({kind: "job"|"measurement", status})` com rótulos: Planejada, Em execução, Concluída, Cancelada; Rascunho, Enviada, Aprovada, Rejeitada.
  - Detalhe da obra: seções Dados, Tabela contratada (oculta para operador; editável por office enquanto não `completed`/`cancelled`), Alocação (`GET /api/drill-rigs?status=active` + `GET /api/operators`), ações de status (botões só para transições válidas) e atalho "Lançar medição" (só `in_progress`).

- [ ] **Step 1: Write failing unit tests:** `formatMoneyBR("1234.5") === "R$ 1.234,50"`, `formatMoneyBR("0") === "R$ 0,00"`; `navFor("operator")` contém "Obras" e "Medições" e não "Tabela de preços"; `navFor("office")` contém os três.
- [ ] **Step 2: Write failing e2e** (`obras.spec.ts`; criar cliente/rig/operador via API nos helpers — acrescentar `createCustomer`, `createRig`, `createJob` a `helpers.ts`):
  - office edita a tabela de preços (40 cm → `"11,5"`) e vê `R$ 11,50` após recarregar.
  - office cria obra para um cliente, vê a tabela contratada copiada; tenta "Iniciar obra" sem alocação → mensagem de `job_not_ready`; aloca rig + operador; inicia → badge "Em execução".
  - operador alocado vê a obra na lista, abre o detalhe e **não** vê "Tabela contratada" nem valores `R$`; acessar `/obras/<id de obra não alocada>` mostra "Registro não encontrado".
  - sem scroll horizontal no detalhe da obra (asserção do P1).
- [ ] **Step 3:** Run `npm run test:unit` e `npx playwright test tests/e2e/obras.spec.ts --project=desktop` → FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run `npm run test:unit`, `npx playwright test` (3 projetos, inclui clientes após a extração de `AddressFields`), `npm run lint`, `npm run build` → PASS.
- [ ] **Step 6: Commit** `feat(web): tabela de preços e telas de obras`

### Task 6: Frontend — lançamento por digitação, rascunho local, fila de aprovação

**Files:**
- Create: `src/app/(app)/obras/[id]/medicoes/nova/page.tsx`, `src/app/(app)/medicoes/{page.tsx,[id]/page.tsx}`, `src/components/{MeasurementForm,LinesEditor}.tsx`, `src/lib/{drafts.ts,dates.ts,uuid.ts}`
- Test: `tests/unit/{drafts,dates,uuid,LinesEditor}.test.ts(x)`, `tests/e2e/medicoes.spec.ts`

**Interfaces:**
- Consumes: `MeasurementIn/Out`, `JobOut.contracted_diameters`, `JobOut.rigs`, `DecimalInput`, `StatusBadge`, `messageFor`.
- Produces:
  - `newUuid(): string` — `crypto.randomUUID` se existir, senão v4 a partir de `crypto.getRandomValues`.
  - `todaySP(now?: Date): string` (`YYYY-MM-DD` via `Intl.DateTimeFormat("en-CA", {timeZone: "America/Sao_Paulo"})`).
  - `drafts.ts`: `saveDraft(d: MeasurementDraft)`, `loadDraft(clientKey) -> MeasurementDraft | null`, `listDrafts(jobId?) -> MeasurementDraft[]`, `clearDraft(clientKey)`; chave `mg_draft:<client_key>`; `MeasurementDraft = MeasurementIn & {saved_at: string}`; todas as operações em `try/catch` (localStorage pode falhar).
  - `LinesEditor({lines, onChange, diameters, rig})`: linha = código da estaca, diâmetro (`<select>` com `contracted_diameters` + "Outro" numérico), profundidade (`DecimalInput`); botão "Adicionar estaca" (≥44px) que sugere o próximo código (`E-12` → `E-13`); rodapé com total de estacas e metros por diâmetro; erros locais: estaca repetida (por `pile_key` igual ao backend), fora dos limites do rig.
  - `MeasurementForm`: gera `client_key` uma vez por medição nova; reabrir um rascunho (`/obras/[id]/medicoes/nova?rascunho=<client_key>`) **reusa** o `client_key` dele. Autosave do rascunho a cada mudança; "Salvar rascunho" e "Enviar" sempre fazem `POST /api/measurements` com o mesmo `client_key` (`submit:false|true`, upsert da Task 3). Falha de rede (`TypeError` do `fetch`) → aviso "Sem conexão — a medição ficou salva neste aparelho" + botão "Reenviar" (reusa o mesmo `client_key`); sucesso → `clearDraft` e vai para `/medicoes/<id>`. A tela da obra lista "Rascunhos neste aparelho" (`listDrafts(jobId)`).
  - `/medicoes`: filtro por status (office/admin abre em "Enviadas" = fila de aprovação; operador em "Todas"); `/medicoes/[id]`: linhas, totais por diâmetro, linhas com diâmetro em `uncontracted_diameters` destacadas, foto (se houver, `<img src="/api/photos/<id>">`), ações Aprovar / Rejeitar (motivo obrigatório) para office, Editar/Reenviar para o autor quando `draft`/`rejected`, motivo da rejeição visível.

- [ ] **Step 1: Write failing unit tests:**
  - `todaySP(new Date("2026-11-11T02:30:00Z")) === "2026-11-10"`.
  - `newUuid()` casa `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/` com `crypto.randomUUID` removido.
  - `drafts`: save/load/list por obra/clear; com `localStorage.setItem` lançando, `saveDraft` não lança.
  - `LinesEditor`: "Adicionar estaca" após `E-12` sugere `E-13`; `"e12"` depois de `"E-12"` mostra "Estaca repetida"; profundidade `"23"` com rig de 22 m mostra erro; total `"8,5"` + `"12"` exibe `20,50 m`.
- [ ] **Step 2: Write failing e2e** (`medicoes.spec.ts`; obra `in_progress` criada via API com operador alocado):
  - operador lança 2 estacas com `"8,5"` e `"12"`, envia → detalhe "Enviada", total `20,50 m`.
  - **reenvio**: `page.route("**/api/measurements", r => r.abort())` no primeiro envio → aviso de sem conexão; recarrega a página → rascunho listado em "Rascunhos neste aparelho"; remove o route, abre o rascunho, "Reenviar" → "Enviada"; via API, a obra tem exatamente 1 medição.
  - **resposta perdida**: route que deixa o request seguir (`route.fetch()`) e depois `route.abort()` → "Reenviar" → mesma medição (via API, 1 medição).
  - office abre `/medicoes` (fila "Enviadas"), rejeita com motivo; operador vê o motivo, edita, reenvia; office aprova → "Aprovada" e sem botões de edição.
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run `npm run test:unit`, `npx playwright test` (3 projetos), `npm run lint`, `npm run build` → PASS.
- [ ] **Step 6: Commit** `feat(web): lançamento de medições com rascunho local e aprovação`

### Task 7: Frontend — medição por foto (câmera → IA → revisão)

**Files:**
- Create: `src/components/PhotoCapture.tsx`, `src/lib/image.ts`, `tests/e2e/foto.spec.ts`, `tests/e2e/fixtures/anotacao.jpg` (imagem pequena qualquer)
- Modify: `src/lib/api.ts` (não definir `content-type` quando `body instanceof FormData`), `src/components/MeasurementForm.tsx`, `playwright.config.ts` (`webServer[0].env`: `NOTES_EXTRACTOR=fake`, `STORAGE_LOCAL_DIR` em diretório temporário), `.github/workflows/ci.yml` (mesmas variáveis no job e2e)
- Test: `tests/unit/api.test.ts` (FormData), `tests/e2e/foto.spec.ts`

**Interfaces:**
- Consumes: `POST /api/jobs/{id}/photos`, `POST /api/photos/{id}/extract`, `Extraction`, `LinesEditor`, `MeasurementForm`.
- Produces:
  - `downscaleToJpeg(file: Blob, maxSide = 2000, quality = 0.8): Promise<Blob>` — `createImageBitmap` + canvas (`OffscreenCanvas` se houver); se a decodificação falhar (ex.: HEIC no Chrome), devolve o arquivo original.
  - `PhotoCapture({jobId, onExtracted(photoId, extraction), onError(code)})`: `<input type="file" accept="image/*">` **sem `capture`** (iOS/Android oferecem câmera e galeria — no canteiro sem sinal o operador fotografa agora e envia depois), botão "Foto das anotações" ≥44px; depois do `downscaleToJpeg`, arquivo > 4 MB é recusado no aparelho com "Foto muito grande. Tente outra foto ou digite as linhas."; mostra "Lendo a foto…"; com `extraction_error`, mostra a mensagem e botão "Tentar ler de novo" (`/extract`) sem reenviar a foto.
  - `MeasurementForm`: as linhas extraídas preenchem o `LinesEditor`; linhas `valid=false` aparecem em vermelho com o `error` e o envio fica bloqueado até corrigir ou remover; `photo_id` vai no `MeasurementIn` e no rascunho; aviso fixo "Confira as linhas lidas da foto antes de enviar".

- [ ] **Step 1: Write failing unit test** (`api.test.ts`): `api("/x", {method:"POST", body: new FormData()})` chama `fetch` sem header `content-type`.
- [ ] **Step 2: Write failing e2e** (`foto.spec.ts`, backend com extractor fake):
  - operador escolhe `fixtures/anotacao.jpg` via `setInputFiles` → 3 linhas aparecem; `E-3` destacada com erro e "Enviar" bloqueado; corrige profundidade para `"10"` → envia → detalhe "Enviada" mostra a foto (`img` carregada, `naturalWidth > 0`).
  - falha de leitura: `page.route("**/api/jobs/*/photos", ...)` devolvendo 201 com `extraction:null, extraction_error:"extraction_failed"` → mensagem "Não foi possível ler a foto. Digite as linhas." e o formulário de digitação continua usável.
- [ ] **Step 3:** Run → FAIL.
- [ ] **Step 4:** Implement.
- [ ] **Step 5:** Run `npm run test:unit`, `npx playwright test` (3 projetos — o CI roda só `desktop`, então rode localmente `--project=iphone-14-pro` e `--project=galaxy-s23`), `npm run lint`, `npm run build` → PASS.
- [ ] **Step 6 (manual, com o usuário):** antes, conferir na documentação da Vercel os limites de tamanho de corpo e de duração para rewrites a origem externa (upload + chamada ao Gemini acontecem numa só requisição); se o limite de duração for menor que `extraction_timeout_s`, baixar o timeout. Depois, no S23 e no iPhone 14 Pro (PWA instalado, API com Gemini real), fotografar uma folha de anotações: a câmera abre, a imagem enviada tem < 2 MB (log do servidor), as linhas aparecem para revisão. Registrar o resultado.
- [ ] **Step 7: Commit** `feat(web): medição por foto com extração por IA e revisão`
