# GILDARDO_QUERIES.md — Bitácora de hallazgos pendientes de confirmar

**Propósito:** registrar, en un solo lugar, los hallazgos sobre la ciencia congelada (el motor de Gildardo) que requieren su confirmación o decisión. Nada de esto se corrige tocando los `.js` congelados de `src/clinical-engine/frozen/` (regla dura 16). Cuando se detecte algo nuevo que dependa de Gildardo, se anota aquí con fecha, en vez de quedar solo en el chat.

**Convención de estado:** `ABIERTO` (esperando respuesta), `CONFIRMADO` (Gildardo respondió; se resume la resolución), `DESCARTADO` (se resolvió sin cambio), `CERRADO` (informativo, sin acción pendiente), `CONSOLIDADA` (fusionada en `docs/FROZEN_EXPORTS_REQUEST.md`; aquí queda solo el puntero histórico).

**Dos lectores:** las queries abiertas o relevantes se estructuran en dos capas: primero **Para Gildardo** (breve, no técnica, con ejemplo si ayuda; él decide), luego **Para su CC** (detalle técnico; ellos ejecutan). Las queries que necesitan que Gildardo entregue algo del lado de la ciencia (exponer funciones o entregar datos) viven consolidadas en `docs/FROZEN_EXPORTS_REQUEST.md`, con el entregable concreto esperado.

> **Ronda de respuestas de Gildardo (2026-07-15):** esta ronda cubrió **Q1-Q5**, que quedaron resueltas. Ninguna requiere cambio de código ni de golden tests ahora mismo; Q3 y Q5 dejan pendiente una posible entrega futura de ciencia (fórmula LE8 y frozen delta de prensil, respectivamente), que solo se portaría si Gildardo la entrega. La ciencia congelada no se toca.
>
> **Estado (2026-07-21): TODO respondido.** Q1-Q5 se cerraron el 2026-07-15. **Q6, Q7 y Q8** (auditoría de acoplamiento y caso golden-path) fueron **RESUELTAS por Gildardo el 2026-07-21**. Q9 y Q10 se consolidaron en `docs/FROZEN_EXPORTS_REQUEST.md` (respondidas; esperando el paquete de archivos). El paquete de Gildardo (`.js` nuevos + changelog) está pendiente de llegar; su integración es el bloque prioritario del `BACKLOG.md`.
>
> **Actualización (2026-07-24): llegó la entrega.** Vive en `docs/entregas/gildardo-2026-07/` (inventario completo en `INVENTARIO.md`). Dos correcciones sobre lo que se esperaba: (1) **NO hay frozen delta EB-BIS**: el frozen vigente ya es v5 (verificado verbatim, ver Q8). (2) La entrega **no es** el paquete de custodia de `FROZEN_EXPORTS_REQUEST.md`, sino una re-extracción más amplia en 7 módulos ES; las 6 funciones (`efrProf`+clasificadores) igual se pueden exponer con el mecanismo del archivo derivado porque **ya existen en nuestro frozen `engine.core.js`** (ver `INVENTARIO.md` punto 6). Los pedidos 4 (función de rangos) y `dAECMCA` NO llegaron y siguen requiriendo a Gildardo.

> **Segunda ronda de Gildardo (documento `Decisiones_ANI-BIS-E_2026-07-29`), procesada 2026-07-30.** Responde los once puntos. Se le envió a Gildardo el documento `docs/entregas/GILDARDO_2026-07-30_SEGUNDA_RONDA.md` (pedido del archivo + queries abiertas).
>
> **HALLAZGO QUE MANDA — escenario C (verificación de líneas): NO tenemos el archivo que su documento describe.** Su doc cita "ATLAS_v7.html" con ~20 números de línea; verificadas cinco (14024, 14077, 14088, 12828, 6516) contra nuestra entrega `docs/entregas/gildardo-2026-07/ATLAS.html`, TODAS caen sobre contenido distinto (UI de seguimiento, Vitacellebis, remisiones, setup React, scoring LE8), con desfases **inconsistentes** (no es corrimiento uniforme), y hay un cambio de **contenido**: él describe GEB por **Mifflin** en 14088; nuestro archivo tiene **Cunningham** en 14124. Es su copia ACTUAL (posterior a la entrega del 2026-07-24, con sus cambios C aplicados), que no tenemos. **RE-PORT EN PAUSA** hasta recibir su archivo: portar por número de línea contra otra revisión aterriza en contenido equivocado sin error visible (familia del bug de cintura, a escala de trece cambios).
>
> **PRUEBA DE IDENTIDAD del archivo que pedimos** (se corre apenas llegue): que las líneas **14077, 14088, 6529 y 12828** caigan sobre lo que su documento describe (motor nutricional, GEB, interruptor del índice contextual, rangos de referencia).
>
> **Reaseguro:** nuestra entrega calcula Cunningham (14124) y REPRODUCE la captura del Nivel IV (`1946 = 500+22×65.73`, verificado). A3.2 portó fielmente lo que la captura y el profesional ven HOY; el Mifflin es su decisión FUTURA (Q14). **Brecha de GOLDEN 1 CERRADA:** la FFM real es 65.73 → 1946 exacto (el 65.75→1947 era redondeo de display).
>
> **Cierres de esta ronda** (resueltos por su DOCUMENTO, no por su código; NO dependen del archivo): **Q3** (activa el mapeo del índice contextual, cambio C1 — port pendiente de su archivo); **Q8** (confirma AUTORÍA y VIGENCIA del modelo, NO validación empírica de la calibración del término contextual, que él declara provisional — dos cosas distintas); **Q11** (el DFI es el ÚNICO origen de R1-R6; `RUTA_COND` es referencia; confirma T1); **Q14** (ni inline ni módulo: un TERCERO — base = peso meta del módulo de antropometría, estrategia POR CONDICIÓN clínica [la de fenotipo desaparece, C7], fórmula abierta como P1); **Q16** (autoridad por pieza + los cuatro motores se resuelven con la estrategia por condición). Los pedidos de autoría de **rangos** (líneas 12828-12878) y **dAECMCA** (AEC L / MCA kg, 3 decimales, cortes <0,45 / 0,45-0,55 / >0,55) dejaron de ser autoría: son transcripción nuestra (port pendiente de su archivo).
>
> **P0 — edad biológica (DECISIÓN registrada, pendiente de confirmación de Gildardo):** es una CUARTA opción (no una de sus tres), que aprovecha que Atlas tiene dos superficies (profesional y paciente), distinción que su prototipo no hace pero el proyecto ya usa ("solo referencia profesional, no se imprime", apartado D del Nivel IV): (1) la cifra ABSOLUTA solo en la superficie del PROFESIONAL, con nota de calibración provisional, NUNCA en el reporte del paciente; (2) el reporte del paciente muestra solo la TRAYECTORIA, desde la segunda medición; (3) siempre se calcula y se guarda, con la versión de calibración registrada (su C2b); (4) el IAE sigue la misma regla (depende de la cifra absoluta).

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

## Q4 · Pantalla en blanco en el prototipo cuando no hay medición BIS cargada (informativo, NO bloqueante)

- **Fecha:** 2026-07-07 (B12)
- **Estado:** CERRADO (informativo; Gildardo notificado, sin acción)

**Para Gildardo (breve):** el prototipo se queda en blanco cuando se abre el diagnóstico de un paciente **sin haber subido su medición del Biody BIS**. No es un fallo de la ciencia ni de los datos: es que el prototipo no contempla ese estado "todavía sin datos", y al faltar la entrada la página no dibuja nada. Ejemplo: se crea el paciente, aún no se le hace la impedanciometría, se entra al diagnóstico, pantalla blanca.

