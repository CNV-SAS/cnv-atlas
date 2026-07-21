# Superficies del rol profesional — inventario

**Propósito:** mapa, a nivel de código, de todo lo que ve y opera el profesional, para pulir
sobre estado real y decidir con evidencia qué ocultar/consolidar. Fecha: 2026-07-17.

**Método:** el sidebar se arma en `src/components/layout/nav-config.ts` filtrando `NAV_ITEMS`
por rol. Los items visibles para `professional` son exactamente seis (más las rutas de detalle
que cuelgan de ellos). Cada fila se verificó leyendo la página y sus readers/policies.

## Rutas del sidebar del profesional

| Ruta | Estado | Cableado | Pendiente | Archivo |
|---|---|---|---|---|
| `/dashboard` (Tablero) | **Parcial** | Saludo con el nombre; landing del shell | Sin contenido real (widgets, pendientes, atajos) | `app/(app)/dashboard/page.tsx` |
| `/pacientes` (Pacientes) | **Real** | Roster del profesional (RLS), edad, # evaluaciones, enlace a historia | — | `app/(app)/pacientes/page.tsx` |
| `/pacientes/[patientId]` | **Real** | Identidad, contacto, línea de tiempo de evaluaciones → resultados | — | `app/(app)/pacientes/[patientId]/page.tsx` |
| `/evaluaciones` (Evaluaciones) | **Real** | Panel de trabajo: confirmar identidad, importar BIS, generar diagnóstico, aprobar/enviar reporte | — | `app/(app)/evaluaciones/page.tsx` |
| `/evaluaciones/[id]` | **Real** | Vista de resultados (indicadores, DFI, Diana), tratamiento, comparación de seguimiento | — | `app/(app)/evaluaciones/[id]/page.tsx` |
| `/reportes` (Reportes) | **Real** | Listado de reportes (RLS); aprobar/enviar/preview desde la tarjeta | — | `app/(app)/reportes/page.tsx` |
| `/pagos` (Pagos) | **Real** | Crear checkout de nutracéuticos (link Wompi 24h) + historial de transacciones (RLS: las suyas) | — | `app/(app)/pagos/page.tsx` |
| `/consentimiento` (Consentimiento vigente) | **Real** | Texto vigente de solo lectura (v1.5) | — | `app/(app)/consentimiento/page.tsx` |

Rutas de flujo que el profesional dispara pero que no viven en su sidebar (públicas / del
paciente): `/encuesta/[token]` (intake), `/checkout/[token]` (pago del paciente),
`/reportes/[id]/pdf` (descarga/preview del PDF). Funcionan; no son superficies de navegación.

## Hallazgo: `/comercial` NO está en el sidebar del profesional

