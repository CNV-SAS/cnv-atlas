import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

// Tests "BD real": corren gateados por DATABASE_URL contra UNA sola base local. Bajo paralelismo se PISAN
// entre si (contencion de estado: un test ve/escribe filas de otro), lo que producia rojos intermitentes
// (5 veces). El timeout no lo arregla porque no es lentitud, es contencion. Solucion: correrlos EN SERIE
// (proyecto "db" con fileParallelism:false); los unitarios (mockean la BD) siguen en paralelo, rapidos.
// Al agregar un test nuevo que toque la BD (usa DATABASE_URL/HAS_DB), AGREGARLO a esta lista o volvera a
// ser flaky. Verificacion: `grep -rl DATABASE_URL src/tests` debe estar contenido aqui.
const DB_TESTS = [
  // NO es un candado: es la MEDICION del efecto de un bump de motor (imprime cifras, asegura que
  // hubo algo que recomputar). Vive en la suite de BD porque necesita datos reales; en la de unit haria
  // que `pnpm verify` dependiera de la base.
  "src/tests/medicion-efecto-del-bump.test.ts",
  "src/tests/alergenos-cobertura.test.ts",
  "src/tests/mapa-alegra.test.ts",
  "src/tests/sentry-causa-db.test.ts",
  "src/tests/cotejo-wompi-db.test.ts",
  "src/tests/reversa-db.test.ts",
  "src/tests/entrega-por-documento-db.test.ts",
  "src/tests/reclamo-factura-concurrente.test.ts",
  "src/tests/venta-rechazada-no-gasta-intentos.test.ts",
  "src/tests/reparto-sellado.test.ts",
  "src/tests/saldo-por-lote-db.test.ts",
  "src/tests/vencimientos-db.test.ts",
  "src/tests/devolucion-a-cnv-db.test.ts",
  "src/tests/distribucion-db.test.ts",
  "src/tests/domicilio-db.test.ts",
  "src/tests/venta-inventario.test.ts",
  "src/tests/factura-huerfana-db.test.ts",
  "src/tests/venta-anulacion-y-revision-db.test.ts",
  "src/tests/catalogo-prescribible-db.test.ts",
  "src/tests/cobro-reconocido-db.test.ts",
  "src/tests/tablero-direccion-inventario-db.test.ts",
  "src/tests/insights-de-la-compra-db.test.ts",
  "src/tests/lo-deshecho-db.test.ts",
  "src/tests/paciente-derivado-de-prueba-db.test.ts",
  "src/tests/una-venta-sabe-si-es-de-prueba-db.test.ts",
  "src/tests/integrante-nace-con-vitrina-db.test.ts",
  "src/tests/descartar-un-pendiente-db.test.ts",
  "src/tests/marca-de-profesional-db.test.ts",
  "src/tests/ventana-de-conteo-db.test.ts",
  "src/tests/modalidad-de-la-venta-db.test.ts",
  "src/tests/distribucion-no-se-factura-db.test.ts",
  "src/tests/ventas-sin-documento-por-dia-db.test.ts",
  "src/tests/avisos-db.test.ts",
  // ── LOS DIECISEIS QUE FALTABAN (2026-10-05) ──────────────────────────────────────────────────────
  //
  // La verificacion que esta escrita arriba (`grep -rl DATABASE_URL src/tests` contenido aqui) estaba
  // ROTA: dieciseis archivos tocaban la base y corrian en el proyecto paralelo. Salio al correr la suite
  // entera despues del retiro del flete: `liquidacion-comision-db` fallo en grupo y paso sola, que es la
  // firma exacta de la contencion que esta lista existe para evitar, no la de un defecto del codigo.
  //
  // POR QUE IMPORTA MAS DE LO QUE PARECE: un rojo intermitente que pasa al reintentar entrena a no creerle
  // a la suite, y el dia que uno de estos falle de verdad se va a leer como "otra vez el flaky".
  "src/tests/adjuntos-del-integrante-db.test.ts",
  "src/tests/aplicar-migracion-banderas.test.ts",
  "src/tests/cliente-de-la-base.test.ts",
  "src/tests/consentimiento-origen-html-db.test.ts",
  "src/tests/devolucion-fisica-db.test.ts",
  "src/tests/emitir-prescripcion-writer.test.ts",
  "src/tests/encuesta-registrada-por-profesional-db.test.ts",
  "src/tests/guardar-protocolo-transaccional.test.ts",
  "src/tests/importacion-html-importar-db.test.ts",
  "src/tests/integrante-reader-db.test.ts",
  "src/tests/liquidacion-comision-db.test.ts",
  "src/tests/modalidad-db.test.ts",
  "src/tests/paciente-de-prueba-db.test.ts",
  "src/tests/perfil-completitud-db.test.ts",
  "src/tests/venta-desde-la-bodega-db.test.ts",
  "src/tests/venta-retroactiva-db.test.ts",
  "src/tests/auth-flows.test.ts",
  "src/tests/base-survey-link.test.ts",
  "src/tests/clinical-access.test.ts",
  "src/tests/comodato.test.ts",
  "src/tests/consent-revocation.test.ts",
  "src/tests/correct-evaluation.test.ts",
  "src/tests/count-session.test.ts",
  "src/tests/demo-realimentacion.seed.test.ts",
  "src/tests/diet-field-keys-in-used-versions.test.ts",
  "src/tests/firma-presencial-db.test.ts",
  "src/tests/intake-publico-db.test.ts",
  "src/tests/sesion-presencial-db.test.ts",
  "src/tests/diagnosis-confirmation-immutability.test.ts",
  "src/tests/hc-antecedentes-encuesta.test.ts",
  "src/tests/faltante-case.test.ts",
  "src/tests/faltante-settle-sobrante.test.ts",
  "src/tests/faltante-two-person.test.ts",
  "src/tests/golden-path.seed.test.ts",
  "src/tests/reapertura-prescripcion.test.ts",
  "src/tests/intake-writer-split.test.ts",
  "src/tests/nutraceuticals.test.ts",
  "src/tests/nutra-inventory.test.ts",
  "src/tests/patron-coupling.test.ts",
  "src/tests/pipeline-propagation.test.ts",
  "src/tests/profession-enum.test.ts",
  "src/tests/protocol-concurrency.test.ts",
  "src/tests/motor-bis-completo.test.ts",
  "src/tests/proteina-forma-vieja.test.ts",
  "src/tests/report-trajectory-seal.test.ts",
  "src/tests/rls.test.ts",
  "src/tests/rls-en-todas-las-tablas.test.ts",
  "src/tests/reversas-visibles-al-profesional.test.ts",
  "src/tests/sociodemographic-writer.test.ts",
  "src/tests/survey-edit-writer.test.ts",
  "src/tests/survey-engine-coupling.test.ts",
  "src/tests/survey-intake.test.ts",
  "src/tests/tiempos-activos-migration.test.ts",
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
