# ATLAS v11 contra Atlas, punto por punto

**Qué se revisó:** `ATLAS_v11.html` (24.275 líneas) y su documento
`ATLAS_v11_PENDIENTES_para_Santiago.md` (29 de septiembre de 2026), contra el código de Atlas y contra la
nube de producción.
**Fecha:** 2026-10-24 · **Para:** Santiago · **Pedido:** mismo ejercicio que el v10, con más cuidado,
separando lo que decide Gildardo de lo que decidimos nosotros.

---

## Lo primero, porque cambia cómo se lee el resto

**El documento dice "no se tocó el motor clínico", y es cierto en el sentido estricto: ningún coeficiente,
umbral ni clasificación cambió.** Pero sí hay cuatro frentes con contenido científico, y tenía razón en
pedir que los mirara con lupa: la cascada de macros, el ICN, el espectro y la seudonimización. Los cuatro
están abajo, verificados contra el código, no contra el documento.

**Y el hallazgo que importa más no está en su lista.** Su módulo CNVResearch **exporta todos los pacientes
de la base, sin mirar el consentimiento**. Lo verifiqué abriendo el HTML: en las 385 líneas del motor no
aparece una sola vez la palabra consentimiento, investigación ni autorización. En su HTML eso no se nota,
porque el consentimiento del HTML no tiene casilla de investigación (las cinco declaraciones son
obligatorias). **En Atlas sí se nota: de 402 pacientes, 53 NO autorizaron el uso de sus datos para
investigación.** O sea que el mismo export, corrido sobre Atlas, sacaría 53 personas que dijeron que no.
Esa compuerta tiene que existir antes de que se genere el primer dataset, y es la primera cosa que hay que
construir cuando se retome. Ver §B2.

---

## El cuadro completo

**Ciencia (C) = decide Gildardo, Regla 0. Software (S) = decidimos nosotros.**

| # | Frente del v11 | Capa | Veredicto en Atlas |
|---|---|---|---|
| 1 | Cascada de macros y `_sintMacro` | C | **Ya existe, y es el port fiel de su fórmula viva.** Ver §A1 |
| 2 | ICN visible e imprimible | C | **Mitad hecha.** Visible y sin reja de profesión; no está en ningún documento imprimible. Ver §A2 |
| 3 | Impresión en todas las páginas | S | **No aplica.** Atlas tiene documentos diseñados, no impresión de pantalla. Ver §B4 |
| 4 | Guardado automático | S | **Parcial, y lo que falta falta a propósito.** Ver §B3 |
| 4.1 | Riesgo de duplicar la consulta del día | S | **No aplica.** La clave es la evaluación, con restricción única |
| 5.1 | Espectro Z5-Z500 | C | **Ya existe, completo: 403 de 403 mediciones, todas medidas.** Ver §A3 |
| 5.2 | Código de paciente y seudonimización | C+S | **Superado en el mecanismo; su nota legal SÍ aplica y encontró una columna mal rotulada.** Ver §A4 y §B1 |
| 5.3 | Los anexos viajan a la nube | S | **No aplica.** Todo vive en Postgres desde el principio |
| 5.4 | El disparador de sincronización | S | **No aplica.** No hay sincronización que disparar |
| 6 | Módulo CNVResearch | S | **El export es nuevo. La separación ya es real, no pintada.** Ver §B2 |
| 6.3 | El paginado de mil en mil | S | **Ya resuelto**, y es patrón del repositorio |
| 9 | Supabase Auth | S | **Ya existe.** Es el bloqueador de v11, y en Atlas está puesto. Ver §B5 |
| 10 | Bodega en `localStorage` | S | **No aplica** (ya revisado en v10) |
| 11 | Tienda virtual sin desplegar | S | **Fuera de Atlas** (es `cnv-corp`) |
| 12 | El consentimiento no menciona investigación | C | **Ya resuelto, y mejor que lo que pide.** Ver §A5 |
| §8.1 | Las tres grafías de los productos | C | **Ya resuelto** (revisión del v10) |
| §8.2 | `guardarConsulta` por `fecha` | S | **No aplica** |
| §8.3 | La pestaña Inventario calcula aparte | S | **No aplica** (ya revisado en v10) |
| §8.4 | `VITACELLEBIS_PRODUCTS` código muerto | S | **No aplica** |

**Nada de v11 obliga a recalcular los diagnósticos.** Ningún coeficiente, media, desviación, umbral ni
clasificación cambió, así que el mecanismo de corrección versionada no se dispara. Es la tercera entrega
seguida de la que se puede decir esto.

---

# Parte A · Lo que es CIENCIA (decide Gildardo)

## A1 · La cascada de macros: Atlas ya la tiene, y su reparación no reproduce su propia fórmula

**Su defecto era de almacenamiento, no de cálculo.** El documento lo dice bien: la pantalla siempre
recalculó, y lo que fallaba era que al guardar se escribían cuatro campos de siete, así que la historia
clínica leía `fat_g` y `cho_g` y encontraba nada.

