# Inventario del archivo vigente completo vs Atlas (2026-08-03)

**Por qué existe.** Gildardo señaló que los cuatro bloques de tratamiento (nutricionista, médico, deportólogo, psicólogo) ya existen y funcionan en su archivo, y que solo portamos el del nutricionista. Pidió tres cosas con datos, no explicaciones: (a) si inventariamos los cuatro o solo uno, (b) cuánto es portar los otros tres, (c) qué más de su archivo está escrito y funcionando pero no identificado del nuestro. Este documento recorre el `ATLAS_v7.html` (17.923 líneas) ENTERO, no solo la pantalla de tratamiento, y lo coteja contra Atlas.

---

## (a) ¿Inventariamos los cuatro bloques, o solo el del nutricionista? — HONESTO: solo el del nutricionista

**Solo el del nutricionista.** El `INVENTARIO_TRATAMIENTO.md` (2026-08-02) recorre exclusivamente la subpestaña "Nutricionista" (resumen clínico, meta terapéutica, VITACELLEBIS, fórmula sintética, validación, intercambio, menú). Su fila 1 ("una por profesión ('Nutricionista')") vio que había subpestañas por profesión, pero solo mapeó la del nutricionista. Para médico y ejercicio, en un pase anterior (tarea "pestañas médica/ejercicio") concluimos que eran "85-95% contenido derivado de indicadores + dos mapeadores pequeños", un juicio SIN mapear su código real. Al psicólogo no lo miramos. Tenías razón: el inventario fue parcial.

## (b) Cuánto es portar los otros tres — con números (verificado leyendo su código)

Los cuatro son MOTORES deterministas (no "display derivado", como habíamos dicho de médico/ejercicio). Los otros tres son motores COMPACTOS + su display:

| Profesión | Motor | Líneas motor | Display (subpestaña) | Depende de | ¿Cadena calórica? |
|---|---|---|---|---|---|
| **Nutricionista** | `motorTratNutri` (14077-14166) + planificador intercambios (15171-15758) | ~90 + ~150 | `plan_nutricional` | Cadena calórica completa + BIS + encuesta | **ES la cadena calórica** (en pausa por C6) |
| **Médico** | `motorTratMedico` (14176-14208) | ~32 | `trat_medico` (15760-15949) + IIFE MUERTA 15951-16099 | Encuesta (dx/meds) + BIS (sarco/obesidad) | **NO** |
| **Deportólogo/Ejercicio** | `motorTratEjercicio` (14209-14234) | ~26 | `trat_ejercicio` (16264-16424) | Encuesta (dx) + edad + BIS composición | **NO** (pero ALIMENTA la cadena: su `faRec` es el factor de actividad del motor nutricional, 14091) |
| **Psicólogo** | `motorTratPsico` (14235-14254) | ~20 | `trat_psico` (16101-16262) | **Solo encuesta** (ignora `bis`) | **NO** (pero DISPARA la salvaguarda TCA que pausa el déficit nutricional, 14106/14251) |

**Lectura:** los tres son pequeños (motor de 20-32 líneas + display de ~160), dependen de la encuesta + indicadores BIS ya calculados, y **NINGUNO depende de la salida de la cadena calórica** (que está en pausa). Así que **son portables AHORA**, sin esperar C6. Dos matices de acoplamiento verificados: (1) el motor de ejercicio produce `faRec`, que es justo el factor de actividad de la cadena calórica (6.4: Gildardo dice que ese factor es "valor fijo por defecto, ligero"); (2) el motor de psicología dispara la salvaguarda que pausa el déficit calórico. Los dos acoplamientos van hacia el nutricional, no al revés. **Estimación: los tres motores + sus displays son un bloque MEDIANO, autocontenido, construible sin la cadena calórica; es puro trabajo de port (se portan verbatim, sin interpretar).** Un cuarto ítem: cada profesión tiene su párrafo narrativo `_resumenXXXParrafo` (11662-11792), cuatro en total (ver (c)).

## (c) Qué MÁS del archivo está escrito y funcionando, no identificado del nuestro

Recorrido del archivo entero (25 bloques funcionales). Lo PORTADO en Atlas está bien; lo que sigue son los HUECOS: bloques que existen y corren en su archivo y que NO teníamos identificados como suyos.

