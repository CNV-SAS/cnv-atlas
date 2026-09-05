# Smoke del encendido del LE8

**Para Santiago. 2026-09-05.** Cambió el **motor**, y cambia cifras para todo paciente. Esto no es
opcional: los tests prueban que el cálculo es el correcto, no que la pantalla lo muestre bien.

**Antes de empezar:** `pnpm db:migrate` en local (ya está aplicada; si sales de una rama limpia, corre
`pnpm db:check` y confirma que dice "al día"). No hace falta re-sembrar.

---

## Lo que cambió, en una tabla

| Dónde | Antes | Ahora |
| --- | --- | --- |
| **Alimentación** (1 de los 8 del LE8) | **30 fijo para todo el mundo**: leía dos campos que solo existen en el prototipo de Gildardo | Sale de la matriz de frecuencia de alimentos: 0 a 100 |
| **Hidratación** | **20 fijo para todo el mundo**, por lo mismo | Sale de "Agua (vasos de 200 ml por día)" |
| **ICEC, EB-BIS, IAE** | Calculados sobre esos dos valores clavados | Sobre lo que el paciente respondió de verdad |
| **Dominios 3 y 5 del DFI, riesgo integrado, rutas R4/R5** | Igual | Se mueven con el ICEC |

**Medido antes de aplicarlo:** donde los dos dominios se apartan de los valores viejos, la edad
biológica **baja entre 0,6 y 5,4 años**, siempre hacia abajo. Es lo que él anunció.

---

## Recorrido 1 · Que el LE8 ya no está clavado

**Es el que importa: verifica que el porte se aplicó de verdad y no solo lo parece.**

1. Coge **dos** pacientes con encuesta completa y diagnóstico, con **dietas distintas** (uno que coma
   verduras y frutas a diario, otro que casi no).
2. Abre el diagnóstico de cada uno y ve al **dominio 5, Epigenético-Contextual**.

**Qué tienes que ver:**

- La línea del dominio dice **`ICEC/LE8 <número>`**, y **el número es DISTINTO entre los dos pacientes**.
- Si además tienen hidratación distinta, la diferencia es mayor.

**Sería defecto si:**

- **Los dos dan el mismo número.** Eso es el porte a medias, y es la razón de todo el cuidado: puede
  verse perfectamente normal y estar mal.
- El ICEC sale **muy bajo en los dos** (por debajo de 40 con encuestas normales). Eso es el otro estado
  a medias: al motor le llegaría el texto de la opción en vez de su posición, y todos los pacientes
  saldrían con "dieta deficiente".

---

## Recorrido 2 · Que el agua llegó

1. En **la misma evaluación**, entra a **Ver o editar encuesta** y mira la respuesta de
   **"Agua (vasos de 200 ml por día)"**.
2. Vuelve al diagnóstico y mira el ICEC.
3. Cambia el agua a **8 vasos**, guarda, y vuelve a mirar.

**Qué tienes que ver:** el ICEC **sube**. De 2 vasos a 8 el dominio de hidratación pasa de 20 a 100, que
sobre ocho dominios son **10 puntos** de ICEC.

**Sería defecto si:** el ICEC no se mueve al cambiar el agua. Ese campo era el que no llegaba.

---

## Recorrido 3 · La reemisión, que es lo que protege a los pacientes ya atendidos

**Este es el que verifica el mecanismo, no el cálculo.** Y tiene DOS desenlaces, los dos buenos.

### El aviso gris, que NO es un defecto

Si el paciente **no cambió de banda**, sale el aviso de que el diagnóstico se emitió con una versión
anterior **y que la clasificación no cambia**, sin lista. **Ese es el desenlace correcto**, y es su regla
del §12c en pantalla: *"no se alarma a nadie por un decimal"*. Un cambio de versión que no mueve ninguna
banda se registra y no se reemite.

Así que ver el gris cierra media verificación. Falta la otra mitad.

### El ámbar con la lista, y en cuál mirarlo

Sin decir cuál abrir, este recorrido no se puede cerrar: hay que buscar a ciegas. **En la base local, de
los doce que piden reemisión, el más completo es:**

```
a0000000-0000-4000-8000-0000000000c4     (confirmado)
```

Cambian siete cosas: **AF, IAE, IR, PABU, Riesgo integrado, Envejecimiento (dominio 3) y
Epigenético-Contextual (dominio 5)**.

Otros dos confirmados que también sirven: `...0000000000a3` y `...0000000000a2` (este último mueve solo
AF, IR y PABU, sin IAE ni dominios).