**Para su CC (detalle):**
- **Causa real:** en `ATLAS-Patients_v7.html` la vista de diagnóstico/tratamiento no maneja el caso "sin fila BIS": no hay guardas para la ausencia de la medición, así que el render falla en silencio y deja la pantalla en blanco. No es un error de render genérico: es la falta del estado vacío.
- **Impacto en Atlas:** ninguno. Ya extrajimos lo que necesitábamos de ese archivo (la ciencia congelada en B11, el patrón de UX de la encuesta en B7.1). No corregimos el HTML de Gildardo.
- **Nota de valor:** este es justo el hueco que Atlas SÍ cubre. Atlas maneja explícitamente los estados vacíos: si la evaluación existe y es del profesional pero aún no tiene diagnóstico, muestra un estado vacío elegante con instrucciones (importar BIS, generar diagnóstico); si no existe o no es suya, un 404 limpio (nunca una pantalla en blanco). El manejo de estados vacíos es una diferencia concreta de Atlas sobre el prototipo.
- **Resolución (Gildardo, 2026-07-15):** Notificado, sin acción. Es la falta del estado "sin medición BIS" en la UI del prototipo, sin impacto en Atlas (que sí maneja ese caso con estado vacío + 404). Gildardo revisará su prototipo cuando lo estime; no es bloqueante. Query cerrada, informativa.

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
- **Estado:** RESUELTO (2026-07-21, Gildardo)

**Resolución (Gildardo, 2026-07-21):** el alcohol es **registro clínico**, no debía pesar en el LE8 (la variable muerta era exactamente eso). **Acción de Atlas (hecha, sin tocar el motor):** se quita el `field_key` de `d3_31` para que deje de viajar al motor; efecto CERO en el diagnóstico (ya era inerte). La pregunta sigue en la encuesta como registro clínico. No hay frozen delta por Q6.

**Para Gildardo (breve):** el paciente responde con qué frecuencia consume alcohol, pero ese dato hoy **no cambia nada** en el resultado del motor: la fórmula del LE8 lo recibe y no lo usa en ningún cálculo. Ejemplo: dos pacientes idénticos, uno abstemio y otro que bebe seguido, dan el mismo puntaje. La pregunta es: ¿el alcohol debía pesar en el LE8, o es solo un registro clínico para la historia?

**Para su CC (detalle):**
- **Hallazgo:** `d3_31` está marcada `engine: true` (una de las 14 preguntas con `field_key`), así que el intake la entrega al motor. Pero en `calcLE8` (`frozen/engine.dfi.js`) el valor se asigna a `const alcohol = enc.d3_31 || ""` y esa variable **no se usa en ninguno de los 8 dominios** del LE8 (Actividad física, Alimentación, Tabaco, Sueño, Glucosa, Colesterol, Presión arterial, Hidratación). Ningún otro punto del motor (DFI, índices) lee `d3_31`.
- **Evidencia de que NO es un defecto del port:** el `.js` es verbatim de `ATLAS_v7.html`; la variable `alcohol` muerta viene de la fórmula de Gildardo, no de Atlas. Preservado byte a byte (regla dura 16).
- **Vías:** (a) si el alcohol **debía** pesar (omisión latente en la fórmula): entrega un frozen delta con el dominio/ponderación del alcohol, se porta fiel con golden actualizado; (b) si es **solo registro**: Atlas quita el `field_key` de `d3_31` (deja de viajar al motor, sin efecto en el resultado). Mientras tanto, no se toca el motor.

---

## Q7 · Contaminantes (`d5_42`) y estrés (`d3_29`): el motor los lee solo en el path NO autoritativo `rutasPorCondicion`

- **Fecha:** 2026-07-15 (auditoría de acoplamiento encuesta ↔ motor)
- **Estado:** RESUELTO (2026-07-21, Gildardo)

**Resolución (Gildardo, 2026-07-21):** contaminantes (`d5_42`) y estrés (`d3_29`) **se quedan igual**, como registro clínico; `rutasPorCondicion` (R5) sigue siendo la vía NO autoritativa. **Sin acción, sin cambio en el motor** y sin frozen delta por Q7.

**Para Gildardo (breve):** dos preguntas (exposición a contaminantes y nivel de estrés) hoy **no afectan el resultado**. El motor solo las usaría en una vía de rutas que el propio modelo marca como "no autoritativa" (no es la que decide el diagnóstico ni las rutas finales). Ejemplo: cambiar la respuesta de contaminantes o estrés no cambia el diagnóstico ni las rutas que ve el profesional. ¿Esa vía debe llegar a decidir rutas, o esas dos preguntas se quedan como registro clínico?

**Para su CC (detalle):**
- **Hallazgo:** `engine.indices.js` define `RUTA_COND` (predicados R1-R6); el predicado **R5** lee `d5_42` (contaminantes) y `d3_29` (estrés). Ninguna está marcada `engine: true`, así que el intake no las entrega al motor. Y el propio motor rotula `rutasPorCondicion` como **no autoritativa** (comentario en `engine.indices.js` ~L79: "la selección AUTORITATIVA se hace vía DFI"); `engine.ts` arma `rutas: dfiRaw.rutas` desde `computeDFIFromData`, no desde `rutasPorCondicion`. `computeDFIFromData` no lee `d5_42` ni `d3_29`.
- **Consecuencia:** hoy `d5_42` y `d3_29` no tocan ningún indicador, DFI, ruta ni fenotipo del `EngineOutput`. Ambas SÍ están en la encuesta como registro clínico (`field_key` null). No hay degradación del diagnóstico actual.
- **Vías:** (a) si `rutasPorCondicion` (R5) **debe** ser autoritativa: marcar `d5_42` y `d3_29` como `field_key` y cablear `rutasPorCondicion` en `engine.ts`, con golden actualizado; (b) si **no**: quedan como registro clínico y R5 sigue siendo lógica de reglas de referencia, sin efecto. Mientras tanto, no se toca el motor.

---

## Q8 · EB-BIS: edad biológica sistemáticamente joven cuando los hábitos reportados son buenos

- **Fecha:** 2026-07-17 (caso golden-path, bloque prerrequisito "profesional primero")
- **Estado:** CERRADO DEL TODO (2026-08-01). RESUELTO 2026-07-21; verificado 2026-07-24 (el frozen vigente YA es v5, NO hay frozen delta); y **confirmado formalmente por Gildardo el 2026-08-01**: dio los coeficientes de la v5 (constante 41,438; IFC +1,082 μ4,0146 σ2,2669; PABU +2,837 μ1,8303 σ0,7741; ICEC −7,982 μ58,578 σ13,332), que **coinciden dígito a dígito** con `engine.indices.js` `computeEBBIS`, y cerró que "para efectos de implementación manda lo que está en `ATLAS_v7.html`". También confirmó su 4.2 ("sin ICEC no hay EB-BIS, no se estima por vía alterna"), que coincide con la guarda `if (icec == null) return null` ya presente. Nada que portar; el motor no se toca. (La calibración de la v5 sigue **provisional** hasta que exista población para recalibrar: eso NO reabre Q8, es la dimensión `calibration` de `emission_versions` y el trabajo de P0, abajo.)

**Actualización (2026-07-24, tras la entrega de Gildardo):** se verificó verbatim el HTML entregado (`docs/entregas/gildardo-2026-07/ATLAS.html` L5706-5729) contra el motor congelado vigente (`src/clinical-engine/frozen/engine.indices.js` L34-41, `computeEBBIS`). Son **byte-idénticos** en coeficientes: constante 41.438, IFC +1.082 (μ 4.0146, σ 2.2669), PABU +2.837 (μ 1.8303, σ 0.7741), ICEC/LE8 -7.982 (μ 58.578, σ 13.332), con la guarda `if (icec == null) return null`. **El frozen vigente ya calcula la EB-BIS v5**, contrario a lo que decía la resolución del 21-jul ("la congelada quedó vieja, viene una v5"). **Corrección del estado: no hay swap, no hay cambio de valores, no se regenera golden ni Demo GoldenPath por EB-BIS.** Queda pendiente **solo la confirmación formal de Gildardo** de que la v5 del frozen vigente es la definitiva (nuestra verificación técnica ya está hecha). Detalle en `docs/entregas/gildardo-2026-07/INVENTARIO.md` (punto 2.1). El punto (2) de la resolución del 21-jul (edad joven con grasa alta es POR DISEÑO) sigue vigente sin cambios.

