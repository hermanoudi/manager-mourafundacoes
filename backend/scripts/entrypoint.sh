#!/bin/sh
set -e
alembic upgrade head
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
  python scripts/create_admin.py --name "${ADMIN_NAME:-Administrador}" --email "$ADMIN_EMAIL"
fi
exec uvicorn moura_gestao.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
