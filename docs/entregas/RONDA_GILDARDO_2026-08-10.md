# Ronda consolidada para Gildardo — 2026-08-10

**Para:** Gildardo Uribe, Dirección Científica CNV
**De:** Equipo Atlas

Construimos **desde tu última respuesta** (`RESPUESTA_GILDARDO_2026-08-09.md`). Las cuatro que respondiste ahí ya están hechas: §6 (la fecha de la cita en el reporte), §10 (los nombres de los indicadores), §15 (el renombre del eje de la Diana) y §9 (las remisiones resumidas por destinatario).

Releímos tu respuesta completa antes de armar esto: **varios puntos que teníamos en cola ya los contestaste ahí** (las cirugías, el peso por defecto), y no los repetimos. Lo que queda son dos preguntas de verdad y tres confirmaciones de cosas que ya aplicamos.

---

## PARTE 1 — Preguntas (necesitamos tu decisión)

### 1. La redacción de "conducta propia", y una figura del modelo

**Cierra §9** (ya construimos el resumen por destinatario; falta este texto).

Dijiste que cuando la ruta remite a la misma profesión del que atiende, esa línea "no dice remisión, sino que queda como conducta propia dentro de su plan". Ya lo aplicamos: esa línea no ofrece registrar remisión. Hoy usamos un placeholder: *"Es tu propia profesión: esto es conducta tuya en la consulta, no una remisión."*

- **1a (redacción):** nos diste la dirección; falta **tu texto exacto** (es tu autoría de comunicación). ¿Un texto genérico ("En esta consulta te corresponde: [indicaciones]") o uno por ruta?
- **1b (una figura):** el componente del frozen rotula el destino como **"Entrenador/Fisioterapeuta"**, pero nuestra profesión del modelo se llama **deportólogo**. ¿Son la misma figura (el deportólogo cubre "ejercicio" y se auto-remite en R2-R4), o el modelo contempla una CUARTA figura distinta? De esto depende quién se auto-remite en el componente ejercicio.

### 2. Dos rarezas del grupo "carnes rojas" en la pantalla del patrón alimentario

Con un paciente demo que come carne roja 5-6 días/semana, al portar tu pantalla vimos dos cosas (portadas verbatim de tu archivo):
- **(a)** las carnes rojas (grupo 15) entran en la matemática y en la grilla, pero **no en el promedio de la tarjeta "Moderados"** (que sigue sobre los grupos 8, 9, 10).
- **(b)** su píldora se pinta **verde con alta frecuencia**, porque los grupos moderados usan la misma lógica de color que los protectores (más = mejor); comer carne roja casi a diario se muestra como si estuviera bien.

**Pregunta:** ¿es deliberado, o el grupo 15 debería (a) entrar en el promedio de "Moderados" y (b) tener su propia lógica de color para que la alta frecuencia no salga en verde?

### 3. ¿Cuántas de las 63 preguntas del intake son necesarias en la PRIMERA consulta?

El asesor legal, al revisar el flujo del consentimiento, observó que 63 preguntas es mucho para un intake y que conviene ver si todas son necesarias en la primera consulta o si algunas van al seguimiento. Es tu terreno (contenido del instrumento), no el nuestro, pero te damos el dato para que sea respondible:

De las 63, **34 alimentan algún motor** y **29 son caracterización pura** (registro clínico, sin efecto en ningún cálculo). Y de esas 34, **solo 13 alimentan el DIAGNÓSTICO**; las otras 21 son del patrón alimentario y del tratamiento (etapa posterior a la evaluación). Es decir: para el diagnóstico de la primera consulta bastan 13; las otras 50 son patrón/tratamiento (que ocurre después) o caracterización.

**Pregunta:** ¿cuáles de esas 50 (las 21 de patrón/tratamiento y las 29 de caracterización) podrían recogerse en el **seguimiento** en vez de en el intake inicial, para acortar la primera encuesta? Es tu decisión de instrumento; nosotros solo movemos el momento de la captura.

---

## PARTE 2 — Confirmaciones (ya lo aplicamos o vamos a aplicar tu instrucción; solo tu visto bueno)

### C1. El renombre del eje de la Diana (§15): resultó más simple de lo que esperabas

Renombramos el eje estructural (FFMI × FMI) de R1-R9 a **E1-E9**, con la R reservada para las rutas. **No hizo falta función de traducción ni migración:** en Atlas el prefijo **nunca se guarda**, se deriva del rango al pintar la Diana (único sitio donde aparece), así que todas las evaluaciones, viejas y nuevas, se leen igual. (Tu instrucción asumía códigos guardados que se traducen al mostrar; en Atlas no era así, y el resultado visible es el que querías.) El pie, donde tu prototipo decía "Radios R1-R9", ahora dice **"Sectores E1-E9"** (son los sectores angulares; tu propio comentario del código ya los llamaba "sectores"). El eje funcional sigue como "Anillos A1-A9".

**Confirma:** ¿te sirve el enfoque sin traducción, y apruebas el rótulo **"Sectores E1-E9"**?

### C2. `pesoAjust`: en tu archivo SÍ se usa, y retirarlo cambia la prescripción de IMC≥25

Tu punto 3 ya nos dio el peso por defecto sin meta (Lorentz fuera de 18,5-25, peso actual dentro), y tu punto 2 pide retirar `pesoAjust`. **Vamos a aplicar eso.** Una salvedad, porque en Atlas tiene una consecuencia que tu punto 2 no anticipa:

En tu propio `atlas-protocolo.js`, `pesoAjust` **no es código muerto: se usa**. Es el `pesoCalculo` sobre el que se prescribe a **todo paciente con IMC ≥ 25** (`pesoCalculo = imc<25 ? peso : PI+0,25×(peso−PI)`). Ejemplo concreto: un paciente de **88 kg con IMC 27** hoy se prescribe sobre **76,6 kg** (el ajustado), no sobre su peso ni sobre su peso ideal. Al retirar `pesoAjust` y adoptar tu default, ese paciente pasa a calcularse sobre su **peso ideal de Lorentz**.

**Confirma:** ¿retiramos `pesoAjust` y usamos tu default (Lorentz / peso actual), sabiendo que cambia la prescripción de los pacientes con IMC ≥ 25 que hoy la calculan sobre el ajustado?

### C3. Las etiquetas del patrón alimentario: usaremos las tuyas más claras

En las tarjetas del patrón, las etiquetas cortas del render dan "Moderados: Moderado" (la categoría y el nivel son la misma palabra). Tu archivo ya tiene unas más claras en `catLabel`, y vamos a **usar esas**: **"Alimentación Real protectora"**, **"Alimentación Real energética (moderar)"**, **"Procesados y ultraprocesados (PCBU)"**.

**Confirma:** ¿son esas las que quieres en pantalla?

---

## PARTE 3 — Pendiente de tu entrega / para tu información (no requieren respuesta)

- **La tabla de referencia `MCA_ref` y `hidSG_ref`** (por sexo y edad) que ofreciste el 2026-08-09. Mientras llega, esas salidas quedan en "no evaluable" (nunca degradadas). Cuando mandes el archivo, las cableamos.
- **Grafías de nutracéuticos (solo para tu información):** tu motor emite tres productos con dos grafías según el fenotipo (MULTI-CELL / MULTICELL, HEPA-DETOX / HEPA DETOX, GUT-IMMUNE PRO / GUTIMMUNE PRO). Lo emparejamos con el catálogo por un mapa de nuestro lado; **no necesitamos que hagas nada**. Solo, si algún día actualizas el archivo, unificar el nombre lo evitaría de raíz.