**Para sacar la lista en la nube**, o si estos ya se movieron, corre la medición: imprime `cuales` con el
id de cada evaluación que pide reemisión y qué le cambia.

**Qué tienes que ver en el ámbar:**

- La lista de qué cambió, **antes y ahora**, por indicador o por dominio.

**Sería defecto si:**

- **No sale ningún aviso** en una evaluación vieja. Sin el aviso, el cambio pasa invisible en los
  diagnósticos ya emitidos, que es lo que su regla del §12b existe para evitar.
- Sale el aviso pero **la lista está vacía en una de las de arriba**, donde sabemos que sí cambió.

**Y una cosa que conviene saber para no leerlo mal:** la **EB-BIS no dispara la reemisión por sí sola**,
porque no lleva clasificación en el snapshot (es decisión vieja, D-010/D-011: no se rotula como edad
fisiológica). Lo que dispara es el **IAE**, los **dominios 3 y 5** y el **riesgo integrado**. Así que
puedes ver una edad biológica que se movió sin que eso, solo, pida reemisión.

---

## Recorrido 4 · Que no se rompió lo que ya funcionaba

**CORREGIDO el 2026-09-05: como estaba escrito, este recorrido no se podía hacer.** Decía "abre una
evaluación con la encuesta incompleta", y eso hoy **no existe como camino**: desde el 2026-08-13 el
sistema **bloquea generar un diagnóstico con la encuesta incompleta** (gate 2bis-b), así que una
evaluación incompleta no tiene diagnóstico, y sin diagnóstico no hay pantalla donde mirar el ICEC.

El estado de suspensión Q28 **sigue existiendo**, pero solo en snapshots **sellados antes de ese gate**.
En la base local hay **cuatro**:

```
a0000000-0000-4000-8000-0000000000d5      (faltan 10 campos)
a0000000-0000-4000-8000-0000000000d3      (faltan 10)
1e7c2f74-1b89-4b60-bdb9-0ed925862966      (faltan 10)
b039e751-2402-490c-9b96-f7248950e8b0      (faltan 12)
```

1. Abre **una de esas cuatro**.

**Qué tienes que ver:** sigue el aviso de suspensión y **el ICEC de arriba sigue sin emitirse** (Q28: lo
que depende de la encuesta no se emite si está incompleta). El desglose del dominio 5 sí muestra su ICEC
provisional, como antes.

**Sería defecto si:** el ICEC de arriba **empieza a emitirse** en una de esas cuatro. El interruptor no
toca la suspensión.

2. Y en una evaluación normal, que **el resto del diagnóstico no se movió**: IFC, IRC, PABU, el fenotipo
   estructural y el sector FyR salen igual que ayer. El interruptor solo toca la cadena del ICEC.

---

## Lo que falta, y te toca a ti

**La medición contra la nube.** Aquí solo se midió en local, y los datos locales están sembrados: en 35
de 42 evaluaciones los dos dominios caen justo sobre los valores viejos, así que el ICEC no se mueve.
**Eso es artefacto del seed, no una propiedad del cambio.**

Apuntando `DATABASE_URL` a la nube, corre la medición y pásame las cifras:

```
pnpm vitest run --project db src/tests/medicion-efecto-del-bump.test.ts --reporter=verbose
```

Busca la línea que empieza por `MEDICION_LE8`. Imprime solo agregados (conteos y promedios), nunca un
dato de paciente.

**Si allá sale algo distinto de lo que él anunció** (un cambio mayor a 8 años, o alguno que **suba** la
edad en vez de bajarla), **para y avísame**: su cifra sale de su propia medición sobre registros reales,
así que una discrepancia grande significaría que algo no coincide.

---

## Y cuando pushees

**La migración no se despliega sola.** Corrige lo que decía esta nota: anunciaba **dos** (0099 y 0100),
y era cierto al escribirla. Para cuando Santiago corrió `db:check:cloud`, la **0099 ya estaba aplicada**
del bump de la encuesta del día anterior, así que la nube solo pedía la **0100** (los dieciséis campos
que pasan a insumo del diagnóstico). **Que apareciera una y no dos es correcto, no un hueco.** Contra la
nube:

```
pnpm db:check:cloud      # 101 en el repo; lo pendiente sale listado
pnpm db:migrate
pnpm db:types
```

**Hasta que corras eso**, la nube corre sin la marca corregida. Al terminar, `db:check:cloud` tiene que
decir **101 en el repo y 101 aplicadas**.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
