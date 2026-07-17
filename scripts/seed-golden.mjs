// Corre el seeder golden-path bajo el runner de vitest, el unico contexto que resuelve el
// motor y el pipeline (server-only, imports sin extension que node no resuelve). Node fija el
// flag SEED_GOLDEN y delega en vitest, para que funcione igual en Windows y POSIX sin depender
// de la sintaxis de variables de entorno del shell. Prerrequisito: `pnpm db:seed`.
import { spawnSync } from "node:child_process";

const r = spawnSync("pnpm", ["vitest", "run", "src/tests/golden-path.seed.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, SEED_GOLDEN: "1" },
  shell: true,
});
process.exit(r.status ?? 1);
