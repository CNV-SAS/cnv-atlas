# GILDARDO_QUERIES.md — Bitácora de hallazgos pendientes de confirmar

**Propósito:** registrar, en un solo lugar, los hallazgos sobre la ciencia congelada (el motor de Gildardo) que requieren su confirmación o decisión. Nada de esto se corrige tocando los `.js` congelados de `src/clinical-engine/frozen/` (regla dura 12, excepción formal). Cuando se detecte algo nuevo que dependa de Gildardo, se anota aquí con fecha, en vez de quedar solo en el chat.

**Convención de estado:** `ABIERTO` (esperando respuesta), `CONFIRMADO` (Gildardo respondió; se resume la resolución), `DESCARTADO` (se resolvió sin cambio), `CERRADO` (informativo, sin acción pendiente).

> **Ronda de respuestas de Gildardo (2026-07-15):** las cinco queries quedaron resueltas. Ninguna requiere cambio de código ni de golden tests ahora mismo; Q3 y Q5 dejan pendiente una posible entrega futura de ciencia (fórmula LE8 y frozen delta de prensil, respectivamente), que solo se portaría si Gildardo la entrega. La ciencia congelada no se toca.

---

## Q1 · ISCM: FMI omitido en el `index.ts` de conveniencia

- **Fecha:** 2026-07-06 (B11)
- **Estado:** CONFIRMADO (Gildardo, 2026-07-15; sin cambios en la ciencia congelada)
- **Hallazgo:** el `index.ts` de conveniencia que Gildardo incluyó en el paquete armaba el objeto para `computeISCM` como `{ ...imp.raw, ifc }` y omitía `FMI` (que es derivado, no columna cruda del Biody). Con FMI ausente, el ISCM daba -1.568 en lugar del valor oro -2.072.
- **Evidencia de que el defecto NO está en la ciencia congelada:** en `ATLAS_v7.html` L5700, `computeISCM` usa `bis.FMI`, y el estado `bis` del HTML llega con FMI poblado. Es decir, el HTML (fuente de verdad) sí pasa FMI; solo el `index.ts` de conveniencia lo perdía.
- **Nuestra acción:** el `index.ts` de conveniencia se reemplazó por nuestro adaptador `src/clinical-engine/analysis.ts`, que pasa `FMI` explícito a `computeISCM`. La ciencia congelada quedó intacta. El golden test ancla el valor -2.072.
- **Pregunta a Gildardo:** confirmar que el `index.ts` de conveniencia era solo un ejemplo de uso (no la vía oficial), y que la vía correcta siempre pasó por el estado `bis` con FMI. Sin cambios esperados en los `.js`.
- **Resolución (Gildardo, 2026-07-15):** Confirmado. El `index.ts` de conveniencia era solo un ejemplo de uso, no la vía oficial; la ruta correcta siempre pasó por el estado `bis` con FMI incluido, como en el HTML (fuente de verdad). Sin cambios en la ciencia congelada; valor oro del ISCM = -2.072. Cierra sin tocar los `.js`.

---

## Q2 · TDZ en `computeDFIFromData` (`sexoM` usado antes de declararse)

- **Fecha:** 2026-07-06 (B11)
- **Estado:** CONFIRMADO (Gildardo, 2026-07-15; bug latente aceptado, se deja verbatim)
- **Hallazgo:** en `computeDFIFromData` (`frozen/engine.dfi.js`, extraído de `ATLAS_v7.html` L9456-9504), `sexoM` se usa al calcular `pabu` una línea antes de declararse con `const` (temporal dead zone). En JavaScript esto lanzaría `ReferenceError` si esa rama se ejecutara.
- **Por qué no truena hoy:** el adaptador `analizarDFI` pasa `PABU` ya precalculado; `num("PABU", "pabu")` retorna un valor y el `||` corta antes de evaluar `calcPABU(..., sexoM)`. La rama con el TDZ nunca se ejecuta en el flujo normal.
- **Nuestra acción:** preservado byte a byte (no se toca la ciencia congelada). Documentado en el encabezado de `frozen/engine.dfi.js`.
- **Pregunta a Gildardo:** confirmar que es un bug latente conocido y aceptado, o entregarlo corregido en una versión nueva del `.js` (swap limpio; el golden avisará si cambia algún valor).
- **Resolución (Gildardo, 2026-07-15):** Confirmado como bug latente conocido y aceptado. La rama con el TDZ nunca se ejecuta en el flujo normal (entra PABU precalculado y el `||` corta antes de `calcPABU(..., sexoM)`). Se conserva el archivo byte a byte. Si en el futuro se entrega una versión reescrita del `.js`, el swap es limpio y el golden avisa si cambia cualquier valor. No se toca la ciencia congelada ahora.

