import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Tests "BD real": corren gateados por DATABASE_URL contra UNA sola base local. Bajo paralelismo se PISAN
// entre si (contencion de estado: un test ve/escribe filas de otro), lo que producia rojos intermitentes
// (5 veces). El timeout no lo arregla porque no es lentitud, es contencion. Solucion: correrlos EN SERIE
// (proyecto "db" con fileParallelism:false); los unitarios (mockean la BD) siguen en paralelo, rapidos.
// Al agregar un test nuevo que toque la BD (usa DATABASE_URL/HAS_DB), AGREGARLO a esta lista o volvera a
// ser flaky. Verificacion: `grep -rl DATABASE_URL src/tests` debe estar contenido aqui.
const DB_TESTS = [
  "src/tests/auth-flows.test.ts",
  "src/tests/base-survey-link.test.ts",
  "src/tests/clinical-access.test.ts",
  "src/tests/comodato.test.ts",
  "src/tests/correct-evaluation.test.ts",
  "src/tests/count-session.test.ts",
  "src/tests/diet-field-keys-in-used-versions.test.ts",
  "src/tests/diagnosis-confirmation-immutability.test.ts",
  "src/tests/faltante-case.test.ts",
  "src/tests/faltante-settle-sobrante.test.ts",
  "src/tests/faltante-two-person.test.ts",
  "src/tests/golden-path.seed.test.ts",
  "src/tests/intake-writer-split.test.ts",
  "src/tests/nutraceuticals.test.ts",
  "src/tests/nutra-inventory.test.ts",
  "src/tests/patron-coupling.test.ts",
  "src/tests/pipeline-propagation.test.ts",
  "src/tests/profession-enum.test.ts",
  "src/tests/protocol-concurrency.test.ts",
  "src/tests/report-trajectory-seal.test.ts",
  "src/tests/rls.test.ts",
  "src/tests/sociodemographic-writer.test.ts",
  "src/tests/survey-edit-writer.test.ts",
  "src/tests/survey-engine-coupling.test.ts",
  "src/tests/survey-intake.test.ts",
  "src/tests/trajectory-demo.seed.test.ts",
  "src/tests/treatment-approve.test.ts",
  "src/tests/treatment-immutability.test.ts",
];

const alias = {
  // Permite a los tests importar y mockear modulos por "@/...". Los modulos server-only (db, supabase,
  // alegra, repos) NO deben cargarse en vitest: se mockean en cada test, asi nunca se evalua su
  // `import "server-only"`.
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
          exclude: [...DB_TESTS, "**/node_modules/**", "**/dist/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          environment: "node",
          include: DB_TESTS,
          // EN SERIE: ningun archivo de BD corre simultaneo con otro -> cero contencion de estado.
          fileParallelism: false,
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
    ],
  },
});
