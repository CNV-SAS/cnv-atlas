# Respuesta a la ronda del 2026-09-04

**De:** Gildardo Uribe — Dirección Científica CNV

**Para:** Equipo Atlas

**Fecha:** 4 de septiembre de 2026

---

## 0. Una advertencia sobre el método, antes de los ocho puntos

**Tres de los ocho puntos de esta ronda preguntan por decisiones que ya estaban tomadas.** No las
tomaron mal ni las portaron mal: **no llegaron a ustedes porque esta Dirección no las escribió en el
documento correspondiente.** Los puntos 2, 4 y 5 son de esa clase, y en cada uno va la fecha y la cita
de dónde salió la decisión original.

Lo digo en primera línea porque el costo se lo llevaron ustedes: preguntaron dos veces por cosas que ya
estaban resueltas. **El defecto es de la redacción de esta Dirección**, y queda anotado para no
repetirlo: una decisión tomada en sesión que no aparece en la entrega, para efectos prácticos no existe.

Y una consecuencia inmediata, que es el punto 2: **una de esas preguntas se rellenó con cifras que
esta Dirección nunca entregó.**

---

# 1 · Los rótulos de los nueve sectores IFC × IRC

**El señalamiento es correcto y la lectura que hacen de la tabla también.** No es cosmético y hacen
bien en ponerlo primero.

## La respuesta no es ninguno de los dos juegos

Ni `FYR_LABELS` ni el `cn` del visor. **Va un tercer juego, y no porque los dos anteriores tuvieran
tres errores sueltos: porque ninguno de los dos estaba construido sobre una regla.** Los rótulos de
este cuadro no son nombres de estados, son la lectura de las dos bandas, y por eso se leen solos:

| IFC | dice | IRC | dice |
| --- | --- | --- | --- |
| Alto | función normal | Bajo | con bajo riesgo |
| Normal | función | Normal | sin riesgo |
| Bajo | disfunción | Alto | con riesgo |

**Los nueve sectores, en firme:**

| Clave | Bandas | Rótulo |
| --- | --- | --- |
| `3_1` | IFC Alto / IRC Bajo | Estado celular óptimo |
| `3_2` | IFC Alto / IRC Normal | Estado fisiológico estable |
| **`3_3`** | IFC Alto / IRC Alto | **Función normal con riesgo** |
| **`2_1`** | IFC Normal / IRC Bajo | **Función con bajo riesgo** |
| **`2_2`** | IFC Normal / IRC Normal | **Función sin riesgo** |
| **`2_3`** | IFC Normal / IRC Alto | **Función con riesgo** |
| **`1_1`** | IFC Bajo / IRC Bajo | **Disfunción con bajo riesgo** |
| **`1_2`** | IFC Bajo / IRC Normal | **Disfunción sin riesgo** |
| `1_3` | IFC Bajo / IRC Alto | Estado crítico |

Los seis en negrita se reemplazan. Los tres restantes —los dos extremos favorables y el crítico—
conservan su nombre propio, que dice más que la fórmula.

**Se reemplaza en los dos sitios y se elimina el juego duplicado**, que es el defecto de fondo: mientras
un mismo dato tenga dos versiones dentro del mismo archivo, van a volver a divergir.

Y los dos casos que preocupaban quedan resueltos en la dirección correcta: quien tiene función alta con
inflamación alta deja de leer "Disfunción sin riesgo" y lee **"Función normal con riesgo"**; y quien
tiene la función celular baja deja de leer "Función estable" y lee **"Disfunción sin riesgo"**.

**Y hacen bien en no haber tocado nada.** La Regla 0 se aplica también cuando lo representado parece un
error: se representa y se pregunta, que es exactamente lo que hicieron.

---

# 2 · El LE8: la decisión estaba tomada desde el 2 de septiembre

**El interruptor está en `true` por decisión de esta Dirección, tomada el 2 de septiembre y reafirmada
ese mismo día.** No es un descuido, no es un estado intermedio y no es la segunda vez que se les pasa: es
la segunda vez que **no se les dijo**.

## La decisión y su fecha

`LE8_MAPEO_CORREGIDO` pasó a `true` el 2 de septiembre por instrucción directa. La razón está medida y
documentada en `ACTUALIZACIONES_ATLAS_v8_2026-09-02.md` §11: con el mapeo apagado, **dos de los ocho
dominios del LE8 —Alimentación e Hidratación— leían campos que solo existen en el objeto `DEMO`**
(`d1_9`, `d1_10`, `d1_16`). En paciente real daban cero, y esos dos dominios quedaban clavados en 30 y
en 20 **para todo el mundo, midiera lo que midiera la persona**.

