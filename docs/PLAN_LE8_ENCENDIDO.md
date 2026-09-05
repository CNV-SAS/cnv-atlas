# Plan: encender el LE8 (`LE8_MAPEO_CORREGIDO`)

**Para Santiago. 2026-09-05. APLICADO en local, salvo la medicion de la nube y P-109.** Las tres piezas
estan portadas, el candado esta verde y la version subio a `anibise-1.3.0`. Lo que falta va marcado.

Su instrucción del 5 de septiembre: *"El ICEC se activa tal cual se envió. Esa es la directriz vigente y
con ella se cierra el punto."* La nota del 30 de agosto que nos frenó era prudencial, escrita sin
analizar un caso, y quedó superada por la medición del 2 de septiembre. Su archivo tiene el interruptor
en `true`; Atlas en `false`. **Esto deja de ser divergencia y pasa a ser porte pendiente** (DIV-2).

Y una advertencia que gobierna todo el plan: **este porte puede parecer hecho y no estarlo.** Por eso el
paso 1 no es el porte, es la prueba.

---

## 0 · Lo que cambia, en una línea

Dos de los ocho dominios del LE8 dejan de estar clavados:

| Dominio | Hoy (apagado) | Encendido |
| --- | --- | --- |
| **Alimentación** | Lee `d1_9` y `d1_10`, que **no existen** en nuestra encuesta. Da **30 para todo el mundo** | `calcPatron(enc).score`, 0-100, sobre la matriz de frecuencia de 15 grupos |
| **Hidratación** | Lee `d1_16`, que **no existe**. Da **20 para todo el mundo** | `d7_agua` (vasos de 200 ml): 8 o más da 100, 6 o más da 75, 4 o más da 50, el resto 20 |

El ICEC es el promedio de los ocho, así que puede moverse hasta unos 20 puntos. Y de ahí cuelgan, en
cascada: **EB-BIS, IAE, los dominios 3 y 5 del DFI con su severidad, el riesgo integrado y las rutas R4
y R5.** Para todo paciente.

---

## 1 · PRIMERO la prueba, y por qué va primero

**El riesgo real de este porte no es romper algo: es que quede a medias sin que nada avise.** Hay cuatro
estados posibles y tres de ellos se ven parecidos:

| Estado | Alimentación | Hidratación |
| --- | --- | --- |
| **A · hoy** (flag en `false`) | 30 constante | 20 constante |
| **B · flip solo** (`calcPatron` fuera de ámbito, cae al `catch`) | **30 constante** | valor real |
| **C · flip + import, sin adaptador** (le llega el TEXTO, no el ordinal) | **10 constante** | valor real |
| **D · correcto** | score real, distinto por paciente | valor real |

El estado **C es el peligroso**: `calcPatron` no revienta con texto, simplemente ninguna comparación
`v >= 3` se cumple y el score sale `0 + 10 = 10` para todos. Mirando un solo paciente, un 10 se lee como
"dieta deficiente" y no como "el porte está mal".

### El candado, con su control

Un golden con **dos fixtures que difieren SOLO en la matriz de frecuencia**:

- **P-alto:** los 7 grupos protectores en "Todos los días", los 4 de riesgo en "Nunca".
- **P-bajo:** los protectores en "Nunca", los de riesgo en "Todos los días".

Y cuatro aserciones:

1. **Alimentación de P-alto por encima de 60** y **de P-bajo por debajo de 30**. En A y B las dos dan 30
   y sale rojo. En C las dos dan 10 y sale rojo. Solo D pasa.
2. **El control: los dos valores tienen que ser DISTINTOS entre sí.** Sin esto, un helper que devuelva
   una constante cualquiera dentro del rango podría pasar. (Es la regla de
   `asercion-negativa-necesita-control`.)
3. **Las dos cifras exactas, derivadas A MANO** de la tabla de puntuación de `calcPatron` (protectores
   +10/+8/+5/+2, riesgo -10/-7/-4/-1, neutros +3, base +10), **nunca pegadas de la salida**.
4. **Hidratación:** un fixture con `d7_agua = 8` da 100 y otro con `2` da 20. En A los dos dan 20 y sale
   rojo.

Y dos aserciones de mecanismo, que son baratas:

5. El archivo **generado** (`engine.dfi.authorized.js`) contiene `LE8_MAPEO_CORREGIDO = true` y el
   **original** sigue en `false`, byte-idéntico a su archivo.
