# Plan — La cadena calórica (C6 completo), con las enmiendas de Gildardo (2026-08-09)

**No construir aún; este es el mapa para revisar con Santiago.** Es el bloque grande de Tratamiento: desbloquea el plan nutricional entero (fórmula, intercambios, menú), parado esperando C6, ahora firmado.

## Estado actual (lo que hay que corregir, no partir de cero)

Ya existe un port ANTERIOR de la cadena (el "3er modelo" de Q14, en pausa desde 2026-08-02):
- `src/clinical-engine/protocolo.ts` (glue): arma el SUGERIDO al diagnosticar y `computeProtocoloEfectivo` lo recomputa con los ajustes del profesional al aprobar.
- `src/clinical-engine/protocolo-calorico.ts`: GEB (Cunningham/Mifflin) -> kcalObj -> proteína/grasa/CHO.
- `src/clinical-engine/frozen/atlas-protocolo.js` (`motorProtocolo`): la estrategia (déficit) **por FENOTIPO** (F1 -500, F2/F3 -600, F4/F5 -300...). **Este es el modelo VIEJO que las enmiendas reemplazan.**
- Peso meta: se captura como `adj_peso_meta` (ajuste del profesional, tabla `treatments`), y `pesoEfectivo = adj.pesoMeta ?? sug.pesoCalculo` -> si el profesional no lo fija, cae a `pesoCalculo` (peso de cálculo), **NO a Lorentz**.

**El delta de Gildardo (D-002, ronda 2026-08-09):**
1. El gasto (Mifflin) va sobre el **PESO ACTUAL**, no el de referencia. (El motor ya usa `pesoAct` en el GEB; verificar que el glue no lo cambie.)
2. El **déficit sale del PESO META** (`peso actual - peso meta`), NO de un valor fijo por fenotipo. El fenotipo puede sugerir un inicial, pero el peso meta lo reemplaza en cuanto está fijado.
3. La salvaguarda de **TCA es ALERTA, no bloqueo**. El `pausadoTCA` que anula el cálculo era un bug; Gildardo lo corrigió en v8. El peso meta acordado sigue gobernando.
4. **El peso meta tiene un DEFAULT (Lorentz) que hoy se usa en silencio** y cambia la prescripción (la proteína se calcula sobre él). Hacerlo VISIBLE. `pesoAjust` es código muerto (retirar si aparece en el target). Lorentz solo aplica si el IMC está fuera de 18.5-25; si no, usa el peso actual.

## Las piezas, en orden (la primera es un defecto silencioso, va primero)

### 1. Hacer VISIBLE el default del peso meta (defecto crítico, nota 3 de Gildardo) — PRIMERO
Antes que las cifras: sin esto, todo lo demás prescribe sobre un supuesto invisible.
- Hoy Atlas cae a `pesoCalculo` en silencio; el modelo corregido usa un default de Lorentz (solo si IMC fuera de 18.5-25). Sea cual sea el default, **mostrarlo en pantalla**: "Peso meta: X kg (por defecto, fórmula de Lorentz). Ajústalo si corresponde." El profesional debe VER que hay un supuesto y poder cambiarlo antes de prescribir.
- Superficie: el panel de tratamiento (donde ya se edita `adj_peso_meta`, `treatment-panel.tsx` + `treatment-writer`/`validations`). El default calculado se expone como precarga visible del campo (no un valor oculto que entra al cálculo sin que el campo lo muestre).
- Retirar `pesoAjust` si está en el target del re-port (código muerto que confunde).

### 2. Re-portar el `motorTratNutri` corregido del v8 (frozen, con DIFF + golden)
Fuente: `docs/entregas/gildardo-2026-08-04/ATLAS_v8.html` (el vigente, con la corrección de TCA y el déficit desde peso meta). Se porta VERBATIM, como los otros motores congelados (extracto contiguo -> frozen JS con test DIFF byte a byte). Toca el frozen: va por el **mecanismo de modificaciones autorizadas** (`atlas-protocolo.authorized.js`), no se edita el frozen base.
- Reemplaza la estrategia por fenotipo (`motorProtocolo` déficit F1..F11) por **déficit = peso actual - peso meta**.
- TCA: de "déficit a cero + bloqueo" a **ALERTA** (el cálculo sigue con el peso meta acordado).
- Golden: anclar contra valores del v8 (paridad 1e-3), como el resto.

### 3. Cablear las cifras C6 (D-002, verbatim de Gildardo)
- **Proteína (g/kg sobre PESO META):** sin condición 1.0 · cáncer/desnutrición 1.25 · obesidad 1.3 · obesidad+sarcopenia 1.4 · sarcopenia sola 1.4 · ERC 0.7 (0.6-0.8). **La ERC MANDA** sobre la proteína alta (ERC+sarcopenia -> 0.7).
- **Energía:** cáncer/desnutrición -> 27.5 kcal/kg de PESO ACTUAL. Resto -> GET - déficit. **Piso SOLO con déficit:** 1500 (H)/1200 (M). El arranque 10-15 kcal/kg por realimentación es NOTA CLÍNICA, no cálculo del motor.
- **Grasa:** 25% en dislipidemia (saturada <7%); 30% resto.
- **Sodio (gana la más restrictiva):** HTA 1500 + DASH · ERC 2000 · alteración hídrica 2000 si no hay otro límite.
- **DM2:** no cambia cifras; agrega CHO controlados y bajo índice glucémico (nota).

### 4. Condiciones derivadas de la COMPOSICIÓN, no solo del diagnóstico
Obesidad = IMC>=30 **O** FMI>6(H)/9(M); sarcopenia = FFMI 17/15 **O** ASMI<7.0/5.5; desnutrición = IMC<18.5. Un paciente sin diagnóstico registrado activa el protocolo igual. (Encaja con EA1: la composición ya está completa, incluso derivada.)

### 5. El plan alimentario detallado (el grueso construible, display sobre la cadena)
Grupos de intercambio ICBF, DRI, validación ICN, distribución por tiempos, menú. Es lo más grande una vez firme la cadena. Se planea aparte cuando 1-4 estén cerradas.

## Decisiones / cosas a confirmar al arrancar
- **Cotejar las cifras C6 una por una contra el .md ORIGINAL de Gildardo cuando llegue** (hoy están en D-002 desde la transcripción de Santiago; alimentan prescripciones, un decimal movido llega a un paciente). Si algo no cuadra al construir, **parar y preguntar**, no asumir.
- El re-port toca ciencia congelada y datos que se sellan: **carril lento** (plan + diff por sub-tarea, golden/DIFF en cada pieza del frozen).
- Confirmar dónde vive el default de Lorentz en el v8 (motorTratNutri) y si Atlas debe adoptarlo o mantener su `pesoCalculo` como base (probable: adoptar el v8, es la ciencia vigente).

## Tamaño
**GRANDE, multi-turno.** Frozen re-port (autorizado, con DIFF) + cifras + composición + el defecto del default + el plan alimentario. La pieza 1 (peso meta visible) es chica y va primero; 2-4 son el núcleo; 5 es un bloque propio.