Eso sí era un defecto, y de los que no se ven: el LE8 parecía funcionar porque se probaba con el caso
demo.

## Por qué μ y σ no llegaron, que es lo que hay que decir con todas las letras

**La recalibración no está pendiente de una firma. Está bloqueada por ausencia de dato.**

μ y σ del ICEC se calculan sobre una población con ICEC medido. **Ninguna fuente disponible lo trae:**

| Fuente | Registros | ¿Trae ICEC? |
| --- | --- | --- |
| Base consolidada | 5.077 | **No** |
| Registros BIS de ATLAS (`atlas_bis_*`) | 6 (5 únicos) | **No** |
| Exports del BiodyManager | — | **No** |

La razón es estructural, no logística: **el ICEC se calcula desde la encuesta**, y ninguna de esas
fuentes la trae. Se verificó paciente por paciente sobre los registros reales de ATLAS.

Así que la respuesta a la pregunta que hacen no es (a) ni (b): **es que hoy no existe la tercera cosa
que ambas requieren.** Se recalibra cuando haya una masa de pacientes con encuesta completa, y esa
condición queda declarada aquí para que entre al candado con su motivo.

## Y una corrección de atribución, que es lo que importa de este punto

> *"Nos dijiste que recalibraste con μ = 54,306 y σ = 12,845 sobre 1.847 pacientes."*

**Esas tres cifras no salieron de esta Dirección Científica.**

Se buscaron —con coma y con punto— en el `ATLAS_v8.html` vigente, en los 29 backups del escritorio, en
todos los `.md` y `.docx` de la carpeta de trabajo, en los documentos técnicos
`EB_BIS_IAE_DocumentoTecnico_v2_2026` y `v3_2026`, y en el registro completo de las sesiones del 2, 3 y
4 de septiembre. **Su única aparición en todo el equipo de esta Dirección es la línea 120 del propio
`RONDA_GILDARDO_2026-09-04.md`.**

No es una imputación de mala fe: es que un número atribuido a Dirección Científica y usado para
condicionar un porte tiene que poder rastrearse hasta ella. Este no se puede. **Pedimos que se retire
esa atribución** y que, de aquí en adelante, toda cifra que se nos atribuya venga con la entrega o el
documento del que salió.

## Un dato adicional, que es de esta Dirección y no se había dicho

**μ = 58,578 y σ = 13,332 tampoco tienen origen documentado.** No aparecen en ninguno de los dos
documentos técnicos de la EB-BIS: ambos describen la **v3**, una regresión Ridge sobre ocho variables
bioeléctricas y de composición, **que no lleva ICEC ni LE8**. La fórmula vigente —la v5, con IFC, PABU e
ICEC— vive solo en el HTML, y esas dos constantes con ella.

Queda anotado como trabajo de esta Dirección: **la v5 necesita su documento técnico.** No condiciona
nada del porte, pero sostiene el candado que ustedes pusieron.

---

# 3 · La proteína: rige la del 3 de septiembre, y hay un reemplazo que no vieron

**Rige la del 3.** No hay dos instrucciones opuestas: hay una instrucción del 2 que la del 3 sustituye,
por las razones que van abajo. **Y la retirada de los cuatro módulos es deliberada.**

## La decisión, en sus términos

La cadena calórica queda **libre de patología**: GEB de Mifflin sobre el **peso meta**, GET por factor de
actividad, y de ahí la restricción que ponga el nutricionista. **Proteína 0,8 g/kg y grasa 30 %, las
dos editables**; los carbohidratos, el resto.

Ninguna patología mueve una caloría. Se retiraron la fórmula por diagnóstico, la bajada de grasa al
25 % por dislipidemia y las cinco cifras de proteína que imponía cada rama. **La proteína se prescribe
en un solo sitio: el módulo del nutricionista.** Por eso salió de los otros cuatro.

## El motivo, que es el que hace que no sea un capricho de un día para otro

El motor no puede distinguir un dato escrito a propósito de un campo mal borrado, y la cadena por
patología convertía esa ambigüedad en gramos prescritos. **La solución no fue ponerle un piso al campo:
fue quitarle al motor la pretensión de saber.** La cifra la decide el profesional, que es quien tiene
delante al paciente.

## Y lo que falta en la ronda: la resta se portó, la suma no

**El punto 3 de la ronda enumera todo lo que se retiró y no menciona ni una vez lo que se puso en su
lugar.** Está en el mismo `ATLAS_v8.html` que recibieron:

| Pieza | Dónde | Qué hace |
| --- | --- | --- |
| `asesoriaMacro(enc, bis, macro)` | ~línea 15904 | El panel de referencia por diagnóstico, junto al campo de proteína y al de grasa. **Sale siempre**, no solo cuando hay conflicto |
| `asesoriaFuera(valor, ases)` | ~línea 16019 | Detecta que la cifra escrita quedó fuera del rango sugerido |
| Badge `CONDICIONES EN CONFLICTO` | ~línea 17903 | Cuando dos condiciones piden rangos que no se solapan, **lo dice en vez de escoger** |

El panel da el rango de cada condición, **el mecanismo por el que lo pide** —no la cita— y la fuente. Y
lo que se escriba fuera del rango **queda en la historia clínica** con el rango, la condición y la
razón. No bloquea y no alarma: deja constancia de que fue una decisión.

**Entonces la lectura correcta no es "el motor dejó de prescribir proteína".** Es que la prescripción
pasó del motor al profesional, y el criterio clínico que el motor imponía ahora se le muestra a quien
decide, en el momento de decidir. **Si portaron la retirada sin portar el panel, lo que quedó en Atlas
es media instrucción**, y es la mitad peor.

## Los 56 tratamientos

**Vuelven a 0,8 editable**, que es la base de la cadena vigente. Al no haber ninguno aprobado ni ningún
paciente real atendido, se aplica limpio y no hay nada que deshacer — y se agradece la precisión, porque
ahorró la pregunta.

---

# 4 · `generarAlertas`: no se borra, y su sitio ya estaba definido

**Tienen razón, y la premisa de la que salió el "marcadas para borrarse" era falsa.**

Ese punto del 3 de septiembre agrupó tres funciones bajo un mismo criterio —"nadie las invoca"— que es
cierto de `calcConsumo` y de `TCAC` **y no lo era de `generarAlertas`**. Ustedes lo demostraron: sus
quince reglas están vivas en Atlas a través del adaptador `alertas-disponibles`.

**Y hay algo más, que es lo que esta Dirección debió escribir y no escribió.** El 2 de septiembre, sobre
esas mismas alertas, quedó dicho en sesión:

> *"Generar alertas sale porque estamos poniendo diagnóstico. Esas alertas solo aparecen al inicio,
> cuando el profesional abre la info de la encuesta del paciente."*

O sea que **las quince reglas no solo son válidas: tienen sitio asignado desde el 2 de septiembre.** Lo
que estaba mal no era su existencia sino dónde aparecían.

**La instrucción, entonces:**

1. **No se borra.** El cableado muerto era el del archivo de esta Dirección, no las reglas.
2. **Su sitio es la apertura de la información de la encuesta del paciente**, cuando el profesional
   entra por primera vez — no la pantalla de diagnóstico.

Si hoy en Atlas salen en dos sitios de la pantalla de evaluación, **el que sobra es el del diagnóstico**.
Las alertas son de entrada, no de resultado.

---

# 5 · Los veintiún estados con raya: las casillas deben ir llenas

**Manda la caída campo por campo.** La forma de `getDX` es la que está mal.

Y esto tampoco es una decisión nueva. Se pidió dos veces, el 3 de septiembre:

> *"En ruta de tratamiento, debajo de la Diana EFyR BIS, aparecen algunas casillas en blanco con un `-`,
> donde deberían estar llenas todas las casillas de acuerdo al # en el que quedó el paciente y a lo que
> ya teníamos en el manual del mapa."*

**"Deberían estar llenas todas las casillas" es la instrucción, y es anterior a esta ronda.** Que se
haya quedado en el archivo es defecto de esta Dirección, no de ustedes.

## La corrección, en sus términos

La condición de `getDX` compone solo cuando falta la clave entera. Las veintiuna claves existen con
`"—"` dentro, así que la condición nunca se cumple y `efrCompose` no llega a correr. **La forma correcta
es la del otro visor**, que cae campo por campo:

```js
return {d:base.d||comp.d, m:base.m||comp.m, b:base.b||comp.b, r:base.r||comp.r, n:base.n||comp.n};
```

Con esa forma los veintiuno salen con texto, y el texto **ya está escrito** en `efrCompose`. No hay
nada que redactar: hay que dejar que la caída llegue.

**Que el mismo paciente vea una cosa en una pantalla y otra en la otra es el defecto de fondo**, el
mismo del punto 1: un dato con dos implementaciones. Se unifica por la que llena, y la raya deja de
existir en los veintiuno.

---

# 6 · Tumaco y Cartago