---

## Q3 · Gap LE8: `d1_9` / `d1_10` / `d1_16` no existen en la encuesta real

- **Fecha:** 2026-07-07 (ítem de encuesta real)
- **Estado:** CONFIRMADO (Gildardo, 2026-07-15; defaults para el MVP, fórmula pendiente si se activan los dominios)
- **Hallazgo:** `calcLE8` (`frozen/engine.dfi.js`) lee `d1_9`, `d1_10` (como número de porciones) y `d1_16` (como vasos de agua) para los dominios **Alimentación** e **Hidratación** del LE8. Pero la encuesta real (`ATLAS-Patients_v7.html`) **no recolecta esos campos**:
  - Los alimentos se capturan como frecuencias de consumo con sufijo `_i` (`d1_9_i` = "Tubérculos y raíces", `d1_10_i` = "Carnes magras"), semántica distinta a "porciones".
  - El agua se captura como `d7_agua`, no `d1_16`.
  - Los `d1_9` / `d1_10` / `d1_16` planos solo existen en el objeto `CASO_DEMO` hardcodeado del prototipo (L6148); no hay adaptador que los derive de los campos reales.
- **Consecuencia (idéntica en el prototipo de Gildardo):** para un paciente real, los dominios **Alimentación** e **Hidratación** del LE8 corren con los valores por defecto (30 y 20 respectivamente); los otros 6 dominios del LE8 y el DFI completo sí encienden con datos reales.
- **Nuestra decisión (Santiago, 2026-07-07):** port fiel (Opción A). No se inventa ningún mapeo `d1_9_i → d1_9` ni `d7_agua → d1_16` (sería inventar matemática clínica). Los 2 dominios corren degradados, documentado. La encuesta se porta completa (63 campos) como instrumento clínico; solo 13 campos alimentan el motor.
- **Pregunta a Gildardo:** ¿los dominios Alimentación e Hidratación del LE8 deben derivarse de las frecuencias `d1_*_i` y de `d7_agua` mediante una fórmula que él defina? Si sí, la entrega como parte de la ciencia (para portarla fiel); si no, quedan degradados por diseño. Mientras tanto, no se toca el motor.
- **Resolución (Gildardo, 2026-07-15):** Para el MVP, los dominios Alimentación e Hidratación del LE8 quedan con sus valores por defecto (port fiel). No se inventa ningún mapeo `d1_9_i → d1_9` ni `d7_agua → d1_16`. Si más adelante se quieren esos dos dominios con datos reales, Gildardo entrega la fórmula que convierte las frecuencias `d1_*_i` y `d7_agua` en el puntaje LE8 correspondiente, y se porta fiel. Mientras tanto, el motor no se toca; los otros 6 dominios del LE8 y el DFI siguen con datos reales.

---

## Q4 · Bug de pantalla en blanco en el prototipo (informativo, NO bloqueante)

- **Fecha:** 2026-07-07 (B12)
- **Estado:** CERRADO (informativo; Gildardo notificado, sin acción)
- **Hallazgo:** en `ATLAS-Patients_v7.html`, al abrir las vistas de diagnostico/tratamiento el prototipo muestra una pantalla en blanco (error de render en su UI). No es un problema de la ciencia ni de los datos: ya extrajimos todo lo que necesitabamos de ese archivo (la ciencia congelada en B11 y el patron de UX de la encuesta en B7.1).
- **Impacto en Atlas:** ninguno. Atlas tiene su propia vista de resultados (vista interna del profesional, B12) y su propio reporte, funcionando de forma independiente del HTML de referencia. No corregimos el HTML de Gildardo.
- **Nota a Gildardo:** aviso de cortesia por si quiere revisar su prototipo; para nosotros no es un bloqueante.
- **Resolución (Gildardo, 2026-07-15):** Notificado, sin acción. Es un error de render de la UI del prototipo, sin impacto en Atlas (que tiene su propia vista de resultados y su reporte). Gildardo revisará su prototipo cuando lo estime; no es bloqueante. Query cerrada, informativa.

