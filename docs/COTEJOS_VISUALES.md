# COTEJOS_VISUALES.md — cotejo de fidelidad de Atlas contra el HTML v8 (E3)

**Qué es esto.** El plan para comparar, pantalla por pantalla, lo que Atlas MUESTRA contra el prototipo de Gildardo (`docs/entregas/gildardo-2026-08-04/ATLAS_v8.html`). Es la fase E3 (pulido de fidelidad), y es un trabajo **distinto** de los anteriores: no se revisan diffs de código, se **comparan pantallas**. Santiago mira mucho; por eso llega ordenado.

**Regla de oro (para no cotejar dos veces):** solo se cotejan pantallas donde ya NO queda nada por construir. Cotejar algo que vamos a cambiar es cotejar dos veces.

---

## d) El criterio: qué ES un hallazgo y qué NO

**Un HALLAZGO (a corregir)** es una divergencia de **forma** (layout, orden, color, rótulo, redacción, un dato que falta o sobra en pantalla) que NO responde a una decisión ya tomada. La fidelidad aplica a la **forma, no a los permisos ni a la ciencia**: si el HTML muestra algo que ampliaría la visibilidad del admin o cambiaría un cálculo, eso NO se copia (ver decisiones abajo).

**REGLA QUE GOBIERNA EL COTEJO (Santiago, 2026-08-14): el HTML manda en QUÉ se muestra; nosotros en CÓMO.**
- **QUÉ (accionable, siempre):** si un INDICADOR se muestra en el HTML y NO en Atlas, hay que **portarlo**. Es su ciencia y los profesionales se entrenan en ese modelo; lo que no mostramos, el profesional no lo tiene. Un indicador ausente en Atlas es SIEMPRE un hallazgo accionable, no una decisión.
- **CÓMO (nuestro, es decisión):** la disposición, el color, el orden y la jerarquía son nuestros (igual que ya se decidió con el radar, las subpestañas y las cuatro de categoría 2). Una diferencia de PRESENTACIÓN es una decisión, no un hallazgo.
- Corolario para clasificar: "indicador que él muestra y nosotros no" → portar (defecto/porte/comentario viejo). "mismo indicador, distinta forma" → decisión (o divergencia deliberada si ya se justificó).

**NO es un hallazgo** una divergencia que ya decidimos a propósito. Lista viva de las decisiones deliberadas (si aparecen en el cotejo, se ignoran; no se anotan):

| Divergencia deliberada | Por qué | Ref |
|---|---|---|
| **AF a 1 decimal** (el HTML usa 2 en varios sitios) | Dos decimales sugieren una exactitud que no hay (Dirección Científica, v8 §2.2) | `DECISIONES_ANIBISE.md` D-016 |
| **Sin barra de subpestañas por profesión** (el HTML tiene tabs Médico/Ejercicio/Psico/Nutricional) | Cada profesional ve SOLO su sección; nadie ve más de una, así que una barra tendría un único destino y se vería rota. Es decisión de visibilidad, no de forma | `BACKLOG.md` (B1, "sin barra") |
| **El admin NO ve las cuatro secciones en solo-lectura** (el HTML sí) | La fidelidad al HTML es a la FORMA, no a los permisos; copiarlo ampliaría el acceso del admin al contenido clínico | `BACKLOG.md` (regla fidelidad≠permisos), `PLAN_GRANTS.md` |
| **EB-BIS NO se rotula como "edad fisiológica"** y su cifra no va al reporte del paciente | Es un índice funcional/bioeléctrico, no la edad del cuerpo (Gildardo P0) | `BACKLOG.md`, D-010/D-011 |
| **Aviso de encuesta incompleta y jerga técnica fuera del reporte del paciente** | Es información del profesional, no del paciente (2026-08-08) | `BACKLOG.md` P0 Parte 2 |
| **Mapeo del ICEC / textos que el prototipo trae desactualizados** | Cuando el prototipo difiere de la ciencia vigente, el desactualizado es el prototipo | `DECISIONES_ANIBISE.md` (ICEC) |

**Cuando dudes si algo es hallazgo o decisión: NO lo anotes como hallazgo; pregúntalo.** Una lista larga sin prioridad es peor que una corta y cierta.

---

## a) Qué comparar, pantalla por pantalla, en orden

El orden sigue el flujo clínico. Para CADA pantalla, la tabla de la sección (c) se llena elemento por elemento.

1. **Encuesta** (`/encuesta/[token]`). Comparar: estructura por dominios/stepper, textos de preguntas y opciones VERBATIM, widgets (pills, contador, slider), orden de las preguntas, el candado de acoplamiento (no se toca el texto). *Ciencia congelada: el contenido NO se cambia; un texto distinto es un hallazgo para Gildardo, no un ajuste nuestro.*
2. **Evaluación** (entrada: consentimiento + import BIS + condiciones). Comparar: pasos de entrada, condiciones BIS (contraindicaciones, embarazo, cintura/cadera), avisos, y que las medidas/umbrales se lean bien.
3. **Diagnóstico** (`/evaluaciones/[id]`, pestaña Diagnóstico). Comparar: la **Diana EFR** (color por celda + **orden posicional** por riesgo, **ya portado**; ver nota abajo), la **tabla de indicadores** (rótulos, orden, Δ, referencia, dirección del riesgo), el DFI/composición, el fenotipo, el aviso de incompletitud (para el profesional).
4. **Tratamiento** (`/evaluaciones/[id]`, pestaña Tratamiento). Comparar: rutas de atención, remisiones (ahora registrables), el workspace del nutricionista (kcal/proteína precargados, restricciones, nutracéuticos, despacho, menú), las secciones de consulta médica/psico/ejercicio. **Ojo:** la barra de subpestañas es una decisión deliberada (arriba), no un hallazgo. **Material extra: Santiago tiene capturas del v8 de tratamiento.**

**Nota Diana (ya ejecutado, verificado 2026-08-08):** el port visual de la Diana está HECHO en sus tres piezas: color por celda (`riskColor`, paradas verbatim del `rc()` del prototipo, `diana.tsx`), orden posicional por riesgo (`efrRiskRank`, menor riesgo al centro, `types.ts`), y la renumeración de `stateNumber` (ya IGUAL al `efrNum` de Gildardo; la vieja base-3 donde "nuestro 42 era su 33" se renumeró, `efrStateNumber` en `types.ts:242-255`, anclado en `efr-state-numbering.test.ts`). No queda port por ejecutar; el cotejo de la Diana es de forma (que se vea igual), no de lógica.

