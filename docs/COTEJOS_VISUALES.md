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
3. **Diagnóstico** (`/evaluaciones/[id]`, pestaña Diagnóstico). Comparar: la **Diana EFR** (color por celda + **orden posicional** por riesgo, hoy pendiente de portar; ver nota abajo), la **tabla de indicadores** (rótulos, orden, Δ, referencia, dirección del riesgo), el DFI/composición, el fenotipo, el aviso de incompletitud (para el profesional).
4. **Tratamiento** (`/evaluaciones/[id]`, pestaña Tratamiento). Comparar: rutas de atención, remisiones (ahora registrables), el workspace del nutricionista (kcal/proteína precargados, restricciones, nutracéuticos, despacho, menú), las secciones de consulta médica/psico/ejercicio. **Ojo:** la barra de subpestañas es una decisión deliberada (arriba), no un hallazgo. **Material extra: Santiago tiene capturas del v8 de tratamiento.**

**Nota Diana (ya en el plan, no es hallazgo nuevo):** el port visual de la Diana (color `rc`+`rk` y orden posicional del HTML) está PREPARADO pero no ejecutado, con una decisión pendiente de renumerar `stateNumber` (nuestro 42 = su 33). Ver `diana-visual-port-prep`. Si en el cotejo la Diana se ve distinta, es esto: se ejecuta el port, no se anota como sorpresa.

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
| 1 | (ej. orden de la Diana) | anillos por banda cruda | verde al centro degradando | hallazgo | ejecutar port Diana |
| 2 | (ej. AF) | 6.8 | 6.85 | deliberada (D-016) | ninguna |

- **"¿Hallazgo o deliberada?"** se decide con la lista de (d). Si es deliberada → "ninguna". Si es hallazgo → una acción concreta.
- Al cerrar cada pantalla, los hallazgos reales (no las deliberadas) se pasan a `BACKLOG.md` con su acción, priorizados. Así el cotejo produce una lista **corta y cierta**, no una larga sin prioridad.
- **Dónde vive esta tabla llena:** una sección por pantalla en este mismo doc, o un archivo por pantalla; se decide al arrancar según prefiera Santiago.

---

## Estado

- **Precondición:** que no quede nada por construir en las cuatro pantallas. Tratamiento cierra su construible con D-009 (Parte A hecha; Parte B espera a Gildardo, no bloquea el cotejo de forma). La **barra de subpestañas NO se construye** (decisión de visibilidad, arriba): no es una pieza pendiente que retenga el cotejo.
- **Arranque sugerido:** Diagnóstico (tiene la pieza visual más característica, la Diana, y ya sabemos que su port está pendiente) o Tratamiento (hay capturas). Se decide con Santiago.
