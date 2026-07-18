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
