# RESULTADOS_GAP.md — vista de resultados/diagnóstico: HTML de referencia vs Atlas

**Propósito:** preparar el alcance del bloque de resultados/diagnóstico. Inventario de qué muestra
la vista de diagnóstico/resultados del prototipo (`reference/ATLAS_v7.html`) comparado con la vista
de Atlas hoy (`src/modules/diagnoses/components/evaluation-results.tsx`), y clasificación de cada
faltante. Fecha: 2026-07-17. **Doc-only; no se construye nada aquí.**

**Método:** lectura del CÓDIGO FUENTE del HTML (no de pantallazos: el prototipo tiene el bug de
render de la Q4, la vista sale en blanco). Se ubicaron las funciones de render por sus marcadores.
El detalle fino de cada bloque se confirma al planear el bloque; aquí manda la clasificación.

**Clasificación:**
- **(a)** ya está en el snapshot inmutable, solo no se muestra → es UI.
- **(b)** lo calcula/arma una función de render del HTML que Atlas no portó → hay que portar render (y a veces re-exponer datos).
- **(c)** fuera de alcance de la vista de resultados (otra feature o decisión previa).
- **(b-CLÍNICO)** subconjunto de (b) que toca cálculo clínico → **marcado para revisión con Gildardo, NO para construir**.

## Qué muestra Atlas hoy

Header (paciente, confirmado) · **Diagnóstico funcional** (estado EFR nombre/número/clave,
fenotipo estructural, sector FyR, mecanismo, biomarcadores, riesgos, nutracéuticos) · **Diana EFR**
(monocroma, solo la celda del paciente) · **12 indicadores** ANI-BIS-E (valor + clasificación) ·
**DFI** (5 dominios + riesgo integrado + rutas) · constelación de versiones.

## Inventario de faltantes (lo que el HTML muestra y Atlas no)

| Bloque del HTML | En Atlas hoy | Clase | Nota |
|---|---|---|---|
| **Color + posición por riesgo de la Diana EFR** (`DianaEFyR`, ~L4374-4595) | Diana monocroma | (b) render | Ya diagnosticado y decidido: es el bloque siguiente (ver `docs/BACKLOG.md` Diana + memoria `diana-visual-port-prep`). No es cálculo clínico. |
| **Diagnóstico antropométrico** (IMC · IC · ICC · ICT + cintura/cadera y sus clasificaciones) (~L6290, `CLASIFICACIONES ANTROPOMÉTRICAS` ~L6414) | No se muestra | (b) | Los insumos crudos (BMI, cintura, cadera) están en `bis_raw_values`; el `EngineOutput` NO los expone como indicadores ni trae sus clasificaciones. Requiere re-exponer + portar cortes de clasificación. Ratios simples, no ciencia congelada, pero sí render/cortes no portados. |
| **Diagnóstico de Sarcopenia — EWGSOP2** (fuerza prensil + ASMI + ángulo de fase; `dxSarcopenia` ~L3430, render ~L6227-6252) | No se muestra | **(b-CLÍNICO)** | **MARCAR (Q5).** La fuerza prensil no se captura hoy y el DFI/EFR no la usan (Q5 abierta). Mostrar este bloque implicaría capturar prensil y, si debe influir, un frozen delta. Revisión con Gildardo, no construir. |
| **MCCB — Mapa Composición Corporal Bidimensional** (SVG FMI×FFMI, 12 fenotipos `FENOTIPOS_MCCB` ~L10991) + **PBI** + **EIEC** (CAPA 2 "tesis doctoral", ~L10961) | No se muestra | **(b-CLÍNICO)** | **MARCAR.** En B11 se decidió NO portar esta taxonomía: Atlas porta EFR (81) / estructural (9) / FyR (9), no MCCB-12 / PBI / EIEC (ver memoria `b11-status`). Reabrir si debe entrar a la vista de resultados es decisión clínica de Gildardo, no build. |
| **Diana FyR** (segunda diana polar, 9 sectores IFC×IRC × 9 anillos FFMI×FMI, `DianaFyR` ~L4707) | Sector FyR como texto | (b) render | Segunda visualización; el dato (sector FyR) ya está en el snapshot. Puramente estético/opcional. |
| **Tab Recomendaciones** (nutracéuticos con indicaciones + argumento científico, `TabRecomendaciones` ~L7467) | "Nutracéuticos sugeridos" (una línea) + rutas | (a)+(b) | El nutracéutico ya está en el snapshot/`efr_states`; el HTML lo enriquece con indicaciones y racional. Parte (a) datos, parte (b) render enriquecido. |
| **Tab Evolución** (histórico longitudinal, ~L8444) | Comparación de seguimiento básica (feature aparte, B13) | (c) | La comparación de seguimiento vive en su propia superficie; la vista longitudinal rica ya está en BACKLOG (Producto). Fuera de la vista de resultados. |
| **Tab Resumen / KPIs** (~L10417) | Header + constelación | (b) render | Layout de resumen (tarjetas KPI). Cosmético. |
| **Reporte al paciente** (render del PDF, ~L9956-10081) | PDF propio de Atlas (B10/B10.1) | (c) | Atlas tiene su propio reporte; no es la vista interna de resultados. |

## Marcados para revisión clínica con Gildardo (NO construir)

1. **Sarcopenia / fuerza prensil (Q5).** Definir si la prensil entra al diagnóstico (frozen delta)
   o es solo captura, antes de decidir si el bloque de sarcopenia va en la vista de resultados.
2. **MCCB-12 + PBI + EIEC.** Confirmar si esta "capa 2" del prototipo debe existir en Atlas o si la
   decisión de B11 (no portarla) se mantiene. Es cálculo/taxonomía clínica, no solo render.

## Faltantes que SÍ son alcance candidato del bloque de resultados (no clínicos)

- Color + posición de la Diana EFR (b) — ya decidido, es el núcleo del bloque siguiente.
- Diagnóstico antropométrico (b) — re-exponer BMI/ICC/ICT/cintura/cadera desde `bis_raw_values` +
  portar cortes de clasificación (ratios, no ciencia congelada). A confirmar en el plan.
- Enriquecer Recomendaciones (a+b) y, opcional, Diana FyR / Resumen (b, cosmético).
