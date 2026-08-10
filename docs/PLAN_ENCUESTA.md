# Plan — Bloque de mejoras a la Encuesta (2026-08-09)

Cruce del listado de Santiago (`entregas/gildardo-2026-08-09/Mejoras encuesta.md`) con los hallazgos del cotejo (COTEJOS_VISUALES §Encuesta, ECA1-4) y la respuesta de Gildardo (§7 cirugías, §10 nombres). **No construir aún; este es el mapa y la dimensión.** Regla de oro (Santiago): mirar nuestras correcciones JUNTO con los cambios de Gildardo, o se toca la encuesta dos veces (contenido versionado + candado de acoplamiento).

## Dos verificaciones que pidió Santiago (RESUELTAS)

- **(b) ¿El motor MÉDICO lee cirugías?** NO. `motorTratMedico` menciona "cirugía bariátrica" pero como RECOMENDACIÓN de remisión gatillada por `obesidad` (IMC), no lee si el paciente TUVO cirugía. Ningún motor (nutricional ni médico) consume `d6_qx`. **§7 se sostiene para todos: ECA1 se porta SIN field_key.**
- **(c) ¿Agregar una pregunta crea incompletitud retroactiva?** NO. `expectedFieldKeys` (pipeline-reader) se arma con `used_in_diagnosis=true` (cirugías no tiene field_key → nunca entra) Y está scopeado por el `survey_version_id` de cada evaluación. Cada evaluación mide `dfi.complete` contra SU versión; con una versión nueva, las viejas quedan atadas a la vieja (completas). El temor de "incompleta para siempre" no se materializa. La cuenta de display "X de Y" también es por versión.

## Buckets (con tamaño, versión y riesgo de motor)

### B1 — Chrome de display (corrección nuestra, SIN versión, SIN motor) — CHICO
- 1a **REPARO: "Atlas Patients" tiene una palabra en inglés en una interfaz que lee un paciente colombiano** (rompe la regla de español que aplicamos en todo lo demás). → **"Atlas Pacientes"** o solo el logo sin palabra. NO "Patients".
- 1g salto directo por click en el stepper (el wizard por dominio YA existe; falta navegación directa).
- 1h **REPARO: los números NO se escriben en el texto de la pregunta, se DERIVAN del orden** (order_index). Si el número es fijo y Gildardo agrega una en medio, todos los siguientes se corren (ya se ve en su archivo: la 44 salta a la 63). Derivándolo del orden, agregar una renumera sola. **Verificar antes: que nada referencie preguntas por número** (si algún acoplamiento lo hace, hay que conocerlo). Esto además arregla el salto 44→63.
- 1i click sobre respuesta marcada la desmarca.
- 1j conteo de ítems por sección.
- D7 dejar "-" (Santiago lo prefiere; NO cambiar) + guía de color de orina (estético, opcional).
- Nombres de sección (D1/D5/D6): Santiago se inclina a MANTENER los de Atlas por claridad → decisión, mayormente "no cambiar".
**Buildable YA, sin Gildardo. Sin nueva survey_version (es UI).**

### B2 — Contenido a PORTAR de Gildardo (su instrumento verbatim, motor lee ORDINAL → seguro) — MEDIO
- ECA2: D1 ejemplos + anclas de porción + intro ("Patrón Usual de Consumo", "espinaca, acelga...", "📏 Un puño cerrado"). Muy útil para el paciente.
- ECA3: nombres de grupos D1 (verbatim de Gildardo) — DECISIÓN: alinear a Gildardo vs mantener Atlas (Santiago se inclina a mantener). Motor lee ordinal → cualquiera es motor-seguro.
- ECA1: la pregunta de cirugías (`d6_qx`, ítem 63) SIN field_key. Arreglar la numeración (hoy salta 44→63).
**Toca el texto del instrumento → NUEVA survey_version. Coupling candado: D1/cirugías NO se leen por texto (ordinal / no motor), no lo dispara; verificar igual.**

### B3 — Comportamiento de multi-select (corrección nuestra, toca coherencia de respuesta) — MEDIO, DELICADO
- 1f + por sección (Q21, Q25, Q34/35, Q38/39/40/42, Q43/44/63): lógica de "ninguna" (excluye a las demás y viceversa); "Puede seleccionar varios" como BADGE/estándar, no texto inline.
- La lógica de "ninguna" cambia la coherencia de lo guardado. El motor lee varias de estas (d5_39, d2_21...) y ya FILTRA "Ninguna", así que una selección coherente es motor-segura, PERO **hay que barrer cada una contra el candado de acoplamiento (`frozen-survey-texts.ts`) antes de tocarla.**
**Cambia cómo se captura la respuesta → NUEVA survey_version. DELICADO: barrido del candado.**

### B4 — "Otro" con texto libre (corrección nuestra + propuesta de contenido) — CHICO-MEDIO
- 1e: input de texto libre al elegir "otro/s" (Q35, Q39, Q40, Q43, Q63). La opción existe; falta capturar el texto.
- Barrido de preguntas que NO tienen "otro" → PROPONER a Gildardo (agregar opciones es su contenido). = ECA4.
**Nueva survey_version. El texto de "otro" normalmente no lo lee el motor; verificar.**