**Resolución (Gildardo, 2026-07-21):** dos cosas. (1) La EB-BIS **congelada quedó vieja**: viene una **v5 como frozen delta** dentro del paquete de Gildardo (se integra al llegar; ver el bloque prioritario del `BACKLOG.md`). (2) La edad biológica joven con grasa alta es **POR DISEÑO**: la EB-BIS lee **función celular / bioeléctrica / contexto**, NO adiposidad; la composición corporal (FMI/grasa) **no debe contrapesarla**. Al integrar la v5 hay que **regenerar el Demo GoldenPath** (sus valores de EB/IAE van a cambiar) y actualizar el golden del bloque de indicadores. **Nota de UI (indicación explícita de Gildardo):** rotular la EB-BIS en el reporte para que **no se lea como "edad fisiológica"** (es un índice funcional/bioeléctrico, no la edad del cuerpo). Anotado en el `BACKLOG.md`. **(Corregido el 2026-07-24: el punto (1) resultó impreciso; ver la actualización arriba. El punto (2) se mantiene.)**

**Para Gildardo (breve):** la edad biológica (EB-BIS) sale marcadamente joven cuando el paciente reporta buenos hábitos, **aunque el BIS muestre sobrepeso o grasa alta**. Ejemplo real: un hombre de 54 años con grasa alta pero hábitos buenos da una edad biológica de 30-36 años. La pregunta clínica: ¿es correcto por diseño, o la composición corporal (la grasa) debería contrapesar el efecto de los buenos hábitos?

**Para su CC (detalle):**
- **Hallazgo:** la EB-BIS depende del ICEC (derivado del LE8) y de la edad; un LE8 alto empuja la edad biológica hacia abajo, sin que la composición corporal (FMI alto) lo contrapese.
- **Evidencia:** el fixture gold `dfi-golden.json` (perfil "hombre 54a, IMC 27.5, sobrepeso leve") da EB 29.9 e IAE -24.7. El caso golden-path (mismo donante BIS, encuesta alineada, LE8 69) da EB 36.4 e IAE -17.6 "Desacelerado".
- **Evidencia de que NO es un defecto del port:** el cálculo de EB-BIS/ICEC es verbatim de la ciencia congelada (`engine.indices.js`, `computeEBBIS`); los golden anclan la EB-BIS a los valores del HTML (tolerancia 1e-3). El propio fixture gold lo marca en su `_meta`: "Revisar coherencia clínica con Gildardo". Es una característica de la fórmula, no de Atlas.
- **Vía:** si la relación LE8/ICEC → EB-BIS debe atenuarse o ponderar la composición corporal, se entrega como frozen delta (versión nueva de los `.js`) con golden actualizado. Si es correcta por diseño, se cierra informativa. Mientras tanto, no se toca el motor.

---

## Q9 · Abordaje por profesión: `efrProf` existe en el paquete congelado pero no se expone

- **Fecha:** 2026-07-18 (planeación de la pestaña de Diagnóstico).
- **Estado:** **CONSOLIDADA → ver `docs/FROZEN_EXPORTS_REQUEST.md` (entrada 1).**
- **Qué era:** el sexto campo del estado EFR ("abordaje por profesión") lo compone `efrProf`, que existe en el paquete pero no está en su `module.exports`. El detalle accionable y las vías de resolución viven ahora SOLO en la solicitud consolidada (para no duplicar); aquí queda el rastro histórico con su fecha.

---

## Q10 · Clasificadores de composición: existen en el paquete pero no se exponen (misma familia que Q9)

- **Fecha:** 2026-07-18 (columna de diagnóstico de la tabla de composición).
- **Estado:** **CONSOLIDADA → ver `docs/FROZEN_EXPORTS_REQUEST.md` (entrada 2).**
- **Qué era:** el diagnóstico por fila de la tabla de composición usa clasificadores (`cSMM`, `cMMEM`, `cASMI`, `cFFW`, `cEISG`) que existen en el paquete pero no están en su `module.exports`. El detalle accionable y las vías viven ahora SOLO en la solicitud consolidada (para no duplicar); aquí queda el rastro histórico con su fecha.

---

## Q11 · Dos reglas distintas activan la ruta R2: severidad del dominio 2 (`computeDFI`, autoritativa) vs umbrales (`RUTA_COND.R2`, referencia)

- **Fecha del hallazgo:** anterior a 2026-07-26 (surgió en el chat de T1; **se registra aquí el 2026-07-26**, ver nota de proceso al final)
- **Abierto desde:** 2026-07-26 (fecha de registro formal)
- **Estado:** ABIERTO del lado de Gildardo (coherencia del modelo). **Verificación de nuestro lado: CERRADA (2026-07-26), ver abajo.**
- **Bloquea:** nada hoy. La discrepancia no puede llegar a la pantalla (T1 lee la vía autoritativa). Es pregunta de coherencia del modelo, no defecto de Atlas.

**Para Gildardo (breve):** dos preguntas, una de fondo y una de confirmación.

1. Dentro del modelo hay **dos reglas distintas que activan la misma ruta R2**, y no son dos copias de la misma fórmula: son dos criterios diferentes. Una la decide por la **severidad del dominio 2** del árbol del DFI (es la que el sistema usa de verdad). La otra la decide por **umbrales de FMI, ISCM, ICC, ICT e IR en OR** (una vía de referencia que hoy no alimenta el resultado). Para un paciente real dan respuestas distintas: `juan-esteban.json` (hombre, 54 años, IMC 27.5, IR 0.798, ICT 0.544, FMI 6.37) queda dentro por una y fuera por la otra. **¿Cuál de las dos reglas representa su modelo actual?** Si es la del árbol, la de umbrales queda como referencia histórica; si es la de umbrales, el ruteo del árbol necesita revisarse.

2. El 21 de julio confirmó que la vía `rutasPorCondicion` **no es autoritativa**, refiriéndose a la ruta R5. Necesitamos confirmar que eso vale para **todas** las rutas de esa vía (R1 a R6), no solo para R5. Es la diferencia entre "una ruta de esa vía no decide" y "esa vía completa no decide". Si vale para todas, la vía de umbrales queda formalmente como referencia y la discrepancia queda cerrada también como pregunta de coherencia del modelo.

**Para su CC (detalle):**

- **Hallazgo (corregido respecto de la redacción inicial de esta query):** no es "una segunda definición" duplicada de R2; son **dos reglas distintas, en dos archivos distintos, que nombran la misma ruta**:
  - **Vía autoritativa:** `computeDFI` (`engine.dfi.js:153`) activa R2 con `if(dom2.sev>=2) rutas.push("R2 · Reducción Cardiometabólica")`, o sea por **severidad del dominio 2** del árbol. Es la que arma `dfi.rutas`.
  - **Vía de referencia:** el predicado `RUTA_COND.R2` (`engine.indices.js:56`) es un **OR de umbrales** (FMI, `ISCM > 1.0`, obesidad sarcopénica, ICC, `ICT ≥ 0.50`, IR). No autoritativa.
  - Para `juan-esteban.json` las dos no concuerdan.

- **Lo que dice el CÓDIGO (verificable, independiente de cualquier interpretación):**
  - `engine.ts:120` fija `rutas: dfiRaw.rutas` desde `analizarDFI` → `computeDFIFromData` → `computeDFI` (`analysis.ts:169`), **no** desde `rutasPorCondicion`.
  - `rutasPorCondicion` y `RUTA_COND` solo se usan, fuera del frozen, como re-export en `analysis.ts:117-123` y en el golden test `clinical-engine-golden.test.ts`. **Ningún path de producción los llama.**
  - El propio motor rotula la vía de condición como no autoritativa: `engine.dfi.js:80` ("la selección AUTORITATIVA se hace vía DFI") y `engine.indices.js:79-82`.
  - La visualización de rutas de T1 lee `dfi.rutas`, o sea la vía autoritativa. **La discrepancia no puede llegar a la pantalla.**