---

## Q5 · Fuerza prensil: ¿debe influir en el DFI y las rutas, o es solo de display?

- **Fecha:** 2026-07-10 (verificación del HTML actualizado)
- **Estado:** CONFIRMADO (Gildardo, 2026-07-15; solo captura, delta futuro del motor si debe influir)
- **Contexto:** Gildardo entregó un `ATLAS_v7.html` actualizado (10 jul) con, entre otros, la fuerza prensil (dinamometría) agregada a antropometría y "al diagnóstico de sarcopenia". Se comparó contra los tres `.js` congelados.
- **Hallazgo:** la ciencia que Atlas porta NO cambió. `dxSarcopenia`, `cSMM`, `cMMEM`, `cASMI` y las constantes de los índices (ISCM/IEHH/EB-BIS/IAE) son idénticas byte a byte; la fuerza prensil ya era el criterio primario EWGSOP2 en el paquete congelado del 5 de julio. Los `.js` de `src/clinical-engine/frozen/` siguen byte-idénticos al paquete de referencia.
- **La distinción clave:** en el HTML nuevo, la fuerza prensil entra a un flag de obesidad sarcopénica que vive en el bloque de **render MCCB** (`ATLAS_v7.html` ~L11008: `const sarcopenia = ... || sarcoDx.k >= 2`, con `sarcoDx` calculado desde `dxSarcopenia(fuerzaPrensil, ...)`). Ese bloque es una ruta de **visualización**, distinta de `computeDFIFromData` (~L9456) y `computeDFI` (~L11304), que son las funciones que Atlas realmente porta. El DFI congelado calcula su propia obesidad sarcopénica SIN prensil: `_obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow)`. Y `engine.ts` arma `rutas: dfiRaw.rutas` desde `computeDFIFromData`, no desde `rutasPorCondicion`. Es decir, hoy la fuerza prensil no toca ningún indicador, DFI, ruta ni fenotipo del `EngineOutput`; `EngineInput` ni siquiera tiene un campo `fuerzaPrensil`.
- **Nuestra decisión (Santiago, 2026-07-10):** no se re-verifican golden tests (nada de lo que Atlas porta cambió). Las preguntas nuevas (suplementos, alergias, cirugías GI), el reorden del panel y la captura de prensil son UI/encuesta, candidatas a un ítem incremental futuro, no un port de ciencia.
- **Pregunta a Gildardo:** ¿la fuerza prensil debe influir en el DFI y en la selección de rutas (es decir, en el diagnóstico que Atlas computa y persiste), o es solo un indicador de pantalla en su prototipo? Si debe influir, hay que entregarlo como un frozen delta nuevo (versión nueva de los `.js`, swap limpio) que wire `dxSarcopenia`/prensil dentro de `computeDFIFromData`, con golden tests actualizados. Si es solo de display, el ítem futuro se limita a capturar la prensil como dato de antropometría, sin tocar el motor. La respuesta define si ese ítem es "solo encuesta" o "encuesta + delta del motor".
- **Resolución (Gildardo, 2026-07-15):** Por ahora, solo captura. La fuerza prensil se guarda como dato de antropometría, sin entrar al motor, coherente con el DFI congelado (que calcula la obesidad sarcopénica sin prensil: `_obSarc = _fmiElev && (_ffmiLow || _asmiLow || _smmwLow)`). Si más adelante se decide que la prensil debe influir en el DFI y en la selección de rutas (criterio primario EWGSOP2 para riesgo de sarcopenia), se entrega como frozen delta nuevo (versión nueva de los `.js` que conecte `dxSarcopenia`/prensil en `computeDFIFromData`), con golden tests actualizados. El ítem futuro de encuesta queda, por ahora, como solo captura.

---