6. El manifiesto declara las dos modificaciones. El test byte-exacto que ya existe hace el resto: un
   flip a mano, sin pasar por el manifiesto, sale rojo.

**Este candado se escribe ANTES de tocar el motor, y tiene que salir ROJO antes de empezar.** Un candado
que nace verde no prueba nada.

---

## 2 · Las tres piezas

### Pieza 1 · El adaptador del patrón, que va FUERA del frozen

`calcPatron` lee `enc.d1_N_i` como un número **0-4**; Atlas guarda el **texto** de la opción
("Nunca", "1-2 días", ...). El resolutor ya existe y está probado: `clinical-engine/patron.ts`, que
resuelve contra los textos canónicos del frozen (`FREQ_OPC`) y no contra el orden de la base.

**No se modifica `calcLE8` para que entienda texto.** Se le entrega el `enc` en la forma que espera:

- Se exporta un helper puro desde `patron.ts`: `ordinalesPatron(enc)`, que devuelve los 15 grupos
  resueltos a su ordinal y omite los que no se pudieron leer.
- En `analizarDFI` (`clinical-engine/analysis.ts`), la llamada pasa a
  `dfi.calcLE8({ ...enc, ...ordinalesPatron(enc) })`.

**Verificado que es seguro:** dentro de `engine.dfi`, los campos `d1_*` **solo los lee `calcLE8`**
(`computeDFIFromData` no los toca), así que enriquecer ese `enc` no mueve nada más. Y se hace en la
llamada, no en el `survey` global, para no cambiarle la forma a los otros consumidores
(`generarAlertas` usa su propio `encDesdeRespuestas`; el display del patrón usa su propio resolutor).

### Pieza 2 · La marca de `d7_agua`, y una decisión que hay que tomar

`d7_agua` **sí fluye**: es de tipo `contador`, así que la respuesta se guarda como "6" y `Number()` la
lee bien. No hay problema de forma.

**El problema es la marca.** Está declarada `treatmentEngine`, así que su `used_in_diagnosis` es
`false`. Lo mismo pasa con los 15 grupos del patrón (`patternEngine`). Y `used_in_diagnosis` es lo que
`pipeline-reader` usa para armar `expectedFieldKeys`, contra la que se mide `dfi.complete`.

**Consecuencia al encender: dieciséis campos pasan a alimentar el diagnóstico y ninguno cuenta para la
completitud del diagnóstico.** Un paciente que no respondiera la matriz obtendría un score de 10
("Deficiente") sobre respuestas que no dio, y el sistema diría que los insumos están completos. Es
exactamente el defecto que su propia instrucción CA-3 mandó cerrar (*"que distinga 'el paciente
respondió 0' de 'el paciente no respondió'"*), reabierto por otra puerta.

**Hoy no es alcanzable** (el gate de generación exige la encuesta entera completa, las 64), así que no
hay un defecto en producción. Pero la marca quedaría mintiendo, y es la clase de cosa que muerde cuando
alguien afloja el otro gate.

**DECIDIDA por Santiago el 2026-09-05: la (a), y el alcance es solo la v6.** Su razón: dejar una
marca falsa esperando es lo que ya nos mordió varias veces, y aquí además reabre por otra puerta el
defecto que su CA-3 mandó cerrar. Las evaluaciones anteriores se emitieron bajo su propia declaración y
se quedan con ella.

| Opción | Qué implica |
| --- | --- |
| **(a) Corregir la marca** (recomendada) | Una data-migration que pone `used_in_diagnosis = true` en los 16 campos. **No cambia el instrumento**: ni el texto, ni las opciones, ni las respuestas. Solo declara qué lee el motor. Hay que decir explícitamente **a qué versiones alcanza** (propongo: solo la v6, la vigente; las evaluaciones anteriores se emitieron bajo su propia declaración y se quedan con ella) |
| **(b) Dejarla** | Queda una marca falsa y un hueco esperando. Se documenta como divergencia con su razón |

### Pieza 3 · El flip, por el mecanismo

`engine.dfi.js` no se edita: se añaden **dos entradas al manifiesto**
(`frozen/authorized-modifications.js`) y se regenera con `node scripts/gen-authorized.cjs`.

- **CA-N · el flip.** `const LE8_MAPEO_CORREGIDO = false;` pasa a `true`. Instrucción verbatim del
  2026-09-05, con la fecha de la decisión (2 de septiembre) y la cita completa.
- **CA-N+1 · el `require`.** Añadir `calcPatron` a la línea de imports del núcleo. **Esto no es una
  modificación clínica**, es reparación de ámbito: en su archivo todo vive en un solo scope y en el
  nuestro son módulos. Se declara así, con esas palabras, porque el propio manifiesto avisa que garantiza
  trazabilidad y no corrección clínica.

Y **hay que actualizar CA-3**, cuyo texto de alcance dice hoy *"con `LE8_MAPEO_CORREGIDO=false` (estado
vigente)... esos dos dominios corren en default SIEMPRE"*. Deja de ser cierto en el mismo commit.