> **TRAMOS APLAZADOS (2026-08-12): NO cotejar contra el v8 del 4-ago.** Nuestro `ATLAS_v8.html` (4-ago) es anterior a dos correcciones que Gildardo ya hizo (ver [[v8-desactualizado-riesgo-cotejo]], pedido su archivo al día en `RONDA_GILDARDO_2026-08-12.md`). Cotejar estos tres tramos contra el v8 viejo produce hallazgos falsos GARANTIZADOS (divergen a propósito):
> 1. **Patrón alimentario, colores de "Moderados"** (§5: el v8 no invierte el color, Atlas tras el port sí). Y el grupo 15 en el promedio.
> 2. **Referencia de MCA / composición** (§9: el v8 usa 50%, Atlas 52,4%).
> 3. **Etiquetas de déficit calórico** (§1: en pausa, esperando la decisión de Gildardo).
>
> El resto (Diana, radar, dominios DFI, indicadores, fenotipo, estructura del reporte) NO está afectado: se coteja YA contra el v8. Estos tres se cierran cuando llegue el v8 al día.

---

## b) Qué material hay y qué falta

- **El prototipo COMPLETO:** `docs/entregas/gildardo-2026-08-04/ATLAS_v8.html` — se abre en el navegador y **renderiza las cuatro pantallas** con datos de ejemplo. Es la fuente de verdad del cotejo; sirve para las cuatro, no solo tratamiento.
- **Capturas de Tratamiento:** las que Santiago ya pasó del v8.
- **Lo que falta:** capturas dedicadas de Encuesta, Evaluación y Diagnóstico. **No bloquea:** el HTML las renderiza; se comparan abriendo el HTML al lado de Atlas. Si conviene, Santiago captura esas tres al recorrerlas (quedan como material para la próxima).
- **Para ver Atlas con datos comparables:** el paciente Demo GoldenPath en la BD (camino completo), para que ambos lados muestren un caso real, no defaults.

---

## c) Cómo registrar lo que se encuentre (para que no se pierda en el chat)

Una **tabla por pantalla**. Santiago la va llenando (o reporta lo que ve y yo la registro). Formato:

| # | Elemento | Atlas muestra | HTML v8 muestra | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| 1 | (ej. AF) | 6.8 | 6.85 | deliberada (D-016) | ninguna |
| 2 | (ej. rótulo de un indicador) | "IFC" | "IFC · Índice..." | hallazgo | añadir nombre largo |

- **"¿Hallazgo o deliberada?"** se decide con la lista de (d). Si es deliberada → "ninguna". Si es hallazgo → una acción concreta.
- Al cerrar cada pantalla, los hallazgos reales (no las deliberadas) se pasan a `BACKLOG.md` con su acción, priorizados. Así el cotejo produce una lista **corta y cierta**, no una larga sin prioridad.
- **Dónde vive esta tabla llena:** una sección por pantalla en este mismo doc, o un archivo por pantalla; se decide al arrancar según prefiera Santiago.

---

## Aviso antes de mirar (2026-08-27)

**Tres de las once entradas [OJOS] se REESCRIBIERON**, porque describían el layout anterior al rediseño
del 26 y 27 de agosto. Cotejar contra ellas habría dado hallazgos falsos: dirían que Atlas no se parece
al HTML en cosas que cambiamos a propósito, con criterio escrito en `BRAND.md`.

**Las otras ocho valen tal cual**: son color, posición, contenido y comprensión, y el rediseño no las
tocó. Cada entrada reescrita lo dice en su propio texto.

## Estado

- **Precondición:** que no quede nada por construir en las cuatro pantallas. Tratamiento cierra su construible con D-009 (Parte A hecha; Parte B espera a Gildardo, no bloquea el cotejo de forma). La **barra de subpestañas NO se construye** (decisión de visibilidad, arriba): no es una pieza pendiente que retenga el cotejo.
- **Arranque:** Diagnóstico (tiene la pieza visual más característica, la Diana, cuyo port ya está ejecutado y verificado; ver nota Diana). Mi pasada HTML-vs-código de Diagnóstico va en la sección siguiente; los hallazgos que requieren ojos (color, layout, comprensión) quedan para Santiago con la tabla de registro llena.

---

## DIAGNÓSTICO — tabla de registro (pre-llena por la pasada HTML-vs-código, 2026-08-08)

**Cómo leer esto.** Yo ya comparé el texto del código de Atlas (`evaluation-results.tsx`, `diana.tsx`, `maps-section.tsx`, el registry de indicadores) contra el render del HTML v8 (pestañas `composicion` y `funcional` del componente `ModDiagnostico`). Lo que se detecta LEYENDO (textos que difieren, campos que faltan, orden) ya está aquí clasificado. Lo que requiere OJOS (color de la Diana, layout, si algo "se entiende") queda para Santiago, marcado **[OJOS]** en la última sub-tabla.

**Fuente HTML:** `ATLAS_v8.html`, tabla de indicadores L14138-14204, DFI L13097-13136, tarjetas EFR L14244-14275.

### A. Tabla de indicadores (ANI-BIS-E)

Atlas agrupa los 12 índices ANI-BIS-E en una tabla propia ("Indicadores ANI-BIS-E"); el HTML los reparte en su "Tabla por Niveles de Wang" (Nivel V/IV/III/II + Índices bioeléctricos integrados). Comparo NOMBRE largo, columnas y decimales.