- **Verificación de nuestro lado: CERRADA (2026-07-26).** Confirmado por grep y lectura que existen las dos reglas (`engine.dfi.js:153` vs `engine.indices.js:56`), que la que alimenta el `EngineOutput` es la del árbol, y que `rutasPorCondicion` no alimenta nada en producción. Esto corrige la redacción previa de esta query, que hablaba de verificar que "no existe una segunda definición": sí existe la del árbol, pero es la autoritativa y esperada, no un duplicado descarriado. No hay nada más que verificar de nuestro lado.

- **Lo que estamos INFIRIENDO (pendiente de confirmar por Gildardo, punto 2 de arriba):** que su resolución del 2026-07-21 aplica a R1-R6 y no solo a R5. **Sus palabras textuales fueron "`rutasPorCondicion` (R5) sigue siendo la vía NO autoritativa".** La pregunta que respondía era sobre contaminantes y estrés, que viven en el predicado R5, así que el paréntesis puede leerse como el alcance de su respuesta o como el ejemplo que tenía delante. No lo damos por dicho.

- **Vías:** (a) si la regla de umbrales **debe** ser la vigente, Gildardo entrega el criterio corregido como frozen delta, con golden actualizado; (b) si la del árbol es la vigente, la de umbrales queda como referencia histórica y se documenta que `rutasPorCondicion` no decide para R1-R6 (extendiendo formalmente la resolución de Q7). Mientras tanto, no se toca el motor.

- **Evidencia:** `juan-esteban.json` (export real del Biody, medición 2026-06-22). Es el mismo donante BIS del fixture golden. **En el extracto que se envía a Gildardo, este caso se cita como `BIS-01` (ver `reference/CASOS-ANONIMOS.md`, interno gitignored).**

---

## Q12 · La fila TOTAL del apartado E (plan por grupos) no cuadra con el objetivo calórico

- **Fecha:** 2026-07-27 (planeación T2; apartados E/F del Nivel IV, fuera de alcance de T2, se registra el hallazgo)
- **Enviada:** `docs/entregas/GILDARDO_2026-07_PENDIENTES.md` punto 1.
- **Estado:** CERRADA (Gildardo respondió, `Decisiones_ANI-BIS-E_2026-07-29`): la casilla TOTAL muestra la **suma real** de las filas de alimentos; el **objetivo calórico va aparte y rotulado**, no dentro de la fila total. No es defecto de la matriz; es cómo se presenta. Se aplica en el bloque Plan alimentario (no T2). **No re-preguntar en round 3.**

**Para Gildardo (breve):** en el plan por grupos de alimentos (apartado E del Nivel IV), las nueve columnas de porciones suman correcto, verificadas una a una. Pero la casilla de kcal de la fila TOTAL muestra 2976 (el objetivo calórico exacto), mientras que las filas de alimentos suman 3134 kcal (947+358+1151+154+524). O sea, en la fila rotulada "total", nueve celdas son sumas reales y la décima es una meta. Implica que la matriz de porciones no reconcilia con el objetivo: se pasa por 158 kcal (5.3%). ¿Es una limitación aceptada de trabajar con porciones enteras, o la matriz debería reconciliar con el objetivo? ¿Qué debe mostrar esa celda?

**Para su CC:** evidencia en la captura del plan alimentario del Nivel IV. No toca el motor calórico (apartado B/D); es la matriz de porciones del apartado E, que se construye en el bloque Plan alimentario, no en T2. Se registra ahora para no perderlo.

---

## Q13 · Los porcentajes por tiempo de comida suman 95%, no 100%, al desactivar un tiempo

- **Fecha:** 2026-07-27
- **Estado:** RETIRADA (verificación propia, no se envió a Gildardo). El código inline del prototipo SÍ normaliza los porcentajes proporcionalmente entre los tiempos activos; la captura que la motivó era un estado viejo del prototipo, no un defecto del modelo. Se retiró a propósito del documento enviado (quedó en la sección de "acciones que ya tomamos"). **No re-preguntar.**

**Para Gildardo (breve):** en el reparto por tiempos de comida, con Merienda desactivada, los porcentajes muestran Desayuno 25 + Medias onces 10 + Almuerzo 30 + Algo 10 + Cena 20 = 95%. El encabezado dice "las porciones se redistribuyen automáticamente", pero el 5% de Merienda no se reasignó. Al desactivar un tiempo de comida, ¿los porcentajes deben renormalizarse a 100% entre los tiempos activos, o el porcentaje del tiempo desactivado se pierde a propósito?

**Para su CC:** evidencia en la captura del plan alimentario. Nota neutral: el código inline del prototipo sí normaliza (reparte proporcionalmente entre los tiempos activos), así que la captura podría ser un estado viejo; se registra tal cual sin resolver, es su prototipo. Del bloque Plan alimentario, no de T2.

---

## Q14 · Dos modelos calóricos de Gildardo sin conciliar: inline de ATLAS.html (Cunningham) vs `atlas-motores-tratamiento.js` (Mifflin)

- **Fecha:** 2026-07-27 (arranque de T2, port del modelo calórico)
- **Estado:** CONFIRMADO (Gildardo, `Decisiones_ANI-BIS-E_2026-07-29`; ver el banner de la segunda ronda arriba). No eligió entre los dos: definió un TERCERO (base = peso meta, estrategia por condición, fórmula abierta P1). El re-port queda EN PAUSA hasta recibir su archivo actual (escenario C). Lo portado en A3.2 (Cunningham) es fiel a la captura/entrega actual; se rehace la estrategia (por condición) y las entradas (peso meta) cuando llegue su archivo.

**Para Gildardo (breve):** hay dos formas distintas de calcular las calorías y la proteína que se le prescriben a un paciente, ambas suyas, y para un mismo paciente dan resultados distintos.
- Una vive inline en `ATLAS.html` (es la que genera la pantalla del Nivel IV que ve el profesional): calcula el gasto basal con Cunningham (500 + 22 × masa magra) cuando hay masa magra disponible, y elige la estrategia calórica según el fenotipo.
- La otra vive en el módulo `atlas-motores-tratamiento.js`: calcula el gasto basal con Mifflin sobre el peso medido, la proteína sobre el peso ideal, y elige la estrategia según la condición clínica. Su encabezado dice textualmente "Reemplazan el modelo calórico por Mifflin × FA prescrita".

"Reemplazan" suena a decisión, no a extracción, así que el módulo podría ser su pensamiento más nuevo aunque su estructura venga de ATLAS_v7. No lo podemos resolver leyendo código. **¿Cuál de los dos representa su modelo vigente?**

**Para su CC:** GEB inline = `ffm>0 ? 500+22*ffm (Cunningham) : Mifflin`; estrategia por fenotipo (F1..F11). Módulo = Mifflin sobre peso medido + estrategia por condición, encabezado "Reemplazan..." (L3), extraído de ATLAS_v7.html. Atlas porta el inline (verificado: reproduce la pantalla del Nivel IV al dígito). Q14 **no bloquea construir** con el inline: si el vigente resulta ser el módulo, revertir cuesta un archivo congelado + su golden; la aritmética TS sobrevive casi igual.

---

## Q15 · Divergencia de cálculo en el patrón alimentario (encuesta congelada)

