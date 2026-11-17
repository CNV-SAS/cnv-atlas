# Estado de Atlas

**Al 17 de noviembre de 2026.** Para que una sesión nueva arranque sin depender de una conversación
larga. Una o dos páginas, y se mantiene así: lo que crezca se va a su documento propio.

> **Cómo se mantiene:** al final de cada turno con cambios, se actualiza este archivo. Cada decisión
> nueva es una línea en `DECISIONES.md`. Está escrito también en `CLAUDE.md`, para que no dependa de que
> alguien se acuerde.

> **Qué NO está aquí:** los gates del lanzamiento (`LANZAMIENTO.md`, fuente única), el backlog
> (`BACKLOG.md`), las reglas de arquitectura (`ARCHITECTURE.md`) y lo que espera a Gildardo, pregunta por
> pregunta (`PENDIENTES_CIENTIFICOS.md`). Este documento no los repite: los nombra.

---

## El motor clínico en producción

**`ENGINE_VERSION = "4.0.0"`** (`src/clinical-engine/version.ts`), más `PROTOCOL_ENGINE_VERSION = "1.0.0"`
para la cadena calórica. Cada versión, en una línea; el porqué completo vive en los comentarios de ese
archivo, que es la fuente.

| | Fecha | Qué cambió |
|---|---|---|
| 1.0.0 | | Port inicial, paridad con su `ATLAS_v7.html` |
| 1.1.0 | 2026-08-19 | Re-port contra su `ATLAS_v8.html` |
| 1.2.0 | 2026-08-31 | La dinamometría entra al motor (su §6 del 30 de agosto) |
| 1.3.0 / 1.3.1 | 2026-09-05 | Se enciende el LE8; patch del chip del PABU, sin ciencia |
| 1.4.0 | 2026-09-06 | La guarda del LE8 pasa de seis insumos a ocho |
| 2.0.0 | 2026-10-28 | La EB-BIS v7 entra al motor |
| 3.0.0 | 2026-11-06 | El DFI lee la EB-BIS de la v7 (su v15 §1.4) |
| 3.1.0 | 2026-11-06 | El puntaje de Alimentación del ICEC (su v16 §4.2) |
| 3.2.0 | 2026-11-07 | El borde de ±5,0 del IAE se cierra, en los cuatro sitios nuestros |
| 3.3.0 | 2026-11-11 | El ICA-BIS, con signo, y su referencia por percentiles (su v17 §4) |
| 4.0.0 | 2026-11-12 | La Diana se mueve: sus cortes MCCB y el sector (su v17 §2.3 y §2.4) |

**El histórico ya está recalculado con la v17:** **481 consultas quedaron en 4.x** y **71 no se pudieron
reemitir**, cada una con su motivo (34 de prueba; de las 37 reales: 20 con la medición
repetida, 13 sin fecha de nacimiento legible y 4 fuera del rango de calibración de la EB-BIS v7). Se
mide con `scripts/las-que-no-se-reemitieron.mjs`.

## Base de datos

**247 migraciones aplicadas**, la última `drizzle/0246_los_rotulos_para_el_paciente.sql`. Forward-only:
una migración aplicada no se modifica nunca, se crea otra. El control es `scripts/check-migrations.mjs`.

## Interruptores de activación

| Constante | Valor | Qué significa |
|---|---|---|
| `CNVS_ACTIVA` | `true` | La Encuesta CNV-S de seguimiento se aplica a **todos** los pacientes, reales incluidos. Encendida el 2026-11-16 |
| `CNVS_EN_PRUEBAS` | `true` | Se deja en `true` para conservar el estado anterior (solo pacientes de prueba) si alguna vez se apaga la de arriba |

Viven en `src/modules/evaluations/instrumento.ts`, con su candado. Apagar `CNVS_ACTIVA` devuelve el
sistema a pacientes de prueba sin tocar nada más.

## En curso

- **Nada clínico abierto de nuestro lado.** Lo científico se cerró con la v17 aplicada, el histórico
  reemitido y la CNV-S encendida.
- Lo que queda es **operativo y comercial**: el smoke comercial de punta a punta y las llaves de
  producción (abajo).

## Lo que espera a alguien

