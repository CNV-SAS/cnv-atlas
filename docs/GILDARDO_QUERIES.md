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

---

## Q4 · Bug de pantalla en blanco en el prototipo (informativo, NO bloqueante)

- **Fecha:** 2026-07-07 (B12)
- **Estado:** INFORMATIVO (cortesia; no afecta a Atlas)
- **Hallazgo:** en `ATLAS-Patients_v7.html`, al abrir las vistas de diagnostico/tratamiento el prototipo muestra una pantalla en blanco (error de render en su UI). No es un problema de la ciencia ni de los datos: ya extrajimos todo lo que necesitabamos de ese archivo (la ciencia congelada en B11 y el patron de UX de la encuesta en B7.1).
- **Impacto en Atlas:** ninguno. Atlas tiene su propia vista de resultados (vista interna del profesional, B12) y su propio reporte, funcionando de forma independiente del HTML de referencia. No corregimos el HTML de Gildardo.
- **Nota a Gildardo:** aviso de cortesia por si quiere revisar su prototipo; para nosotros no es un bloqueante.

---

## Q5 · Fuerza prensil: ¿debe influir en el DFI y las rutas, o es solo de display?

- **Fecha:** 2026-07-10 (verificación del HTML actualizado)
- **Estado:** ABIERTO (define el alcance de un ítem futuro de encuesta)
- **Contexto:** Gildardo entregó un `ATLAS_v7.html` actualizado (10 jul) con, entre otros, la fuerza prensil (dinamometría) agregada a antropometría y "al diagnóstico de sarcopenia". Se comparó contra los tres `.js` congelados.
- **Hallazgo:** la ciencia que Atlas porta NO cambió. `dxSarcopenia`, `cSMM`, `cMMEM`, `cASMI` y las constantes de los índices (ISCM/IEHH/EB-BIS/IAE) son idénticas byte a byte; la fuerza prensil ya era el criterio primario EWGSOP2 en el paquete congelado del 5 de julio. Los `.js` de `src/clinical-engine/frozen/` siguen byte-idénticos al paquete de referencia.
- **La distinción clave:** en el HTML nuevo, la fuerza prensil entra a un flag de obesidad sarcopénica que vive en el bloque de **render MCCB** (`ATLAS_v7.html` ~L11008: `const sarcopenia = ... || sarcoDx.k >= 2`, con `sarcoDx` calculado desde `dxSarcopenia(fuerzaPrensil, ...)`). Ese bloque es una ruta de **visualización**, distinta de `computeDFIFromData` (~L9456) y `computeDFI` (~L11304), que son las funciones que Atlas realmente porta. El DFI congelado calcula su propia obesidad sarcopénica SIN prensil: `_obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow)`. Y `engine.ts` arma `rutas: dfiRaw.rutas` desde `computeDFIFromData`, no desde `rutasPorCondicion`. Es decir, hoy la fuerza prensil no toca ningún indicador, DFI, ruta ni fenotipo del `EngineOutput`; `EngineInput` ni siquiera tiene un campo `fuerzaPrensil`.
- **Nuestra decisión (Santiago, 2026-07-10):** no se re-verifican golden tests (nada de lo que Atlas porta cambió). Las preguntas nuevas (suplementos, alergias, cirugías GI), el reorden del panel y la captura de prensil son UI/encuesta, candidatas a un ítem incremental futuro, no un port de ciencia.
- **Pregunta a Gildardo:** ¿la fuerza prensil debe influir en el DFI y en la selección de rutas (es decir, en el diagnóstico que Atlas computa y persiste), o es solo un indicador de pantalla en su prototipo? Si debe influir, hay que entregarlo como un frozen delta nuevo (versión nueva de los `.js`, swap limpio) que wire `dxSarcopenia`/prensil dentro de `computeDFIFromData`, con golden tests actualizados. Si es solo de display, el ítem futuro se limita a capturar la prensil como dato de antropometría, sin tocar el motor. La respuesta define si ese ítem es "solo encuesta" o "encuesta + delta del motor".
