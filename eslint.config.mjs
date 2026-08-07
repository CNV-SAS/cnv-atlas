import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Material de referencia local (gitignored): HTML/motor de Gildardo y
    // muestras. No es codigo de la app; no debe romper el lint del proyecto.
    "reference/**",
    // Entregas de Gildardo (JS minificado, verbatim del prototipo) y artefactos
    // temporales de la CLI de Supabase. No son codigo de la app; si el lint se
    // pone rojo por ellos deja de servir de senal (nadie nota un fallo real).
    "docs/entregas/**",
    "supabase/.temp/**",
    // Ciencia clinica CONGELADA (verbatim del prototipo de Gildardo): excepcion
    // nombrada a la regla 12 (ARCHITECTURE.md). No se estiliza ni se edita; su
    // correccion la prueban los golden tests, no el lint.
    "src/clinical-engine/frozen/**",
  ]),
]);

export default eslintConfig;