| # | Elemento | Atlas muestra | HTML v8 muestra | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| A1 | Encabezado col. valor | `Valor` | `Valor obtenido` | hallazgo (menor) | decidir rótulo; bajo |
| A2 | Encabezado col. clasificación | `Clasificación` | `Diagnóstico` | hallazgo (menor) | decidir rótulo; bajo |
| A3 | Nombre IFC | Índice de **Función** Celular | Función Celular | **RESUELTO** (§10/P-18, 2026-08-09; `registry-data.ts:37`) | coincide; ninguna |
| A4 | Nombre IRC | Índice de Riesgo Celular | Índice de riesgo celular (×10) | **RESUELTO** (§10: IRC queda como está; escala cruda, ver A11) | ninguna |
| A5 | Nombre PABU | Proporción Áurea Bioeléctrica **de Uribe** | Proporción Áurea Bioeléctrica de Uribe | **RESUELTO** (§10: "de Uribe", no "Universal"; `registry-data.ts:39`) | ninguna |
| A6 | Nombre ICA-BIS | Índice de Coherencia Áurea (BIS) | ICA-BIS (PABU − φ) | candidato (no lo nombró §10) | menor; no urge |
| A7 | Nombre ISCM | Índice de Susceptibilidad Cardiometabólica (BIS) | Score de susceptibilidad multicomponente | **RESUELTO** (§10: ISCM queda como está) | ninguna |
| A8 | Nombre IEHH | Índice del **Estado** de Hidratación Humana | Índice del Estado de Hidratación Humana | **RESUELTO** (§10: "Estado", no "Espectro"; `registry-data.ts:42`) | ninguna (ojo: el comentario del frozen `engine.indices.js:23` aún dice "Espectro"; solo comentario) |
| A9 | Nombre EB | Edad Bioeléctrica (EB-BIS) | Edad biológica (a) | **deliberada** (D-010/D-011) | ninguna; NO es "edad biológica" |
| A10 | Nombre IR | Radio de impedancia | Radio de impedancia | **RESUELTO** (traducido; `registry-data.ts:48`) | ninguna (el inglés sobrevive solo como header del Excel de import, correcto) |
| A11 | Escala IRC en pantalla | valor crudo, 2 dec, referencia cruda (`< 1.68`) | valor ×10, 3 dec | candidato → decisión | Atlas es coherente consigo mismo; el número no coincidirá con el HTML |
| A12 | Decimales AF | 1 decimal | 1 decimal | **coincide** | ninguna (la fila "deliberada AF 2 dec" no aplica en esta tabla) |
| A13 | Nombres FMI / FFMI / IAE | Índice de Masa Grasa / Libre de Grasa / Aceleración del Envejecimiento | idénticos en esencia | **coincide** | ninguna |

### B. DFI (Diagnóstico Funcional Integral)

| # | Elemento | Atlas muestra | HTML v8 muestra | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| B1 | Título de la card | Diagnóstico Funcional Integral (DFI) | Diagnóstico Funcional Integrado + subtítulo "5 dominios · síntesis ANI BIS-E" | hallazgo (menor) | "Integral" (nuestro, establecido) vs "Integrado"; falta el subtítulo. Decidir; bajo |
| B2 | Nombres de los 5 dominios | Celular-Eléctrico, Metabólico-Estructural, Envejecimiento, Conductual-Perceptual, Epigenético-Contextual | idénticos | **coincide** (port del motor) | ninguna |
| B3 | Iconos de dominio | lucide (Zap, HeartPulse, Hourglass, Brain, Dna) | emoji (🔬 ❤️ ⏳ 🪞 🧬) | **deliberada** (sin emoji en UI) | ninguna |
| B4 | Niveles de riesgo integrado | BAJO / MEDIO / ALTO / CRÍTICO + descriptores | idénticos | **coincide** (port del motor) | ninguna |
| B5 | Etiquetas de severidad por dominio | Óptimo / **Leve** / Moderado / **Alto** | Óptimo / **Vigilancia** / Moderado / **Crítico** | candidato → Gildardo | el HTML se contradice: su clasificador emite Leve/Moderado/Alto, su array de display dice Vigilancia/Crítico. Atlas siguió el clasificador |

### C. Detalle del estado EFR (6 tarjetas)

| # | Elemento | Atlas muestra | HTML v8 muestra | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| C1 | Tarjeta 1 | Enfermedades / Complicaciones probables | 1. 🔬 Enfermedades / Complicaciones probables | **coincide** (sin emoji/número) | ninguna |
| C2 | Tarjeta 2 | Mecanismos bioquímicos / Disfunción celular | 2. ⚙️ Mecanismos bioquímicos / Disfunción celular | **coincide** | ninguna |
| C3 | Tarjeta 3 | Biomarcadores clave | 3. 🧪 Biomarcadores clave | **coincide** | ninguna |
| C4 | Tarjeta 4 | Riesgos clínicos | 4. ⚠️ Riesgos clínicos | **coincide** | ninguna |
| C5 | Tarjeta 5 | Nutracéuticos sugeridos | 5. 💊 VITACELLEBIS — Nutraceúticos indicados... | **deliberada** (excepción de negocio) | ninguna. (De paso: el HTML trae el typo "Nutraceúticos"; Atlas lo tiene bien) |
| C6 | Tarjeta 6 | Abordaje por profesión | 6. 🧭 Abordaje por profesión | **coincide** | ninguna |

### D. Fenotipo / rótulos del estado y Diana

| # | Elemento | Atlas muestra | HTML v8 muestra | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| D1 | Línea de estado | Estado EFR {N} de 81 · clave {key} | Anillo {A} · Radio {R} · #{N} de 81 | hallazgo (menor) | Atlas usa "clave" (bandas); el HTML usa nomenclatura Anillo/Radio. Decidir si adoptar Anillo/Radio; bajo |
| D2 | Fenotipo estructural | Fenotipo estructural (FMI × FFMI) | Fenotipo MCCB (FFMI×FMI) | hallazgo (menor) | orden de factores FMI×FFMI vs FFMI×FMI; "estructural" vs "MCCB". Alinear; bajo |
| D3 | Ejes de la Diana | anillo = IFC×IRC, sector = FFMI×FMI | anillo = IFC×IRC, radio = FFMI×FMI | **coincide** | ninguna |
| D4 | Numeración de estado | `rank(IFC×IRC)*9 + rank(FFMI×FMI) + 1` | `(rk_IFCxIRC−1)*9 + rk_FFMIxFMI` (equivalente) | **coincide** (anclado en test) | ninguna |
| D5 | Aviso "explorar no cambia el diagnóstico" | presente (maps-section) | presente (banner) | **coincide** | ninguna |

### E. Estructura de la pantalla

| # | Elemento | Atlas muestra | HTML v8 muestra | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| E1 | Organización | página única (DFI → Mapas → Detalle EFR → Indicadores → Composición → confirmar) | 4 pestañas (encuesta D1-D8, composición, funcional, prof) | **deliberada** (arquitectura) | ninguna; cotejar elemento a elemento, no la estructura de pestañas |
| E2 | Diagnóstico de encuesta D1-D8 | sección aparte (survey-diagnosis-section) | pestaña "encuesta" | fuera de alcance de esta pasada | cotejar por separado si se decide |

### Para Santiago (requiere OJOS, no se detecta leyendo)