**En Atlas ese defecto es estructuralmente imposible, y no por mérito nuestro: es la consecuencia de que
nada se guarde a medias.** Los macros no se persisten como un bloque que alguien pueda escribir
incompleto: se CALCULAN en `clinical-engine/protocolo-calorico.ts`, desde los insumos sellados, cada vez
que alguien los pide. La historia clínica llama a la misma función que la pantalla
(`computeProtocoloEfectivo`), con un comentario que dice por qué: *"un documento clínico no puede registrar
una cifra que nadie prescribió"*. Y lleva un campo más que el suyo: el **porcentaje** de grasa, no solo los
gramos, porque el porcentaje es el que el profesional fija y los gramos salen de él.

**El port es fiel línea por línea, y está anotado así.** Cada paso lleva la línea del HTML de la que salió:

| Atlas | Su línea | Fórmula |
|---|---|---|
| `fatKcal` | `:14133` | `round(kcalObj * fatPct / 100)` |
| `fatG` | `:14134` | `round(fatKcal / 9)` |
| `choKcal` | `:14135` | `max(0, kcalObj - protKcal - fatKcal)` |
| `choG` | `:14136` | `round(choKcal / 4)` |

### Lo que encontré al abrir su `_sintMacro` (línea 12144)

Su reparación de los planes viejos **no usa su propia fórmula**. Hace la resta con los gramos ya
redondeados:

```js
return Math.round((kcal - protG * 4 - fatG * 9) / 4);   // _sintMacro, linea 12153
```

mientras su fórmula viva resta las **calorías** sin pasar por el gramo:

```js
choKcal = kcalObj - protKcal - fatKcal                   // :14135
```

No son lo mismo. `fatG * 9` no devuelve `fatKcal`, porque `fatG` ya se redondeó. Con 2.000 kcal y 30% de
grasa: `fatKcal` = 600, `fatG` = 67, y `fatG * 9` = **603**. Esas 3 kcal se convierten en **1 gramo de
carbohidrato de diferencia**.

**Clínicamente es nada. Lo que no es nada es la forma del defecto:** en un plan viejo, la ficha mostraría un
carbohidrato y la pantalla del plan otro, por un gramo, sin que nada avise. Es la misma familia del hazard
que ya nos costó caro: dos superficies que dicen cosas distintas porque **leen fuentes distintas**. Si quiere
que coincidan, la reparación tiene que restar `fatKcal`, no `fatG * 9`.

**A Atlas no le afecta**: hay un solo camino, y es el de la fórmula viva.

> **Para él:** ¿confirma que la reparación debía reproducir la fórmula viva? Si sí, es un cambio de una línea
> en su archivo. Y para nosotros no hay nada que hacer.

## A2 · El ICN: la mitad que faltaba ya estaba bien, y la otra mitad es una decisión suya

Sus dos causas, y cómo está cada una en Atlas:

1. **`className:"no-print"`, no salía en ninguna impresión.** En Atlas no existe ese problema porque no
   existe esa impresión (ver §B4).
2. **Se dibujaba solo si el profesional era nutricionista, así que la dirección científica no lo veía
   nunca.** **En Atlas ya está bien, y por la razón correcta:** la tabla de validación del plan
   (`treatment-panel.tsx:3392`) se dibuja cuando hay plan, no cuando el que mira es nutricionista. La reja
   de profesión en Atlas gobierna **escribir** la prescripción, no **verla**: quien no es nutricionista la
   ve en lectura, con el aviso de quién la edita. Eso cubre su caso de la dirección científica sin tocar
   nada.

Y el contenido está portado completo: los 16 nutrientes con obtenido, requerido, % de cubrimiento e ICN; la
meta **ICN ≈ 1** en el título; los cortes de color ([0,9 - 1,15] óptimo, [0,7 - 1,3) alerta, resto crítico);
la leyenda con la definición; y el resumen `% de nutrientes con ICN >= 0,9`, portado de su `_icnPctOk`.
Incluso está escrito en el código que una fila puede verse incoherente (fibra al 136% en rojo con su ICN en
ámbar) y que **eso no es un error**, porque el ICN mide densidad y el cubrimiento mide cantidad.

**Lo que NO está: el ICN no aparece en ningún documento imprimible.** No está en la historia clínica ni en
el plan del paciente. Vive solo en la pantalla del profesional.

> **Para él, y es una pregunta de verdad, no una formalidad:** en su archivo "imprimible" significa que el
> módulo entero sale por la impresora. En Atlas los documentos están **diseñados**: la historia clínica es
> un documento probatorio y el plan del paciente es un documento para el paciente. Así que la pregunta no es
> si el ICN se imprime, es **en cuál de los dos va**. Mi lectura: en la historia clínica, porque es la
> validación de una prescripción y la HC es donde queda constancia de cómo se prescribió; en el plan del
> paciente no, porque un ICN de 0,78 en fibra no le dice nada a quien va a comer. Pero el documento es suyo.

## A3 · El espectro Z5-Z500: en Atlas nunca se perdió, y lo medí

Esto es lo que usted pidió que mirara arriba de todo, y la respuesta es buena.