## Q6 · Alcohol (`d3_31`): marcado como campo del motor, pero `calcLE8` lo lee en una variable sin usar

- **Fecha:** 2026-07-15 (auditoría de acoplamiento encuesta ↔ motor)
- **Estado:** ABIERTO (esperando decisión de Gildardo)
- **Hallazgo:** `d3_31` ("¿Con qué frecuencia consume alcohol?") está marcada `engine: true` (una de las 14 preguntas con `field_key`), así que el intake la entrega al motor. Pero en `calcLE8` (`frozen/engine.dfi.js`) el valor se asigna a `const alcohol = enc.d3_31 || ""` y esa variable **no se usa en ninguno de los 8 dominios** del LE8 (Actividad física, Alimentación, Tabaco, Sueño, Glucosa, Colesterol, Presión arterial, Hidratación). Ningún otro punto del motor (DFI, índices) lee `d3_31`. Resultado: el paciente responde alcohol, el dato viaja al motor y no influye en nada.
- **Evidencia de que NO es un defecto del port:** el `.js` es verbatim de `ATLAS_v7.html`; la variable `alcohol` muerta viene de la fórmula de Gildardo, no de Atlas. Preservado byte a byte (regla dura 12).
- **Pregunta a Gildardo:** ¿el alcohol debía ser un factor del LE8 (omisión latente en la fórmula, a entregar como frozen delta con su dominio/ponderación) o es solo registro clínico? Si es solo registro, se puede quitar el `field_key` de `d3_31` (deja de viajar al motor, sin efecto en el resultado). Si debía influir, entrega la fórmula y se porta fiel con golden actualizado. Mientras tanto, no se toca el motor.

---

## Q7 · Contaminantes (`d5_42`) y estrés (`d3_29`): el motor los lee solo en el path NO autoritativo `rutasPorCondicion`

- **Fecha:** 2026-07-15 (auditoría de acoplamiento encuesta ↔ motor)
- **Estado:** ABIERTO (informativo; sin impacto en el diagnóstico actual)
- **Hallazgo:** `engine.indices.js` define `RUTA_COND` (predicados R1-R6); el predicado **R5** lee `d5_42` (contaminantes) y `d3_29` (estrés). Ninguna de las dos está marcada `engine: true`, así que el intake no las entrega al motor. Pero el propio motor rotula `rutasPorCondicion` como **no autoritativa** (comentario en `engine.indices.js` ~L79: "la selección AUTORITATIVA se hace vía DFI"), y `engine.ts` arma `rutas: dfiRaw.rutas` desde `computeDFIFromData` (`analizarDFI`), no desde `rutasPorCondicion`. `computeDFIFromData` no lee `d5_42` ni `d3_29`.
- **Consecuencia:** hoy `d5_42` y `d3_29` no tocan ningún indicador, DFI, ruta ni fenotipo del `EngineOutput`. Ambas preguntas SÍ están en la encuesta como registro clínico (`field_key` null). No hay degradación del diagnóstico actual.
- **Pregunta a Gildardo:** ¿`rutasPorCondicion` (R5 con contaminantes y estrés) debe llegar a ser una vía autoritativa de selección de rutas? Si sí, habría que (a) marcar `d5_42` y `d3_29` como `field_key` y (b) cablear `rutasPorCondicion` en `engine.ts`, con golden actualizado. Si no, quedan como registro clínico y R5 sigue siendo lógica de reglas de referencia, sin efecto. Mientras tanto, no se toca el motor.

---

## Q8 · EB-BIS: edad biológica sistemáticamente joven cuando los hábitos reportados son buenos

