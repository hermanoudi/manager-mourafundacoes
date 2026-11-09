# Moura Gestão

Sistema de gestão da Moura Fundações (clientes, obras, medições, faturamento e financeiro).
Spec: `docs/superpowers/specs/2026-11-09-sistema-gestao-design.md` · Fase atual: **P1 Fundação**
(usuários, clientes, perfuratrizes, PWA).

- `backend/` — FastAPI + SQLAlchemy 2 async + Alembic (Python 3.12, uv)
- `frontend/` — Next.js (App Router) PWA

## Rodando localmente

```bash
docker compose up -d db            # Postgres de desenvolvimento (porta 5432)
cd backend
cp .env.example .env               # ajuste JWT_SECRET
uv sync
uv run alembic upgrade head
uv run python scripts/create_admin.py --name "Seu Nome" --email voce@moura.com   # senha via prompt ou ADMIN_PASSWORD
uv run uvicorn moura_gestao.main:app --reload --port 8000

cd ../frontend
cp .env.example .env.local         # API_URL=http://localhost:8000
npm install
npm run dev                        # http://localhost:3000
```

Testes: `docker compose up -d db_test`, depois `cd backend && uv run pytest -q`;
`cd frontend && npm run test:unit && npx playwright test` (desktop, Galaxy S23 e iPhone 14 Pro).
O WebKit (projeto `iphone-14-pro`) precisa das libs do sistema: `sudo npx playwright install-deps webkit`.

## Deploy

### Railway (API + Postgres)
1. Novo projeto → adicionar **PostgreSQL**.
2. Adicionar serviço a partir deste repositório com **Root Directory** `backend` (usa o `Dockerfile` e o `railway.json`).
3. Variáveis do serviço: `DATABASE_URL` (referência ao Postgres do projeto), `JWT_SECRET` (`openssl rand -hex 32`), `COOKIE_SECURE=true`, `ENVIRONMENT=prod`.
4. O `entrypoint.sh` roda `alembic upgrade head` a cada deploy. Healthcheck: `/api/health`.
5. Criar o primeiro admin: `railway run --service <api> python scripts/create_admin.py --name "..." --email ...`.

### Vercel (PWA)
1. Importar o repositório com **Root Directory** `frontend`.
2. Variável `API_URL=https://<servico>.up.railway.app` (o Next reescreve `/api/*` para ela, mantendo o cookie de sessão em primeira parte).

## Instalar o PWA
- **Galaxy S23 (Chrome):** abrir o site → menu ⋮ → **Instalar app**.
- **iPhone (Safari):** abrir o site → **Compartilhar** → **Adicionar à Tela de Início**.