Su documento dice: *"se leían del Excel, se usaban para calcular el IR, se mostraban en pantalla y se
botaban al guardar. Lo que se perdió hasta el 29 de septiembre de 2026 no se recupera. Son los datos brutos
del observatorio."*

**En Atlas están completos, y son datos medidos, no reconstruidos.** Medido hoy en producción:

| variable | mediciones con el dato | origen |
|---|---|---|
| `Z5`, `Z20`, `Z50`, `Z100`, `Z200`, `Z500` | **403 de 403** | `medido` en las 403; `derivado` en ninguna |
| `Impedance Ratio (IR)` | 403 de 403 | `medido` |
| `Rcc` (centro del círculo), `Xcc` | 403 de 403 | `medido` |

Las seis frecuencias están declaradas desde el principio en `clinical-engine/edge/biody-columns.ts` y se
persisten en `bis_raw_values` junto con las demás 94 columnas del export. Atlas guarda el export **entero**,
no los campos que un cálculo necesita, y cada valor lleva de qué procedencia viene (`medido` o `derivado`,
este último con la versión de la fórmula que lo reconstruyó).

**Las dos mediciones que vinieron importadas del HTML también traen el espectro** (lo verifiqué: `Z5`
presente en las dos). Así que el hueco que él describe no llegó a Atlas por ninguna puerta.

> **Nada que hacer, y conviene decírselo:** el dato bruto del observatorio no tiene un agujero entre julio y
> el 29 de septiembre. Lo que se perdió se perdió en el HTML, y Atlas tiene las 403 completas.

## A4 · El código de paciente: el mecanismo está superado, la advertencia legal NO

Su `atlasCodigoPaciente` (línea 12224) es una buena pieza: FNV-1a de doble pasada, determinista, sin el
documento en claro, 40.000 casos sin colisión.

**Atlas no lo necesita, y la razón es que resuelve un problema que Atlas no tiene.** Su código existe porque
en el HTML la clave del paciente ES el documento: para exportar sin el documento hay que derivar algo de él.
En Atlas la clave es un UUID que no deriva de ningún dato de la persona, así que el seudónimo ya existe y es
la propia clave. El archivo de cohorte que le mandamos el 22 de octubre usa el id de la evaluación por eso
mismo: es estable, no contiene nada de la persona, y solo reidentifica quien tenga la base.

**Pero su nota de §5.2 sí aplica, y es la mejor línea del documento:**

> *"Es seudonimización, no anonimización. (...) significa que OB BIA LATAM no puede declararse «anonimizado»
> ante un comité de ética ni en la sección de métodos de una publicación. Es una distinción que un revisor
> sí mira."*

Tiene razón, y al buscar dónde aplicaba en Atlas encontré una columna mal rotulada. Va en §B1, porque el
arreglo es nuestro.

## A5 · El consentimiento y la investigación: ya está resuelto, y con su propia palabra

Su tabla lista esto como *"Decisión de Gildardo"*, pendiente. **En Atlas ya está decidido y escrito, desde
el consentimiento v1.0 con revisión legal del 2026-08-11.** Hay una casilla propia, opcional, separada de
las demás:

> *"Participar, con sus datos seudonimizados (nunca con sus datos de identificación), en investigación
> científica del modelo ANI-BIS-E y de la medicina bioeléctrica, realizada directamente por el Observatorio
> Latinoamericano de Bioimpedancia (ObBIA-Latam) o en colaboración con instituciones académicas (...).
> Cuando un estudio específico requiera identificar el resultado de un paciente en una publicación con fines
> académicos, se le solicitará un consentimiento de investigación adicional y separado, propio de ese
> estudio."*

Tres cosas que vale la pena que él sepa, porque van más lejos de lo que pide:

1. **Dice "seudonimizados", no "anonimizados".** Es exactamente la distinción de su §5.2, resuelta en el
   texto que el paciente firma, antes de que él la escribiera.
2. **Nombra a ObBIA-Latam** y acota el alcance: mediciones, indicadores, respuestas de la encuesta,
   tratamiento y seguimiento, **sin las notas en texto libre del profesional**.
3. **Ya prevé el caso de la publicación identificada** y exige un consentimiento adicional y separado.

Y cubre la pertenencia étnica dentro de esa misma finalidad, con el gate escrito en el esquema: sin la
autorización de investigación vigente, el writer **nulifica** la etnia.

**La medición que convierte esto en una compuerta de software:** de 402 pacientes con consentimiento,
**349 autorizaron investigación y 53 no** (4 la revocaron después). Sigue en §B2.

---

# Parte B · Lo que es SOFTWARE (decidimos nosotros)

## B1 · `anonymization_level` no admite "seudonimizado", y la tabla está vacía

**El hallazgo.** `research_datasets.anonymization_level` es un `text` libre cuyo propio comentario declara
los valores admitidos:

```ts
anonymizationLevel: text("anonymization_level").notNull(), // aggregate, anonymized
```

