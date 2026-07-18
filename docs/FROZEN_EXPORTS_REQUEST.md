# FROZEN_EXPORTS_REQUEST.md — solicitud consolidada a Gildardo (BORRADOR / WIP)

**Estado:** BORRADOR en construcción. Se completa a medida que se construye la vista de Diagnóstico
(ST4-ST7); cada función interna del frozen que Atlas necesite exponer se anota aquí al encontrarla.
**NO se envía todavía:** Santiago la revisa con Gildardo y su CC antes de que salga. Consolida
[[Q9]] y [[Q10]] (y lo que aparezca al construir el radar y el resto).

**Por qué una sola solicitud:** encontramos el mismo bloqueo repetido (funciones que existen en el
paquete congelado pero no están en el `module.exports`). En vez de queries goteando que piden
"resuélvelo", le llegamos a Gildardo con la solución propuesta lista para que él y su CC solo
aprueben.

## Regla de custodia (crítica, no negociable)

Atlas **NO edita el `.js` frozen ni se lo entrega modificado.** La propiedad verbatim (byte a byte
contra la ciencia de Gildardo) exige que el cambio **nazca del lado de Gildardo**, para preservar la
cadena de custodia de la ciencia. El flujo es:

1. Atlas propone EXACTAMENTE qué líneas agregar (abajo).
2. Gildardo / su CC lo aplican en **su** repo y nos entregan el `.js` nuevo.
3. Atlas hace el **swap limpio** del archivo y el **golden test** confirma que **nada más cambió**.

Esta solicitud dice **"les proponemos este cambio exacto para que lo apliquen de su lado"**, NO
"aquí está el archivo ya cambiado".

**Naturaleza del cambio:** SOLO exposición. Se agregan nombres al `module.exports`, exactamente como
ya se exponen `getDX`/`efrCompose`. **No se toca la lógica de ninguna función.** El golden lo
verifica (los valores no cambian; solo pasa a ser alcanzable desde el adaptador).

## Funciones que Atlas necesita exponer

### 1. `efrProf` — abordaje por profesión (de Q9)
- **Archivo:** `frozen/engine.core.js` (definida ~L807, no exportada).
- **Qué habilita:** la 6ª tarjeta de la Diana ("abordaje por profesión"), texto por rol
  (Médico / Psicólogo / Deportólogo / Nutricionista). Atlas congela el **conjunto de los 4 roles**
  en el snapshot al diagnosticar (para que un diagnóstico histórico muestre el abordaje del rol tal
  como el modelo lo tenía, sin acoplarse al rol ni al registry vivo).
- **Vía A (exponer la función):** agregar `efrProf` al `module.exports`.
- **Vía B (datos, quizá más natural para TEXTO):** entregar el abordaje como tabla
  `estado EFR × profesión → texto`, para poblarlo en el registry como el resto del contenido EFR.
  Para contenido de texto, esta vía puede ser más limpia. **Que su CC elija la vía.**

### 2. Clasificadores de composición (de Q10)
- **Archivo:** `frozen/engine.core.js` (definidos, no exportados).
- **Funciones:** `cSMM`, `cMMEM`, `cASMI`, `cFFW`, `cEISG`.
- **Qué habilitan:** la columna de Diagnóstico de la tabla de composición (SMM/W, MMEM, ASMI,
  hidratación libre de grasa, balance E/I). `cASMI` además toca sarcopenia (Q5).
- **Vía recomendada (exponer la función):** para clasificadores (funciones de corte), exponer es más
  limpio que transcribir datos. Agregar los 5 al `module.exports`.
- **Nota `dAECMCA` (AEC/MCA):** es render-only (no está en el paquete congelado). Decidir si Gildardo
  la incorpora al paquete o si Atlas la trata como referencia de display (como los umbrales OMS).

