# Cotejo de Tratamiento: las dos subpestañas, Atlas contra el v8

**Fecha:** 2026-08-24 · **Fuente HTML:** `docs/entregas/Gildardo responses/ATLAS_v8.html` (2026-08-19, la entrega que Gildardo confirmó vigente el 17). **Paciente de referencia:** Nico Smoke, con la misma encuesta, el mismo BIS y las mismas condiciones en los dos lados.

**Método.** (a) inventario de los dos lados sin interpretar, (b) clasificación en cuatro grupos, (c) lo que quede sin clasificar es lo que hay que mirar. Este documento es el paso previo: Santiago compara contra las capturas y señala lo que el inventario no ve.

**Regla aplicada desde el inventario (no después):** de cada pieza del HTML se verificó que **se renderice en su vista**, no solo que exista en el código. Ya nos costó una: la lista de intercambio del paciente existe, y está marcada como "solo impresión". La columna **"¿se ve?"** de las tablas recoge eso.

---

# ANTES DE COMPARAR NÚMEROS: LEE ESTO

Santiago va a comparar cifras con el mismo paciente en los dos lados. **Hay un grupo de números que va a salir distinto, y ya sabemos por qué.** Sin este aviso, aparecerían como cinco o seis defectos separados; son **uno solo**, y es la pregunta que ya le hicimos a Gildardo (**P-32**, punto 1 de la ronda del 23).

**La causa:** la "Fórmula sintética" del v8 toma sus números de **`motorTratNutri`**, y la "Cadena calórica" de Atlas los calcula con **`computeProtocoloCalorico`** (que viene de `motorProtocolo`). Son los **dos motores que no coinciden**.

| Número | Cómo lo saca el v8 | Cómo lo saca Atlas | ¿Va a diferir? |
|---|---|---|---|
| **GEB** | Mifflin, siempre, sobre peso actual | Cunningham si hay masa libre de grasa; si no, Mifflin | **Sí**, si Nico tiene FFM (la tiene) |
| **Factor de actividad** | el sugerido por el motor de ejercicio | 1,375 por defecto | **Sí**, salvo que coincidan |
| **GET** | GEB × FA | GEB × PAL | **Sí**, arrastra los dos de arriba |
| **Objetivo calórico** | GET − déficit (500 en obesidad; 27,5 × peso en cáncer o desnutrición) | GET de mantenimiento | **Sí**, si Nico entra en alguna de esas |
| **Proteína g/kg** | `protKg` de `motorTratNutri` | `protMin` de `motorProtocolo` | **Sí**, en cáncer y en obesidad |
| **Grasa %** | 25 si hay dislipidemia, 30 si no | 30 siempre | **Sí**, solo si hay dislipidemia |

**Y hay un efecto en cadena que importa más que la tabla:** las porciones del intercambio se calculan **desde el objetivo calórico**. Si el objetivo difiere, difieren las porciones, y con ellas la distribución por tiempos y los porcentajes de cubrimiento y el ICN de la validación. **Toda la mitad de abajo de la pantalla hereda la diferencia de arriba.**

**Cómo usarlo al comparar:** si el objetivo calórico coincide, compara todo lo de abajo cifra por cifra. **Si el objetivo NO coincide, lo de abajo no se puede comparar todavía**: primero hay que igualar el de arriba (poniendo a mano en Atlas el mismo objetivo que muestre el v8) y comparar entonces. Si con el mismo objetivo las porciones siguen difiriendo, **eso sí es un hallazgo** y hay que reportarlo.

---

# Parte 1 · Subpestaña "Rutas de atención"

## Inventario del v8 (pestaña `tratamiento`)

| # | Pieza | ¿Se ve en pantalla? | ¿Se imprime? |
|---|---|---|---|
| R1 | SECCIÓN 1 — RUTAS DE ATENCIÓN ACTIVADAS | sí | sí |
| R2 | SECCIÓN 2 — VITACELLEBIS RECOMENDADO | sí | sí |
| R3 | SECCIÓN 3 — REMISIONES | sí | sí |
| R4 | Botón "Imprimir / Guardar PDF" | sí | no (`no-print`) |