**"seudonimizado" no está.** O sea que el día que Atlas genere el dataset que Gildardo quiere (código de
paciente, sin nombre ni documento), el único rótulo disponible para describirlo diría `anonymized`, que es
**precisamente la afirmación que él advierte que no se puede hacer**. Nada en la base lo impide, porque la
columna es texto libre; pero el vocabulario documentado es el que termina en la sección de métodos de una
publicación y en una respuesta a un comité de ética.

**El costo es cero y la ventana es ahora.** Verifiqué en producción: `research_datasets` tiene **0 filas**.
No hay nada que migrar ni ningún rótulo viejo que arreglar. Lo que propongo:

- Agregar `pseudonymized` a los valores admitidos y **cerrarlos con un enum o un CHECK**, no dejarlos en un
  comentario. Un comentario no impide escribir cualquier cosa, y este en particular no impide escribir la
  única cosa que no se debe.
- Que el nivel del dataset se **derive** de lo que el export de verdad quita, no que lo escriba quien lo
  pide. Un dataset que lleva el código del paciente es seudonimizado por construcción, y eso no debería
  depender de que alguien marque bien una casilla.

**Prioridad: alta, costo trivial.** Es la clase de cosa que cuesta una migración hoy y cuesta una
retractación dentro de un año.

## B2 · La compuerta que falta: el export tiene que mirar el consentimiento

**Esto es lo más importante de la revisión del v11.**