- **Fecha:** 2026-07-27 (auditoría de fidelidad de los módulos de la entrega, V1)
- **Enviada:** `docs/entregas/GILDARDO_2026-07_PENDIENTES.md` punto 2.
- **Estado:** CERRADA (Gildardo respondió, `Decisiones_ANI-BIS-E_2026-07-29`): **mandan los quince grupos** (el cálculo del módulo, con carnes rojas como neutro, es el correcto). Es el cambio **C9**. Consecuencia: la encuesta congelada necesita **versión nueva** (agregar el grupo carnes rojas + el neutro `[8,9,10,15]`), junto con el cambio de cáncer (dos cambios de encuesta que van juntos). Trabajo NUESTRO pendiente (versión de encuesta), no pregunta. **No re-preguntar en round 3.**

**Para Gildardo (breve):** el patrón alimentario, la clasificación de la dieta del paciente en protectora / moderada / de riesgo, se calcula de dos formas distintas entre sus artefactos, y dan puntajes distintos. El módulo `atlas-encuesta-patron.js` suma el bonus de "neutros" incluyendo un grupo extra (carnes rojas) que la versión dentro de `ATLAS.html` no incluye. No es diferencia de contenido, es el puntaje de calidad. Y la encuesta está congelada de nuestro lado. ¿Cuál de los dos cálculos es el correcto?

**Para su CC:** `calcPatron` usa neutro `[8,9,10,15]` en el módulo (`:72`) vs `[8,9,10]` en `ATLAS.html:2324`; y `FREQ_GROUPS` tiene 15 grupos en el módulo vs 14 en el HTML (agrega "Carnes rojas" como neutro). Como el bonus suma por ítem con frecuencia alta, el score cambia. Es de la familia de la encuesta, congelada (CLAUDE.md); cualquier cambio de score requiere parar y decidir con Gildardo. Evidencia: auditoría de fidelidad V1.

---

## Q16 · Ambigüedad de versión de la entrega 2026-07: la autoridad es por pieza, no global

- **Fecha:** 2026-07-27 (auditoría de fidelidad V1)
- **Estado:** CONFIRMADO (Gildardo, `Decisiones_ANI-BIS-E_2026-07-29`; ver el banner de la segunda ronda arriba). La autoridad ES por pieza, no global; y la segunda ronda agregó una vuelta de tuerca: su documento cita líneas de un archivo que NO es nuestra entrega (escenario C), reforzando que ningún nombre ("ATLAS_v7.html") identifica un único artefacto. Pendiente su archivo actual + confirmación pieza por pieza. La lección de proceso (portar por número de línea exige el artefacto que citan) queda en `ARCHITECTURE.md`.

**Para Gildardo (breve):** los siete módulos de la entrega dicen "Extraído de ATLAS_v7.html", pero el `ATLAS.html` que también entregó es un archivo distinto, más nuevo en unas cosas y más viejo en otras. Hay contenido (el resumen clínico y la lista de intercambio de alimentos de ~350 ítems) que está en los módulos pero no aparece en ese `ATLAS.html`. No hay un artefacto único que sea "el más nuevo" para todo: para el modelo calórico manda el HTML, para la lista de intercambio manda el módulo. ¿Cuál artefacto representa su modelo vigente, y puede confirmarlo pieza por pieza (índices, patrón alimentario, DFI, resumen clínico, lista de intercambio, menú)?

**Para su CC:** auditoría de fidelidad V1 (seis módulos vs ATLAS.html): `atlas-core-indices` coincide verbatim; `atlas-encuesta-patron` diverge en score (Q15); `atlas-dfi` coincide el motor pero agrega metas a 24 semanas atadas a un spec externo; `atlas-resumen-clinico` y `atlas-lista-intercambio` no existen en el HTML entregado; `atlas-menu-ciclo` coincide en alimentos con unidades convertidas. Corregido en `INVENTARIO.md` punto 0: la autoridad es por pieza, ninguna regla global la da.

---

## Q17 · ¿Qué profesiones pueden aprobar el protocolo nutricional del Nivel IV?

- **Fecha:** 2026-07-30 (T2b B1)
- **Estado:** **CERRADA (Gildardo, tercera ronda 2026-07-30):** "el protocolo nutricional lo aprueba el nutricionista"; el tipo de profesional queda determinado cuando el paciente escoge quién lo atiende, y el módulo nutricional solo se presenta a nutrición. Los roles administrativos son operativos, no ejecutan actos clínicos. **Implementado:** el guard de las 5 escrituras de prescripción pasó de "profesión no nula" a `profession === "nutricionista"` (`treatment/services/require-profession.ts`, `requireNutricionista`). Consultar análisis, notas y remitir siguen abiertas a todas las profesiones. Un médico/deportólogo ve en Tratamiento SU sección (B1: "protocolo de tu especialidad, próximamente" + puede consultar análisis/rutas/remisiones), no la nutricional. Cuando lleguen los otros protocolos, cada uno tendrá su profesión habilitada (la matriz profesión→protocolo se extiende ahí).

**Para Gildardo (breve):** en Atlas cada profesional tiene su especialidad (médico, psicólogo, deportólogo, nutricionista). El protocolo del Nivel IV es nutricional (calorías, proteína, macros). ¿Quién puede aprobarlo, es decir firmarlo como prescripción? ¿Solo el nutricionista, o también el médico (que puede prescribir nutrición)? Un psicólogo suponemos que no. Necesitamos la regla por profesión para no dejar que cualquier profesión lo apruebe, ni bloquear a quien sí debe. La misma pregunta se repetirá para los otros protocolos (médico, ejercicio, psicológico) cuando lleguen sus motores.

**Para su CC:** hoy los gates de las escrituras de tratamiento son rol (`professional`) + asignación, sin mirar `profession`; un guard interino (`treatment/services/require-profession.ts`) rechaza solo `profession = null`. La matriz profesión→acto (qué profesión aprueba/edita qué protocolo) es criterio clínico, no de código; no se inventa. Cuando llegue, se implementa extendiendo el guard o las policies. Es el mismo eje que Q9 y que el sistema multi-rol real (bloque aparte).

---

## Q18 · ¿Quién implementa las decisiones que cambian la ciencia congelada? (proceso, C1-C13)