| Espera a | Qué | Dónde está |
|---|---|---|
| **Gildardo** | Las **50 preguntas abiertas** del 16 de noviembre (siete solo piden confirmar lo ya aplicado). Tres frenan trabajo: la **37**, la **1** y la **2** | `docs/PENDIENTES_CIENTIFICOS.md`, y el `.docx` del 16 en `docs/entregas/` (fuera de git) |
| **Ángela** | Las correcciones de la cohorte: los grupos de **medición repetida**, **15 pacientes sin fecha de nacimiento** y **2 fechas que no cuadran** | `scripts/PARA_COORDINAR_CON_ANGELA_2026-11-07.mjs` arma el mensaje en `docs/entregas/dudas/` (gitignoreado) |
| **Una profesional (`4d2a74e0`)** | Reportó un error en "Antrop. y BIS" y quedó en reintentar. Si vuelve a verlo, se corre el script de abajo con su identidad | `scripts/los-lectores-con-su-identidad.mjs` |
| **La contadora** | La tarifa exacta de retención por comisiones. Bloquea **liquidar** el pago al integrante, no vender ni facturar | `DECISIONES_LEGALES.md` |

## Los próximos pasos

1. **Smoke comercial de punta a punta** (venta por pasarela y en efectivo, comisión, inventario).
2. **Las llaves de producción de Alegra y de Wompi.** Hoy la factura es un simulacro en sandbox: ni el
   pago por pasarela ni la venta en efectivo facturan de verdad. Las variables y su alcance están en
   `DEPLOY.md`; el cotejo del catálogo, en `scripts/cotejo-alegra.mjs`.
3. Lo demás, por prioridad, en `BACKLOG.md` y `LANZAMIENTO.md`.

## Los scripts de solo lectura

Todos leen la nube y **no escriben nada en ella**. Se corren con
`node --env-file=.env.production.local scripts/<nombre>`, e imprimen cuentas e ids abreviados a ocho
caracteres, nunca nombres ni documentos.

| Script | Qué mide |
|---|---|
| `las-que-no-se-reemitieron.mjs` | Qué consultas quedaron sin reemitir con la v17, y por qué cada una |
| `los-veredictos-de-la-hc-contra-el-dfi.mjs [id...]` | Qué dice cada superficie de cada índice sobre el mismo sello. Sin ids, barre y resume |
| `hombres-con-el-ica-bis-alterado.mjs` | Qué consultas de hombre traen la fila del ICA-BIS alterada (para verificarla en la HC, que solo muestra lo alterado) |
| `el-item-de-nutraceuticos-contra-la-vigente.mjs` | El pendiente del cierre contra la prescripción vigente: cuántas tienen solo producto externo |
| `el-omega-en-la-cohorte.mjs` | Dónde sugiere el omega el modelo y en cuántas consultas se prescribió |
| `los-pendientes-de-verdad.mjs` | Los pendientes que la franja del cierre cuenta de verdad, con las condiciones reales |
| `mediciones-fuera-de-rango.mjs` | Mediciones con insumos fuera de rango fisiológico |
| `repasar-el-seguimiento.mjs <id>` | Qué le quedó a una consulta de seguimiento |
| `revisar-respuestas-de-la-consulta.mjs <id>` | Qué le quedó a una consulta después de un guardado que falló (acepta el prefijo que imprime Sentry) |
| `los-lectores-con-su-identidad.mjs` | Corre los lectores de "Antrop. y BIS" con la identidad de una profesional, para reproducir su error |
| `encuesta-de-los-importados.mjs` | Cuántos pacientes importados del HTML tienen la encuesta incompleta |
| `que-trajo-el-html-en-otra.mjs` · `cotejo-de-las-opciones-otra.mjs` | Qué trajo el HTML en el texto libre de "Otra", y en cuántas preguntas se escribe distinto |
| `datos-eb-bis-para-gildardo.mjs` | Los datos de la edad bioeléctrica para la dirección científica |
| `simular-v17.mjs` | Simula una versión del motor sobre la cohorte sin escribir (es como se midió la v17 antes de aplicarla) |
| `PARA_COORDINAR_CON_ANGELA_2026-11-07.mjs` | Arma lo que Santiago necesita para coordinar las correcciones con Ángela |
| `cotejo-alegra.mjs` · `leer-alegra.mjs` · `sondeo-wompi-consulta.mjs` | Cotejan el catálogo y las cuentas de Alegra, y sondean las transacciones de Wompi |

**Y las puertas, que corren en local y no tocan la nube:** `npx tsc --noEmit` · `pnpm lint` ·
`pnpm check:rsc` · `pnpm check:cables` · `node scripts/check-secrets.mjs` ·
`node scripts/check-entregas.mjs` · `npx vitest run --project unit` · `npx vitest run --project db`.

**Los scripts que SÍ escriben** (`aplicar-migracion`, `normalize-patient-sex`, `adoptar-factura-alegra`,
`reseed-indicator-defs`, `seed-golden`, `limpiar-fixtures-de-la-suite`, y los `gen-*`) no se corren contra
producción sin que Santiago lo pida en ese turno.