| Bloque del archivo | Líneas | ¿En Atlas? | Nota |
|---|---|---|---|
| Motor bioeléctrico (calcIFC/IRC/PABU + clasificadores cXXX) | 3195-3417 | **SÍ** (frozen engine.core) | portado |
| Motor EFR/Diana (efrCompose/getDX/MCCB) | 3916-4919 | **SÍ** (frozen + Diana SVG) | portado |
| Clasificadores antropométricos (clasifCC/ICC/Lancet) | 6427-6473 | **SÍ** (frozen) | portado |
| computeDFI + rutas | 9576-11519 | **SÍ** (frozen engine.dfi + rutas) | portado |
| motorDiagnostico (2 capas + MCCB 12 fenotipos) | 11032 | **SÍ** (frozen) | portado |
| motorProtocolo (protocolo por fenotipo/sector) | 14001-14076 | **SÍ** (frozen atlas-protocolo) | portado |
| Encuesta D0-D8 + ModEncuesta | 665-5460 | **SÍ** | 62 preguntas portadas |
| Antropometría/BIS + import | 5461-6592 | **SÍ** (B8 + Evaluación) | portado |
| Reporte imprimible (generarHTMLReporte/HC) | 7598/13191 | **SÍ** (B10 PDF) | portado |
| **`motorTratNutri` (motor calórico nutricional)** | 14077-14166 | **PARCIAL** | la cadena calórica, EN PAUSA por C6 |
| **`motorTratMedico`** | 14176-14208 | **NO** | hueco (b) |
| **`motorTratEjercicio`** | 14209-14234 | **NO** | hueco (b); alimenta el factor de actividad calórico |
| **`motorTratPsico`** | 14235-14254 | **NO** | hueco (b) |
| **Los CUATRO `_resumenXXXParrafo`** (nutri/médico/ejercicio/psico) | 11662-11792 | **NO** | solo conocíamos el nutricional (`atlas-resumen-clinico.js`); son CUATRO, uno por profesión |
| **Planificador de intercambios/ICN** (interSugerir/interICN/interCob) | 15171-15758 | **NO** | Plan alimentario (E+F), ya identificado como bloque propio |
| **Motor de menú/porciones ANI** (calcPorcionesANI/distribPorTiemposANI/generarMenuANI) | 13929-14000 | **NO** | el motor detrás del menú 7x5; ya identificado (Plan alimentario) |
| **`BIAQualityCheck`** (control de calidad de la medición BIA) | 10543 | **PARCIAL** | Atlas valida calidad al IMPORTAR (rangos/fecha/una sola medición, `import-schema`), pero NO el panel interactivo de control de calidad de la toma. Hueco menor. |
| **Despacho por profesión** (buildDespachoBlock + registrarDespacho) | 14834-14942 | **NO** | el "Registrar despacho" de nutracéuticos; es T3, por profesión |
| Admin (integrantes/inventario/consignaciones) | 17327+ | **SÍ** (comodato B4, nutracéuticos B5, paneles B14) | portado |
| Seguimiento (ModSeguimiento, dfiCompara, lineFollow) | 12999-13190 | **PARCIAL** (B13 followups) | comparación longitudinal parcial |

**Los huecos reales que NO teníamos como suyos (la respuesta a (c)):**
1. **Los tres motores de tratamiento** (médico, ejercicio, psicólogo). El hallazgo principal, confirma a Gildardo.
2. **Los cuatro párrafos narrativos por profesión** (`_resumenXXXParrafo`). Solo teníamos el nutricional (y como artefacto suelto sin bloque); en realidad son cuatro, uno por profesión, parte del archivo.
3. **`BIAQualityCheck`** (control de calidad de la medición BIA) — hueco menor: Atlas valida al importar, pero no tiene el panel interactivo de calidad de la toma.
4. El **despacho por profesión** (registrar despacho de nutracéuticos/exámenes) es por-profesión, no solo del nutricionista.

Lo demás que falta (cadena calórica, plan alimentario, menú) ya estaba identificado en `INVENTARIO_TRATAMIENTO.md`. El error no fue omitir esos; fue mirar una sola de las cuatro columnas de la pantalla de tratamiento.

## Consecuencia

El tratamiento no es "el del nutricionista + dos mapeadores"; son **cuatro workspaces de profesión**, tres de ellos motores pequeños portables ya, más la narrativa por profesión, más el plan alimentario y la cadena calórica (en pausa). La estructura de subpestañas por profesión del vigente NO era decorativa: refleja que hay cuatro bloques. Va al replanteo de Tratamiento y al documento consolidado.