### 3. Diagnóstico de consumo alimentario (D1-D8, patrón alimentario)
- **Origen:** NO está en el paquete congelado. El patrón alimentario (alimentos protectores /
  moderados / de riesgo, con su scoring por grupos) se computa en la **capa de render** del
  prototipo (`ATLAS_v7.html`: categorización de alimentos ~L587-686, funciones de scoring
  ~L2342 y ~L3234, `FREQ_GROUPS`). Es la misma familia que `calcularDominios`/`dAECMCA`:
  lógica de presentación que nunca se porto al motor.
- **Qué habilita:** la sección "Diagnóstico de encuesta" de la pestaña de Diagnóstico (hoy
  placeholder "Disponible proximamente"). Es análisis clínico de la encuesta D1-D8.
- **Por qué no se resuelve del lado de Atlas:** reimplementar la categorización y el scoring en
  TS sería reingeniería de la lógica clínica de Gildardo (prohibido); no se deriva fielmente de
  las respuestas crudas sin esa lógica.
- **Vías (que su CC elija):** (a) **incorporar la función al paquete congelado** y exponerla en
  `module.exports`, como el resto; o (b) **entregar la categorización + los cortes como datos**
  (mapa alimento -> categoría, y los umbrales/pesos del scoring por grupo), para poblarlos en el
  registry. Para contenido tan tabular, la vía de datos puede ser la más limpia.

### 4. Rangos de referencia de los 12 indicadores (columnas Referencia y Δ)
- **Origen:** los cortes que definen el rango esperado de cada indicador viven DENTRO de los
  clasificadores congelados (`cIFC`, `cIRC`, `cPABU`, `cFMI`, `cFFMI`, `cISCM`, `cIEHH`, `cIAE`,
  `cAF`, `cIR`): p. ej. `cIFC(v, sexo)` usa `lo/hi` (hombres 4.12/6.68, mujeres 2.08/3.28), pero
  la funcion solo DEVUELVE `{ label, color, risk, k }`, no el `lo/hi`. El snapshot guarda
  `IndicatorClass = { label, k }`, sin rango. Los umbrales no estan expuestos como dato.
- **Qué habilita:** las columnas Referencia (rango esperado) y Δ (desviacion) en la tabla de los
  12 indicadores de la pestaña de Diagnostico, que es como el profesional lee el porque de la
  clasificacion. Hoy la tabla tiene 3 columnas (Indicador, Valor, Clasificacion); faltan esas dos.
- **Por qué no se resuelve del lado de Atlas:** transcribir los `lo/hi` de cada clasificador en TS
  duplicaria la ciencia congelada (drift si Gildardo recalibra), y viola la propiedad verbatim.
- **Vías (que su CC elija):** (a) **entregar los cortes como datos** (tabla indicador × sexo →
  `{ lo, hi, unidad }`), la mas natural para una columna de referencia; o (b) **exponer una
  funcion** que dado el indicador/sexo devuelva el rango.
- **Ojo con Δ:** la referencia es un RANGO (lo/hi), no un punto. Para una columna Δ hay que
  definir contra que se mide la desviacion (borde mas cercano del rango, punto medio, etc.). Esa
  definicion tambien la da Gildardo; Atlas no la inventa.

### (se agregarán más a medida que ST4-ST7 las encuentren)

## Propuesta de línea exacta (a confirmar al cerrar la lista)

`frozen/engine.core.js`, `module.exports` actual:
```js
module.exports = { calcIFC, calcIRC, calcPABU, cIFC, cIRC, cPABU, cFMI, cFFMI, cISCM, cIEHH, cIAE, cAF, cIR, kl, DX, efrCompose, getDX, FYR_LABELS, STRUCT_LABELS };
```
Propuesta (agregar SOLO los nombres, sin tocar lógica; lista provisional, se cierra al terminar la vista):
```js
module.exports = { calcIFC, calcIRC, calcPABU, cIFC, cIRC, cPABU, cFMI, cFFMI, cISCM, cIEHH, cIAE, cAF, cIR, kl, DX, efrCompose, getDX, efrProf, cSMM, cMMEM, cASMI, cFFW, cEISG, FYR_LABELS, STRUCT_LABELS };
```
(Si para el abordaje se elige la vía de datos, `efrProf` no entra al export y en su lugar se entrega
la tabla estado × profesión.)
