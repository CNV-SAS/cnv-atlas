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
  },
});
