# Cómo subir la medición del Biody a Atlas

**Una página. Para los profesionales de CNV.** · 6 de noviembre de 2026

---

## Antes de medir: la cintura y la cadera se toman siempre

Es lo que más detiene las importaciones. De los 82 intentos que no pasaron, **41 fue porque la medición
llegó sin datos obligatorios**, y en la mayoría los que faltaban eran la cintura y la cadera.

El Biody no las mide: las escribes tú en el programa, antes de la medición. Si se quedan en blanco, el
archivo sale sin ellas y Atlas no puede emitir el diagnóstico, porque la cintura y la cadera entran en los
indicadores. No es un dato administrativo.

**Lo que hay que hacer:** en el Biody Manager, en la ficha del paciente, llena la cintura y la cadera en
centímetros antes de tomar la medición. Si ya mediste y quedaron vacías, vuelve a tomar la medida con los
datos puestos: no se pueden agregar después al archivo.

---

## Al exportar: el archivo correcto es el de **Exportar medidas**

El Biody Manager ofrece dos casillas al exportar, y de las tres combinaciones posibles **solo una no
sirve**:

| Lo que marcas en el Biody | ¿Sirve en Atlas? |
|---|---|
| **Exportar medidas** | **Sí** |
| **Exportar medidas** + **Exportar datos del paciente** | **Sí** |
| Solo **Exportar datos del paciente** | **No.** Ese archivo no trae ninguna medición |

El tercero se intentó ocho veces hasta finales de octubre. No es culpa de Atlas ni de un error del
programa: ese archivo trae el nombre, la fecha de nacimiento y la altura, y ni una sola variable de
bioimpedancia. **Si Atlas te dice que el archivo es el de "Exportar datos del paciente", vuelve a exportar
con "Exportar medidas" marcada.**

**Y el archivo se sube tal como sale del Biody.** No lo abras en Excel para revisarlo y volverlo a guardar,
no lo pases a CSV y no le cambies el nombre de la extensión: al guardarlo de nuevo cambia de formato y
Atlas ya no lo puede leer.

---

## Si el archivo trae varias mediciones, no pasa nada

Cuando exportas medidas y datos juntos, el archivo trae **una fila por cada medición** que el paciente
tenga en el Biody. Eso es normal y Atlas lo acepta: te pregunta cuál medición quieres importar y por
defecto toma la más reciente.

Antes del 6 de octubre Atlas rechazaba esos archivos y había que borrar filas a mano. **Ya no.** Si te
pasó antes, vuelve a intentarlo con el mismo archivo.

---

## Si Atlas dice que un valor está fuera de rango

Atlas frena una medición cuando un valor no es posible: una cadera de 1.047 cm, una cintura de 19 cm, una
capacitancia negativa. Casi siempre es un dígito de más, un decimal perdido o una celda del programa que
quedó mal.

**Lo que hay que hacer:** mira el valor que Atlas nombra en el mensaje y compáralo con la pantalla del
Biody. Si en el Biody está bien y Atlas lo rechaza, **avísale a Santiago con la fecha y el paciente**: hay
un caso así de octubre (un ángulo de fase de 0,6°) y los rangos están en revisión con la Dirección
Científica. No vuelvas a tomar la medida antes de preguntar.

---

## Si la medición ya se tomó y nunca se subió

Pasa: la actividad se hizo, quedó en el Biody Manager y la consulta en Atlas sigue abierta esperándola.
**No la dejes abierta y no la borres.** Dos caminos, en este orden:

1. **Si el archivo todavía existe en el Biody**, expórtalo y súbelo: Atlas acepta mediciones con fecha
   anterior, y la consulta queda completa con su fecha real.
2. **Si ya no se puede recuperar**, ciérrala desde la historia del paciente, en el botón de la fila de esa
   consulta, **escribiendo el motivo** (por ejemplo: "la medición quedó solo en el Biody Manager y no se
   subió"). No borra nada: el consentimiento y la encuesta que el paciente respondió se conservan. Queda
   constancia de quién lo hizo y por qué, la consulta deja de contar como pendiente y de entrar a los
   análisis, y se puede deshacer.

---

## En resumen

1. Cintura y cadera, **antes** de medir.
2. Exportar con **"Exportar medidas"** marcada.
3. Subir el archivo **tal como sale**, sin abrirlo ni guardarlo de nuevo.
4. Varias mediciones en un archivo: **está bien**, Atlas pregunta cuál.
5. Un valor rechazado: **compáralo con el Biody y pregunta** antes de repetir la medición.

---

*Connected Nutrition Ventures SAS. Si algo de esta guía no coincide con lo que ves en pantalla, dilo: el
mensaje de Atlas y esta guía tienen que decir lo mismo.*