- **[OJOS] La Diana:** que el color por celda (verde al centro degradando a rojo al exterior) y las posiciones se vean IGUAL que en el HTML. El port está hecho y verificado en lógica; falta confirmar que en pantalla luce igual con el paciente Demo GoldenPath.
- **[OJOS] El radar funcional:** que los 5 vértices y la severidad se lean igual.
- **[OJOS] Jerarquía visual (REESCRITA 2026-08-27, la anterior describía el layout de antes del rediseño).** Ya NO se compara contra el HTML: Atlas usa a propósito un sistema propio de tres niveles (`decision` / `derivado` / `registro`, ver `BRAND.md`), porque su pantalla es una interfaz de trabajo y la del HTML no. Lo que hay que mirar es si **el sistema funciona**: ¿se ve de un golpe qué decidió el profesional y qué calculó el motor? ¿Los bloques del mismo nivel se ven iguales entre sí? Un hallazgo aquí es "no se distinguen" o "este bloque está en el nivel equivocado", NUNCA "no se parece al HTML".
- **[OJOS] Comprensión:** que un profesional entienda la tabla de indicadores igual de bien (Atlas separa ANI-BIS-E de Composición; el HTML los junta en Niveles de Wang).

### Resumen de la pasada (para el BACKLOG)

- **Hallazgos reales (a corregir):** A10 (IR en inglés, el único claro y accionable ya). A1/A2 (rótulos de columna), B1 (título DFI), D1/D2 (rótulos de estado/fenotipo): menores, decisión de copy.
- **Candidatos → Gildardo (nomenclatura clínica, NO tocar sin su palabra):** A3 IFC, A5 PABU, A6 ICA-BIS, A7 ISCM, A8 IEHH (nombres largos que difieren en significado), B5 (severidad Leve/Alto vs Vigilancia/Crítico), A4/A11 (escala IRC ×10). El HTML se contradice a sí mismo en varios; por eso van a él, no los adivino.
- **Coinciden (verificado):** los 5 dominios DFI, los niveles de riesgo, 5 de las 6 tarjetas EFR, los ejes y la numeración de la Diana, el aviso de exploración, los decimales de AF, FMI/FFMI/IAE.
- **Deliberadas (ignorar):** EB (no "edad biológica"), Nutracéuticos (no Vitacellebis), sin emoji, página única vs pestañas.

---

## EVALUACIÓN (entrada de datos) — tabla de registro (pre-llena, 2026-08-08)

**Cómo leer esto.** Esta es la pantalla DONDE ENTRAN LOS DATOS, así que una divergencia puede no ser cosmética: si el HTML CAPTURA un campo y Atlas no, es un dato que falta, no una diferencia de forma. Separo abajo **CAPTURA** (lo grave) de **PRESENTACIÓN**. En el HTML v8 la entrada está repartida en tres superficies (Datos personales/encuesta, módulo Antropometría & BIS, y verificación de condiciones BIA); en Atlas está en la pestaña Evaluación (consentimiento + encuesta en solo lectura + condiciones BIS + import). Fuente HTML: `ModAntropometria` ~L6095/L7400, `BIAQualityCheck` ~L11859, import ~L7237.

### A. CAPTURA crítica: ¿el v8 captura algo que Atlas no? (verificado contra código)

| # | Elemento | HTML v8 captura | Atlas captura | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| EA1 | **Espectroscopía cuando el export es INCOMPLETO** (Biody BIS, sin Cole-Cole) | Sí: entrada manual de los 7 parámetros (R∞, Re, Ri, C, Fo, Rc, Xc) **y** lectura por OCR de una foto del equipo | **NO.** `ENGINE_REQUIRED` exige Re/Ri/Rinf/C en el XLSX; si faltan, `biody-import.ts` lanza `ClinicalInputError` y no calcula. Sin fallback manual ni foto | **RESUELTO (2026-08-11): EA1 hecho, ya no bloquea** | Derivación cableada en el import real; aceptación `ea1-acceptance.test.ts` verde. Solo `MCA_ref`/`hidSG_ref` esperan a Gildardo (Q35), como null/no-evaluable. Ver `BACKLOG.md` sección EA1 |
| EA2 | **Corrección manual de peso/talla/cintura/cadera** (si el archivo falta o llegó mal) | Sí: editables a mano aunque vengan del Excel (`DPEdit`) | **NO.** Vienen solo del import; peso/talla `required`. Sin edición a mano | candidato → decisión | ¿Deliberado (procedencia: la medida es del equipo, no se teclea) o hueco? Preguntar |
| EA3 | **Demografía extendida**: etnia/grupo poblacional, nivel educativo, ocupación, estado civil, estrato | Sí (pantalla de datos personales) | **NO.** `patient_profiles` tiene nombre, documento, nacimiento, sexo, país, ciudad, email, teléfono; no los otros 5 | candidato (intake-scope) | Ninguno los consume el motor ANI-BIS-E. Va al cotejo de Encuesta; decidir si se registran |

### B. Condiciones de la toma BIA (captura, verbatim)

| # | Elemento | HTML v8 | Atlas | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| EB1 | Las 11 preguntas compartidas (placas, prótesis, marcapasos, café/alimentos, baño, ejercicio, diurético+cuál, accesorios, embarazo, menstruación, ciclo) | idénticas (verbatim) | idénticas | **coincide** | ninguna |
| EB2 | **Efecto de marcapasos y embarazo** | informativo (ámbar/verde); **NO bloquea** la medición | marcapasos **bloquea el import** (contraindicación absoluta); embarazo exige reconocimiento consciente + comité de ética | **deliberada** (Atlas es más estricto por seguridad; la fidelidad al HTML es a la forma, no a quitar un candado) | ninguna; NO copiar el no-bloqueo del HTML |
| EB3 | Condiciones de validez: amputación, edema/anasarca, febril/deshidratación | no existen | Atlas las AÑADE (reserva de validez) | **deliberada** (Atlas captura más) | ninguna |
| EB4 | Semana del ciclo (cuando no menstrúa) | select de 4 fases nombradas ("Fase menstrual (días 1-7)"...) | input numérico 1-6 sin nombres de fase | hallazgo (menor, captura) | ¿adoptar las fases nombradas? decidir; bajo |

### C. PRESENTACIÓN (no captura)

| # | Elemento | HTML v8 | Atlas | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| EC1 | Peso meta: feedback | muestra "Meta lograda ✓" / "Falta −X kg" / clasificación IMC (Bajo peso/Normal/Sobrepeso/Obesidad) | captura el número (opcional); el veredicto vive en Composición/Diagnóstico | hallazgo (menor, presentación) | ¿mostrar el delta meta-vs-actual en la entrada? decidir; bajo |
| EC2 | Cortes de referencia junto a fuerza prensil / ASMI / AF ("Bajo <27/<16 Kgf") | sí, en la tabla | no en la entrada (van en Diagnóstico) | deliberada (separación entrada/diagnóstico) | ninguna |
| EC3 | Unidad de fuerza prensil | "Kgf" | "kg" | hallazgo (trivial) | alinear rótulo; muy bajo |
| EC4 | Estructura | 3 superficies (personales, antropometría, BIA quality) con su orden | pestaña única: consentimiento → encuesta (solo lectura) → condiciones → import | deliberada (arquitectura) | ninguna; cotejar elemento a elemento |