---

## 3 · La medición del efecto: HECHA en local el 2026-09-05

**Falta la de la nube, y es la que manda.** Ver el final de esta sección.

Se midió de DOS formas, y hacen falta las dos:

- **Aislada:** se calcula el LE8 de hoy y se reconstruye por aritmética exacta el ICEC que habría dado
  con el interruptor apagado (los dos dominios afectados vuelven a sus constantes, 30 y 20; los otros
  seis no los toca el interruptor). Así el delta es del LE8 y de nada más.
- **Contra lo sellado:** snapshot contra recomputado de hoy, que es lo que de verdad dispara la
  reemisión. Ese delta **mezcla** el LE8 con los bumps anteriores (hay diagnósticos sellados con 1.0.0 y
  1.1.0), así que no sirve para contrastar su cifra.

### Lo aislado, que es lo que se contrasta con su anuncio

| | |
| --- | --- |
| Evaluaciones comparables | 42 |
| Se les mueve el ICEC | **7** |
| La EB-BIS baja | entre **0,6 y 5,4 años** (media 1,46) |
| Dirección | **siempre hacia abajo**, en las siete |
| Cruzan banda de IAE por el LE8 solo | **0** |

**Coincide con lo que él anunció** ("baja entre 1 y 8 años, más cuanto más sano esté el paciente"):
siempre baja, y el máximo (5,4) queda dentro de su rango. **No hay discrepancia, así que no hay que
parar.**

### Y por qué solo 7 de 42, que es lo importante de esta medición

No es que el cambio sea pequeño. Es que **los datos locales están sembrados**. La distribución de los
dos dominios nuevos, sobre las 42:

| Alimentación / Hidratación | Casos |
| --- | --- |
| **30 / 20** | **35** |
| 42 / 20 | 4 |
| 15 / 50 | 2 |
| 45 / 75 | 1 |

En 35 de 42 los dos dominios caen **exactamente sobre las constantes viejas**, porque el sembrado
responde la matriz con un patrón fijo que puntúa 30 y deja el agua en el tramo de 20. En esos casos el
ICEC no se mueve, y eso es un artefacto del seed, **no una propiedad del cambio**.

**En pacientes reales, con dietas e hidrataciones distintas, se va a mover mucho más.** Por eso la
medición de la nube no es una confirmación de trámite: es la que decide.

### Contra lo sellado (lo que va a disparar en pantalla)

| | |
| --- | --- |
| Diagnósticos | 61 (13 confirmados) |
| Recomputables | 45 |
| Cambia la banda de IAE | 3 |
| Cambia la severidad del dominio 3 | 3 |
| Cambia la severidad del dominio 5 | **7** |
| Cambia el riesgo integrado | 6 |
| Cambian las rutas | 3 |
| **Veredicto `reemision-obligatoria`** | **12** |
| ...de ellos, en diagnósticos **confirmados** | **5** |

**El mecanismo dispara**, que era la verificación obligatoria. Y dispara por donde el plan predijo: no
por la EB-BIS (que no tiene clasificación), sino por el IAE, por los dominios 3 y 5 y por el riesgo.

Una coincidencia que vale la pena mirar: **los 7 a los que se les mueve el ICEC son 7, y 7 son los que
cambian severidad en el dominio 5.** Es la cascada funcionando, aunque las dos cifras salen de
mediciones distintas y no se puede afirmar que sean los mismos siete sin cruzarlos uno a uno.

## La medición de la nube: por qué la dirección MIXTA no es un defecto

**Medido en la nube el 2026-09-05:** 23 comparables, el ICEC se mueve en las 23, la EB-BIS entre 0,6 y
9,6 años, dirección **MIXTA**, una banda de IAE cambiada. Contra lo sellado: 9 reemisiones obligatorias,
4 en confirmados.

