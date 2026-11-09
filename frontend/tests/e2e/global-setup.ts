import { spawnSync } from "node:child_process";

export const E2E_EMAIL = "e2e-admin@moura.test";
export const E2E_PASSWORD = "senha-forte-123";

export default function globalSetup() {
  const env = {
    ...process.env,
    DATABASE_URL:
      process.env.TEST_DATABASE_URL ?? "postgresql+psycopg://moura:moura@localhost:5433/moura",
    ADMIN_PASSWORD: E2E_PASSWORD,
  };
  const run = (args: string[]) => {
    const r = spawnSync("uv", args, { cwd: "../backend", env, stdio: "inherit" });
    if (r.status !== 0) throw new Error(`uv ${args.join(" ")} falhou`);
  };
  run(["run", "alembic", "upgrade", "head"]);
  run(["run", "python", "scripts/create_admin.py", "--name", "E2E Admin", "--email", E2E_EMAIL]);
}
