# COTEJOS_VISUALES.md — cotejo de fidelidad de Atlas contra el HTML v8 (E3)

**Qué es esto.** El plan para comparar, pantalla por pantalla, lo que Atlas MUESTRA contra el prototipo de Gildardo (`docs/entregas/gildardo-2026-08-04/ATLAS_v8.html`). Es la fase E3 (pulido de fidelidad), y es un trabajo **distinto** de los anteriores: no se revisan diffs de código, se **comparan pantallas**. Santiago mira mucho; por eso llega ordenado.

**Regla de oro (para no cotejar dos veces):** solo se cotejan pantallas donde ya NO queda nada por construir. Cotejar algo que vamos a cambiar es cotejar dos veces.

---

## d) El criterio: qué ES un hallazgo y qué NO

**Un HALLAZGO (a corregir)** es una divergencia de **forma** (layout, orden, color, rótulo, redacción, un dato que falta o sobra en pantalla) que NO responde a una decisión ya tomada. La fidelidad aplica a la **forma, no a los permisos ni a la ciencia**: si el HTML muestra algo que ampliaría la visibilidad del admin o cambiaría un cálculo, eso NO se copia (ver decisiones abajo).

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
| A3 | Nombre IFC | Índice de Funcionalidad Celular | Índice de función celular (tabla) / Función Celular (paciente) / Fuerza Celular (otro) | candidato → Gildardo | el HTML se contradice a sí mismo; pedir nombre canónico |
| A4 | Nombre IRC | Índice de Riesgo Celular | Índice de riesgo celular (×10) | candidato → decisión | ver A11 (escala ×10) |
| A5 | Nombre PABU | Proporción Áurea Bioeléctrica Universal | Distancia a la proporción áurea φ | candidato → Gildardo | difiere el SIGNIFICADO (proporción vs distancia a ella) |
| A6 | Nombre ICA-BIS | Índice de Coherencia Áurea (BIS) | ICA-BIS (PABU − φ) | candidato → Gildardo | nombre vs fórmula; pedir canónico |
| A7 | Nombre ISCM | Índice de Susceptibilidad Cardiometabólica (BIS) | Score de susceptibilidad multicomponente | candidato → Gildardo | "cardiometabólica" vs "multicomponente": difiere el significado |
| A8 | Nombre IEHH | Índice del Espectro de Hidratación Humana | Índice de equilibrio hídrico | candidato → Gildardo | difiere el significado |
| A9 | Nombre EB | Edad Bioeléctrica (EB-BIS) | Edad biológica (a) | **deliberada** (D-010/D-011) | ninguna; NO es "edad biológica" |
| A10 | Nombre IR | **Impedance Ratio** (inglés) | Radio de impedancia | **hallazgo (real)** | traducir a español; viola regla de idioma de CLAUDE.md |
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
- **[OJOS] Layout general:** que el orden de las cards y su jerarquía visual se sienta equivalente (Atlas es página única; el HTML es pestañas).
- **[OJOS] Comprensión:** que un profesional entienda la tabla de indicadores igual de bien (Atlas separa ANI-BIS-E de Composición; el HTML los junta en Niveles de Wang).

### Resumen de la pasada (para el BACKLOG)

- **Hallazgos reales (a corregir):** A10 (IR en inglés, el único claro y accionable ya). A1/A2 (rótulos de columna), B1 (título DFI), D1/D2 (rótulos de estado/fenotipo): menores, decisión de copy.
- **Candidatos → Gildardo (nomenclatura clínica, NO tocar sin su palabra):** A3 IFC, A5 PABU, A6 ICA-BIS, A7 ISCM, A8 IEHH (nombres largos que difieren en significado), B5 (severidad Leve/Alto vs Vigilancia/Crítico), A4/A11 (escala IRC ×10). El HTML se contradice a sí mismo en varios; por eso van a él, no los adivino.
- **Coinciden (verificado):** los 5 dominios DFI, los niveles de riesgo, 5 de las 6 tarjetas EFR, los ejes y la numeración de la Diana, el aviso de exploración, los decimales de AF, FMI/FFMI/IAE.
- **Deliberadas (ignorar):** EB (no "edad biológica"), Nutracéuticos (no Vitacellebis), sin emoji, página única vs pestañas.