- **Fecha:** 2026-07-30 (verificación del archivo nuevo, ronda 2). **Estado:** ABIERTA (la parte de gobernanza: ¿quién implementa? y la aprobación previa a producción). **La enumeración C1-C13 YA LLEGÓ** (`docs/entregas/Decisiones_ANI-BIS-E_2026-07-29.docx`, commiteada).
- **Opción B CONCEDIDA + "bloqueo del archivo" = MALENTENDIDO (2026-07-30/31).** Gildardo concedió la Opción B (nosotros aplicamos los cambios que tocan el cálculo desde su instrucción escrita; docs `GILDARDO_RESPUESTA_..._TERCERA_RONDA.md`). Pero en su otra respuesta (la "(1)") el punto 7 dice "bloqueo activo, sin el archivo con los cambios aplicados no se pueden aplicar C1-C13". **Contradicción resuelta por análisis: NO hay bloqueo de archivo.** Tenemos su archivo VIGENTE (`gildardo-2026-07-30`, identidad verificada); los diez cambios de código (C1, C3, C4, C5, C7, C8, C9, C10, C11, C12) se leen de ESE archivo, que tenemos. La "segunda lista" (cambios que exigen contenido que NO tenemos) está VACÍA. El punto 7 refleja el modelo VIEJO (él aplica y manda el archivo con los cambios); bajo Opción B eso no aplica. Los únicos frenos son DECISIONES: C11→Q20, C6→coexistencia de P1 (fórmula ya dada), C13→P2 (autoría). Santiago se lo aclara; mientras tanto no se considera bloqueado nada hacible con instrucción + nuestro archivo.
- **Revisión de C1-C13 contra su propio estándar (fórmula/condición/cortes explícitos), 2026-07-30:** **Nueve están claros y son transcribibles** (la lógica está en el código a las líneas que cita): C1 (mapeo índice contextual, 6516-6518), C3 (rutas del DFI, función en 9639), C4 (repuntar 4 usos), C5 (predicados inertes), C7 (retirar estrategia por fenotipo), C8 (rótulo Cunningham/Mifflin), C9 (15 grupos, cálculo en 2303), C10 (fila TOTAL), C12 (**AEC/MCA con cálculo en 5696 + cortes en 12734** — ¡ya no es render-only!, contradice lo que creíamos en INVENTARIO 6c, ahora SÍ es portable). **Dos son versionado/proceso** (no fórmulas de ciencia): C2 y C2b (reemitir con versión, sin sobrescribir; ver el mecanismo único de versiones en BACKLOG). **TRES hay que devolver o esperar:** **C6** (gasto basal/proteína sobre peso meta) — él mismo lo marca "depende de P1 para la fórmula": SIN la fórmula de P1 no se implementa; **C11** (exponer rangos "por indicador y sexo", cita 12828-12878) — su instrucción pide *por sexo* (= `cXXX`) pero cita la tabla display no-sexada (`dXXX`): es la contradicción de **Q20**, se devuelve; **C13** (nutracéuticos por ruta) — "en espera de P2". C6 y C13 él ya los marca dependientes; C11 es el que nosotros surgimos (Q20).
- **Origen:** el documento `Decisiones_ANI-BIS-E_2026-07-29` anuncia decisiones ("se corrige la cintura", "se parte cáncer en dos"), pero verificado en su archivo nuevo (`gildardo-2026-07-30/ATLAS_v7.html`), varias NO están aplicadas: la cintura sigue leyendo el umbral `REFERENCEESTIMEE` (línea 5600), y el cáncer en remisión sigue disparando el hipercalórico por substring (línea 14025). Su doc es de DECISIONES, no de cambios aplicados; lo leímos como trabajo terminado. Regla de proceso registrada en `ARCHITECTURE.md` (un doc de decisiones no es evidencia de que el artefacto cambió).
- **CONTRADICCIÓN CONCRETA con evidencia (2026-07-30):** en su respuesta (`GILDARDO_RESPUESTA_2026-07-30`, punto 3.3 y "Mi archivo actual") escribe explícitamente **"la corrección del campo de cintura va incluida en ese envío"**. No está: la línea 5600 del archivo que mandó sigue leyendo `REFERENCEESTIMEE`. Dice que sí, el archivo dice que no.
- **POSIBILIDAD ABIERTA (a preguntar): nos envió una versión ANTERIOR.** La prueba de identidad verifica las líneas que cita su **documento del 29** (14077/14088/6529/12828) y pasó, pero la corrección de cintura la anunció el **30**. El archivo puede ser su estado del 29 (pasa identidad, trae C1-C13) y NO ser su última versión. **DISTINCIÓN QUE HABÍAMOS CONFUNDIDO: la prueba de identidad confirma que el archivo corresponde al documento del 29, NO que sea su versión más reciente.** Si es así, todo lo que portemos de este archivo estaría desactualizado en un día. Hay que pedirle que confirme que este es su estado ACTUAL (con la cintura corregida), o que reenvíe.

**Para Gildardo (breve):** en tu documento hay decisiones que cambian la ciencia (el campo de cintura, que la remisión no active el hipercalórico) y otras que son contenido o presentación. Para las que cambian la ciencia: ¿las aplicas tú en tu archivo y nos mandas la versión nueva, o nos autorizas a implementarlas de nuestro lado a partir de tu especificación escrita? Preguntamos porque nuestra regla es no editar tu ciencia, y necesitamos saber cuál es el camino para las trece (C1-C13).

**Para su CC:** la regla dura 16 prohíbe que Atlas edite el `.js` congelado. Cambios como "remisión no activa hipercalórico" son lógica de la ciencia (motor por condición, `~14025`), no contenido; implementarlos de nuestro lado sería editar su modelo. Además, **la enumeración C1-C13 NO está en el repo** (solo se referencia en el doc que le enviamos); sin ella no podemos verificar los trece en el archivo, solo los que menciona el texto. Necesitamos: (a) la enumeración C1-C13 con sus números de línea, y (b) por cada uno, si ya está en el archivo (lo portamos, verificando la línea) o es decisión pendiente (define quién la implementa).

---

## Q19 · El "Fenotipo estructural" a mostrar: hay TRES clasificaciones del mismo paciente

- **Fecha:** 2026-07-30 (T2b, cruce con la petición de fenotipo de la ronda 2). **Estado:** ABIERTA; toca registro clínico sellado, no solo display.
- **Contexto verificado:** Atlas tiene tres clasificaciones, dos de ellas del MISMO eje: `structural` (STRUCT_LABELS, 9 estados FFMI×FMI, de su Excel "EFR Salidas", `engine.core.js:740`), el fenotipo MCCB (F1-F12, FFMI×FMI, de `FENOTIPOS_MCCB`, A3.4) y `frSector` (IFC×IRC, 9 sectores, el funcional). Su HTML nuevo usa AMBAS taxonomías del eje estructural: el MCCB (F1-F12) en la tabla del Nivel IV (`~12837`, "Fenotipo MCCB") y los 9 STRUCT en la composición del estado EFR (5 ocurrencias). El `structural` de 9 NO es display libre: **sella `diagnoses.phenotype_id`** (`pipeline-writer.ts:130`), alimenta el prompt del menú (`generate-menu.ts:80`) y el PDF. Su petición de fenotipo (ronda 2) pide mostrar "estructural (F7, normopeso sarcopénico) + funcional + sector EFR", donde F7 es el MCCB, no el STRUCT de 9.

**Para Gildardo (breve):** en el diagnóstico tenemos dos formas del fenotipo estructural (FFMI×FMI): una de 9 estados (de tu Excel EFR Salidas) que usamos internamente para el mapa EFR, y la MCCB de 12 (F1-F12) que pides mostrar (F7 normopeso sarcopénico). Para la pantalla del profesional, ¿mostramos la MCCB (F1-F12) como "Fenotipo estructural" y dejamos la de 9 como dato interno del mapa EFR, o quieres las dos visibles? Queremos no confundir mostrando tres cosas del mismo paciente.

**Para su CC:** `structural` (9-STRUCT) es insumo sellado (`phenotype_id`), no solo pantalla; cambiar cuál se muestra es display, pero cambiar cuál se SELLA tocaría registros clínicos y nomenclatura de código. La MCCB (F1-F12) hoy vive en el snapshot del protocolo (`ProtocoloSnapshot.fenotipo`, A3.4), no en el snapshot del diagnóstico. Según su respuesta: si solo cambia el display, lo resolvemos nosotros; si cambia qué se sella, es su decisión de taxonomía.

---

## Q20 · Dos juegos de clasificadores en el HTML (ciencia `cXXX` vs display `dXXX`): ¿cuál manda en la tabla de diagnóstico?

