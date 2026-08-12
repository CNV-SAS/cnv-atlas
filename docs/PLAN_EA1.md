# Plan — EA1: derivar la composición que el export corto del Biody BIS no trae

> **ESTADO: CERRADO DEL TODO (2026-08-12).** Los cuatro checkpoints del orden de abajo están construidos: `deriveMissingComposition` (frozen `derivar-composicion.js` + golden), cableada en el import real (`bis-import.ts`) por composición faltante, icc/ict derivados. La que era la única dependencia abierta, `MCA_ref`/`hidSG_ref`, quedó CABLEADA con la respuesta de Gildardo del 12 (§9): referencias poblacionales (`MCA_ref` = 52,4% de la MLG de referencia, `hidSG_ref` = 73,2%), sexo-específicas, derivadas en el import (sexo vía `getPatientSex`) y persistidas como DERIVADAS. Con ellas ISCM ya se emite y las badges MCA/hidratación son evaluables. Prueba de aceptación end-to-end: `src/tests/ea1-acceptance.test.ts` (verde, 4 asserts). Este plan se conserva como registro de diseño.

**Lo que ya sabemos (no se replantea).** El export del Biody BIS SÍ trae la espectroscopía, así que el import FUNCIONA hoy y el diagnóstico núcleo (IFC/IRC/PABU/fenotipo/AF) sale bien. Faltan 36 campos de COMPOSICIÓN; las identidades de Gildardo (`derivarFaltantes`, v8 L158-216, verificadas sobre 5.073 registros) los derivan, incluidos ECM_BCM y hidSG. El gate del v8 corre la derivación solo si falta la espectroscopía; con este export (espectroscopía presente, composición ausente) NO correría, así que hay que correrla por COMPOSICIÓN faltante. `MCA_ref`/`hidSG_ref` esperan a Gildardo (Q35): quedan en null, sin degradar en silencio. Material listo: `src/tests/fixtures/biody-bis-male-synthetic.xlsx`.

## Qué deriva `derivarFaltantes` (del v8, verbatim)

FFW = ACT − 0.15·FM · AEC_sg = AEC − 0.1125·FM · AIC_sg = AIC − 0.0375·FM · MPM (protActiva) = MSSG − SES − MNO · MCA = 1.0162·AIC + MPM · IR = Z200/Z5 · smmW = SMM/peso·100 · ei/ei_sg/aec_mca (ratios) · ECM = FFM − MCA · **ECM_BCM = (FFM−MCA)/MCA** · ACT_MLG = ACT/FFM·100 · **hidSG = FFW/(FFM−0.15·FM)·100**. Solo rellena lo AUSENTE (nunca pisa un valor del Excel), así que es seguro correrla siempre.

## Las piezas

1. **Portar `derivarFaltantes` verbatim, golden-anclado.** Es ciencia de Gildardo (autoría), se porta sin cambiar un decimal. **Dónde:** en la capa de import (`clinical-engine/edge/`), como una función TS, **igual que ya se portan FMI y ASMI** (derivaciones suyas ancladas por golden). Opera sobre el objeto de composición con las MISMAS claves que `imp.raw` (los nombres de Atlas se extrajeron de su `importarComposicion`, coinciden: FM, TBW, ECW, ICW, masaSeca, solEC, minNoOseo, SMM, FFM, Z200, Z5...). Golden test: anclar cada derivación contra los valores del fixture / de Gildardo (paridad 1e-3), para que un cambio silencioso salte.

2. **Correrla en el import cuando falte composición, DESACOPLADA de la espectroscopía.** Punto de inserción: justo después de `parseBiodyRow` (que deja `imp.raw` con lo leído y null en lo ausente). Correr la derivación sobre `imp.raw` SIEMPRE (solo rellena huecos). Así, downstream, el objeto `bis` que consumen ISCM/IEHH (`engine.indices.js`) trae FFW/ECW_sg/ICW_sg/MCA ya derivados. **NO se copia el gate solo-espectroscopía del v8** (registrado como la razón: su gate no anticipó este firmware).

3. **Derivar los ratios antropométricos que el export corto no trae** (icc/ict) de cintura/cadera/talla, que SÍ vienen. Alimentan la tabla de Wang (display). Trivial; va con la derivación.

4. **`MCA_ref`/`hidSG_ref` a NULL, sin degradar en silencio (Q35).** El único hueco que la derivación NO cubre: dos referencias poblacionales.
   - **ISCM:** hoy su término MCA cae a **0** si falta `MCA_dif` (`engine.indices.js:16`: `MCA_dif != null ? ... : 0`). Eso es degradar en silencio. **Gate en el glue** (sin tocar el frozen): si `MCA_dif` no se puede computar (falta `MCA_ref` y `MCA_dif`), **ISCM se emite NULL** (no un número con un término en 0). Cuando Gildardo dé `MCA_ref` (Q35), ISCM computa completo. IEHH NO necesita MCA_ref (Re/Rinf/C/FFW), así que IEHH queda COMPLETO con la derivación.
   - **Badges celulares** (`celular-badges.ts`, glue): la de MCA (necesita `MCA_dif`) y la de hidratación (compara `hidSG < hidSG_ref`) no pueden dispararse sin la referencia. Hoy no disparan en silencio; agregar una nota honesta **"MCA / hidratación: no evaluables sin la referencia poblacional (pendiente de Gildardo)"** para que la ausencia se VEA, no se lea como "sin alteraciones". La badge ECM/BCM y la de AF SÍ funcionan (ECM_BCM se deriva, AF viene).

5. **Tests / golden.**
   - `derivarFaltantes` anclado contra valores conocidos (fixture + v8).
   - El import del BIS corto (fixture sintético) produce IEHH, los términos de agua de ISCM, ECM_BCM y hidSG (valor).
   - **ISCM = null (no 0)** cuando falta `MCA_ref`. Candado contra la regresión de "degradar en silencio".
   - Las badges AF y ECM/BCM disparan con el fixture; MCA/hidratación quedan "no evaluables".

## Orden de construcción (checkpoints, slow-lane, diff en cada uno)

1. Portar `derivarFaltantes` (TS en edge) + golden que la ancla. (Sin cablearla aún.)
2. Cablearla en el import (correr sobre `imp.raw`, siempre) + derivar icc/ict. Test: el fixture BIS produce la composición derivada.
3. Gate de ISCM a null sin `MCA_ref` (glue) + nota "no evaluable" en las badges MCA/hidratación. Test: ISCM null, no 0.
4. Aceptación: importar el fixture BIS sintético end-to-end → diagnóstico con IEHH e ISCM (o ISCM null honesto), badges correctas, composición completa en la tabla de Wang.

## Tamaño

**Medio, casi todo PORT.** La ciencia está hecha (las identidades de Gildardo); el trabajo es portarlas fiel (con golden), cablearlas por composición-faltante, y el gate honesto de las dos referencias. El OCR NO va (este equipo trae la espectroscopía). Es más chico que lo estimado al principio, cuando creíamos que era OCR.

## Qué espera a Gildardo

Solo `MCA_ref` y `hidSG_ref` (Q35, ya en el paquete). Sin ellos se construye TODO lo demás; ISCM y esas dos badges quedan en null/no-evaluable (honesto), y se completan cuando responda.
