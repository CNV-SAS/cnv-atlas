import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Permite a los tests importar y mockear modulos por "@/...". Los modulos
      // server-only (db, supabase, alegra, repos) NO deben cargarse en vitest: se
      // mockean en cada test, asi nunca se evalua su `import "server-only"`.
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Los tests "BD real" (gateados por DATABASE_URL) corren en paralelo con toda la suite y comparten
    // una sola base: bajo contencion, una query ocasionalmente pasa del timeout por defecto (5s) y el
    // test se pone rojo de forma intermitente; en aislamiento pasa. Subimos el margen para que la
    // contencion no se lea como fallo. Si el ruido reaparece, la opcion mas robusta es correr los
    // archivos de BD en serie (fileParallelism: false para ellos), ver vitest projects.
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