- **Fecha:** 2026-07-30 (al portar los rangos de la tabla de indicadores). **Estado:** ABIERTA, **PRIORIDAD ALTA (nivel Q19).** **Toca la CLASIFICACIÓN, que se SELLA** en el registro clínico, no solo display.
- **Tres consecuencias, escritas:** (a) **El HTML clasifica una severidad y Atlas otra, para el mismo paciente.** Ejemplo concreto (donante golden): su `dIRC` → "Alto riesgo celular"; nuestro `cIRC` → "Riesgo moderado". Mismo IRC, distinta severidad. En la revisión del Hito 2, donde el HTML es la referencia (la expresión de su ciencia, NO el material con el que se forma el profesional: eso es Atlas Web), aparece como "Atlas está mal". (b) **Cada diagnóstico emitido sella UNA de las dos, y son inmutables.** Si la autoritativa resulta la otra, quedan registros clínicos con la clasificación equivocada que NO se pueden reescribir (solo dejar constancia de versión, ver el mecanismo único de versiones en BACKLOG). (c) **Es la TERCERA vez que dos artefactos suyos se contradicen:** modelo calórico (Q14, Cunningham inline vs Mifflin módulo), taxonomías de fenotipo (Q19, STRUCT-9 vs MCCB-12), y ahora clasificadores (`cXXX` vs `dXXX`).
- **Verificación de los DOCE (2026-07-30):** todos tienen `dXXX`. **Coinciden EXACTO (cortes+etiquetas):** AF, ISCM, IEHH, IAE. **Cortes coinciden, etiqueta difiere:** IR ("Inflamación de bajo grado"), FFMI ("Desnutrición" vs "Bajo", cortes 17/25 iguales), PABU (punto φ igual). **DIFIEREN en cortes (peligrosos):** IFC (cIFC M 4.12–6.68 vs dIFC 3.5–6.0), IRC (cIRC crudo M 1.68–2.11 vs dIRC ×10 2.0–2.8), FMI (cFMI 3–6 vs dFMI 6–9). **Sin `cXXX` nuestro (el HTML sí clasifica):** ICA-BIS y EB (existen `dICA`/`dIAE`; Atlas los muestra sin clasificación). **Orientación de vigencia:** los `cXXX` están primero (ciencia core, líneas 29–247), con comentario de cohorte P25/P75 y **por sexo** (`cIRC`); los `dXXX` están en la capa de render (12729–12746), como heurísticas. Y **su propio C11 pide los rangos "por indicador y sexo"** (= `cXXX`), aunque cite la tabla display (no-sexada). Todo orienta a que `cXXX` es lo vigente y la tabla display es la inconsistente, pero lo confirma él.
- **Contexto verificado:** el HTML tiene DOS clasificadores por indicador para varios de los 12: los de CIENCIA en `engine.core.js` (`cIFC`, `cIRC`, `cFMI`, …), que es lo que Atlas usa (motor congelado, B11), y los de DISPLAY en la capa de render del prototipo (`dIFC`:12740, `dIRC`:12741, `dFMI`:12730, …), que es lo que su TABLA de diagnóstico muestra. **No coinciden:** `cIFC` es sexo-específico (M 4.12–6.68) vs `dIFC` genérico (3.5–6.0); `cIRC` opera en escala cruda (M 1.68–2.11) vs `dIRC` en `v×10` (2.0–2.8); `cFMI` normal 3–6 vs `dFMI` 6–9. Para el donante golden, `cIRC` da "Riesgo moderado" pero `dIRC` daría "Alto riesgo celular". **Para AF/IR SÍ coinciden** (`cAF==dAF`, `cIR==dIR`, verificado). Detectado porque la referencia de la tabla (que transcribimos del mundo `dXXX`) contradecía nuestro valor+clasificación (que son `cXXX`): un IRC 1.82 con referencia "2.0–2.8 ×10" se leía "muy por debajo" cuando la clasificación decía alerta. Arreglo inmediato: se dejó "-" en la referencia de IFC/IRC/FMI (los inconsistentes) para no mostrar una lectura invertida; AF/IR y los demás consistentes sí muestran rango.

**Para Gildardo (breve):** en tu HTML hay dos formas de clasificar algunos indicadores (IFC, IRC, FMI): una en el motor (por sexo) y otra en la tabla que ve el profesional (sin sexo, y en el caso de IRC en otra escala). Dan resultados distintos: para un paciente, el IRC sale "riesgo moderado" por una y "alto riesgo" por la otra. Atlas usa la del motor. ¿Cuál debe ver el profesional en la tabla de diagnóstico, la del motor (por sexo) o la de la tabla de tu prototipo? Importa porque esa clasificación se guarda de forma permanente con el diagnóstico.

**Pregunta aparte (etiquetas), en lenguaje de producto:** para **IR** y **FFMI**, tus dos juegos de clasificadores dan el **mismo resultado clínico** pero lo **nombran distinto**. El HTML nombra el estado con una palabra y Atlas con otra, para el mismo paciente en el mismo estado; en la revisión del Hito 2 (el HTML como referencia de la ciencia) llega como "Atlas dice algo distinto" sin poder distinguir si es etiqueta o ciencia. ¿Qué palabra quieres que vea el profesional? Pares concretos: **IR** — Atlas (`cIR`) "Inflamación bajo grado" vs tu tabla (`dIR`) "Inflamación **de** bajo grado"; **FFMI** — Atlas (`cFFMI`) "Bajo — riesgo desnutrición" vs tu tabla (`dFFMI`) "Desnutrición". (PABU NO entra aquí: ahí `cPABU` es ifc-dependiente con más bandas que `dPABU`, es diferencia de LÓGICA, no de palabra; va en el bloque principal de arriba.)

**Evidencia PARA la respuesta (no la sustituye):** tu propio cambio **C11** pide "exponer los rangos de referencia por indicador **y sexo**". Los `cXXX` SON por sexo (cIFC/cIRC/cFMI tienen cortes M/F distintos); los `dXXX` de la tabla que C11 cita NO (IFC/IRC son un solo umbral). Tu instrucción escrita orienta a `cXXX`, aunque cite la tabla display. No lo damos por dicho; lo señalamos.

**Para su CC:** el motor de Atlas clasifica con `cXXX` (frozen, sexo-específico) y sella `classifications` en el snapshot. La tabla del prototipo usa `dXXX` (display). Difieren en IFC/IRC/FMI (cortes y, en IRC, escala ×10). Si manda `dXXX`, hay que decidir cómo se porta sin editar el frozen (¿exponer `dXXX` por el mecanismo derivado? ¿o son equivalentes clínicos y `cXXX` es el correcto?), y si cambia lo que se sella, entra un campo de versión de clasificación (familia de C2b / `protocol_engine_version`). Mientras tanto Atlas sigue con `cXXX` y la referencia de esos tres queda en "-".

---

## Q21 · Tu HTML como entorno de pruebas: ¿lo mantienes al día con las modificaciones autorizadas, o lo dejas como está?

- **Fecha:** 2026-07-31. **Estado:** ABIERTA (decisión tuya, no nuestra).
- **De dónde sale:** corregimos un hecho que veníamos arrastrando. Justificábamos varias decisiones de fidelidad (visual, de vocabulario) con "hay que ser fieles al HTML porque los profesionales se entrenan con él". **Dato de Santiago: los profesionales se forman en Atlas Web, no en el HTML** (el HTML se usó porque no había versión web; hoy la hay). Las decisiones de fidelidad siguen bien, pero por otra razón: el HTML es la **expresión de tu ciencia**, y la fidelidad protege eso. Con esa corrección, el HTML deja de ser material de formación y pasa a ser, si acaso, tu **entorno de referencia/pruebas** para comparar contra Atlas.
- **Contexto que lo hace relevante:** con la opción B, Atlas va a aplicar cambios que tocan la ciencia (cáncer-remisión, la Δ, los C1-C13) a partir de tu instrucción escrita, sin editar tu archivo. Si tu HTML no se actualiza con esos mismos cambios, en el Hito 2 tu HTML y Atlas divergirán a propósito (cada divergencia queda registrada en `CAMBIOS_AUTORIZADOS.md`), y comparar uno contra otro dejará de ser una prueba limpia.

**Para Gildardo (breve):** ya no usamos tu HTML como material de formación (los profesionales se forman en Atlas). Queda como tu referencia de la ciencia. Cuando apliquemos de nuestro lado los cambios que autorizas (cáncer, la Δ, etc.), tu HTML y Atlas van a diferir a propósito en esos puntos. ¿Quieres mantener tu HTML actualizado con esos cambios, para conservarlo como tu entorno de pruebas contra el cual verificar Atlas, o prefieres dejarlo como está y usar solo el registro de cambios autorizados? Es decisión tuya; nosotros nos adaptamos.

---

## P0 · Presentación de la EB-BIS y del IAE (al paciente vs al profesional) — CERRADO (2026-08-01)

