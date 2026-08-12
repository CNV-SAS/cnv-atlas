# Ronda consolidada para Gildardo — 2026-08-10

**Para:** Gildardo Uribe, Dirección Científica CNV
**De:** Equipo Atlas

Construimos **desde tu última respuesta** (`RESPUESTA_GILDARDO_2026-08-09.md`). Las cuatro que respondiste ahí ya están hechas: §6 (la fecha de la cita en el reporte), §10 (los nombres de los indicadores), §15 (el renombre del eje de la Diana) y §9 (las remisiones resumidas por destinatario).

Releímos tu respuesta completa antes de armar esto: **varios puntos que teníamos en cola ya los contestaste ahí** (las cirugías, el peso por defecto), y no los repetimos. Lo que queda: **lo que más bloquea (el motor de peso)** arriba, luego tres preguntas y dos confirmaciones de cosas que ya aplicamos.

---

## LO QUE MÁS BLOQUEA — el motor de peso (déficit y pesoAjust)

Estas dos son del mismo tema y las ponemos **primero**: sin la 1 **no podemos portar el motor de peso**, que es la mitad de Tratamiento.

### 1. La fórmula exacta del déficit desde el peso meta

En tu respuesta del 2026-08-09 (enmiendas a D-002) corregiste que el déficit calórico debe **derivarse de la diferencia entre peso actual y peso meta**, y dejar de ser un valor fijo por fenotipo (−500 en obesidad). Estamos de acuerdo y queremos portarlo. **El problema:** tu respuesta da la dirección, pero no la fórmula de la conversión, y tu archivo no la trae todavía.

Revisamos tu `motorTratNutri` en la entrega de julio (`atlas-motores-tratamiento.js`) y en el **v8** (`ATLAS_v8.html`): en los dos, el déficit sigue siendo **fijo** (`deficit = 500` en obesidad, `kcalObjetivo = get − deficit`) y el peso meta **solo alimenta la proteína** (`protG = protKg × pesoMeta`); no entra al déficit. O sea: la corrección que describes **no está en código todavía**. No es reproche, es el dato, para que no asumas que ya la entregaste y respondas "está en mi archivo".

Para portarla sin inventar (una conversión de kilos a calorías mal hecha prescribe mal a un paciente real), necesitamos tu **fórmula exacta**:

- **(a) ¿Cómo se convierte la diferencia en kg (peso actual − peso meta) a un déficit diario en kcal?** Tres candidatas, para que confirmes o corrijas:
  - (i) un **ritmo objetivo** (p. ej. 0,5 kg/semana → 7700 × 0,5 / 7 ≈ 550 kcal/día);
  - (ii) `kcalObjetivo = gasto de mantenimiento al peso meta` (GEB(pesoMeta) × FA), y el déficit es GET(actual) − ese objetivo. **Ojo:** esto usaría el peso meta para el gasto, y en tu punto 1 dijiste que el gasto va sobre el **peso actual**;
  - (iii) una **tabla por magnitud** de la diferencia.
- **(b)** ¿El fenotipo sigue dando un valor inicial hasta que se fija el peso meta, y con qué números?
- **(c)** Confirmar el **piso** (1.500 H / 1.200 M, solo cuando hay déficit) y el caso de **superávit** (cuando el peso meta es mayor que el peso actual).

### 2. `pesoAjust`: en tu archivo SÍ se usa, y retirarlo cambia la prescripción de IMC≥25

Es del mismo tema que la 1. Tu punto 3 ya nos dio el peso por defecto sin meta (Lorentz fuera de 18,5-25, peso actual dentro), y tu punto 2 pide retirar `pesoAjust`. **Vamos a aplicar eso.** Una salvedad, porque en Atlas tiene una consecuencia que tu punto 2 no anticipa:

En tu propio `atlas-protocolo.js`, `pesoAjust` **no es código muerto: se usa**. Es el `pesoCalculo` sobre el que se prescribe a **todo paciente con IMC ≥ 25** (`pesoCalculo = imc<25 ? peso : PI+0,25×(peso−PI)`). Ejemplo concreto: un paciente de **88 kg con IMC 27** hoy se prescribe sobre **76,6 kg** (el ajustado), no sobre su peso ni sobre su peso ideal. Al retirar `pesoAjust` y adoptar tu default, ese paciente pasa a calcularse sobre su **peso ideal de Lorentz**.

**Confirma:** ¿retiramos `pesoAjust` y usamos tu default (Lorentz / peso actual), sabiendo que cambia la prescripción de los pacientes con IMC ≥ 25 que hoy la calculan sobre el ajustado?

---

## PARTE 1 — Otras preguntas (necesitamos tu decisión)

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