Se cumplían las dos condiciones de parada que se habían escrito (más de 8 años, y dirección mixta cuando
él dijo que siempre baja). **Se paró y se verificó. La conclusión es que el porte está bien y su cifra
describía el caso típico.** La razón es aritmética, no interpretativa.

### La aritmética, que es lo que decide

`computeEBBIS` lleva el término `-7.982 · z(ICEC, 58.578, 13.332)`, así que **un punto de ICEC son
-0,5987 años**. El ICEC es el promedio de ocho dominios, luego **un punto de (Alimentación +
Hidratación) son -0,0748 años**.

El valor fijo viejo era **Alimentación 30 + Hidratación 20 = 50**. Entonces:

> **La edad BAJA si la suma real supera 50, y SUBE si no llega.**

No es una tendencia: es una identidad. Encender el interruptor sustituye una nota fija por la real, y una
sustitución así **tiene que mover en las dos direcciones**. Quien come e hidrata mejor que ese 50 se
rejuvenece; quien lo hace peor envejece, **porque el valor fijo lo estaba favoreciendo**.

| | Suma real | Efecto |
| --- | --- | --- |
| **Máximo que puede BAJAR** | 200 (100 + 100) | **-11,23 años** |
| **Máximo que puede SUBIR** | 20 (0 + 20) | **+2,25 años** |

**De ahí salen las dos respuestas:**

- **Los 9,6 años son de los que BAJAN.** La subida no puede pasar de 2,25 por construcción, así que un
  9,6 solo cabe del lado del descenso: necesita una suma cercana a 178 de 200, o sea un paciente con muy
  buena alimentación e hidratación. **Es el caso que él mismo describió** al escribir *"más cuanto más
  sano esté el paciente"*.
- **Su "entre 1 y 8" era un rango típico, no un límite.** El máximo aritmético es 11,23; su 8 se queda
  corto en la cola, que es justamente el paciente más sano.

**Nada de esto invalida el porte.** Lo que invalida es la lectura de su frase como una ley universal:
dijo *"bajaría la edad de TODOS los pacientes"*, y eso solo es cierto si la alimentación e hidratación
reales de todos superan 50.

### El caso que se ve IGUAL y sí sería defecto

Hay una forma de subir la edad que **no** es la corrección funcionando: un paciente cuya **matriz de
frecuencia no esté respondida**. `calcPatron` sobre un enc vacío da **10**, y sin `d7_agua` la
hidratación cae a **20**: suma 30, y la edad sube **+1,50 años exactos** sobre datos que el paciente
nunca dio. Es el defecto que su CA-3 mandó cerrar, entrando por la puerta del que no respondió.

**Por eso la medición ahora desglosa la dirección** y, de los que suben, cuenta cuántos respondieron la
matriz y si el agua llegó. La lectura:

| Lo que sale | Qué significa |
| --- | --- |
| Suben, con matriz y agua completas | **La corrección funcionando.** Su nota real es peor que el fijo viejo |
| Suben, con `sinMatrizRespondida > 0` | **DEFECTO.** Se les está moviendo la edad sobre datos fabricados |
| `porEncimaDelTopeAritmetico > 0` | La reconstrucción del ICEC apagado no es la que se supone. Parar |
---

## 4 · Los diagnósticos confirmados, y si el mecanismo dispara

Su regla: *"reemisión obligatoria si el paciente cambia de banda, y aviso cuando le cambie el
tratamiento."*

**El mecanismo existe y está cableado:** `veredictoDeReemision` (comparación sellado contra recomputado)
se invoca desde `results-reader` cuando hay desfase de versión, y `avisarAlPaciente` decide el aviso. Un
bump de `ENGINE_VERSION` produce el desfase, así que el disparo es automático.

**Pero hay que decir con precisión POR QUÉ dispararía, porque no es por donde parece.**
`veredictoDeReemision` compara tres cosas: las clasificaciones por indicador, el riesgo integrado del DFI
y la severidad de cada dominio. **La EB-BIS NO tiene clasificación**: en el snapshot va como
`EB: null`, decisión ya tomada (D-010/D-011: no se rotula como edad fisiológica). Así que **un cambio de
EB-BIS, por sí solo, NO dispara la reemisión.**

Lo que sí dispara:

- **IAE**, que sí tiene clasificador (`cIAE`) y sale de la EB-BIS menos la edad. Si la EB-BIS se mueve
  entre 1 y 8 años, el IAE se mueve igual y su banda puede cruzar.
