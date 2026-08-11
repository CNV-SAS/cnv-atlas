# Ronda consolidada para Gildardo — 2026-08-10

**Para:** Gildardo Uribe, Dirección Científica CNV
**De:** Equipo Atlas

Construimos **desde tu última respuesta** (`RESPUESTA_GILDARDO_2026-08-09.md`). Las cuatro que respondiste ahí ya están hechas: §6 (la fecha de la cita en el reporte), §10 (los nombres de los indicadores), §15 (el renombre del eje de la Diana) y §9 (las remisiones resumidas por destinatario). Esta ronda es lo que queda, ordenado por lo que más bloquea, y al final unas confirmaciones de cosas que ya aplicamos y solo necesitan tu visto bueno.

Verificamos cada punto contra el estado actual antes de incluirlo (algunas se resolvían solas al construir; esas no están aquí).

---

## PARTE 1 — Preguntas (necesitamos tu decisión)

### 1. `pesoAjust`: sobre qué peso se calcula la prescripción cuando nadie fijó el peso meta (LO QUE MÁS BLOQUEA)

**Desbloquea:** la mitad de Tratamiento. Es la Pieza 2 de la cadena calórica, y hasta que la respondas no podemos re-portar el motor de prescripción.

Marcaste `pesoAjust` como código muerto. **En Atlas NO lo es:** el motor congelado que portamos de tu `atlas-protocolo.js` computa `pesoCalculo = (IRC||Cáncer) ? peso : imc<25 ? peso : PI+0.25*(peso−PI)`. Ese `PI+0.25*(peso−PI)` para IMC ≥ 25 **es exactamente `pesoAjust`**, y es el peso sobre el que se calcula la prescripción (Mifflin del gasto basal, y la proteína) de **todo paciente con sobrepeso u obesidad**. No es código muerto: gobierna prescripciones.

**Pregunta:** al reemplazar `pesoAjust` por el peso meta, ¿qué pasa con los pacientes **sin peso meta fijado**? ¿El peso de cálculo cae al **peso ideal de Lorentz** (`round(PI)`), al **peso actual**, o **sigue el ajustado** (`PI+0.25*(peso−PI)`)? Los tres dan cifras distintas para el mismo paciente con sobrepeso, y hoy Atlas usa el tercero en silencio.

### 2. La redacción de "conducta propia" cuando la remisión es a la propia profesión del que atiende

**Desbloquea:** el cierre de §9 (ya construimos el resumen por destinatario; falta solo este texto).

Confirmaste que cuando la ruta remite a la misma profesión del que atiende, no es remisión sino **conducta propia**. Ya lo aplicamos: esa línea no ofrece "registrar remisión". Falta **tu texto exacto** (es tu autoría de comunicación). Hoy usamos un placeholder: *"Es tu propia profesión: esto es conducta tuya en la consulta, no una remisión."*

- **2a (redacción):** ¿cómo debe presentarse? ¿Un texto genérico ("En esta consulta te corresponde: [indicaciones]") o uno por ruta? Redactamos en tu dirección y apruebas.
- **2b (salvedad):** el componente del frozen rotula el destino como **"Entrenador/Fisioterapeuta"**, pero nuestra profesión del modelo se llama **deportólogo**. ¿Son la misma figura (el deportólogo cubre "ejercicio" y se auto-remite en R2-R4), o el modelo contempla una CUARTA figura distinta? De esto depende quién se auto-remite en el componente ejercicio.

### 3. La pregunta de cirugías digestivas/metabólicas: ¿alimenta el motor o es solo registro?

Tu v8 tiene en D6 una pregunta (ítem 63) que nuestra encuesta no tiene: *"¿Le han realizado alguna cirugía que afecte la digestión o el metabolismo?"* (colecistectomía, bariátrica, resección intestinal, gastrectomía, apendicectomía, otra). La vamos a portar. Una cirugía **bariátrica cambia cómo se absorbe la comida**; si el motor no lo sabe, prescribe sobre un supuesto falso.