El supuesto de que el profesional ve `/comercial` no se sostiene con el código: en
`nav-config.ts` sus roles son `["admin", "direccion"]`, no `professional`. Por eso el
profesional nunca lo ve. `/comercial` sí es un placeholder (`SectionPlaceholder`, "En
construcción") y sí es redundante con `/pagos` (real) y `/direccion` (agregados), pero eso es
una decisión de las superficies de **admin/dirección**, fuera del alcance de este bloque.

## Propuesta (no se ejecuta; decisión sobre el inventario)

- **Nada que ocultar para el profesional hoy.** Sus seis items son reales y funcionales; no hay
  placeholder ni ruta muerta en su sidebar. La limpieza de placeholders (`/comercial`,
  `/dashboard` delgado) corresponde a otras fases (superficies admin / rediseño de dashboard,
  ambas fuera de alcance).
- **`/dashboard` (Parcial):** es la única superficie del profesional sin contenido real. Candidata
  a enriquecer (pendientes del día, atajos a evaluaciones por confirmar, últimos pacientes). Es
  el rediseño de dashboard, explícitamente fuera de alcance de este bloque; se deja anotado.
- **Solapamiento menor `/evaluaciones` ↔ `/reportes`:** los reportes con acción pendiente
  aparecen tanto en el panel de `/evaluaciones` (como paso del flujo) como en `/reportes` (listado
  completo). Es intencional (contexto de trabajo vs. archivo), pero conviene tenerlo presente si
  a futuro se consolida la experiencia. No es duplicación de código.

## Apéndice — calidad de datos de prueba (hallazgo de ST1/ST3)

Para el caso real navegable se detectó que `src/tests/fixtures/biody_synthetic.xlsx` tiene
valores placeholder (fuera de rango fisiológico): **solo sirve para probar el import de B8, no
para alimentar el motor**. El caso golden-path usa los valores reales anonimizados de
`biody-juan-esteban-anon.json`. Detalle y candado en `src/tests/fixtures/README.md` y
`fixtures-integrity.test.ts`.

---

# Pestañas internas de `/evaluaciones/[id]` (inventario 2026-07-20)

**Propósito:** estado real de las otras tres pestañas de la vista de resultados, para planear el
siguiente bloque sobre estado real. La fila `/evaluaciones/[id]` de arriba (Real) se refiere a la
vista como un todo; aquí se desglosan sus 4 pestañas internas (`EvaluationTabs`). **Diagnóstico**
ya se cableó y se pulió (fidelidad visual, bloque cerrado); faltan **Evaluación, Tratamiento,
Seguimiento**. Raíz: `src/app/(app)/evaluaciones/[id]/page.tsx`.

| Pestaña | Estado | Cableado | Falta / pendiente |
|---|---|---|---|
| **Evaluación** | **Placeholder** (en `[id]`) | Siempre `StagePlaceholder` (`page.tsx:64` y `:125`), en ambas ramas | Construir o decidir no construir la pestaña; el trabajo real vive en otra ruta |
| **Tratamiento** | **Real** (punta a punta, con gate) | `RutasSection` + `TreatmentPanel` + `ReportCard` | Pulido de ubicación/UX; el menú IA es borrador por diseño |
| **Seguimiento** | **Parcial / condicional** | `FollowupComparison` (real) o `StagePlaceholder` si no hay previa | Placeholder en toda evaluación inicial; sin acciones propias; sin vista longitudinal rica |

## Evaluación — placeholder; el trabajo real vive en `/evaluaciones` (panel sin id)

- En `[id]/page.tsx` la prop `evaluacion` es SIEMPRE `StagePlaceholder` (`:64` sin diagnóstico,
  `:125` con diagnóstico). La vista `[id]` es de RESULTADOS (metadata "Resultados - Atlas", `:29`);
  el estado vacío sin diagnóstico incluso enlaza a `/evaluaciones` para hacer el trabajo (`:82-91`).
- El trabajo REAL de evaluación está cableado punta a punta en **otra ruta**,
  `src/app/(app)/evaluaciones/page.tsx` (panel sin `[id]`), con 4 secciones: confirmar identidad
  (`identity-confirmation.tsx`, reader `listPendingIdentityChecks`, policy `canConfirmIdentity`),
  importar BIS (`BisImportForm`, `listEvaluationsForBisImport`), generar diagnóstico
  (`PipelineRunner`, `listEvaluationsForDiagnosis`, corre el motor real) y aprobar/enviar reportes
  (`ReportCard`, `listReports`).
- **Relación:** `/evaluaciones` (panel) es el PRODUCTOR del flujo; `/evaluaciones/[id]` es el
  CONSUMIDOR de resultados. La pestaña Evaluación dentro de `[id]` es hoy 100% placeholder; la
  intención documentada (comentarios `page.tsx:31-32,119-120`) es "reubicar" el trabajo aquí en un
  bloque futuro.
- **Decisión para el próximo bloque (gap principal de las tres):** ¿se construye la pestaña
  Evaluación en `[id]` (reubicando el panel, o mostrando la evidencia de entrada: respuestas de
  encuesta, medición BIS, identidad confirmada), o se mantiene el split productor/consumidor y se
  retira la pestaña placeholder?

## Tratamiento — real, punta a punta, con gate de diagnóstico confirmado

- `page.tsx:126-143`: `RutasSection` (rutas de `snapshot.dfi.rutas`, o `[]` si el snapshot es
  incompatible), `TreatmentPanel` (si hay `protocol`, si no placeholder) y `ReportCard` como cierre.
- `TreatmentPanel` (`treatment/components/treatment-panel.tsx`) desde `getTreatmentProtocol`
  (`treatment/data/treatment-reader.ts`, por RLS): objetivos (kcal precargado del GET medido del
  BIS), nutracéuticos (catálogo B5), guías dietarias, notas, sugerencias de menú IA.
- **Gate:** `locked = !protocol.diagnosisConfirmed` (`treatment-panel.tsx:41`), re-verificado en el
  service y writer. Aprobar el reporte confirma el diagnóstico y desbloquea el panel.
- **Persiste:** guardar protocolo (`saveProtocolAction` → service → writer, revalida la ruta),
  notas append-only (`addNoteAction`), menú IA (`generateMenuAction`: rate-limit + barrera PII +
  `ai_menu_suggestions` inmutable, borrador informativo que NO se aplica al protocolo por diseño),
  aprobar/enviar reporte (`reports/actions.ts`, revalida `/evaluaciones/[id]`). Policies
  `canManageTreatment` / `canManageReports`.
- **Falta:** poco funcional; pulido de ubicación/UX. Snapshots de era anterior del motor bloquean la
  generación de menú.

## Seguimiento — comparación real cuando hay evaluación previa; si no, placeholder

- `page.tsx:144-150`: `FollowupComparison` si hay `comparison`, si no `StagePlaceholder`.
- `getFollowupComparison` (`followups/data/comparison-reader.ts`): toma la evaluación actual y la
  PREVIA del mismo paciente, lee ambos snapshots inmutables (vía `reports-repository`) y calcula
  deltas `actual - previa` de los 12 indicadores + cambio de estado EFR + riesgo DFI. Presentación
  pura (los deltas no se persisten). Sin acción que escriba.
- **Cae a placeholder** cuando: es la PRIMERA evaluación del paciente (sin previa, el caso más
  común), falta reporte/snapshot en alguna de las dos, o algún snapshot es de era anterior del motor
  (`!isEngineOutput`).
- **Falta:** es solo lectura; emitir el link de una nueva evaluación de seguimiento vive en
  `/evaluaciones` (`canEmitFollowupLink`), no aquí. La visualización longitudinal rica ya está en
  `BACKLOG.md`. Para evaluaciones iniciales la pestaña es siempre placeholder.

## Lectura para planear el siguiente bloque

- **Gap principal: la pestaña Evaluación** (placeholder puro). Decidir su alcance antes de nada.
- **Tratamiento** ya es real; su siguiente paso es pulido de ubicación/UX, no cableado.
- **Seguimiento** es correcto pero "vacío" para iniciales; el enriquecimiento longitudinal está
  trazado en el BACKLOG.