- **Fecha:** 2026-07-17 (caso golden-path, bloque prerrequisito "profesional primero")
- **Estado:** ABIERTO (informativo; no bloquea nada)
- **Hallazgo:** la EB-BIS (edad biológica celular) sale sistemáticamente por debajo de la edad cronológica cuando la encuesta reporta hábitos buenos (LE8/ICEC alto), **aunque el BIS muestre sobrepeso o grasa alta**. La EB-BIS depende del ICEC (derivado del LE8) y de la edad; un LE8 alto empuja la edad biológica hacia abajo, sin que la composición corporal (FMI alto) lo contrapese.
- **Evidencia:** el fixture gold `dfi-golden.json` (perfil documentado "hombre 54a, IMC 27.5, sobrepeso leve") da EB 29.9 e IAE -24.7. El caso golden-path (mismo donante BIS, encuesta alineada al perfil, LE8 69) da EB 36.4 e IAE -17.6 "Desacelerado". En ambos, un hombre de 54 con grasa alta obtiene una edad biológica de 30-36.
- **Evidencia de que NO es un defecto del port:** el cálculo de EB-BIS/ICEC es verbatim de la ciencia congelada (`engine.indices.js`, `computeEBBIS`); los golden anclan la EB-BIS a los valores del HTML (tolerancia 1e-3). Además el propio fixture gold ya lo marca en su `_meta`: "Revisar coherencia clínica con Gildardo". Es una característica de la fórmula, no de Atlas.
- **Pregunta a Gildardo:** ¿es esperado que un perfil con sobrepeso/grasa alta pero hábitos reportados buenos dé una edad biológica marcadamente joven (54 → 30-36)? ¿La relación LE8/ICEC → EB-BIS debe atenuarse o ponderar la composición corporal, o es correcta por diseño? Mientras tanto, no se toca el motor.

---

## Q9 · Abordaje por profesión: `efrProf` existe en el paquete congelado pero no se expone

- **Fecha:** 2026-07-18 (planeación de la pestaña de Diagnóstico)
- **Estado:** ABIERTO (bloquea SOLO la tarjeta de "abordaje por profesión"; el resto del Diagnóstico avanza)
- **Hallazgo:** la vista de Diagnóstico del HTML muestra 6 campos por estado EFR. Cinco ya se congelan en el snapshot (`diagnosisName`, `mechanism`, `biomarkers`, `risks`, `suggestedNutraceuticals`), poblados desde `core.getDX` (exportado). El sexto, **"abordaje por profesión"**, lo compone `efrProf(role, i, r, f, m)` (`frozen/engine.core.js` L807): una función de reglas dependiente del rol (Médico / Psicólogo / Deportólogo / Nutricionista). Pero `efrProf` **NO** está en el `module.exports` del paquete (L936 exporta `getDX`/`efrCompose`/`DX`/…, no `efrProf`).
- **Por qué no se resuelve del lado de Atlas:** (a) no se edita el `.js` frozen, ni siquiera el `module.exports` (rompe la propiedad verbatim que hace verificable la regla 12 y ensucia el swap limpio de la próxima entrega); (b) en CommonJS una `const` module-local no exportada es inalcanzable desde otro módulo sin re-evaluar el fuente (acceso raro, descartado); (c) re-implementar `efrProf` en TypeScript sería reingeniería de la ciencia congelada (prohibido). Además el contenido del abordaje NO existe como dato estático (mapa) que se pueda poblar: solo como salida algorítmica de `efrProf` (a diferencia de dx/mec/bio/rsk, que salen de `getDX`, exportado).
- **Pregunta a Gildardo (dos vías, cualquiera sirve):**
  1. **Exponer `efrProf` en el `module.exports`** de la próxima versión del `.js` (como ya se exponen `getDX`/`efrCompose`); Atlas lo consume limpio desde el adaptador y congela la salida.
  2. **Entregar el contenido de los abordajes como datos** (mapa estado EFR × profesión → texto) y se pobla en el registry como el resto del contenido de la Diana (dx/mec/bio/rsk/n), sin llamar la función en runtime. **Esta es la más consistente** con cómo ya vive el contenido EFR y la preferida.
  
  Con cualquiera de las dos, Atlas congela el **conjunto completo** de abordajes (los 4 roles) en el snapshot al diagnosticar, sin acoplarse al rol logueado ni al registry vivo (un diagnóstico histórico mostrará el abordaje del rol tal como el modelo lo tenía cuando se decidió).
- **Decisión de Atlas (2026-07-18):** se **difiere** la tarjeta de "abordaje por profesión" hasta la entrega de Gildardo. No se toca el frozen ni se inventa acceso. Las otras 5 tarjetas se muestran. El diseño de la pestaña de Diagnóstico deja el hueco listo (capas separables: contenido del modelo vs. rol).