**Pregunta:** ¿esa pregunta **alimenta el motor nutricional** (y entonces qué opción cambia qué: bariátrica → ¿ajuste de proteína/kcal/absorción?), o es **solo registro clínico**? Si alimenta el motor, dinos la regla para portarlo fiel; si es solo registro, la sembramos sin efecto en el cálculo.

### 4. Tu motor emite tres nutracéuticos con dos grafías distintas

**Afecta:** el emparejamiento de la recomendación con el catálogo (la tienda).

Según la rama del árbol de decisión, el motor emite: **MULTI-CELL BASE** / **MULTICELL BASE**; **HEPA-DETOX** / **HEPA DETOX**; **GUT-IMMUNE PRO** / **GUTIMMUNE PRO**. El catálogo usa la primera de cada par. Lo emparejamos de nuestro lado con un mapa (sin tocar tu motor congelado), así que no bloquea; pero si en algún momento actualizas el archivo, **unificar el nombre lo evita de raíz**. ¿Prefieres que lo unifiquemos por mapa (ya lo hacemos) o lo dejarás unificado en una próxima versión del archivo?

### 5. Dos rarezas del grupo "carnes rojas" en la pantalla del patrón alimentario

Con un paciente demo que come carne roja 5-6 días/semana, al portar tu pantalla vimos dos cosas (portadas verbatim de tu archivo):
- **(a)** las carnes rojas (grupo 15) entran en la matemática y en la grilla, pero **no en el promedio de la tarjeta "Moderados"** (que sigue sobre los grupos 8, 9, 10).
- **(b)** su píldora se pinta **verde con alta frecuencia**, porque los grupos moderados usan la misma lógica de color que los protectores (más = mejor); comer carne roja casi a diario se muestra como si estuviera bien.

**Pregunta:** ¿es deliberado, o el grupo 15 debería (a) entrar en el promedio de "Moderados" y (b) tener su propia lógica de color para que la alta frecuencia no salga en verde?

### 6. Etiquetas ambiguas en las tarjetas del patrón ("Moderados: Moderado")

En las tarjetas del patrón, "Moderados: Moderado" confunde (la categoría de alimentos y el nivel de consumo son la misma palabra). Tu archivo ya tiene etiquetas más claras en otro lado (p. ej. "Alimentación Real energética (moderar)"). **Pregunta:** ¿usamos esas en la pantalla, o las cortas están bien?

---

## PARTE 2 — Confirmaciones (ya lo aplicamos; solo tu visto bueno)

### C1. El renombre del eje de la Diana (§15): resultó más simple de lo que esperabas

Renombramos el eje estructural (FFMI × FMI) de R1-R9 a **E1-E9**, con la R reservada para las rutas, como pediste. **Dos cosas para que las conozcas:**
- **No hizo falta función de traducción ni migración.** En Atlas el prefijo **nunca se guarda**: se deriva del rango al pintar la Diana (único sitio donde aparece). Por eso todas las evaluaciones, viejas y nuevas, se leen igual, sin traducir nada. (Tu instrucción asumía códigos guardados que se traducen al mostrar; en Atlas no era así, y el resultado visible es el que querías.)
- **El wording del pie:** donde tu prototipo decía "Radios R1-R9", ahora dice **"Sectores E1-E9"** (son los sectores angulares del gráfico; tu propio comentario del código ya los llamaba "sectores"). El eje funcional sigue como "Anillos A1-A9".

**Confirma:** ¿te sirve el enfoque sin traducción, y apruebas el rótulo **"Sectores E1-E9"**?

---

## PARTE 3 — Pendiente de tu entrega (no es pregunta)

- **La tabla de referencia `MCA_ref` y `hidSG_ref`** (por sexo y edad) que ofreciste en la ronda del 2026-08-09. Mientras llega, esas salidas quedan en "no evaluable" (nunca degradadas). Cuando mandes el archivo, las cableamos.