### D. Decisiones deliberadas ya tomadas (que NO reaparezcan como hallazgo)

| Decisión | Por qué | Ref |
|---|---|---|
| **Cintura se lee de "Waist Size cm" (medida), NO del umbral que mapea Gildardo** (col REFERENCEESTIMEEEXPORT = 102 fijo) | Su mapeo apunta al umbral OMS, no a la medida; se corrigió el falso positivo CV | `biody-columns.ts` (comentario), consulta a Gildardo pendiente (¿su mapeo es deliberado?) |
| **Marcapasos bloquea, embarazo exige reconocimiento** (el HTML no bloquea) | Candado de seguridad clínica; fidelidad a la forma, no a quitar un control | EB2 |
| **Import solo XLSX, medidas no editables a mano** | Procedencia: la medida es del equipo (a confirmar si es decisión o hueco, ver EA2) | EA2 |
| **Peso meta y fuerza prensil opcionales** | Decididas en el sub-bloque B de Evaluación | memoria del bloque |

### Pregunta operativa antes de Hito 1 (sale de EA1)

**¿Qué export produce el equipo real de CNV (Biody BIS ZM)?** El código de Atlas se validó contra un export COMPLETO (BiodyConnect android v1.2.2, 94/94 columnas, con espectroscopía). Pero el HTML anticipa un export INCOMPLETO (Biody BIS 91 col, sin Cole-Cole) y por eso trae la entrada manual + OCR. Si el equipo real produce el incompleto, **Atlas hoy no puede procesar esas mediciones** (falla en voz alta, sin fallback) y habría que construir la captura manual de los 7 parámetros. Es la divergencia más seria de esta pantalla y conviene resolverla antes de cerrar el Hito 1.

### Para Santiago (requiere OJOS)

- **[OJOS]** Que la tabla de condiciones BIA se lea igual (colores Sí/No, prominencia del bloqueo de marcapasos vs el ámbar del HTML).
- **[OJOS] Layout de la entrada (REESCRITA 2026-08-27).** La comparación "pestaña única vs 3 superficies del HTML" ya no aplica: la diferencia es deliberada. Lo que se mira es si el orden de la entrada acompaña lo que el profesional hace primero, y si al bajar sigue sabiendo dónde está (la barra lateral ahora es fija).
- **[OJOS]** El feedback de peso meta (EC1) y si su ausencia en la entrada se echa de menos.

### Resumen de la pasada (para el BACKLOG)

- **Hallazgo serio (pre-Hito 1):** EA1, el fallback de espectroscopía para exports incompletos. Depende de qué export da el equipo real; preguntar YA.
- **Candidatos → decisión:** EA2 (edición manual de medidas), EA3 (demografía extendida, intake-scope), EB4 (fases del ciclo), EC1 (feedback peso meta), EC3 (unidad Kgf).
- **Coinciden:** las 11 condiciones BIA verbatim, meta de peso y fuerza prensil capturadas, import XLSX, consentimiento como puerta.
- **Deliberadas (ignorar):** marcapasos/embarazo bloquean (más estricto), 3 condiciones de validez añadidas, cintura de la medida no del umbral, entrada/diagnóstico separados, pestaña única.

---

## ENCUESTA (instrumento del paciente) — tabla de registro (pre-llena, 2026-08-08)

**Cómo leer esto.** La encuesta es contenido CONGELADO de Gildardo: una diferencia de TEXTO de pregunta/opción es hallazgo para él (o para el bloque "re-auditar cobertura de la encuesta" ya en `BACKLOG.md`), no un ajuste nuestro. Lo que SÍ es nuestro: las etiquetas de dominio (de-jergadas a propósito), el consentimiento (artefacto legal propio) y qué demografía se captura. Crucé el HTML v8 (`ModEncuesta`, preguntas L1299-2226, consentimiento L3130-3410) contra las 63 preguntas del seed (`supabase/seed.ts`) y el esquema `patient_profiles`.

**Conteo:** HTML v8 = **64 ítems** obligatorios/opcionales; Atlas = **63**. La diferencia es una pregunta que falta (ver EC-A1).

### A. Contenido (frozen → Gildardo / bloque de re-auditoría, NO auto-editar)

> **PASE DE INSTRUMENTO HECHO (2026-08-12): ECA1, ECA2, ECA3 y los rótulos PORTADOS como encuesta v3** (bump de UUID, v2 preservada). Verbatim de `ATLAS_v8.html`. Candado de acoplamiento VERDE (no toca los 13 field_key). Commits `54e61ae` (columna hint) + `40ab9ec` (v3). ECA4a SEPARADO (ver abajo). Al pushear: `pnpm db:migrate` + `pnpm db:seed` + `pnpm db:types` contra la nube; el reseed vuelve NO corregibles las evaluaciones de v2 (gate de version, correcto).

| # | Elemento | HTML v8 | Atlas | Acción |
|---|---|---|---|---|
| ECA1 | **Pregunta de CIRUGÍAS digestivas/metabólicas** (`d6_qx`, ítem 63) | existe (D6) | **HECHO (v3)** | Portada. Solo registro (P-16: sin field_key, no altera el cálculo). |
| ECA2 | **D1: ejemplos y ancla de porción** por grupo | los 15 grupos los traen | **HECHO (v3)** | Portados a la columna `hint` (sin emoji). Ayudan al paciente a estimar cantidades. |
| ECA3 | **Nombres de grupos D1** | v8 | **HECHO (v3)** | Alineados verbatim a v8. NO tocan el motor (calcPatron lee el ORDINAL). |
| ECA4a | **Texto libre en "Otra"** (hoy solo existe en d5_39 ROJO y d5_40) | existe (+ input libre) | **SEPARADO del pase** | Alimentar texto libre en d5_39 (lista roja) cambia las entradas por-substring del motor (escribir "diabetes" dispararía el protocolo DM): es decisión de comportamiento, no porte. Pendiente aparte. |
| ECA4b | **A qué preguntas agregar la opción "Otro"** | — | **para Gildardo** | Borrador listo (`docs/entregas/ECA4b_OPCION_OTRO_PARA_GILDARDO.md`); se manda cuando responda la ronda. |
| ECA5 | Opciones ENGINE-acopladas (d5_39, d5_38, d2_21) | listas completas | **coinciden verbatim** | ninguna (candado intacto) |

