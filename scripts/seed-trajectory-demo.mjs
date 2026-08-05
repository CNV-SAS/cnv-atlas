// Siembra el caso demo del smoke de P0 Parte 2 (trayectoria de EB-BIS) bajo el runner de vitest, el
// unico contexto que resuelve el motor y el pipeline (server-only). Node fija SEED_TRAJECTORY y delega
// en vitest. Prerrequisito: `pnpm db:seed` (necesita la organizacion, el profesional y la encuesta).
import { spawnSync } from "node:child_process";

const r = spawnSync("pnpm", ["vitest", "run", "src/tests/trajectory-demo.seed.test.ts"], {
  stdio: "inherit",
  env: { ...process.env, SEED_TRAJECTORY: "1" },
  shell: true,
});
process.exit(r.status ?? 1);