**El criterio ya estaba dado y no ha cambiado:** las regiones de Colombia están determinadas, y la
región de un municipio es la suya, no la que decida el orden de las claves de un objeto. Que hoy la
resuelva ese orden es el defecto real, y en eso el señalamiento es exacto.

**La asignación:**

| Municipio | Región | Se retira de |
| --- | --- | --- |
| **Tumaco** | `pacifica` | `andina_narino` |
| **Cartago** | `andina_antioquia` (Antioquia y Eje Cafetero) | `andina_valle` |

Cartago es municipio del Valle del Cauca, pero para efectos de lo que se come **pertenece al Eje
Cafetero**, y eso es lo que decide una lista de intercambio: no la división política sino el patrón
alimentario. La agrupación de este bloque es alimentaria, no administrativa.

**Cada municipio queda en una sola región**, y con eso el orden de las claves del objeto deja de decidir
nada.

---

# 7 · Los subgrupos que quedan sin alimento

**El hallazgo es correcto y el que importa es el que ustedes aislaron bien:** que el reparto prescriba
"Azúcares y dulces: 1 porción" y tres páginas después se entregue una lista vacía para ese grupo **es
una contradicción dentro del mismo documento del paciente**, y esa sí es un defecto, no una rareza.

Se agradece particularmente que se hayan medido las tres salidas antes de proponerlas, y que no se haya
tomado ninguna. La objeción de fondo que levantan contra la segunda es correcta: **entregarle 37
entradas de azúcares a alguien con dieta hipocalórica porque su región no surte ese grupo sería peor que
el rótulo vacío.**

## La decisión: la tercera

**Un grupo que hace parte de una dieta saludable tiene que estar, y no puede estar vacío.** Ese es el
criterio, y de él se sigue la regla:

> **Ningún grupo que el reparto prescribe puede quedar sin lista en ninguna región.**

No se resuelve suprimiendo el rótulo ni quitándole la porción al grupo. Se resuelve porque **esos
subgrupos entran al núcleo nacional**, con alimentos de la propia `INTER_TABLA_B` —ninguno nuevo, ningún
contenido inventado—, y por tanto quedan disponibles en las diez regiones.

**Lo que entra, y ya está en el archivo** — diez alimentos, todos de `INTER_TABLA_B`:

| Subgrupo | Al núcleo nacional |
| --- | --- |
| **Azúcares y dulces** | Azúcar blanca granulada · Miel de abejas · Panela en polvo · Jarabe de maple · Postre gelatina-leche · Helado de vainilla |
| **Nueces** | Maní sin sal · Almendras tostadas sin sal · Marañón tostado sin sal · Nuez del nogal |

**Quedan fuera del núcleo las bebidas azucaradas y la confitería.** Siguen disponibles en las regiones
que ya las traen, pero no se le ofrecen por defecto a alguien con dieta hipocalórica. La objeción del
equipo contra volcar las 37 entradas nacionales de azúcares sobre ese paciente es correcta y se recoge
tal cual.

Es un núcleo corto a propósito: **cubre la porción prescrita en las diez regiones sin deshacer el
recorte**, que es para lo que este bloque existe. El núcleo pasa de 56 a 66 alimentos.

## Los otros subgrupos vacíos

**Azúcares y nueces son los dos que el reparto prescribe, y por eso son los dos que se corrigen.** Los
demás no se leen igual y se quedan como están:

- **Mecato y bebidas alcohólicas**, vacíos en las diez regiones, son decisión de esta Dirección. Un plan
  no los prescribe y no tienen por qué llevarse nada al núcleo.
- **Leche descremada, semillas y reducidos en grasa** quedan pendientes de la misma revisión, pero
  **solo si el reparto llega a asignarles porción**. La regla es esa y no la cantidad de rótulos
  vacíos: lo que no se prescribe puede salir vacío sin contradecir nada.

**Y portar el render tal cual —con los rótulos vacíos incluidos— fue lo correcto.** Suprimirlos habría
sido un arreglo de forma que tapaba el defecto en vez de mostrarlo.

---

# 8 · Las erratas de la tabla de alimentos

**Corríjanlas.** Son erratas ortográficas sin contenido clínico y no hay nada que discutir en ellas.

**Pero hay un dato que amplía el alcance de lo que encontraron, y que cambia cómo hay que hacerlo.** Los cuatro nombres no aparecen solo en
`INTER_TABLA_B`: **están repetidos en nueve sitios del archivo**, porque las listas regionales los
referencian por nombre.

