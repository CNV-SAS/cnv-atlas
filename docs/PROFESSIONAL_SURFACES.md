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