### B. Demografía / datos personales (captura — aquí cae EA3)

| # | Elemento | HTML v8 captura | Atlas captura | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| ECB1 | Identidad: nombre, tipo/N° doc, sexo, fecha nac, teléfono, email | sí | sí (`patient_profiles`) | **coincide** | ninguna |
| ECB2 | País y ciudad | sí | sí | **coincide** | ninguna |
| ECB3 | **Etnia / grupo poblacional** | sí (7 opciones) | **NO (diferida)** | **DELIBERADA / diferida** | dato sensible (Ley 1581 art. 5); espera el bump de consent v1.0 (`sociodemographic-options.ts:3-4`) |
| ECB4 | **Nivel educativo** | sí (8 opciones) | **HECHO** ("Sobre ti", fase 2) | resuelta | ninguna |
| ECB5 | **Ocupación** | sí (15 + Otra) | **HECHO** (con "Otra" texto libre) | resuelta | ninguna |
| ECB6 | **Estado civil** | sí (5 opciones) | **HECHO** | resuelta | ninguna |
| ECB7 | **Estrato socioeconómico** | sí (1-6 / No aplica) | **HECHO** | resuelta | ninguna |
| ECB8 | **Motivo de consulta** | sí (8 opciones, múltiple) | **HECHO** (`evaluations.reason_for_visit`) | resuelta | ninguna |

**EA3 CERRADO (2026-08-12):** los 5 no sensibles + motivo se capturan en "Sobre ti" (inicio de la fase 2), portados verbatim del v8 (`sociodemographic-options.ts`); 4 al perfil, motivo a la evaluación. Solo **etnia (ECB3)** queda sin capturar, a propósito: dato sensible que espera el bump de consentimiento v1.0.

### C. Deliberadas (nuestras; que no reaparezcan)

| Decisión | HTML v8 | Atlas | Por qué |
|---|---|---|---|
| **Etiquetas de dominio de-jergadas** | "D1 Patrón Usual de Consumo", "D5 Epigenético / LE8", "D6 Alergias y Salud Digestiva" | "Alimentación", "Antecedentes y estilo de vida", "Alergias y digestión" | lenguaje al paciente, sin jerga (comentario del seed: "nada de LE8") |
| **Consentimiento** | "Encuesta CNV v3.0", 5 casillas (datos/salud/terceros/derechos/bioética) + firma por nombre | artefacto legal propio vendorizado (v1.7), 3 autorizaciones del gate (servicio/datos_sensibles/internacional_ia, regla 15) + casilla de firma electronica + soporte de menores | Atlas tiene su consentimiento legal propio, no el del prototipo (C1, hash anclado) |
| **Encuesta del paciente separada del lado profesional** | tab "Motor ⚡" salta al lado profesional desde la encuesta | superficies separadas (público `/encuesta/[token]` vs interno) | seguridad/separación de superficies |
| **Señales de riesgo ocultas al paciente (parámetro `audience`)** | 3 categorías de D1 con cabecera de color (protectora/energética/PCBU), pills de riesgo en rojo, marca ⚠ TCA en D2, descripción "Factor de Estrés" en Q39 | ninguna de esas señales al paciente | el sesgo es del que RESPONDE, no del que interpreta (`PLAN_ENCUESTA.md`): desaparecen para el paciente, SE CONSERVAN para el profesional. El prop `audience` **aún no se construye** (llega con el port de las categorías); hasta entonces están ausentes en ambas superficies |
| **Sin emoji en toda la UI** | emojis en tabs, anclas 📏, cabeceras de categoría, alertas | sin emoji | regla de UI (CLAUDE.md) |
| **Sociodemográficos al inicio de la fase 2** | D0 "Datos de la consulta" (contexto profesional) | "Sobre ti" (5 campos + motivo) tras firmar | post-autorización; no en la identidad |
| **ECA4a texto libre en "Otra" diferido** | input libre al elegir "Otra"/"Otros" | opción existe, sin campo de texto | cambia entradas por-substring del motor en d5_39 (lista roja); pregunta a Gildardo (ECA4b) |

### D. Widgets (coinciden en tipo; confirmar con OJOS)

| # | Elemento | HTML v8 | Atlas | Nota |
|---|---|---|---|---|
| ECD1 | Pills única/múltiple | dominante | `opcion` / `opcion_multiple` (rótulo "Puedes elegir varias") | coincide |
| ECD2 | Contador +/- (bebidas D7) | Counter, rango 0-30 | `contador` 0-30 | **coincide** (tope 30 confirmado en el cotejo) |
| ECD3 | Slider (estrés d3_29) | range 1-10 | `escala` | coincide (único slider) |
| ECD4 | Alerta roja D2 TCA / resaltado de riesgo D1 | pinta en rojo + aviso | ausente | **DELIBERADA (audiencia)**, no [OJOS]: oculta al paciente, se conserva para el profesional (sección C). Se rendea del lado profesional cuando se construya `audience` |

### D-vis. Presentación visual (EXIGE OJOS de Santiago; material de la Fase 3)

| # | Elemento | HTML v8 | Atlas v3 | Nota |
|---|---|---|---|---|
| ECV1 | **Ancla de porción D1** | pill ámbar aparte con 📏 ("Un puño cerrado") | texto gris pegado al hint tras " · ", sin emoji | **[OJOS]** que se lea y no se pierda entre los ejemplos |
| ECV2 | **Bebidas D7** | grid 2 columnas, unidad por bebida ("tazas", "vasos 200ml", "latas"), icono | lista vertical, contador sin etiqueta de unidad | **[OJOS]** layout + falta la unidad |
| ECV3 | **Sub-bloque horarios D1** | caja gris "Hábitos de horario y condimentación" agrupa d1f_sal/des/noche | 3 preguntas planas al final de Alimentación | **[OJOS]** agrupación visual |
| ECV4 | **Barra de progreso / stepper** | barra fina gradiente verde (% = respuestas/64) + tabs coloreadas por dominio + "N/9" | `Progress` token primary (% = paso/total secciones) + subpestañas de texto + "Paso X de N" | **[OJOS]** que se sienta equivalente (semántica del % distinta) |

### E. Hallazgo nuevo (ni hecho ni decidido)