| Dice | Debería decir | Ocurrencias |
| --- | --- | --- |
| Café **instántaneo** en polvo | instantáneo | 2 |
| Café **instántaneo** descafeinado en polvo | instantáneo | 1 |
| Chocolate con **azticar** | azúcar | 2 |
| Chocolate granulado con **panels** | panela | 4 |

**Corregir solo la tabla rompería el emparejamiento con las listas regionales**, y el alimento
desaparecería de la lista de la región en vez de salir bien escrito. La corrección tiene que ser
simultánea en las nueve.

**Y sí a la revisión completa**: mejor la ortografía de los 350 de una vez, verificada y entregada como
lista, que ir corrigiendo por goteo lo que aparezca en el documento de cada paciente. Se envía en la
próxima entrega.

---

## Resumen

| # | Decisión |
| --- | --- |
| **0** | **Tres de los ocho puntos preguntan por decisiones ya tomadas que esta Dirección no escribió.** El defecto es de redacción, no de porte |
| **1** | **Va un tercer juego, construido sobre la regla de las dos bandas**: IFC Alto/Normal/Bajo = *función normal · función · disfunción*, cruzado con IRC Bajo/Normal/Alto = *con bajo riesgo · sin riesgo · con riesgo*. **Seis rótulos se reemplazan**; los dos extremos favorables y el crítico conservan su nombre. **Y se elimina el juego duplicado** |
| **2** | **El `true` es decisión del 2 de septiembre**, con el defecto que corrige medido. **μ y σ no están pendientes de firma: están bloqueadas por ausencia de ICEC en toda fuente disponible.** Y **μ = 54,306 / σ = 12,845 / 1.847 pacientes no salieron de esta Dirección**: se pide retirar la atribución |
| **3** | **Rige la del 3 y la retirada es deliberada.** Y falta portar el reemplazo: `asesoriaMacro`, `asesoriaFuera` y el badge de conflicto ya están en el archivo. Los 56 vuelven a 0,8 editable |
| **4** | **`generarAlertas` no se borra.** Sus quince reglas son válidas y su sitio estaba asignado desde el 2 de septiembre: la apertura de la encuesta, no la pantalla de diagnóstico |
| **5** | **Manda la caída campo por campo.** "Todas las casillas deben ir llenas" se pidió el 3 de septiembre; el texto ya está en `efrCompose` |
| **6** | **Tumaco → Pacífica. Cartago → Antioquia y Eje Cafetero**, porque lo que agrupa este bloque es el patrón alimentario, no la división política. Cada municipio en una sola región |
| **7** | **Ningún grupo que el reparto prescribe puede quedar sin lista en ninguna región.** Azúcares y nueces entran al núcleo nacional con un conjunto corto, de la propia `INTER_TABLA_B`. Mecato y bebidas alcohólicas se quedan vacíos: un plan no los prescribe |
| **8** | **Corríjanlas** — y son **nueve** ocurrencias, no cuatro: corregir solo la tabla rompe el emparejamiento con las listas regionales. Va también la revisión ortográfica completa de los 350 |

---

## Lo que va aplicado en el `ATLAS_v8.html` de esta entrega

No hace falta que porten nada de esto: **ya está en el archivo**, verificado.

| Punto | Cambio | Verificación |
| --- | --- | --- |
| **1** | Los seis rótulos de `FYR_LABELS`, y el `cn` del visor unificado con ellos | Los tres bloques de script compilan sin error |
| **5** | `getDX` cae campo por campo, tratando `"—"` como ausencia de texto | Los 37 campos con raya de `DX` pasan a componerse desde `efrCompose`. **No se toca `base.n`**: el bloque de nutracéuticos conserva sus reglas intactas |
| **6** | Tumaco fuera de `andina_narino`; Cartago fuera de `andina_valle` | 224 municipios, **ninguno repetido**. El orden de las claves deja de decidir |
| **7** | Diez alimentos al núcleo nacional | Los diez nombres emparejan **exactamente** con `INTER_TABLA_B`; núcleo 56 → 66 |
| **8** | Las nueve ocurrencias de las cuatro erratas | Cero apariciones restantes de `instántaneo`, `azticar` y `panels` |

**Una cosa que queda señalada y sin tocar:** los colores de `FYR_LABELS` no se movieron, y con los
rótulos nuevos hay tres que ya no acompañan. `3_3` "Función normal con riesgo" sigue en cian, `2_2`
"Función sin riesgo" sigue en ámbar y `1_2` "Disfunción sin riesgo" sigue en rojo. **El color es
contenido de esta Dirección y va firmado aparte**, no inferido de la nueva redacción.

© Connected Nutrition Ventures SAS, 2026. Documento interno.
