# GILDARDO_QUERIES.md — Bitácora de hallazgos pendientes de confirmar

**Propósito:** registrar, en un solo lugar, los hallazgos sobre la ciencia congelada (el motor de Gildardo) que requieren su confirmación o decisión. Nada de esto se corrige tocando los `.js` congelados de `src/clinical-engine/frozen/` (regla dura 12, excepción formal). Cuando se detecte algo nuevo que dependa de Gildardo, se anota aquí con fecha, en vez de quedar solo en el chat.

**Convención de estado:** `ABIERTO` (esperando respuesta), `CONFIRMADO` (Gildardo respondió; se resume la resolución), `DESCARTADO` (se resolvió sin cambio).

---

## Q1 · ISCM: FMI omitido en el `index.ts` de conveniencia

- **Fecha:** 2026-07-06 (B11)
- **Estado:** ABIERTO (informativo; ya mitigado de nuestro lado)
- **Hallazgo:** el `index.ts` de conveniencia que Gildardo incluyó en el paquete armaba el objeto para `computeISCM` como `{ ...imp.raw, ifc }` y omitía `FMI` (que es derivado, no columna cruda del Biody). Con FMI ausente, el ISCM daba -1.568 en lugar del valor oro -2.072.
- **Evidencia de que el defecto NO está en la ciencia congelada:** en `ATLAS_v7.html` L5700, `computeISCM` usa `bis.FMI`, y el estado `bis` del HTML llega con FMI poblado. Es decir, el HTML (fuente de verdad) sí pasa FMI; solo el `index.ts` de conveniencia lo perdía.
- **Nuestra acción:** el `index.ts` de conveniencia se reemplazó por nuestro adaptador `src/clinical-engine/analysis.ts`, que pasa `FMI` explícito a `computeISCM`. La ciencia congelada quedó intacta. El golden test ancla el valor -2.072.
- **Pregunta a Gildardo:** confirmar que el `index.ts` de conveniencia era solo un ejemplo de uso (no la vía oficial), y que la vía correcta siempre pasó por el estado `bis` con FMI. Sin cambios esperados en los `.js`.

---

## Q2 · TDZ en `computeDFIFromData` (`sexoM` usado antes de declararse)

- **Fecha:** 2026-07-06 (B11)
- **Estado:** ABIERTO (bug latente preservado verbatim; no dispara en el flujo real)
- **Hallazgo:** en `computeDFIFromData` (`frozen/engine.dfi.js`, extraído de `ATLAS_v7.html` L9456-9504), `sexoM` se usa al calcular `pabu` una línea antes de declararse con `const` (temporal dead zone). En JavaScript esto lanzaría `ReferenceError` si esa rama se ejecutara.
- **Por qué no truena hoy:** el adaptador `analizarDFI` pasa `PABU` ya precalculado; `num("PABU", "pabu")` retorna un valor y el `||` corta antes de evaluar `calcPABU(..., sexoM)`. La rama con el TDZ nunca se ejecuta en el flujo normal.
- **Nuestra acción:** preservado byte a byte (no se toca la ciencia congelada). Documentado en el encabezado de `frozen/engine.dfi.js`.
- **Pregunta a Gildardo:** confirmar que es un bug latente conocido y aceptado, o entregarlo corregido en una versión nueva del `.js` (swap limpio; el golden avisará si cambia algún valor).

---

## Q3 · Gap LE8: `d1_9` / `d1_10` / `d1_16` no existen en la encuesta real

- **Fecha:** 2026-07-07 (ítem de encuesta real)
- **Estado:** ABIERTO (decisión tomada de nuestro lado: port fiel, dominios degradados)
- **Hallazgo:** `calcLE8` (`frozen/engine.dfi.js`) lee `d1_9`, `d1_10` (como número de porciones) y `d1_16` (como vasos de agua) para los dominios **Alimentación** e **Hidratación** del LE8. Pero la encuesta real (`ATLAS-Patients_v7.html`) **no recolecta esos campos**:
  - Los alimentos se capturan como frecuencias de consumo con sufijo `_i` (`d1_9_i` = "Tubérculos y raíces", `d1_10_i` = "Carnes magras"), semántica distinta a "porciones".
  - El agua se captura como `d7_agua`, no `d1_16`.
  - Los `d1_9` / `d1_10` / `d1_16` planos solo existen en el objeto `CASO_DEMO` hardcodeado del prototipo (L6148); no hay adaptador que los derive de los campos reales.
- **Consecuencia (idéntica en el prototipo de Gildardo):** para un paciente real, los dominios **Alimentación** e **Hidratación** del LE8 corren con los valores por defecto (30 y 20 respectivamente); los otros 6 dominios del LE8 y el DFI completo sí encienden con datos reales.
- **Nuestra decisión (Santiago, 2026-07-07):** port fiel (Opción A). No se inventa ningún mapeo `d1_9_i → d1_9` ni `d7_agua → d1_16` (sería inventar matemática clínica). Los 2 dominios corren degradados, documentado. La encuesta se porta completa (63 campos) como instrumento clínico; solo 13 campos alimentan el motor.
- **Pregunta a Gildardo:** ¿los dominios Alimentación e Hidratación del LE8 deben derivarse de las frecuencias `d1_*_i` y de `d7_agua` mediante una fórmula que él defina? Si sí, la entrega como parte de la ciencia (para portarla fiel); si no, quedan degradados por diseño. Mientras tanto, no se toca el motor.
