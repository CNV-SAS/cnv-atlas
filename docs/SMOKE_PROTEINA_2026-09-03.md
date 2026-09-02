# Smoke: la proteína la prescribe el motor (2026-09-03)

**Qué cambió, en una línea.** La cadena calórica dejó de calcular la proteína con el mínimo poblacional
de `motorProtocolo` (base 0,8 g/kg) y pasa a usar la que prescribe `motorTratNutri` (base 1,0, con sus
ramas). Es la §9.6 punto 4 de Gildardo, respondiendo una divergencia que le reportamos.

**Por qué hay que verlo en el navegador y no basta con los tests.** Los tests prueban que la cifra sale
bien. Lo que no pueden ver es si la pantalla se entiende: son 56 de 60 tratamientos los que cambian, y
uno de los avisos va a aparecer en casi todos por primera vez.

**Antes de empezar:** `pnpm dev`. Los cuatro casos son evaluaciones que ya existen en tu base local.

---

## Caso 1 · La proteína sube, y el aviso de desfase aparece

**Abre** `/evaluaciones/a0000000-0000-4000-8000-0000000000a3` y baja al bloque **Cadena calórica**.

**Qué tiene que pasar:**

1. **La proteína ya no dice 0,8 g/kg.** El paciente es fenotipo F5, 65,4 kg. La cifra que salga es la que
   prescribe el motor para su composición; lo que importa es que **no sea 0,8**.
2. **El bloque de arriba (la prescripción del modelo) y la cadena dicen el MISMO número.** Ese es todo el
   punto del cambio: antes decían 1 g/kg y 0,8.
3. **Aparece el aviso de desfase**, con este texto: *"Esta cadena se selló con una versión anterior del
   modelo (...), y con el de hoy las cifras del modelo no dan lo mismo: la proteína, N g en vez de M.
   Lo sellado sigue siendo válido para la fecha en que se emitió. Los campos de abajo ya usan el modelo
   de hoy."*

**Lo que te pido que juzgues, que es lo que ningún test puede:**

- **¿Se entiende sin explicación?** Es la primera vez que este aviso dispara, y va a estar en casi todos
  los pacientes que abras.
- **El recuadro es GRIS, no ámbar.** Lo cambié a propósito: una franja de alerta en 56 de 60 pacientes no
  comunica "revisa esto", comunica "algo se rompió". **Si te parece que gris lo esconde demasiado, se
  vuelve ámbar**, es una línea.
- **¿Las dos cifras se leen bien?** Dice los gramos al día, no los g/kg.

---

## Caso 2 · La desnutrición, que NO se debe mover

**Abre** `/evaluaciones/a0000000-0000-4000-8000-0000000000f2`.

Fenotipo **F10**, 43,7 kg, talla 155 (IMC 18,2). Tiene sellado `protMin` **1,5**.

**Qué tiene que pasar: la proteína sigue en 1,5 g/kg (unos 66 g/día).** Las dos vías coinciden aquí, y
por eso este caso es el control: si esta cifra se movió, el cambio tocó algo que no debía.

Es el perfil donde una proteína equivocada haría más daño, así que **si ves cualquier otro número,
párate y avísame antes de seguir.**

---

## Caso 3 · La insuficiencia renal, que SÍ se mueve, y poco

**Abre** `/evaluaciones/a0000000-0000-4000-8000-0000000000f4`.

Fenotipo F10 con **insuficiencia renal declarada**, mismo peso (43,7 kg).

**Qué tiene que pasar: la proteína pasa de 0,6 a 0,7 g/kg** (de unos 26 a unos 31 gramos al día).

**Las dos cifras son de Gildardo, no nuestras:** `motorProtocolo` devuelve 0,6 para cualquier IRC (el
extremo inferior del rango) y la rama renal de `motorTratNutri` fija 0,7 declarando el rango *"proteína
controlada 0,6-0,8 g/kg"*, o sea su punto medio. Su §9.6 dice cuál manda.

**Verifica también** que el bloque de la prescripción siga mostrando los atributos renales
("Nefroprotectora", el sodio máximo).

---

## Caso 4 · Que el ajuste del profesional siga ganando

En cualquiera de los tres, **escribe un valor a mano en Proteína (g/kg)** (por ejemplo 1,1) y guarda.

**Qué tiene que pasar:**

1. Los gramos al día se recalculan con tu número.
2. **No aparece ningún aviso diciéndote que el modelo prescribe otra cosa.** Ese aviso existía y lo
   retiré: advertir sobre la cifra que acabas de escribir es justo lo que él prohibió en su §5 del 27 de
   agosto ("ninguna cifra de la prescripción lleva techo, piso, validación ni advertencia").
3. Bórralo y guarda otra vez: vuelve la del motor.

---

## Lo que este smoke NO puede probar, y hay que decirlo

**Los 60 tratamientos de tu base son de la forma ANTERIOR**, o sea que reciben la proteína del motor
calculada al vuelo (`protFuente: "motor"`). La rama de la cifra **sellada** solo se ejercita en una
evaluación diagnosticada DESPUÉS de este cambio.

**Si quieres cubrirla:** haz un diagnóstico nuevo completo y abre su tratamiento. La cifra tiene que ser
la misma; lo que cambia es de dónde sale, y eso no se ve en pantalla.

---

## Y una cosa que verifiqué mal y quedó registrada

Al medir el impacto contra la base, mi script le pasó al motor un `bis` **sin peso ni talla** (el snapshot
del reporte no los trae), así que el motor usó sus propios defaults (70 kg / 170 cm) y me devolvió 1,0 para
todos. Con eso "medí" que al paciente F10 le bajaba la proteína de 1,5 a 1,0, y era falso: con sus datos
reales da 1,5.

**El motor no falla cuando le falta el insumo: contesta.** Queda como caso de prueba con nombre propio
(`CONTROL NEGATIVO` en `proteina-la-prescribe-el-motor.test.ts`) para que la próxima medición no repita la
trampa.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