De las 63, **34 alimentan algún motor** y **29 son caracterización pura** (registro clínico, sin efecto en ningún cálculo). Y de esas 34, **solo 13 alimentan el DIAGNÓSTICO**; las otras 21 son del patrón alimentario y del tratamiento (etapa posterior a la evaluación).

**Una advertencia para no podar de más:** algunas de esas 29 de caracterización, aunque no alimenten ningún cálculo, quizá las **necesita el observatorio (ObBIA)** para estratificar. Podarlas de la primera consulta tiene un costo que hay que conocer antes de decidir.

**Pregunta (dos partes):**
- De las **21 de patrón/tratamiento**: como el tratamiento ocurre DESPUÉS de la evaluación, ¿podrían recogerse en el seguimiento en vez de en el intake inicial?
- De las **29 de caracterización pura**: ¿cuáles necesita el **observatorio en la primera consulta**, y cuáles pueden esperar al seguimiento?

Es tu decisión de instrumento (y la del observatorio); nosotros solo movemos el momento de la captura.

### 4. El riesgo integrado del DFI cuando la encuesta está incompleta

Al implementar la suspensión por encuesta incompleta (Q28) medimos el efecto sobre el mismo paciente: la edad bioeléctrica se inflaba 14 años y el **riesgo integrado subía un nivel (de MEDIO a ALTO)**. Suspendimos las tres salidas que nombraste (edad bioeléctrica, índice contextual y rutas). El **riesgo integrado no lo nombraste**, así que en principio se seguía mostrando al profesional. El problema es que el riesgo integrado es un promedio ponderado de los cinco dominios, y dos de ellos (envejecimiento y contextual) se calculan sobre las mismas salidas que suspendimos, así que hereda esa inflación.

**Pregunta:** ¿debería suspenderse también, o se conserva como orientación con su rótulo?

**Lo que hicimos mientras respondes (conservador, reversible):** con la encuesta incompleta, la vista del profesional ya **no muestra el nivel concreto** (aparece "Provisional · se recalcula al completar la encuesta"), y los dos dominios inflados (envejecimiento y contextual) se marcan **"No evaluable"** en vez de una severidad calculada sobre supuestos. Si nos dices que se conserva como orientación, relajamos el display; si dices que se suspende, ya estamos ahí.

---

## PARTE 2 — Confirmaciones (ya lo aplicamos o vamos a aplicar tu instrucción; solo tu visto bueno)

### C1. El renombre del eje de la Diana (§15): resultó más simple de lo que esperabas

Renombramos el eje estructural (FFMI × FMI) de R1-R9 a **E1-E9**, con la R reservada para las rutas. **No hizo falta función de traducción ni migración:** en Atlas el prefijo **nunca se guarda**, se deriva del rango al pintar la Diana (único sitio donde aparece), así que todas las evaluaciones, viejas y nuevas, se leen igual. (Tu instrucción asumía códigos guardados que se traducen al mostrar; en Atlas no era así, y el resultado visible es el que querías.) El pie, donde tu prototipo decía "Radios R1-R9", ahora dice **"Sectores E1-E9"** (son los sectores angulares; tu propio comentario del código ya los llamaba "sectores"). El eje funcional sigue como "Anillos A1-A9".

**Confirma:** ¿te sirve el enfoque sin traducción, y apruebas el rótulo **"Sectores E1-E9"**?

### C2. Las etiquetas del patrón alimentario: usaremos las tuyas más claras

En las tarjetas del patrón, las etiquetas cortas del render dan "Moderados: Moderado" (la categoría y el nivel son la misma palabra). Tu archivo ya tiene unas más claras en `catLabel`, y vamos a **usar esas**: **"Alimentación Real protectora"**, **"Alimentación Real energética (moderar)"**, **"Procesados y ultraprocesados (PCBU)"**.

**Confirma:** ¿son esas las que quieres en pantalla?

---

## PARTE 3 — Pendiente de tu entrega / para tu información (no requieren respuesta)

- **La tabla de referencia `MCA_ref` y `hidSG_ref`** (por sexo y edad) que ofreciste el 2026-08-09. Mientras llega, esas salidas quedan en "no evaluable" (nunca degradadas). Cuando mandes el archivo, las cableamos.
- **Grafías de nutracéuticos (solo para tu información):** tu motor emite tres productos con dos grafías según el fenotipo (MULTI-CELL / MULTICELL, HEPA-DETOX / HEPA DETOX, GUT-IMMUNE PRO / GUTIMMUNE PRO). Lo emparejamos con el catálogo por un mapa de nuestro lado; **no necesitamos que hagas nada**. Solo, si algún día actualizas el archivo, unificar el nombre lo evitaría de raíz.
