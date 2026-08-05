// Siembra los casos demo por la VIA REAL del pipeline bajo el runner de vitest, el unico contexto que
// resuelve el motor y el pipeline (server-only, imports sin extension que node no resuelve). Node fija
// los flags y delega en vitest, para que funcione igual en Windows y POSIX. Prerrequisito: `pnpm db:seed`.
// Siembra DOS conjuntos en UNA sola orden:
//   - golden-path.seed: Demo GoldenPath (hombre completo), casos femeninos, evaluacion sin diagnostico.
//   - trajectory-demo.seed: los tres pacientes del smoke de trayectoria (empeoro / mejoro / intervalo).
// Antes trajectory tenia su propio comando (seed:trajectory); se consolido aqui para una sola orden.
import { spawnSync } from "node:child_process";

const r = spawnSync(
  "pnpm",
  ["vitest", "run", "src/tests/golden-path.seed.test.ts", "src/tests/trajectory-demo.seed.test.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, SEED_GOLDEN: "1", SEED_TRAJECTORY: "1" },
    shell: true,
  },
);
process.exit(r.status ?? 1);
