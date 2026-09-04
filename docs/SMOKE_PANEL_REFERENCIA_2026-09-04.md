# Smoke del panel de referencia (proteína y grasa)

**Para Santiago. 2026-09-04.** Bloque nuevo debajo de dos campos de un formulario. Es exactamente la clase
de cosa que ni `tsc` ni los tests ven, así que **necesita navegador real**.

Los recorridos están escritos en el lenguaje de la pantalla, no en el del código.

---

## Qué es esto, en una línea

Junto a los campos de **Proteína (g/kg)** y **Grasa (%)** aparece ahora un bloque gris que dice qué rango
recomienda la ciencia para las condiciones de ESE paciente, por qué, y de dónde sale. **No valida nada:**
no bloquea el guardado, no pinta el campo en rojo, no impide escribir cualquier cifra.

Es la otra mitad de la retirada de la proteína. Antes el motor imponía 1,3 g/kg a un obeso; ahora
prescribe 0,8 y **le muestra al nutricionista** que la obesidad sugiere 1,2-1,5, para que decida él.

---

## Dónde está

1. Entra a una evaluación **que ya tenga diagnóstico generado** (sin diagnóstico no hay protocolo, y sin
   protocolo no hay panel de tratamiento).
2. Pestaña **Tratamiento**.
3. Baja hasta el bloque **Cadena calórica**, donde están los campos de ajuste.
4. El bloque nuevo va **justo debajo** del campo de Proteína, y otro igual debajo del de Grasa.

---

## Recorrido 1 · Que aparezca, y que diga algo del paciente

**Paciente sugerido: cualquiera con diagnóstico.** Si tiene alguna condición (obesidad, diabetes,
dislipidemia, enfermedad renal, cáncer, desnutrición) mejor, porque el texto es más rico.

**Qué tienes que ver debajo de Proteína:**

- Una línea de **Referencia** con un rango, por ejemplo `Referencia: 1.2–1.5 g/kg`.
- Debajo, una o más líneas, cada una con: **el nombre de la condición**, su rango, **una explicación del
  mecanismo** (no una cita), y la fuente entre paréntesis. Ejemplo:
  > **Obesidad:** 1.2–1.5 g/kg. Con déficit calórico la proteína protege la masa magra. *(AND AWM 2014 ·
  > ESPEN Obesidad 2022)*
- Y lo mismo debajo de Grasa, con sus propias condiciones y el rango en porcentaje.

**Sería defecto si:**

- **No aparece nada.** El panel tiene que salir **siempre**: un paciente sin ninguna condición debe ver
  *"Sin condiciones que lo modifiquen: 0.8–0.8 g/kg"* con su explicación. Un bloque ausente es defecto,
  no "es que no tiene nada".
- Aparece debajo de Proteína pero **no debajo de Grasa**, o al revés.
- El texto sale cortado, se sale de la caja, o el bloque empuja los campos fuera de la pantalla.
- Aparece debajo de otros campos (peso meta, PAL, GEB). **Solo van esos dos.**

---

## Recorrido 2 · El aviso de fuera de rango, que es el que me preocupa

**Este es el caso importante y el que no puede probar ningún test.** El aviso se calcula **en el
navegador, contra lo que estás escribiendo**, no contra lo guardado. Si lo hubiera calculado en el
servidor, iría un guardado por detrás: el campo diría una cifra y el aviso hablaría de la anterior.

**Recorrido, sin guardar en ningún momento:**

1. Mira qué rango dice la línea de **Referencia** debajo de Proteína. Digamos `1.2–1.5`.
2. **Borra el campo de Proteína.** Con el campo vacío manda el valor del modelo, así que el aviso tiene
   que reflejar ESE valor, no desaparecer por estar vacío.
3. Escribe una cifra **claramente fuera**, por ejemplo `3`.
   - **Tiene que aparecer**, en ámbar y debajo del bloque: *"La cifra escrita queda fuera del rango
     sugerido 1.2–1.5 g/kg (...)"*.
   - **Y tiene que aparecer mientras escribes, sin guardar ni recargar.**
4. Bórrala y escribe una cifra **dentro** del rango, por ejemplo `1.3`.
   - **El aviso tiene que desaparecer**, también en el momento.
5. Repite los dos pasos en el campo de **Grasa** con un `3` (el caso real del que salió todo esto) y
   luego con un `30`.

**Sería defecto si:**

- El aviso **no aparece hasta que guardas**. Ese es justamente el defecto que esto evita.
- El aviso aparece **una tecla tarde**: escribes `3`, no dice nada, escribes `35` y entonces avisa de `3`.
- El aviso **se queda pegado** después de corregir la cifra.
- El aviso sale con el campo **vacío** diciendo que el vacío está mal. Un campo en blanco es una decisión
  legítima del profesional (manda el modelo), no un error.
- El aviso **impide guardar**, deshabilita el botón, o pinta el campo de rojo. **No valida: informa.**

---

## Recorrido 3 · El conflicto, que se ve distinto

**Paciente sugerido: uno con enfermedad renal crónica Y desnutrición** (o renal y obesidad). Son dos
condiciones que piden rangos de proteína que **no se solapan**: la renal pide bajar (0,6-0,8) y la otra
subir (1,2-1,5).

**Qué tienes que ver:**

- **En vez de** la línea de `Referencia: X–Y`, un título que dice **"Dos condiciones piden rangos que no
  coinciden"**.
- Debajo, **las dos condiciones con sus dos rangos**, cada una con su explicación.
- Y al final una nota suya que dice, en sus palabras, que *ATLAS no escoge por usted*.

**Sería defecto si:**

- Sale una línea de `Referencia:` **vacía**, o un rango raro tipo `1.2–0.8`.
- Sale **una sola** de las dos condiciones, o el panel elige una por su cuenta.
- El conflicto se ve **igual** que un paciente sin condiciones. Son cosas distintas: uno es "no hay nada
  que ajustar" y el otro es "hay una decisión que le toca a usted".

---

## Recorrido 4 · Que no se rompa lo que ya funcionaba

El bloque nuevo se metió **dentro** del contenedor de los dos campos, así que hay que confirmar que no
movió nada:

1. Escribe cifras en **peso meta, GEB, PAL, proteína y grasa**, y **guarda**.
2. Vuelve a entrar a la evaluación.

**Sería defecto si:** alguna cifra no se guardó, la rejilla de campos quedó descuadrada (dos columnas
donde había cuatro, o campos de distinto alto), o el aviso de "la proteína del motor difiere de la de la
cadena" dejó de salir.

---

## Y una cosa de color, que se ve rápido

El aviso de fuera de rango va en **ámbar** (la capa de atención), **no en el rojo/verde clínico**.

No es preferencia: el rojo y el verde clínicos son un **veredicto sobre la persona** y sus colores salen
de los clasificadores de Gildardo. *"Esta cifra quedó fuera del rango"* es operativo, habla de la cifra,
no del paciente. Si lo ves en rojo clínico, es defecto.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