- **Los dominios 3 y 5** del DFI, por severidad.
- **El riesgo integrado**, si alguno de esos dos lo arrastra.

**Verificación obligatoria del paso 3, y es la que pediste:** que al menos un paciente real con cambio
de EB-BIS produzca de verdad un veredicto `reemision-obligatoria`. **Si la EB-BIS se mueve y ningún
paciente dispara, eso es un hallazgo, no un alivio**: querría decir que la cascada se corta en algún
sitio y que el cambio pasa invisible. En ese caso se para y se reporta.

**Hoy la reemisión es barata**, y por eso el momento es este: no hay pacientes reales atendidos. (Local
hay 1 tratamiento aprobado, que es dato de prueba; **el conteo que decide es el de la nube** y se hace en
el paso 3.)

---

## 5 · El bump de versión

`ENGINE_VERSION` sube de **`anibise-1.2.0` a `anibise-1.3.0`**, y **no se folda** en la anterior: cambia
salidas clínicas para todo paciente, que es el criterio con el que subieron 1.1.0 y 1.2.0.

La entrada de historia en `version.ts` lleva escritas las cifras que se mueven, no una descripción vaga:
los dos dominios del LE8 que dejan de estar clavados, el ICEC, la EB-BIS, el IAE, los dominios 3 y 5 del
DFI, el riesgo integrado y las rutas R4 y R5. Y la razón por la que sube: **para que la comparación de
bandas de su punto 12b pueda dispararse.** Sin el bump no hay desfase, y sin desfase el mecanismo de
reemisión no corre.

`PROTOCOL_ENGINE_VERSION` **no sube**: la cadena calórica no lee el ICEC.

---

## 6 · P-109, que va con este porte

Su punto 3 no era solo el panel: *"lo que se escriba fuera del rango queda en la historia clínica con el
rango, la condición y la razón"*. Portamos el panel y no la constancia.

Su archivo (L15622-15648) arma `_desv` con `asesoriaFuera` sobre la proteína y la grasa **prescritas** y,
si hay algo, pinta en la HC el bloque **"DECISIÓN DEL PROFESIONAL. CIFRAS FUERA DE LA REFERENCIA"**. En
Atlas ese bloque no existe: el aviso vive en la pantalla de tratamiento y no deja rastro.

Va en este bloque, después del porte del LE8 y antes del cotejo. Es chico: los datos ya se computan
(`getAsesoriaMacros` ya devuelve `fuera`); falta llevarlos a `historia-clinica.tsx` y a `hc-document.tsx`
(pantalla y PDF, los dos), y el candado sobre el sitio de llamada.

---

## 7 · Orden, y criterio de aceptación

1. **El candado primero**, y verlo rojo.
2. Pieza 1 (adaptador) y pieza 3 (manifiesto y regenerar). El candado pasa a verde.
3. **Medir** contra local y contra la nube. Escribir las cifras aquí. **Si aparece algo inesperado,
   parar.**
4. Pieza 2: la data-migration de la marca, solo sobre la v6 (decidida, ver arriba).
5. Bump de `ENGINE_VERSION` con las cifras escritas.
6. Verificar el disparo de la reemisión en un paciente real.
7. P-109.
8. `pnpm verify` completo. Los goldens que se muevan **se re-derivan a mano**, nunca se pegan de la
   salida.

**Criterio de aceptación:** el candado del paso 1 en verde, las cifras del paso 3 escritas en este
documento, y al menos un `reemision-obligatoria` demostrado. **Y el cotejo final va DESPUÉS**, no antes:
hacerlo ahora sería hacerlo dos veces.

---

## 8 · Lo que NO se toca

- **La mu y la sigma se quedan en 58,578 y 13,332.** Él lo dice con todas las letras: no están
  pendientes de firma, están **bloqueadas por ausencia de dato** (el ICEC sale de la encuesta y ninguna
  fuente disponible la trae). Se recalibra cuando haya masa de pacientes con encuesta completa. Y
  reconoce que esas dos constantes **tampoco tienen origen documentado**, y que la v5 necesita su
  documento técnico: trabajo suyo, que no condiciona el porte pero sí sostiene el candado.
- **El original `engine.dfi.js` no se edita.** Sigue byte-idéntico a su archivo.
- **El instrumento no se toca.** La encuesta se queda en v6. La opción (a) de la pieza 2, si se aprueba,
  es una data-migration de metadatos: no cambia ni una pregunta, ni una opción, ni una respuesta.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