| # | Elemento | v8 | Atlas v3 | Decisión pendiente |
|---|---|---|---|---|
| ECE1 | **Orden de los 15 alimentos de D1** | por categoría: 1-7, 8-9-10-**15**, 11-12-13-14 (carnes rojas entre blancas y refinados) | secuencial 1..14,**15** (carnes rojas AL FINAL, tras ultraprocesados) | cuando llegue el prop `audience`: ¿el orden del paciente sigue el flujo protector→neutro→riesgo (sin las etiquetas de color) o queda numérico plano? Hoy es plano. Menor, ligado al port de las categorías |

### Resumen (para el BACKLOG / bloque de re-auditoría de la encuesta)

- **Content, va a Gildardo/re-auditoría (ya hay bloque):** ECA1 (falta la pregunta de cirugías `d6_qx`, la más concreta), ECA2 (D1 sin ejemplos/porción), ECA3 (nombres de grupos D1), ECA4 (opciones "Otros" + texto libre).
- **Candidatos → decisión nuestra:** ECB3-8 (etnia, educación, ocupación, estado civil, estrato, motivo). Ninguno lo usa el motor.
- **Coinciden (verificado):** las opciones engine-acopladas (d5_39/d5_38/d2_21), identidad, país/ciudad, tipos de widget.
- **Deliberadas (ignorar):** etiquetas de-jergadas, consentimiento propio, encuesta separada del lado profesional.

---

> **El cotejo de las DOS subpestañas (Nutricionista y Rutas) vive en `COTEJO_TRATAMIENTO_2026-08-24.md`**, hecho cuando el plan alimentario quedó completo. Trae el inventario de los dos lados con la columna "¿se ve en pantalla?" (la regla nueva: verificar que la pieza se RENDERICE, no solo que exista), la clasificación en cuatro grupos, y el aviso de qué cifras van a diferir por P-32 y por qué. Esta sección de abajo es la pasada anterior (2026-08-08) y se conserva por sus decisiones deliberadas, que siguen vigentes.

## TRATAMIENTO — tabla de registro (pre-llena, 2026-08-08)

**AVISO de la regla de oro.** A diferencia de las otras tres pantallas, Tratamiento **tiene construcción pendiente**: la cadena calórica (re-port del 3er modelo, Q14) y el plan alimentario detallado (grupos de intercambio, menú, secciones E/F del HTML) están en pausa/en curso (ver `handoff-2026-08-05-plan-alimentario`). **Esas piezas NO se cotejan todavía** (cotejar lo que vamos a cambiar es cotejar dos veces). Se cotejan las partes CERRADAS: estructura, rutas, remisiones, paneles médico/psico/ejercicio, despacho de nutracéuticos, y los gates. Fuente HTML: `ModTratamiento` L16002-17754, motores L15402-15575. Santiago tiene capturas del v8 de esta pantalla.

### A. Estructura y permisos (deliberadas ya decididas)

| # | Elemento | HTML v8 | Atlas | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| ET1 | Sub-pestañas por profesión | 5 tabs (Rutas del DFI, Nutricionista, Médico, Psicólogo, Entrenador) | sin barra; cada profesional ve SOLO su sección vía switch | **deliberada** (barra pospuesta; un solo destino por profesional se vería roto) | ninguna |
| ET2 | Admin ve las 4 secciones en solo-lectura ("👁", "Modo Administrador") | sí | **NO** | **deliberada** (fidelidad a la forma, no a los permisos; copiarlo ampliaría el acceso del admin) | ninguna |
| ET3 | Gate para prescribir | solo exige `hasEnc` + `IFC>0`; **NO exige diagnóstico confirmado** | Atlas EXIGE diagnóstico confirmado (D1, `treatment-writer.ts:391`) | **deliberada** (Atlas más estricto; prescribir sigue a confirmar) | ninguna; NO copiar el no-gate del HTML |
| ET4 | Título de pantalla | "Rutas de Atención" | "Tratamiento" | menor | ¿alinear rótulo? bajo |

### B. Rutas y remisiones (cerradas)

| # | Elemento | HTML v8 | Atlas | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| ET5 | Sección 1: rutas activadas del DFI (tarjetas, activación, componentes nutri/ejercicio/psico/seguimiento) | sí, verbatim del motor de rutas | portadas (T1, snapshot congelado) | **coincide** (mismo motor) | **[OJOS]** que se vean igual |
| ET6 | Sección 3: remisiones (destino, urgencia obligatoria/recomendada, indicaciones) | contenido puro (sin registro en el prototipo) | **Atlas va MÁS ALLÁ**: remisión registrable (D-009), con retorno | **deliberada** (Atlas añade el acto que el prototipo no tenía) | ninguna |

### C. Paneles médico / psico / ejercicio (portados T2)

| # | Elemento | HTML v8 | Atlas | Nota |
|---|---|---|---|---|
| ET7 | Médico: metas, monitoreo, remisión, interacciones fármaco-nutriente, exámenes, alertas por sector | motor `motorTratMedico` | portado (T2) | verificar textos con **[OJOS]** |
| ET8 | Ejercicio: FITT-VP, faRec que alimenta el FA nutricional, metas de composición | `motorTratEjercicio` | portado (T2) | `faRec` acopla al nutricional (invariante a respetar) |
| ET9 | Psico: SCOFF/PHQ-9/GAD-7, salvaguarda TCA que PAUSA el déficit, técnicas | `motorTratPsico` | portado (T2) | la salvaguarda TCA es requisito duro de la cadena calórica |
| ET10 | Estos motores son FROZEN (ciencia de Gildardo) | verbatim | port verbatim | el cotejo de VALORES es golden, no visual; los textos/labels sí a ojo |

### D. Despacho de nutracéuticos y envío (cerrado, con divergencias deliberadas)

| # | Elemento | HTML v8 | Atlas | ¿Hallazgo o deliberada? | Acción |
|---|---|---|---|---|---|
| ET11 | VITACELLEBIS recomendado + dosis + prioridad + registrar despacho | sí (a inventario local) | portado (T3), a BD real con audit | **coincide** en fondo | **[OJOS]** dosis/prioridad |
| ET12 | Grafía de nombres de nutracéuticos | "MULTI-CELL BASE", "MULTICELL BASE" (inconsistente en el HTML) | Atlas usa la grafía del registro INVIMA (Q31) | **deliberada** (manda el registro sanitario) | ninguna |
| ET13 | Envío al paciente | `mailto:` (abre cliente de correo) + `window.print()`; persistencia en `localStorage` | Atlas: reporte por Resend con adjunto + BD inmutable + audit | **deliberada** (Atlas es superior; el prototipo no tiene backend) | ninguna |
| ET14 | "Aprobar protocolo" | función existe pero sin botón cableado en el prototipo | Atlas: aprobar sella el protocolo (write-once) | **deliberada** (Atlas lo cierra) | ninguna |

