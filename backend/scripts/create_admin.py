"""Cria um usuário admin (idempotente). Senha via ADMIN_PASSWORD ou prompt."""

import argparse
import asyncio
import getpass
import os
import sys

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from moura_gestao.application.users import create_user
from moura_gestao.domain.errors import Conflict
from moura_gestao.domain.users import Role
from moura_gestao.infrastructure.repositories import SqlUserRepository
from moura_gestao.infrastructure.security import Argon2Hasher


async def main(name: str, email: str, password: str) -> int:
    url = os.environ["DATABASE_URL"]
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    engine = create_async_engine(url)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            try:
                await create_user(
                    SqlUserRepository(session), Argon2Hasher(),
                    name=name, email=email, password=password, role=Role.ADMIN,
                )
                await session.commit()
            except Conflict:
                print(f"Usuário {email} já existe; nada a fazer.")
                return 0
        print(f"Admin {email} criado.")
        return 0
    finally:
        await engine.dispose()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--name", required=True)
    parser.add_argument("--email", required=True)
    args = parser.parse_args()
    pw = os.environ.get("ADMIN_PASSWORD") or getpass.getpass("Senha (mín. 10 caracteres): ")
    if len(pw) < 10:
        print("Senha muito curta (mín. 10).", file=sys.stderr)
        sys.exit(1)
    sys.exit(asyncio.run(main(args.name, args.email, pw)))