Abrí el motor de CNVResearch en el HTML (líneas 20135 a 20520, 385 líneas) y busqué consentimiento,
investigación y autorización. **No aparecen.** El modo observatorio hace una sola cosa: dejar en blanco el
documento y el nombre (línea 20367: *"`modo` = «interno» conserva documento y nombre; «observatorio» los
deja..."*) y poner el código de paciente en su lugar. **Todos los pacientes de la base salen en las dos
modalidades.**

En su HTML eso no es un defecto visible, porque su consentimiento no tiene casilla de investigación: las
cinco declaraciones son obligatorias, así que no hay nadie que haya dicho que no.

**En Atlas sí hay. Medido hoy en producción:**

| | pacientes |
|---|---|
| Con consentimiento de servicio vigente | **402** |
| Con autorización de investigación **vigente** | **349** (86,8%) |
| **Con servicio pero SIN investigación** | **53** |
| Que la autorizaron y después la **revocaron** | 4 |

**Cincuenta y tres personas dijeron que no.** Un export que no las filtre no es un export incompleto: es
usar datos de salud para una finalidad que su titular rechazó expresamente, con la casilla ahí al lado de
las que sí marcó. Y los 4 que revocaron son peores todavía, porque cualquier dataset generado antes de la
revocación ya salió.

**Lo que esto implica para cuando se construya el dataset del observatorio** (que hoy no existe: el panel de
`obbia` lista los datasets que haya, y la generación está en el BACKLOG como post-MVP):

1. **El filtro de la autorización de investigación va en el lector, no en la pantalla.** Si vive en la
   pantalla, el siguiente camino que lea la misma tabla lo saltea. Es la lección de "una regla también vive
   en varios sitios".
2. **La revocación tiene que poder alcanzar un dataset ya generado.** O los datasets se regeneran siempre,
   o se registra qué pacientes entraron en cada uno. Lo segundo es lo que deja contestarle a un titular que
   pregunta dónde quedaron sus datos.
3. **El rótulo del dataset dice cuántos quedaron fuera y por qué.** Es la misma idea de su diccionario,
   que lista lo retirado y no solo lo que queda; su §6.2 punto 3 lo dice mejor que yo: *"sin esa lista, un
   revisor tendría que deducir la exclusión de una ausencia."*

**No construyo nada de esto ahora.** Queda dimensionado y en el BACKLOG.

### Lo que sí hay que reconocerle a su módulo

Tres decisiones del v11 que son buenas y que conviene copiar cuando construyamos:

- **Nada se pierde en silencio:** las columnas conocidas salen con su etiqueta, y cualquier variable que
  aparezca y no esté en la lista **se anexa igual**. *"En un observatorio es peor perder una variable sin
  notarlo que mostrar una de más."* Exacto.
- **Dos encabezados por columna:** etiqueta legible arriba, nombre técnico debajo. Es lo que deja reproducir
  un análisis meses después sin adivinar.
- **Ni escritura, ni para él:** el motor no tiene una sola función de escritura, y hay una prueba automática
  que falla si alguien agrega un `setItem`, un `insert` o un `update`. Ese candado es del tipo que usamos
  nosotros, y pide que se conserve. Bien pedido.

## B3 · El guardado automático: parte ya existe, y lo que falta falta a propósito

Su regla es: Antropometría y Diagnóstico se guardan solos cuando hay encuesta completa **y** Excel cargado.

| módulo | en Atlas |
|---|---|
| **Encuesta** | **Ya autoguarda**, y es lo que salvó el caso del 22 de octubre: una encuesta a medias conservó las 22 respuestas que el paciente alcanzó a dar |
| **Antropometría** | No autoguarda, y **no tiene qué**: los datos llegan de la importación del export del Biody, en una transacción. No hay un formulario que alguien pueda dejar a medias |
| **Diagnóstico** | No autoguarda **a propósito**: generar el diagnóstico es un acto que sella la constelación de versiones y escribe en el log clínico. Un acto de sello no se dispara por un temporizador de 1,2 segundos |

Su advertencia de §4.1 (el helper busca por `fecha`, el historial indexa por `fechaConsulta`, y llamar al
primero desde otro módulo crea **dos filas del mismo día** que llegan a CNVResearch como dos
pacientes-día) **no aplica**: en Atlas la clave es el id de la evaluación, y la medición cuelga de ella con
restricción única. No hay dos campos de fecha que puedan discrepar.

**Nada que hacer.**

## B4 · La impresión: su solución es correcta para su archivo y equivocada para el nuestro

Puso un botón flotante inyectado fuera de React, para que exista en los once módulos sin tocar ninguno.
Para un archivo de 24.275 líneas que no tiene documentos diseñados, es la decisión correcta, y la razón que
da para dejar las reglas globales en la cabecera (que los tres módulos con su propio `@media print` sigan
mandando por orden de cascada) está bien pensada.

**En Atlas sería un retroceso.** Atlas no imprime pantallas: emite **documentos**, diseñados cada uno para
su lector y su propósito, con su componente imprimible propio (la historia clínica, el plan del paciente).
Un botón que manda la pantalla a la impresora produciría un papel con la barra lateral y los botones, al
lado de documentos hechos. **No aplica, y conviene que quede dicho por qué**, para que no vuelva como
pendiente.

## B5 · Supabase Auth: es el bloqueador de v11, y en Atlas ya está

Su §7.1 es la pieza que sostiene el resto de su documento: *"La clave que ATLAS lleva dentro del archivo es
pública. Cualquiera que abra el HTML puede leer y escribir la tabla `consultas` completa por fuera de los
módulos."* Y de ahí: la separación de CNVResearch es de interfaz, los permisos de Bodega son de interfaz, y
la encuesta por QR sigue parada.

**En Atlas está puesto, y los cuatro niveles que él describe existen como él los describe:**

- La dirección científica (`obbia`) **solo puede leer `research_datasets`**, por RLS, no por interfaz. El
  candado de que nunca alcance PII es un test (`obbia-no-pii.test.ts`).
- El profesional lee y escribe **sus** pacientes, por `is_patient_professional`, que es una función de base
  de datos, no una condición en una pantalla.
- Nadie borra.
- Y la autorización no vive en ningún `user.role === ...` suelto: va por policies, que es regla dura.

**Su recomendación es la que seguimos:** *"Resuélvelo una sola vez para todo ATLAS, no módulo por módulo."*
Así está.

## B6 · El paginado: ya es patrón, y le costó caro al que no lo aplicó

Su §6.3 avisa: *"Supabase devuelve como máximo 1.000 filas por consulta. Sin paginar, el día que la base
pase de mil consultas el módulo mostraría solo la primera página y nadie lo notaría, el peor tipo de error
en investigación."*

**Tiene toda la razón, y en este repositorio ya es patrón escrito**, con la misma justificación y con una
condición más: leer siempre el campo `error`, porque un fallo de PostgREST **viene en un campo, no
lanzando**. Eso último ya nos costó un freno abierto en silencio y una columna que salía vacía sin un solo
error. Su aviso y nuestra lección son la misma.

---

## Lo que recomiendo, en orden

| | qué | capa | costo | por qué |
|---|---|---|---|---|
| 1 | Abrir el vocabulario de `anonymization_level` a `pseudonymized`, cerrado por enum o CHECK | S | una migración | La tabla está vacía: hoy es gratis. El rótulo equivocado es el que llega a un comité de ética (§B1) |
| 2 | Dejar en el BACKLOG, como requisito del dataset del observatorio, el filtro de la autorización de investigación en el **lector** | S | documentar hoy | 53 pacientes dijeron que no. Sin esto, el primer export es una infracción (§B2) |
| 3 | Preguntarle a Gildardo en cuál documento va el ICN | C | una pregunta | Media entrega ya está hecha; la otra mitad es una decisión suya (§A2) |
| 4 | Decirle que su `_sintMacro` no reproduce su fórmula viva | C | una pregunta | Un gramo de carbohidrato, pero dos superficies que discrepan (§A1) |
| 5 | Decirle que el espectro no tiene agujero en Atlas | C | una frase | Cree que perdió dato bruto del observatorio hasta el 29-sep. No lo perdió (§A3) |

**Nada de esto se construye todavía.** El punto 1 es el único que yo construiría sin más conversación, y
tampoco lo hice: espero su visto bueno.

---

## Las cinco cosas que se le devuelven a Gildardo

1. **El espectro Z5-Z500 no se perdió en Atlas.** 403 de 403 mediciones lo tienen, medido, incluidas las dos
   que vinieron importadas del HTML. El agujero que describe es del HTML, no del observatorio.
2. **Su `_sintMacro` no reproduce su propia fórmula:** resta `fatG * 9` donde la fórmula viva resta
   `fatKcal`. Da un gramo de carbohidrato de diferencia en los planes viejos, y hace que la ficha y la
   pantalla puedan discrepar. Arreglo de una línea en su archivo; a Atlas no le afecta.
3. **El ICN ya se ve siempre y sin reja de profesión**, con la meta ≈ 1, los cortes de color y el resumen de
   nutrientes sobre 0,9. Falta decidir **en cuál documento** se imprime: la historia clínica o el plan del
   paciente. Mi recomendación es la historia clínica, pero el documento es suyo.
4. **El consentimiento de Atlas ya tiene la casilla de investigación**, nombra a ObBIA-Latam, dice
   "seudonimizados" (su propia distinción, antes de que la escribiera), excluye las notas de texto libre y
   prevé un consentimiento adicional para la publicación identificada. Su punto 12 está cerrado.
5. **Y la cifra que cambia cómo se diseña el observatorio: 53 de 402 pacientes NO autorizaron
   investigación, y 4 la revocaron.** Su CNVResearch exporta a todos. El de Atlas no va a poder.

---
---

# Segunda pasada (2026-10-24, tarde): lo que Santiago pidió verificar en Atlas

**Lo que sigue no es el informe de arriba revisado: son los seis puntos concretos que Santiago pidió
comprobar DENTRO de Atlas, con el veredicto medido en el código y en producción.** Él leyó la v11 así: lo
cerrado por el informe de arriba (5.1, 5.3, 5.4, 5.5, 7.1, 7.2, 7.3 y 8) queda cerrado.

## V11-1 · Nutrición: el defecto del HTML **no puede ocurrir en Atlas**. CERRADO

**El defecto del HTML, dicho por él:** al guardar no se escribían `fat_g` ni `cho_g`, así que cambiar las
calorías o la proteína dejaba la grasa y el carbohidrato en su valor viejo.

**En Atlas eso no es posible, y la razón es de forma, no de cuidado: Atlas no GUARDA la grasa ni el
carbohidrato.** Los deriva, cada vez, en un solo sitio:

| | |
|---|---|
| Lo que se guarda | solo los **ajustes** del profesional: `kcalObj`, `protGkg`, `fatPct`, `deficit`, `geb`, `pal`, el peso meta |
| Lo que se deriva | `protG`, `protKcal`, `fatG`, `fatKcal`, `choKcal`, `choG`, `choPct`, las porciones y el ICN |
| Dónde | `computeProtocoloEfectivo` a `computeProtocoloCalorico` (`clinical-engine/protocolo-calorico.ts:178-215`), con las líneas de su archivo anotadas al lado de cada paso (`:14130` a `:14137`) |

**Y las cuatro superficies leen esa misma función**, verificado archivo por archivo: el panel de tratamiento
(`treatment-panel.tsx:606`), la tabla de validación del ICN (`:3326`), la historia clínica
(`reports/data/hc-composicion.ts:1`) y, por la HC, la impresión. **No hay dos cálculos que puedan
divergir**, que es justo el defecto del HTML: ahí el valor guardado y el valor en pantalla eran dos cosas.

**Así que no hay nada que portar, y hay algo que NO portar.** Su `_sintMacro` (HTML:12144) tiene el error que
ya le reporté (`fatG * 9` donde la fórmula viva usa `fatKcal`). Portarlo sería traer a Atlas el defecto que
Atlas no tiene.

> **Lo único que queda por verificar aquí es de navegador, no de código:** que al cambiar las calorías en la
> pantalla, la tabla del ICN se repinte antes de guardar. El cálculo es síncrono y vive en el render, así
> que debe hacerlo; pero esta es una de las ocho familias de defecto que solo se ven en un navegador real
> (CLAUDE.md), y el smoke lo confirma en un minuto.

## V11-2 · El ICN: dónde se imprime. **PROPUESTA**

Ya está resuelto que se ve siempre y sin reja de profesión. Lo que falta es en qué documento se imprime, y
hoy **no está en ninguno**: la tabla vive en el panel de tratamiento, que es pantalla de trabajo.

**Mi propuesta: en la historia clínica, no en el plan del paciente.** Tres razones, y la tercera es la que
decide:

1. **El ICN es una validación del plan, no una instrucción para el paciente.** Dice si el plan cubre los
   requerimientos; el paciente no actúa sobre un ICN de 0,87.
2. **La HC ya es el documento del profesional** y ya lleva la composición derivada de la misma función, así
   que la tabla entra donde sus insumos ya están.
3. **El plan del paciente es la hoja que se imprime y se entrega**, y meter una tabla de catorce nutrientes
   con semáforos convierte una hoja de "qué come" en un informe técnico. Es la misma línea que ya seguimos
   con la EB-BIS: al paciente se le dice la evolución, no el constructo.

**Es su decisión por Regla 0** (el documento es suyo), pero la pieza ya está: la tabla se calcula en
`computeValidacion` y la HC ya importa la función que le da los insumos. Construirlo es mover un bloque.

## V11-3 · El botón de impresión global: **DIMENSIONADO**. La maquinaria ya existe

Lo que Atlas ya tiene construido, y es casi todo:

- **La regla de impresión** (`globals.css:363-388`): oculta todo lo que no sea la hoja `.imprimible`, usando
  `:has()` para no esconder la cadena de ancestros. Lleva dentro dos defectos ya resueltos y escritos: el
  `visibility` que paginaba trece hojas en blanco, y las dos hojas montadas a la vez.
- **`imprimirHoja(elemento)`** (`components/shared/imprimir-hoja.ts`): marca la hoja activa, imprime, y
  limpia la marca al terminar **o al cancelar**. Con su candado (`imprimir-una-hoja.test.ts`).
- **Cuatro hojas ya marcadas**: el diagnóstico, la hoja del DFI, la HC SOAP y el plan del paciente.

**Así que el botón global no es un desarrollo nuevo: es un botón en la barra que llame a `imprimirHoja` con
el panel activo.** Lo que cuesta de verdad es lo otro:

| | |
|---|---|
| El botón en la barra, con la hoja activa | **pequeño**, la función ya existe |
| Marcar como `.imprimible` los paneles que todavía no lo están | **mediano**: son las pestañas de Antropometría, Encuesta y Tratamiento |
| **Que lo impreso se lea como un documento** | **el trabajo de verdad** |

La última fila es la que hay que decir antes de prometer el botón. La regla de impresión **no quita los
controles**: si una pestaña de trabajo se marca imprimible tal cual, en el papel salen los desplegables, los
campos de texto y los botones, vacíos y sin borde. Cada panel necesita su pasada de estilo de impresión
(ocultar controles, soltar los `overflow`, no cortar las tablas entre hojas). Es lo que distingue el botón de
las cuatro hojas que ya existen: esas se diseñaron para el papel.

**Mi recomendación: el botón sí, y panel por panel.** Se empieza por el que él nombra (la subpestaña de
Nutricionista) y se añade cada uno cuando su hoja esté presentable, no todos a la vez con el aspecto de una
captura de pantalla.

## V11-3b · Lo que registra imprimir el plan, y por qué está así

Santiago preguntó qué registra y por qué, antes de quitarlo. **Registra una emisión de prescripción**
(`registrarPlanImpresoAction`, que llama a `emitirPrescripcion(..., "impresa")`), y eso guarda **una copia
inmutable de lo que se imprimió**: no un marcador de "ya se entregó", sino el contenido exacto que el
paciente recibió.

**Y la decisión es suya, del 9 de septiembre.** Antes había un botón aparte, "Entregado en consulta", que
**sellaba** la prescripción: a partir de ahí quedaba bloqueada y corregir una coma exigía reabrirla con un
motivo escrito. Usted lo reportó como confuso y tenía razón: eran tres cosas que el profesional sufre para
conseguir una que importa. Se cambió por esto, y a la vez **emitir dejó de cerrar**: la prescripción sigue
abierta y dos impresiones dejan dos líneas que dicen la verdad ("se imprimió dos veces").

**Mi recomendación: no quitarlo, y el argumento es el coste.** Esto **no le cuesta un clic a nadie**: ocurre
sobre la impresión que el profesional hace de todos modos. Lo que se perdería al quitarlo es la única copia
de qué plan se entregó, que es la pregunta que no se puede contestar después. Y si el problema es que los
nutricionistas casi no usan el plan, **lo que sobra es el plan, no su registro**: el día que se decida
retirar esa hoja, el registro se va con ella sin que haya que decidirlo aparte.

Un límite que conviene tener escrito, y ya está en el código: `window.print()` no informa de si se imprimió o
se canceló. Así que esto registra que el plan **se mandó a imprimir**. Es la afirmación que el sistema puede
sostener.

## V11-4.1 · Autoguardado: su lectura es correcta, y la confirmo

**"Superado" en lo primero:** en Atlas los datos no viven en la pantalla. La medición entra a
`bis_measurements` y `bis_raw_values` al importar, la encuesta a `survey_answers` al responder, y el
tratamiento guarda sus ajustes en su propia fila. No hay nada que un botón de "forzar el guardado" pueda
rescatar, porque no hay estado que solo exista en el navegador.

**"Choca" en lo segundo, y la razón es la regla dura 7.** Confirmar un diagnóstico es un acto clínico que
sella una constelación de versiones (`engine_version`, `model_version_id`, `rules_version`,
`survey_version_id`) y queda en `clinical_audit_log` con quién lo confirmó. **Un sello automático es un sello
sin autor.** El que firma tiene que ser una persona que decidió firmar.

Y hay un matiz que vale la pena, porque es el mismo defecto visto del otro lado: **lo que sí hace falta es
que un borrador no se pierda**, y eso ya está resuelto por otro camino (las etapas visitadas no se desmontan,
precisamente para no perder el borrador del tratamiento, como dice el comentario de `imprimir-hoja`).

## V11-4.2 · La consulta duplicada por fecha: **ES LO MISMO QUE LOS ERRORES 1 Y 2 DE LA v7**

Santiago pidió mirarlos juntos, y tenía razón en sospecharlo. **Son el mismo defecto en dos sistemas.**

En el HTML: la consulta se identifica por `fechaConsulta`, así que dos consultas del mismo día colisionan.
En Atlas: nada impide que el mismo archivo del equipo se importe dos veces, ni que se importe al paciente
equivocado. **Resultado medido: 11 grupos de mediciones con los crudos idénticos, 5 de ellos repartidos entre
pacientes DISTINTOS.** El detalle completo está en `EB_BIS_V7_LO_QUE_TOCA_ANTES_DE_CONSTRUIR_2026-10-24.md`
secciones 0 y 3, con el freno que propongo.

**Lo que esto cambia en la lectura de la v11:** su punto 4.2 no era un detalle de su prototipo. Era la pista
de un defecto que Atlas también tiene, por otro mecanismo, y que ya metió el dato de salud de una persona en
la historia de otra. **Es el hallazgo más grave de las dos pasadas de la v11.**

## V11-5.2 · El código de paciente: la vista del punto 1. **CONSTRUIDO**

La lectura de Santiago es la correcta: el seudónimo reemplaza al documento en la exportación, y solo salen
los que autorizaron investigación. Eso ya no depende de que cada consulta se acuerde:

**Migración 0224**, dos vistas hermanas de `ventas_reales`:

- **`evaluaciones_vigentes`**: no de prueba, no reemplazada, no retirada. **Sin** la fecha de arranque, que
  es de lo comercial (la 0219 ya lo había dejado escrito, y la lectura de Santiago coincidía con ella).
- **`evaluaciones_para_investigacion`**: lo anterior **más la autorización `investigacion` vigente**.

Las dos con `security_invoker`, revocadas a `anon` y `authenticated`, con las columnas enumeradas una por una
y **cero columnas que identifiquen a un paciente**: van los identificadores técnicos para poder unir, y la
constelación de versiones del diagnóstico, que es lo que permite no mezclar motores en un mismo dataset.

**Y la respuesta directa a su pregunta sobre el seudónimo:** no, no es el documento. El documento no sale.
Cuando haya que entregar un dataset, el seudónimo se construye sobre `patient_id` (un UUID que ya no dice
nada por sí solo), igual que hace hoy el CSV de la cohorte.

## V11-6.1 · Dos roles en un usuario: **SÍ, y hoy nadie los tiene**

| | |
|---|---|
| ¿El modelo lo permite? | **Sí.** `user_roles` es N:N y `CurrentUser.roles` es un **arreglo**; las policies preguntan con `hasAnyRole`, no con una igualdad. |
| ¿Hay que cambiar código? | **No.** Dar a Gildardo `professional` más `obbia` son **dos filas** en `user_roles`. |
| ¿Cuántos usuarios tienen dos hoy? | **Ninguno.** Medido: 18 usuarios, todos con un rol. |
| ¿Cuántos tienen `obbia`? | **Ninguno.** El rol existe y su panel está construido, sin nadie asignado. |

**Y lo que sí hay que mirar antes de dárselo**, porque es la parte que no se ve: la policy `canViewObbia`
dice que *"obbia NUNCA accede a PII: su única fuente por RLS es `research_datasets`"*, con su candado
(`obbia-no-pii.test.ts`). **Eso sigue siendo cierto para el rol, pero deja de ser cierto para la PERSONA**:
Gildardo con los dos roles ve la PII por su rol de profesional, que es correcto y es lo que ya hace. Lo que
no se puede afirmar después es "quien entra a CNVResearch no ve PII". Es una frase sobre el rol, no sobre el
usuario, y conviene no confundirlas cuando se escriba la política de acceso al observatorio.

**Y el dato que hace esto urgente de otra manera:** `research_datasets` tiene **0 filas** y su
`anonymization_level` solo admite `aggregate` y `anonymized`. Así que hoy el único rótulo disponible para el
dataset que él quiere es `anonymized`, que es precisamente la afirmación que su propia nota advierte que no
se puede hacer ante un comité de ética. Abrir el vocabulario a `pseudonymized` es gratis mientras la tabla
esté vacía.

## V11-6.1b · El React #310 de su CNVResearch

No lo arreglé, y quiero decir por qué antes de que parezca un olvido. El error #310 es *"se renderizaron más
hooks que en el render anterior"*: un `useState` o un `useEffect` dentro de una condición, o después de un
`return` temprano. Encontrarlo en el archivo minificado es viable (son 385 líneas del módulo), pero
**arreglarlo en una copia local tiene un riesgo que no compensa**: si la copia arreglada se aparta del
original, Santiago cotejaría contra una pantalla que no es la de Gildardo, y la Regla 0 dice que el archivo
manda. **Lo que propongo en su lugar: decírselo a Gildardo.** Es su archivo, es un fallo de su código, y él lo
arregla en una línea con el stack sin minificar. Mientras tanto el cotejo de esa pantalla espera, y no
bloquea nada de Atlas: la pantalla de investigación de Atlas la diseñamos nosotros (sus puntos 6.2 y 6.3).
