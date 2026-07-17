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

---

# Parte 2 — Estructura y layout (cómo organiza la información el HTML)

**Restricción de negocio (importante):** con este HTML se forma a los Integrantes. Su
estructura/layout está "pagada" en la formación (familiaridad), así que **se preserva por
defecto**. Solo nos apartamos donde la estructura del HTML esté **claramente rota o no
funcional**, y esas desviaciones se marcan abajo para que Santiago las juzgue. Inventario leído
del código fuente del HTML (el runtime tiene el bug de render de la Q4: la vista de
diagnóstico/tratamiento sale en blanco, así que la estructura se infiere del código, no de la
pantalla).

## Navegación del HTML: módulos como pasos, cada uno con tabs internas

El prototipo es un flujo de **módulos** (pasos del profesional), cada uno con su propia barra de
tabs. Orden:

1. **Módulo 1 · Encuesta CNV** (L64) — tabs D0-D8 (`TABS_ENC`, L2825). Intake del paciente.
2. **Módulo 2 · Antropometría & BIS** (L2432) — captura manual de peso/talla/cintura/cadera y del
   BIS, con diagnóstico antropométrico y de sarcopenia inmediatos. Tabs `📋 Datos · 🎯 EFR BIS ·
   📈 Evolución` (`TABS`, L5453).
3. **Módulo 3 · Resumen** (L6284) — vista resumen (`📊 Resumen`, L10416).
4. **Módulo 4 · Diagnóstico integral** (L8342) — la vista de resultados principal. Tab por defecto
   `integral`, más `📈 Evolución` y `💊 Recomendaciones` (`TABS`, L8436), y un salto a
   `diagnostico` (L8612). Arriba, una **tarjeta de estado del paciente** (L10686).
5. **Módulo 5 · Rutas & Reporte** (L9316) — rutas de atención + reporte.
6. **Módulo Reporte / Historia Clínica completa** (L10347) — el documento imprimible (tabs
   `📋 Encuesta · 📊 Resumen · ...`, L10405).

## Jerarquía visual dentro de la vista de diagnóstico

- **Tarjeta de estado del paciente** como cabecera (nombre + indicadores clave, L10686).
- **`SectionTitle`** (rótulos pequeños en mayúsculas, L4213) sobre **`Card`** blancas redondeadas.
- **KPI cards** (número grande + etiqueta): p. ej. "Anillo MCCB", índices (L10012).
- **Chips/badges** para clasificaciones (antropométricas, sarcopenia) con color por severidad.
- **Tablas** para indicadores y clasificaciones.
- Las dos **Dianas** (EFR y FyR) como piezas visuales centrales.

## Atlas hoy

Una **única página con scroll** (`/evaluaciones/[id]`) de `Card` apiladas en orden fijo:
Diagnóstico funcional → Diana EFR (monocroma) → Indicadores (tabla) → DFI (5 dominios + riesgo +
rutas) → constelación de versiones. Sin tabs, sin módulos, sin tarjetas KPI de resumen. El
**flujo de trabajo** (confirmar identidad, importar BIS, generar, aprobar/enviar) vive aparte, en
el panel `/evaluaciones`.

## Comparación estructural

| Elemento estructural del HTML | Atlas hoy | Preservar / desviar | Nota |
|---|---|---|---|
| Navegación por **tabs** dentro del diagnóstico (Integral / Diana / Evolución / Recomendaciones) | Scroll único de cards | **Preservar** (familiaridad) | Candidato claro: organizar la vista de resultados en las tabs del HTML. |
| **Tarjeta de estado del paciente** como cabecera con indicadores clave | Header simple (nombre, fecha, confirmado) | **Preservar** | Falta el resumen KPI de cabecera. |
| **KPI cards** (número grande + etiqueta) para índices/anillo | Tabla de 12 indicadores | **Preservar/mezclar** | La tabla es correcta pero densa; el HTML jerarquiza con KPIs arriba + detalle abajo. |
| **Clasificaciones antropométricas** en chips (IMC/IC/ICC/ICT) | No se muestran | Preservar (ver Parte 1, faltante (b)) | Estructura + dato faltan juntos. |
| **Módulos como pasos** (Encuesta → Antropometría → Diagnóstico → Rutas → Reporte) | Flujo repartido: intake público + panel `/evaluaciones` + `/reportes` | **Desviación justificada** | Atlas separa por RLS/roles y por captura (encuesta pública, import de BIS), no por módulos de una SPA. No copiar la captura manual del HTML. |

## Marcas: estructura del HTML rota / no funcional (para que Santiago juzgue)

- **[ROTO EN RUNTIME] La vista de diagnóstico/tratamiento del HTML sale en blanco (Q4).** No hay
  layout observable en pantalla; se preserva la **intención de estructura del código fuente**, no
  un render roto. No se replica el bug.
- **[DESVIACIÓN JUSTIFICADA] Módulo de Antropometría & BIS con captura manual.** En Atlas el BIS
  entra por import de XLSX (B8) y la antropometría viene del mismo export; no hay entrada manual.
  La estructura de "formulario de captura" del HTML no aplica; su parte de **resultados**
  (clasificaciones antropométricas, sarcopenia) sí es candidata (Parte 1).
- **[REDUNDANCIA] Múltiples superficies de reporte** (Módulo 5 Rutas&Reporte + Módulo Reporte/HC +
  render de reporte al paciente). Atlas lo consolidó en un solo PDF (B10/B10.1). No replicar las
  múltiples entradas de reporte del HTML; mantener una sola.
- **[A JUZGAR] Tab "Evolución" dentro del diagnóstico.** En Atlas la comparación de seguimiento es
  una superficie aparte (B13). Preservar como tab vs. mantener separada es decisión de Santiago.

**Resumen de la Parte 2:** la estructura por tabs y la jerarquía KPI + cards del HTML se preservan
como base de la vista de resultados de Atlas; las desviaciones (captura manual, reportes
múltiples, runtime roto de la Q4) están marcadas y son justificadas o quedan a juicio de Santiago.