### B5 — DECISIONES de contenido a PROPONER a Gildardo (cambian su instrumento) — acumular para la próxima ronda
- Quitar la separación por categorías de riesgo en D1 (✅ protectora / ⚖️ energética "moderar" / ⚠️ PCBU): sesga la respuesta (símbolos + "moderar").
- Quitar la advertencia visible "⚠ TCA" + color en Q21: sesga. (El motor sigue detectando por d2_21; solo se quita el display.)
- Mover la descripción de Q39 ("Factor de Estrés Metabólico") a la vista del PROFESIONAL, no del paciente.
- Sweep de "otro" faltante (de B4).
- Alineación de nombres D1/D5/D6 (si se va con los de Gildardo).
**Son SU contenido/marco → su aprobación. Motor-seguro (ordinal/detección intactos). Acumular con Q36 para el mensaje corto.**

### B6 — SEGURIDAD del intake público — REVISADO 2026-08-09: YA ESTÁ BIEN ENDURECIDO
Revisión hecha (Santiago pidió "saber lo malo primero"). Los cuatro puntos, presentes:
- **Validación:** server-side Zod completo (`validations.ts`: email `z.email()`, longitudes máx en todo, enum doc, birthDate regex; answers array máx 500, valor máx 5000, `z.guid()`). Cliente: `type="email"`. El email SÍ se valida en ambas capas.
- **XSS:** cero `dangerouslySetInnerHTML` en `src` (regla 9); respuestas renderizadas como texto React (escapado). Sin XSS almacenado.
- **Cabeceras:** CSP + HSTS + X-Frame DENY en `/:path*` (cubre `/encuesta/*`); `object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`.
- **Rate limit:** IP + token antes de todo. **SQL:** parametrizado (Drizzle/Supabase). **CSRF:** server actions de Next.

**Nada críticamente expuesto.** Items menores/conocidos (NO bloquean, van a BACKLOG):
- CSP `script-src 'unsafe-inline'`: baseline MVP conocido (endurecer a nonces estaba tagueado B15; el comentario quedó stale). Sin `dangerouslySetInnerHTML`, no hay vector de script inyectado; es endurecimiento, no un hueco.
- Sanitización defense-in-depth del texto libre: hoy el render ya es seguro (React escapa) + longitudes acotadas; una normalización explícita del texto libre valdría cuando crezcan los "otro" (B4). Marginal.
- El bound `answers` máx 500 es generoso (la encuesta tiene ~64); apretarlo es cosmético (Next ya limita el body).
**Conclusión: B6 = verificado suficiente. No requiere construcción ahora.**

### B7 — CONSENTIMIENTO (corrección nuestra, DELICADO legal, C1 con hash anclado) — MEDIO-GRANDE
- 1b/1b.2: "ver más" del texto largo; campos llenables (firma electrónica con validez legal CO/internacional); asentimiento de menor 14-17 (parte existe, DELTA2); renderizar el consentimiento con los datos REALES ya puestos (no las rayas vacías antes de llenar); quitar campos innecesarios (cédula, ya va en la pantalla 2).
**Toca el consentimiento vendorizado (C1, hash). Puede requerir versión de consentimiento + revisión legal. CUIDADO, sub-bloque propio.**

### B8 — Desplegables sociodemográficos (corrección nuestra) — CHICO + una decisión
- 1c: sexo desplegable (motor M/F, el valor no cambia), ciudad/país desplegables (sin motor; §12 caracterización).
- **Decisión (Santiago pregunta): dataset de país/ciudad.** Recomendación: lista de países ISO vendorizada + lista de ciudades de Colombia vendorizada (NO una API global de ciudades: evita dependencia externa en superficie pública; aprobar en DEPLOY.md). Evita typos sin acoplar a un tercero.
**Pantalla de identidad, no de preguntas → sin survey_version.**

## Versión de encuesta: una sola, no por ítem

Todo lo que toca el INSTRUMENTO (B2 + B3 + B4 + ECA1) va en UNA nueva `survey_version`, no una por cambio. Las viejas evaluaciones quedan atadas a su versión (completas). B1/B6/B8 no son instrumento → sin versión. Se re-verifica el candado de acoplamiento al cerrar la versión nueva.

## Orden recomendado

1. **A Gildardo (mensaje corto, con Q36):** B5 (quitar agrupaciones/advertencia, mover descripción Q39, sweep de "otro" faltante, alineación de nombres). Sus respuestas condicionan el pase de instrumento; hacerlo dos veces es lo que evitamos.
2. **Buildable ya, sin Gildardo (en paralelo):** B1 (chrome, victorias rápidas) + B6 (seguridad, alta prioridad, independiente).
3. **Tras la respuesta de Gildardo:** el ÚNICO pase de instrumento (B2 + B3 + B4 + ECA1 + lo que responda), en una survey_version nueva, con el candado re-verificado.
4. **B7 consentimiento:** sub-bloque propio, con cuidado legal.
5. **B8 desplegables:** decidir el dataset país/ciudad, luego construir.

## Tamaño total
**GRANDE, decomponible.** El pase de instrumento (B2+B3+B4+ECA1) = una survey_version, medio-grande. Chrome (B1) = chico. Seguridad (B6) = medio. Consentimiento (B7) = medio-grande, legal. Desplegables (B8) = chico + decisión. Lo que va a Gildardo (B5) = corto, pero destraba el pase de instrumento.