- **Fecha decisión:** 2026-08-01 (Gildardo). **Estado:** CERRADO; queda UNA sub-pregunta de producto abierta (abajo). Trabajo de implementación registrado en `BACKLOG.md` (T4 reportes + bloque Seguimiento).
- **Decisión completa de Gildardo:**
  1. La **cifra de EB-BIS NUNCA va al reporte del paciente.** Solo la ve el profesional.
  2. **Primera medición, reporte del paciente:** sin cifra y sin la expresión "edad biológica". Lleva la **lectura funcional** de los indicadores con su clasificación e interpretación en lenguaje llano.
  3. **Vista del profesional:** cifra completa de EB-BIS e IAE, **con marca visible "calibración provisional, no comunicable al paciente".**
  4. **Desde la segunda medición**, al paciente se le muestra **EL CAMBIO, no el nivel**, con dos reglas: (a) intervalo mínimo de **12 semanas** entre mediciones comparables; (b) presentación en **TRES BANDAS** (mejoró / sin cambio / empeoró) con corte **provisional en ±2 años**. Ese ±2 es **operativo, no clínico**: se reemplaza por el **cambio mínimo detectable** cuando exista.
  5. La **CLASE de IAE** (acelerado / concordante / desacelerado) **tampoco se imprime al paciente**; misma marca en la vista del profesional.
- **Sub-pregunta de producto ABIERTA (la abre su regla y no la resuelve):** si dos mediciones están a **MENOS de 12 semanas**, ¿qué ve el paciente sobre EB-BIS? ¿Nada, o el mismo contenido que en la primera medición (lectura funcional sin cifra)? Es decisión de producto; alguien la tendrá que tomar. Anotada también en `BACKLOG.md`.
- **Enganche técnico:** la marca "calibración provisional" es la dimensión `calibration` de `emission_versions` (`ebbis-v5-provisional`); cuando exista población y se recalibre, sube la versión y se reemite. Ver Q8 (cerrada) y `emission-versions.ts`.

---

## P1 · Cadena calórica: Mifflin sobre peso de referencia, SIN déficit adicional — DECIDIDO, implementación EN PAUSA

- **Fecha:** 2026-08-01 (Gildardo, punto 3.2). **Estado:** decidido por Gildardo; **implementación EN PAUSA** hasta que Santiago reciba respuesta a una ambigüedad pendiente (no se implementa la cadena nueva ni CA-3 hasta entonces). Es un cambio de opción B (toca la prescripción): tendrá su entrada en `CAMBIOS_AUTORIZADOS.md` cuando se implemente.
- **Regla de Gildardo:** (1) la prescripción usa **Mifflin sobre el peso de REFERENCIA** (es lo que alimenta el motor nutricional); (2) **NO se aplica un déficit adicional encima** (el peso de referencia ya fija ese nivel; sumar otro déficit duplicaría la restricción); (3) **Cunningham sobre peso MEDIDO** sigue vigente pero solo como **dato informativo del gasto actual** para el profesional, NO alimenta la prescripción; (4) al paciente no se le muestra ninguno de los dos como cifra suelta; (5) **los DOS valores quedan sellados en el snapshot** (trazabilidad y análisis longitudinal).
- **Impacto verificado en Atlas (lectura, sin tocar código — 2026-08-01):**
  - **La cadena portada cambia en DOS puntos, no uno.** Hoy `protocolo-calorico.ts` hace `gebAuto = ffm>0 ? Cunningham(500+22·FFM) : Mifflin(pesoN)` y `kcalObj = max(1000, round(GET − deficit))`. Bajo la regla nueva: (i) la prescripción usa SIEMPRE la rama Mifflin sobre peso de referencia (Cunningham pasa a ser figura informativa aparte, no el driver), y (ii) el déficit es **cero**. No es solo "déficit 0": también cambia de dónde sale el GEB de la prescripción.
  - **(a) `estrategia.deficit` no muere, pierde su efecto calórico.** Lo computa el frozen `motorProtocolo` (no lo tocamos); nuestra TS deja de restarlo. Queda sellado como parte de la salida del motor, pero ya no maneja `kcalObj`. `estrategia` sigue viva para display (`tipo`/`label`/`color`/`ref`, y el `resumenClinico`).
  - **(b) Lo demás de `estrategia` NO depende del déficit y sigue vivo:** `protMin`/`protMax` se computan aparte (por IRC/cáncer/fenotipo/obesidad sarcopénica, no por estrategia) y siguen alimentando la proteína; `restricciones`, `examenes`, `suplementacion`, `resumenClinico` se computan independientes. La estrategia solo pierde su efecto calórico.
  - **(c) El caso ancla de GOLDEN 1** (Cunningham desde FFM 65.73 → GEB 1946 → GET 2676 → **objetivo 2976**, el +300 hipercalórico con `deficit:-300`) **ya NO representa lo que Atlas prescribiría** bajo la regla nueva. Sigue válido como prueba de TRANSCRIPCIÓN (que nuestro TS iguala los bytes del HTML), pero deja de representar producción. **Pendiente (cuando se levante la pausa):** declararlo en el encabezado del golden con la disciplina de las brechas ("este caso prueba la transcripción de la cadena del HTML; NO representa el cálculo vigente de Atlas, que usa peso de referencia sin déficit adicional").
  - **(d) `protocol_suggested` debe sellar AHORA dos gastos basales** (Mifflin sobre peso de referencia + Cunningham sobre peso medido). **Cabe sin migración:** `treatments.protocol_suggested` es `jsonb` (write-once por el trigger 0026); sellar un segundo GEB es agregar un campo al objeto. Los diagnósticos nuevos sellan la forma nueva; los viejos conservan la suya.
- **CA-3 (cáncer) queda condicionado por esto (punto 2 de la ronda):** si el efecto calórico de la estrategia desaparece, "la remisión no activa el hipercalórico" deja de significar lo mismo (el cáncer activo tampoco recibe las +300). Bajo la regla nueva, la diferencia práctica que quedaría entre **cáncer activo y en remisión** sería solo: **proteína** (`protMin`/`protMax` 1.5–2.0 vs 0.8–1.2), **`pesoCalculo`** (peso actual sin ajuste vs peso ajustado en obesidad), y los **exámenes/suplementos/restricciones** oncológicos. CA-3 sigue teniendo sentido, pero es **otro cambio** del que describimos ("no activa el hipercalórico"): hay que redescribirlo en términos de proteína/peso/monitoreo. **No se implementa hasta que Santiago tenga la respuesta de Gildardo.**

---

## Nota de proceso (2026-07-26)

El propósito de este documento, en su primera línea, dice que los hallazgos que dependen de Gildardo se anotan aquí **con fecha, en vez de quedar solo en el chat**. Se incumplió dos veces con los dos ítems clínicos más delicados abiertos: esta Q11 y el protocolo de riesgo del PHQ-9/SCOFF/GAD-7 (que vivía solo en el handoff y ahora está en `BACKLOG.md`). Los dos se perdieron durante un traspaso de chat y se recuperaron por memoria de Santiago, no por documento.

**Punto de aplicación (acuerdo endurecido 2026-07-30): el registro se hace AL CERRAR CADA SUBTAREA, no al cerrar el bloque.** La regla de registrar existía hace veinte turnos y no se cumplió: se acumuló un lote doc-only de veinte turnos sin escribir, y varias queries envejecieron (las respuestas de Gildardo cambiaron algunas antes de que se escribieran). Cerrar por bloque deja la ventana demasiado grande. Al cerrar cada SUBTAREA se responden dos preguntas explícitas, aunque la respuesta sea "ninguno":
1. ¿Apareció algo que dependa de una decisión de Gildardo? Entra a `GILDARDO_QUERIES.md` con fecha, **antes** de cerrar la subtarea.
2. ¿Apareció algo que condicione un bloque futuro? Entra a `BACKLOG.md` con fecha, **antes** de cerrar la subtarea.

No queda en el chat. El chat es contexto perecedero; estos dos documentos no lo son.
