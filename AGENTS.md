# Moura Gestão — guia para agentes

Sistema de gestão da Moura Fundações. Spec: `docs/superpowers/specs/2026-11-09-sistema-gestao-design.md`.

## Regras globais
- Dinheiro/medidas: `Decimal` no Python, `NUMERIC` no banco, string no JSON (`"12.50"`); nunca `float`.
- Entrada numérica aceita vírgula decimal pt-BR (`"12,5"` → `Decimal("12.5")`).
- Banco: **somente Alembic**; nunca `create_all`; toda migration tem `downgrade()`; teste falha se modelos divergirem das migrations.
- Interface em pt-BR; código, rotas, tabelas e campos em inglês.
- Papéis: `admin`, `office`, `operator`.
- Fuso de negócio `America/Sao_Paulo`; timestamps `TIMESTAMPTZ` em UTC.
- Viewports: 360×780, 393×852, 1280×800; toque ≥44px; sem scroll horizontal.
- Segredos só via env; nunca commitar `.env`.
- Camadas: `domain/` só stdlib + pydantic; `application/` nunca importa `infrastructure/`.
- Commits em português: `tipo(escopo): descrição`.
- Ruff só em `backend/src backend/tests backend/migrations backend/scripts` (nunca `ruff format` no repo).

## Comandos
- Banco de teste: `docker compose up -d db_test`
- Backend: `cd backend && uv run pytest -q` · `uv run ruff check src tests migrations scripts`
- Frontend: `cd frontend && npm run test:unit` · `npx playwright test` · `npm run lint` · `npm run build`

## Deploy
- API + Postgres no Railway (root `backend`, Dockerfile, healthcheck `/api/health`; variáveis `DATABASE_URL`, `JWT_SECRET`, `COOKIE_SECURE=true`, `ENVIRONMENT=prod`).
- Front na Vercel (root `frontend`, variável `API_URL`); o Next reescreve `/api/*` para a API (cookie `mg_session` de primeira parte).
- Next 16: o antigo `middleware.ts` chama-se `src/proxy.ts`; leia `frontend/node_modules/next/dist/docs/` antes de mexer em convenções do Next.
