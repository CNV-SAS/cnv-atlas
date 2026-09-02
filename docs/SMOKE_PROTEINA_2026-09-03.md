# Smoke corto: lo que se arregló después del primero (2026-09-03)

**Tres cosas, y las tres salen del smoke anterior.** El recorrido largo de los cuatro casos ya se hizo;
esto solo verifica los arreglos.

`pnpm dev` y las mismas evaluaciones de siempre.

---

## 1 · El caso 2, que decía tres cifras distintas

**Abre** `/evaluaciones/a0000000-0000-4000-8000-0000000000f2` (el F10 de 43,7 kg, IMC 18,2).

**Antes:** el campo decía *modelo 1.5*, la validación 73 g y la calculadora 44 g con 1 g/kg.

**Ahora la proteína tiene que decir 1,5 g/kg en los tres sitios:**

| Dónde | Qué tiene que decir |
| --- | --- |
| Chip del objetivo de tratamiento | **Proteína 1,5 g/kg** |
| Campo "Proteína (g/kg)" | placeholder **modelo: 1.5** |
| Calculadora, reparto de macros | **1,5 g/kg** (unos 66 g) |

**Si alguno de los tres dice otra cosa, párate ahí:** es el perfil donde una proteína equivocada hace más
daño, y era el que estaba mal.

## 2 · Y en ese mismo caso, el atributo que faltaba

El bloque de chips tenía que traer **"Densidad energética y proteica alta, fraccionada"** y no estaba: es
el que aporta la rama de desnutrición, que el motor no estaba viendo porque le faltaban peso y talla.

**Verifica que ahora aparezca**, junto con las dos notas de esa rama (recuperar el estado nutricional, y
la de vigilar la realimentación).

---

## 3 · Los chips del caso 3, a ver si siguen duplicados

**Abre** `/evaluaciones/a0000000-0000-4000-8000-0000000000f4` (F10 con insuficiencia renal).

**No pude reproducirlo:** el motor devuelve la lista una sola vez (5 atributos y 3 notas, todos distintos)
y en el código hay un solo sitio que la pinta, montado una sola vez.

**Míralo otra vez, porque el contenido cambió:** ahora tiene que traer también el atributo de
desnutrición, así que si sigue duplicado se va a notar mejor. **Si lo ves repetido, dímelo y lo busco con
la pantalla delante**; puede haber sido de la selección al copiar.

---

## Y lo que cambió en el aviso de desfase, por tu duda

Tenías razón: el aviso comparaba sobre el **peso de cálculo del modelo** y los campos de abajo corren
sobre el **peso meta**, sin que nada lo dijera. Eran 1.631 kcal y 85 g arriba contra 1.529 y 78 abajo.

**Mantuve la comparación sin ajustes y le puse el dato al texto.** Ahora, cuando los dos pesos difieren,
dice sobre cuál compara y sobre cuál corren los campos de abajo. Cuando no hay peso meta fijado, esa
aclaración no sale, porque ahí sería ruido.

**Míralo en el caso 1** (`/evaluaciones/a0000000-0000-4000-8000-0000000000a3`, que tiene peso meta 60): la
frase larga tiene que aparecer con los dos pesos. **Y en un paciente sin peso meta**, la frase corta.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