Las tres secciones se renderizan solo si hay medición BIS (`hasBis`). Con datos, se ven.

## Inventario de Atlas

| # | Pieza |
|---|---|
| A1 | Rutas de atención activadas (`RutasSection`) |
| A2 | Nutracéuticos: lo que **recomienda el modelo** + lo que **agrega el profesional** (`NutraceuticalsSection`) |
| A3 | Registrar despacho (`DespachoSection`) |
| A4 | Remisiones, **registrables con retorno** (`RemisionesSection`) |

## Clasificación

| Grupo | Qué |
|---|---|
| **Igual en los dos** | R1↔A1 (mismo motor de rutas) · R2↔A2 (recomendación de nutracéuticos) · R3↔A4 (remisiones) |
| **Solo en el HTML** | R4, el botón de imprimir. Atlas no tiene superficie de impresión del tratamiento (va con el bloque de envío) |
| **Solo en Atlas** | A3 despacho a inventario real con auditoría · el **registro** de la remisión con su retorno (D-009) · la separación explícita recomienda-vs-agrega en nutracéuticos |
| **Deliberadas** | ET1 sin barra de subpestañas por profesión · ET2 el admin no ve las cuatro secciones · ET3 Atlas exige diagnóstico confirmado · ET11-ET14 (grafía INVIMA, envío por Resend, aprobar sella) |

**Sin clasificar: nada.** Esta subpestaña estaba cotejada en su mayor parte (`COTEJOS_VISUALES.md`, filas ET5-ET14); lo que faltaba era mirarla con el detalle de ahora, y no aparecieron piezas nuevas.

**Para los ojos de Santiago:** el orden de las tres secciones (el v8 las numera 1-2-3), los textos de las rutas activadas, y las dosis y prioridades de los nutracéuticos.

---

# Parte 2 · Subpestaña del Nutricionista

## Inventario del v8 (pestaña `plan_nutricional`)

| # | Pieza | ¿Se ve en pantalla? | ¿Se imprime? |
|---|---|---|---|
| N1 | META TERAPÉUTICA | sí | sí |
| N2 | A — RESUMEN CLÍNICO | sí | sí |
| N3 | D — FÓRMULA SINTÉTICA (la cadena, editable) | sí | **no** (`no-print`) |
| N4 | Aviso "⚠ Restricciones activas" (dentro de N3) | sí | no (hereda) |
| N5 | E — FÓRMULA DESARROLLADA · Plan por grupos | sí | sí |
| N6 | Objetivo del tratamiento nutricional (texto libre) | sí | sí |
| N7 | Selector de tiempos activos | sí | **no** (`no-print`) |
| N8 | MOTOR NUTRICIONAL CNV · Necesidades (derivadas del DFI) | sí | sí |
| N9 | Lista de intercambio (tabla del profesional, editable) | sí | **no** (`no-print`) |
| N10 | Validación del plan · % cubrimiento e ICN | sí | **no** (`no-print`) |
| N11 | Distribución por tiempos | sí | sí |
| N12 | LISTA DE INTERCAMBIO U DE A (la del paciente, recortada a 8) | **NO** | sí (`plan-print-only`) |
| N13 | F — MENÚ SEMANAL (opcional) | sí | sí |
| N14 | RECOMENDACIONES NUTRICIONALES PERSONALIZADAS | sí | sí |
| N15 | Botones "Imprimir plan" y correo al paciente | sí | no (`no-print`) |

## Inventario de Atlas

| # | Pieza |
|---|---|
| B1 | Resumen clínico + meta terapéutica + aviso de realimentación |
| B2 | Objetivo del tratamiento nutricional |
| B3 | Guías dietarias |
| B4 | Nivel III — Salud celular |
| B5 | **Aviso de realimentación accionable** (encima de la cadena) |
| B6 | **Restricciones activas del modelo** (encima de la cadena) |
| B7 | Cadena calórica (seis ajustes, recomputación en vivo) |
| B8 | Lista de intercambio por alimento (21 filas, macros, alimentos con gramaje plegados) |
| B9 | **Tiempos de comida** (sección propia, con su botón) |
| B10 | Distribución por tiempos (con cuadre por alimento y aviso de comida vacía) |
| B11 | Validación de nutrientes (% cubrimiento e ICN) |
| B12 | Lista de intercambio para el paciente |
| B13 | Menú semanal editable |
| B14 | Restricciones alimentarias del profesional |
| B15 | Menú sugerido (IA) + historial de sugerencias con procedencia |
| B16 | Notas del profesional |

