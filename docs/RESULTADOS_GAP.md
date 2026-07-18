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

---

# Parte 3 — Auditoría de fuente de la pestaña de Diagnóstico

**Marco (decidido):** `/evaluaciones/[id]` adopta el flujo por etapas del HTML como pestañas
internas (Encuesta / Antrop&BIS / **Diagnóstico** / Rutas / Seguimiento / Reporte); el sidebar
sigue navegando entre entidades. Este bloque audita SOLO la pestaña de Diagnóstico. Leído del
código fuente del HTML (`reference/ATLAS_v7.html`; el runtime tiene el bug de la Q4). Doc-only.

**Origen de cada valor/clasificación:** (a) sale de un clasificador del motor congelado o ya está
en el snapshot → display, portable directo; (b) umbral aplicado en el render (fuera del motor)
→ señalado; (c) fuera de alcance. Los (b) de cálculo clínico se marcan para revisión, NO construir.

## Tabla de origen por fila

| Fila del Diagnóstico (HTML) | Qué muestra | Origen | Portabilidad / acción |
|---|---|---|---|
| **Composición Corporal — Niveles de Wang** (tabla V/IV/III/II, L6144) | Variable · valor obtenido · referencia · Δ | (a) valores y referencias del import BIS (`bis_raw_values`, inmutable por medición); Δ = resta en el render (trivial) | Portable como display. Los valores NO están en el snapshot del diagnóstico (viven en `bis_raw_values`). **Decisión:** congelarlos en el snapshot (autosuficiencia total) o leerlos de `bis_raw_values` (inmutable por medición, no del registry vivo → aceptable). No es clasificador clínico. |
| **Clasificación antropométrica** (IMC / Cintura / ICT con etiqueta de diagnóstico, `clasifIMC`/`clasifCC`/`clasifICT` L6416-6470) | IMC "Obesidad I", cintura "Riesgo CV", ICT "Saludable" | (b) umbral aplicado en el render, FUERA del motor. **Umbrales médicos ESTÁNDAR** (OMS/WHO: IMC 18.5/25/30/35/40 kg/m²; circunferencia de cintura riesgo CV 94/102 cm H · 80/88 cm M; índice cintura-talla 0.4/0.5/0.6) | **Referencia de display**, NO ciencia congelada ANI-BIS-E: cutoffs universales publicados (OMS). Portables como umbrales documentados con su fuente. Los valores (IMC/cintura/ICT) se derivan de `bis_raw_values` (BMI/cintura/talla). **Decisión menor:** computarlos al mostrar desde los cutoffs estándar (que no cambian) — recomendado — o congelar la clasificación en el snapshot. **La UI los rotula como referencia médica estándar (OMS), NO como output del motor ANI-BIS-E.** NO requiere a Gildardo. |
| **Indicadores ANI-BIS-E** (12) con clasificación | IFC/IRC/PABU/ICA-BIS/ISCM/IEHH/IAE/EB/FMI/FFMI/AF/IR + etiqueta | **(a)** clasificadores del motor congelado (`cIFC`, `cIRC`…), YA en el snapshot (`indicators` + `classifications`) | Portable directo. Atlas ya lo muestra. |
| **Diagnóstico funcional + radar de 5 dominios (DFI)** | 5 dominios + severidad + riesgo integrado + rutas | **(a)** el DFI está en el snapshot (`dfi.domains/riesgo/rutas`). El RADAR es visual (b, presentación) | Datos portables directo (Atlas ya los muestra como tarjetas). El radar es un componente visual a construir (como la Diana). |
| **Diana + 6 tarjetas de contenido** por estado EFR | (1) enfermedades/complicaciones, (2) mecanismos, (3) biomarcadores, (4) riesgos, (5) nutracéuticos, (6) abordaje por profesión | **(a) 5 de 6** congelados en `efrContent` (ST1/ST5); **(6) abordaje** = `efrProf(role)`, NO congelado, role-dependent | 5 portables del snapshot. El 6º requiere decisión (Verificación 3). |
| **Diagnóstico de Sarcopenia** (`dxSarcopenia` + prensil, L6227) | Veredicto: Sin sarcopenia / probable / confirmada / severa | **(b-CLÍNICO)** el veredicto depende de la fuerza prensil (criterio primario EWGSOP2); sin prensil → "Ingrese fuerza prensil" | **NO se porta** (Q5). Ver Verificación 1. |

## Verificación 1 — El veredicto de sarcopenia depende de la fuerza prensil