### E. PENDIENTE de construir (NO se coteja aún)

- **Cadena calórica completa** (GEB Mifflin/Cunningham → FA → GET → objetivo con déficit y pisos; proteína g/kg por protocolo; macros): en pausa (re-port 3er modelo, Q14). Cuando se porte, se cotejan las fórmulas contra el HTML (L15402-15494) como golden, no a ojo.
- **Plan por grupos de alimentos** (secciones D/E/F del HTML). Estado al 2026-08-23, pieza por pieza:
  - **HECHO:** fórmula sintética (cadena calórica), lista de intercambio **por alimento** con sus columnas de macros, alimentos concretos con gramaje en las dos superficies (plegada para el profesional, recortada a 8 para el paciente), distribución por tiempos con cuadre, validación de nutrientes con ICN.
  - **FALTA:** el **menú semanal editable** (grilla 7 × tiempos con `CICLO_MENU_21` de precarga; hoy Atlas genera texto libre con IA). Arrastra migración (el v8 persiste en `localStorage`) y una decisión nuestra: el v8 arranca el ciclo en un día **aleatorio**, y en Atlas el plan se GUARDA, así que un menú que cambia al recargar no es un plan.
  - **FALTA:** las **recomendaciones por diagnóstico**, bloqueadas por la ronda (P-32 el motor, P-33 el bloque huérfano, P-34 los dos umbrales de sarcopenia).
  - **DIFERIDO:** los badges de comorbilidad (EN3).
- Cuando esas piezas cierren, se añade su fila aquí. Hasta entonces, cotejarlas sería cotejar dos veces.

### F. Señales que el motor produce y no llegan al profesional (barrido 2026-08-22/23)

**Qué es esto.** No es un cotejo de forma: es un barrido de "el dato existe y no llega" (la familia del párrafo de dieta). Se revisó, señal por señal, qué sella el motor en `protocol_suggested` y quién la ve. Resultado: **dos** señales huérfanas, más la confirmación de que `examenes` y `suplementacion` sí están donde corresponde (panel del médico, verificado en código, no asumido).

| # | Señal del motor | Quién la ve hoy | Veredicto | Estado |
|---|---|---|---|---|
| EN1 | `alertaSindRealim` (síndrome de realimentación: F7/F10 + GEB<1200 + IMC<18.5) | solo el médico | **hueco clínico** (el nutricionista fija las kcal y no veía el riesgo) | **CERRADO 2026-08-22**: se surfacea en dos sitios (resumen informa, encima de la cadena instruye 10 kcal/kg/día ASPEN), crítico y no descartable. Caso de smoke sembrable: `demo-realimentacion.seed.test.ts` |
| EN2 | `restricciones` del MODELO (proteína/fósforo/potasio por IRC, sodio por HTA, CHO simples por DM, AGS/ultraprocesados por fenotipo) | **nadie** en el armado del plan | **hueco clínico** (el v8 las muestra como aviso al inicio de la Fórmula sintética, y además son lo ÚNICO que alimenta su adaptación de menú) | **CERRADO 2026-08-23**: (1) aviso de solo lectura encima de la cadena, porte fiel del v8; (2) llegan al generador de menú en bloque propio y rotulado (`menu.v2`); el campo del profesional se mantiene, rotulado como aditivo. El ack `restrictions_ack_*` NO se cablea, con el argumento escrito en `BACKLOG.md` |
| EN3 | `flags` de comorbilidad (IRC / cáncer / DM / HTA) | ningún consumidor en Tratamiento | **presentación, no hueco** | **DIFERIDO** (decisión de Santiago 2026-08-23): las comorbilidades ya se ven en Diagnóstico; se decide junto con el resto del cotejo de la subpestaña del Nutricionista |
| EN4 | `examenes` y `suplementacion` | panel del médico | **correcto** | ninguna acción (verificado en `profession-treatment-section.tsx`, no asumido) |

**No hay más señales huérfanas:** el barrido recorrió los campos de `ProtocoloSnapshot` uno por uno.

### Para Santiago (requiere OJOS)

- **[OJOS]** Los avisos del plan (EN1 y EN2) renderizando. Sembrar con `SEED_REALIMENTACION=1 pnpm vitest run --project db src/tests/demo-realimentacion.seed.test.ts`, entrar **con la cuenta nutricionista** (`profesional.demo@cnvsystem.com`; el seed asigna los dos pacientes a ella, y el reader es RLS: con otra cuenta la página da 404) y abrir:
  - `/evaluaciones/a0000000-0000-4000-8000-0000000000f2` — solo el aviso de realimentación (sin comorbilidad, sin restricciones).
  - `/evaluaciones/a0000000-0000-4000-8000-0000000000f4` — realimentación **más** las cuatro restricciones del modelo (IRC + HTA: proteína, fósforo, potasio, sodio, con su referencia).
- **[OJOS] Rutas (Sección 1) y remisiones (REESCRITA 2026-08-27).** "Que se vean como el v8" dejó de ser el criterio: sus bloques se migraron al sistema de tres niveles, así que ahora se ven como el RESTO DE ATLAS y no como el v8. Lo que se coteja contra el v8 es el CONTENIDO (que estén las mismas rutas, los mismos textos, el mismo orden); la forma se coteja contra las demás pantallas de Atlas.
- **[OJOS]** Los tres paneles de profesión (médico/psico/ejercicio): textos de metas, alertas por sector, interacciones, FITT-VP, SCOFF.
- **[OJOS]** El despacho de nutracéuticos: dosis y prioridad.
- Con las capturas que ya tienes del v8.

### Resumen de la pasada

- **Deliberadas (ignorar):** sin barra de subpestañas, admin sin las 4 secciones, gate de diagnóstico confirmado (Atlas más estricto), grafía INVIMA de nutracéuticos, envío por Resend/BD vs mailto/localStorage, aprobar sella.
- **Coincide / Atlas va más allá:** rutas (mismo motor), remisiones (Atlas añade el acto D-009), paneles de profesión (port T2), despacho (T3 a BD real).
- **PENDIENTE de construir (no cotejado):** cadena calórica (Q14) y plan alimentario detallado (Alcance B).
- **Menor:** ET4 (título "Tratamiento" vs "Rutas de Atención").