## Clasificación

### Igual en los dos (comparar CIFRAS y textos)

| v8 | Atlas | Qué mirar |
|---|---|---|
| N1+N2 | B1 | Los párrafos, palabra por palabra |
| N3 | B7 | **Las seis cifras. Ojo al aviso de arriba: van a diferir por P-32** |
| N4 | B6 | Nombre, valor y referencia de cada restricción |
| N5+N9 | B8 | Porciones por alimento, kcal, proteína, CHO, grasa, y la fila TOTAL |
| N6 | B2 | Campo de texto libre |
| N7 | B9 | Qué tiempos vienen marcados por defecto |
| N10 | B11 | Los ~16 nutrientes: aporte, necesidad, % y ICN, **y los colores** |
| N11 | B10 | El reparto por tiempo |
| N12 | B12 | Los ocho alimentos por subgrupo y el "entre otros" |
| N13 | B13 | Los menús del ciclo, **día por día** |

### Solo en el HTML (falta en Atlas)

| # | Qué | Estado |
|---|---|---|
| N14 | Recomendaciones por diagnóstico | **Bloqueado** (P-33/P-34: un bloque huérfano y dos umbrales que discrepan) |
| N15 | Imprimir plan y correo al paciente | Bloque de envío, ya dimensionado (P-38) |
| N8 | Tabla de "Necesidades" como bloque aparte | **Cubierta**, repartida entre B7 y B11. Atlas muestra 16 micronutrientes; el v8, 5 |

### Solo en Atlas (va MÁS allá)

B3 guías dietarias · B4 salud celular (**P-28**, Gildardo decide si se queda) · B5 aviso de realimentación · B14 restricciones del profesional · B15 historial de sugerencias con proveedor, modelo y versión de prompt · B16 notas · el cuadre por alimento · el aviso de comida activa y vacía (P-41) · los alimentos con gramaje plegados en la tabla de trabajo.

### Deliberadas (no son hallazgos)

Sin barra de subpestañas · AF a un decimal (D-016) · el ICN del sodio coloreado (era divergencia gris nuestra, corregida) · el plan **se guarda** en vez de recalcularse al recargar · el menú semanal con semilla persistida en vez de aleatoria · **B12 en pantalla en vez de solo al imprimir (P-36)**.

### Sin clasificar: **una**

**El orden de las secciones.** El v8 va: meta → resumen → **fórmula sintética** → plan por grupos → objetivo → necesidades → intercambio → validación → distribución → menú → recomendaciones. Atlas va: resumen → objetivo → guías → celular → **cadena** → intercambio → tiempos → distribución → validación → lista del paciente → menú → restricciones → IA → notas.

Coinciden en lo grueso (leer, prescribir, repartir, validar, generar) pero no en el detalle. **La regla del cotejo dice que el orden es nuestro** (el HTML manda en QUÉ, nosotros en CÓMO), así que probablemente sea decisión y no hallazgo. **Lo dejo sin clasificar a propósito** para que Santiago decida mirándolo, que es donde un orden se siente bien o mal.

---

# Lo que necesito de Santiago

1. **Compara primero el objetivo calórico.** Si difiere, no sigas hacia abajo: es P-32 y ya está preguntado. Iguálalo a mano y compara entonces.
2. **Con el objetivo igualado**, las porciones del intercambio, la distribución y la validación **deberían coincidir cifra por cifra**. Si no, es hallazgo nuevo.
3. **Los textos**: resumen, meta, restricciones, nutrientes de la validación.
4. **El orden de las secciones**: si al mirarlo se siente peor que el suyo, dilo y lo cambiamos.
5. **Lo que el inventario no ve**: colores, espaciado, qué se lee primero, qué se pierde.

Lo que levante preguntas nuevas para Gildardo va a la **ronda del 24**, que aún no se ha mandado.