Evidencia: `dxSarcopenia(fuerza, asmi, af, sexoM)` (`ATLAS_v7.html` L3434). La fuerza prensil es el
criterio PRIMARIO EWGSOP2. Sin prensil (`fz <= 0`) devuelve `{ l: "Ingrese fuerza prensil" }`, sin
veredicto (L3439). Todo veredicto real (probable/confirmada/severa) exige `fzLow` (prensil bajo).
El DFI congelado, en cambio, calcula obesidad sarcopénica SIN prensil
(`_obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow)`, Q5), y `EngineInput` ni siquiera tiene
un campo `fuerzaPrensil`.

→ **El veredicto de sarcopenia NO se porta.** Atlas no captura prensil. Queda como dato
antropométrico sin veredicto; la sarcopenia real (EWGSOP2 con prensil) sería un **frozen delta**
futuro de Gildardo, con golden actualizado. **Marcado para revisión, NO construir. Ubicación:** si
algún día existe, va en la pestaña **Diagnóstico**, no en Antrop&BIS.

## Verificación 2 — Contenido de la Diana: qué falta congelar

El HTML compone 6 campos por estado (`efrCompose` L3994 + `efrProf` L4039): dx
(enfermedades/complicaciones), mec, bio, rsk, n (nutracéuticos VITACELLEBIS), abordaje por
profesión. Nuestro snapshot congela (`efrContent`, ST1): `diagnosisName`(=dx), `mechanism`(=mec),
`biomarkers`(=bio), `risks`(=rsk), `suggestedNutraceuticals`(=n) → **5 de 6**.

- **FALTA: "abordaje por profesión"** (`efrProf`), NO congelado. **DIFERIDO (Q9):** `efrProf` está
  en el paquete congelado (`engine.core.js` L807) pero NO se exporta, y no se edita el `.js` frozen
  (regla 12). No es alcanzable desde el adaptador (const module-local en CJS) ni existe como dato
  estático que poblar (a diferencia de dx/mec/bio/rsk, que salen de `getDX`, exportado). Se pide a
  Gildardo exponer `efrProf` o entregar el abordaje como datos (Q9). Hasta entonces, la tarjeta se
  omite y el layout deja el hueco listo. La FORMA de congelarlo, cuando se destrabe, es el conjunto
  completo de roles (Verificación 3).
- **Matiz "enfermedades/complicaciones probables":** SÍ está congelado, es nuestro `diagnosisName`
  (= dx.dx). Hoy Atlas lo muestra como TÍTULO del diagnóstico funcional, no como una tarjeta
  rotulada. Es el mismo valor: mostrarlo como una de las 6 tarjetas es decisión de presentación,
  no falta el dato.
- **Vacíos:** evidencia: los 81 estados del registry tienen mec/bio/risks **NO vacíos** (0 vacíos;
  N_N_N_A trae valores cortos, no vacíos). El display ya tolera el vacío: el helper `Line` retorna
  `null` ante un valor falsy (no rompe); el snapshot guarda strings (vacío = `""`, tolerado). Si a
  futuro Gildardo entrega contenido con campos vacíos, no rompe display ni snapshot.

## Verificación 3 — "Abordaje por profesión" es role-dependent

Evidencia: `efrProf(role, i, r, f, m)` (L4039) recibe `role` y ramifica el texto: **Médico**
(L4043), **Psicólogo** (L4050), **Deportólogo/Entrenador** (L4053), **Nutricionista** (default,
L4059). El texto CAMBIA según la profesión del profesional logueado; no es fijo por estado.

→ Implicaciones de diseño (Atlas soportará varios tipos de profesional, bloque aparte): el
contenido del MODELO y la acción específica del profesional deben quedar como **capas
separables**: (i) el estado EFR define el conjunto de abordajes; (ii) el rol selecciona cuál se
muestra. **Recomendación de congelado:** congelar en el snapshot el CONJUNTO de abordajes del
estado (los de los 4 roles) y seleccionar por rol al mostrar; así el snapshot es autosuficiente y
el contenido del modelo no se entreteje con el rol. (Alternativa mínima: congelar solo el abordaje
del rol que diagnosticó; más chico, pero pierde los otros si otro rol revisa el caso.) Hoy Atlas es
solo nutricionista (el default de `efrProf`); para el MVP podría congelarse solo ese, dejando el
diseño listo para el conjunto.

## Resumen: qué es cada cosa para el bloque de Diagnóstico

- **Portable directo (a, ya en el snapshot):** indicadores ANI-BIS-E + clasificaciones; DFI (5
  dominios + riesgo + rutas); 5 de las 6 tarjetas de la Diana. (+ color/posición de la Diana, ya
  decidido en Parte 1.) El radar y el layout de tarjetas son visual a construir, sin dato nuevo.
