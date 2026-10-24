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