- **Re-exponer / decidir congelar (a-ish):** tabla de Wang (valores de `bis_raw_values`);
  clasificación antropométrica (umbrales estándar de display). Ninguno toca el registry vivo.
- **Diferido, bloqueado por Gildardo (Q9):** "abordaje por profesión". `efrProf` existe en el
  paquete congelado pero no se exporta; no se edita el `.js` frozen. Se congelará el conjunto
  completo (4 roles) cuando Gildardo lo exponga o entregue el abordaje como datos. La tarjeta se
  omite hasta entonces.
- **Marcado para revisión con Gildardo, NO construir:** veredicto de sarcopenia / fuerza prensil
  (Verificación 1); y lo ya marcado en Parte 1 (MCCB-12 + PBI + EIEC).

---

# Parte 4 — Auditoría de la columna de Diagnóstico de la tabla de composición (ST3)

En la pestaña de Diagnóstico, la tabla de composición es la versión INTERPRETADA (5 columnas:
Variable · Valor · Referencia · Δ · **Diagnóstico**). Esa 5ª columna es lo que la diferencia de la
tabla cruda de Antrop&BIS. Auditoría fila por fila del ORIGEN de cada diagnóstico, antes de
poblarlo (leído del HTML + verificado contra los exports de `frozen/engine.core.js`).

## Origen por grupo de filas

| Grupo de filas | Clasificador (HTML) | Origen | Disponible ahora |
|---|---|---|---|
| Antropométricas (IMC / cintura / ICT, Nivel V) | `clasifIMC`/`clasifCC`/`clasifICT` | **(a)** umbrales OMS de display | **Sí** (ya construidos en ST3) |
| Filas que coinciden con un indicador ANI-BIS-E (FMI, FFMI, AF) | `cFMI`/`cFFMI`/`cAF` (EXPORTADOS) | **(b)** clasificador congelado, ya en `snapshot.classifications` | **Sí** (leer del snapshot) |
| SMM/W, MMEM (índice), ASMI | `cSMM`/`cMMEM`/`cASMI` | **(c)** clasificador congelado pero **NO exportado** (no en `module.exports`, no en el snapshot) | **No** (bloqueado, Q10) |
| Hidratación libre de grasa (FFW), balance E/I | `cFFW`/`cEISG` | **(c)** congelado pero NO exportado | **No** (bloqueado, Q10) |
| AEC/MCA (ratio extracelular/celular) | `dAECMCA` (L12397) | **(c)** función SOLO de render (ni siquiera en el paquete congelado) | **No** (render-only; candidato a referencia de display) |
| Masas crudas (MCA kg, sólidos EC, AEC/AIC en L, agua total, proteína, minerales, Re/Ri/R∞/C) | — | Sin clasificador dedicado en el port | **No** (no hay diagnóstico congelado; no se inventa) |

## Verdicto

- La columna de Diagnóstico se puede poblar HOY solo para **(a)** antropométricas + **(b)** FMI/FFMI/AF
  (del snapshot).
- El resto (SMM/W, MMEM, ASMI, hidratación, E/I, AEC/MCA) es **(c)**: sus clasificadores
  (`cSMM`/`cMMEM`/`cASMI`/`cFFW`/`cEISG`) existen en el `.js` frozen pero **NO están expuestos** ni
  se computan en el snapshot. Es el **mismo bloqueo que el abordaje por profesión (Q9)**: no se edita
  el frozen, no se alcanza una const no exportada, no se re-implementa ni se inventa. Registrado como
  **[[Q10]]** (exponer los clasificadores o entregarlos como datos). `ASMI` además toca sarcopenia
  (Q5). `dAECMCA` es render-only: candidato a referencia de display si Gildardo lo confirma.

## Decisión pendiente (de Santiago)

1. **Construir la columna ahora con lo disponible:** poblar Diagnóstico para (a)+(b); dejar las (c)
   como "sin clasificación del motor" / "—" (no inventar), con la columna lista para cuando Q10
   resuelva. La tabla queda a 5 columnas de inmediato.
2. **Diferir la columna completa** hasta Q10, dejando la tabla cruda (4 columnas) en Diagnóstico por
   ahora.

Recomendado: (1) — muestra la diferencia con Antrop&BIS ya (antropométricas + índices clasificados),
es honesto sobre lo que falta, y no obliga a duplicar la tabla cruda. Sin inventar nada.
