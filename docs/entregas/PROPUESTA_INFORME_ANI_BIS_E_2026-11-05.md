# La sugerencia del informe ANI-BIS-E: qué trae, qué ya tenemos y cómo quedaría

**Connected Nutrition Ventures · Atlas · 5 de noviembre de 2026**
**Estado:** PROPUESTA. No se ha construido nada.

---

## 0 · Antes que nada: ese PDF lleva datos de un paciente y se versionó

`SUGERENCIA_INFORME_ANBISE.pdf` **es un informe de paciente**, no una maqueta vacía: lleva nombre
completo, número de documento, fecha de medición y cifras clínicas. Estaba en `docs/entregas/cotejo-visual/`,
que **no** cubría ningún patrón de `.gitignore` para PDF, y entró en un commit de hoy (`b893efe3`) con un
`git add -A`.

**Dije que no había llegado a GitHub. Sí había llegado**, y al preparar la limpieza salió que ese PDF no es
el único: hay **once** blobs `.pdf` de paciente en el historial, en cinco commits, **desde el 1 de
septiembre**. Eso ya no cabe en un apartado de este documento: está en
`docs/incidents/2026-11-05-pdf-de-paciente-en-el-historial.md`, con el alcance verificado, el runbook de
limpieza en PowerShell y la pregunta legal que decide Santiago.

---

## 1 · Qué trae la sugerencia

Es **una página**, con dos bloques.

**Bloque A, el encabezado.**

| Pieza | Cómo viene |
|---|---|
| Título | "VALORACIÓN NUTRICIONAL · BIOIMPEDANCIA ESPECTROSCÓPICA" en versales, y debajo "Informe de evaluación bioeléctrica" |
| Subtítulo | "Resultados de medición · BiodyBis" |
| Caja del paciente | Tres columnas rotuladas: PACIENTE · DOCUMENTO · FECHA DE MEDICIÓN |
| La cifra grande | "EDAD BIOLÓGICA ESTIMADA", el número en grande ("28,9 años") y debajo el delta ("+7,9 años") |
| Pie de la cifra | "Diferencia estimada reportada por el equipo" |
| Profesional | "Profesional responsable · [nombre] · Nutricionista Dietista" |
| Interpretación | Un párrafo: los resultados corresponden a la medición de esa fecha, se interpretan junto con la historia clínica y la valoración nutricional, y **no constituyen por sí solos un diagnóstico** |

**Bloque B, la Diana por áreas.** Titulado *"Tu evaluación bioeléctrica integral, área por área"*:

- El pentágono con los cinco dominios, con **anillos de color** (verde al centro, luego amarillo, luego
  rojo) y el polígono del paciente encima en negro, con un punto por vértice.
- Cada vértice rotulado con el nombre del dominio en dos líneas y **su veredicto en color** debajo
  (Prioritario en rojo, A trabajar en naranja, A vigilar en ámbar, En equilibrio en verde).
- Una línea de leyenda en lenguaje llano: *"Cada punta es una parte de tu salud. Cuanto más cerca del
  centro, mejor estás en esa parte: la figura pequeña es la que buscamos."*
- Debajo, **cinco filas** con una barra vertical de color, el nombre del dominio, su veredicto y **una
  frase** de lectura clínica.

---

## 2 · Qué de eso YA tenemos

Más de lo que parece. El informe actual ya lleva:

| Pieza de la sugerencia | En Atlas hoy |
|---|---|
| Caja del paciente (nombre, documento, fecha) | **Sí**, y con **dos** fechas: la de la medición y la de la consulta, rotuladas. La sugerencia solo trae una |
| Profesional responsable | **Sí**, con su profesión, como última línea del encabezado |
| Edad biológica estimada, con su delta | **Sí**, desde que su tabla 3 la devolvió al paciente. Y gateada: solo sale si el diagnóstico se selló con la v7 |
| Los cinco dominios con su veredicto | **Sí**, y con **las mismas cuatro palabras** (En equilibrio · A vigilar · A trabajar · Prioritario). No son de la sugerencia: son el porte de su clasificador |
| El radar de cinco dominios | **Sí** |
| Una frase de lectura por dominio | **Sí**, son las lecturas del DFI (y están en la pregunta 14 del documento de dudas: las queremos en lenguaje de paciente, escritas por él) |
| Nota de que no es un diagnóstico por sí solo | **Parcialmente**, y hay historia: el informe tuvo una frase así y **se retiró** el 1 de septiembre, porque contradecía su §7.1 (el diagnóstico es lo primero que el paciente recibe) y al bloque de al lado, que le dice que su envejecimiento está acelerado |

---

## 3 · Qué NO tenemos, y qué vale la pena tomar

**Lo que la sugerencia hace mejor, y se adopta:**

1. **La jerarquía del encabezado.** Hoy el informe abre con "Informe ANI-BIS-E del paciente" y una lista de
   filas etiqueta-valor. La sugerencia convierte el encabezado en un bloque con **una caja de tres
   columnas** y, debajo, **la cifra grande**. Es más legible y pone lo importante donde la vista cae
   primero. Se adopta.
2. **La cifra de la edad biológica como pieza grande y sola**, con su delta debajo. Hoy es una fila más
   entre los indicadores. Se adopta.
3. **Los anillos de color del radar.** Hoy el radar dibuja la figura del paciente sobre una rejilla neutra;
   la sugerencia pinta el fondo por bandas. Hace la lectura inmediata *sin leer*. **Se adopta la forma,
   pero la escala de color queda esperando** (ver 4.1).
4. **La línea de leyenda en lenguaje llano.** "Cuanto más cerca del centro, mejor estás" es exactamente el
   registro que pide el informe del paciente, y hoy no está. Se adopta.
5. **Las cinco filas con barra de color**, debajo del radar: repiten el veredicto en texto para quien no
   lee bien un gráfico, y para la impresión en blanco y negro. Se adopta.

**Lo que NO se toma, y por qué:**

| Pieza | Por qué no |
|---|---|
| *"Diferencia estimada reportada por el equipo"* | **Es falso en Atlas.** El delta no lo reporta el Biody: lo calcula la EB-BIS v7 de Gildardo con sus parámetros 7.1.0. Atribuirlo al equipo sería decir que la cifra viene de un aparato cuando viene de un modelo. La frase correcta es *"estimada por el modelo ANI-BIS-E"* |
| *"VALORACIÓN NUTRICIONAL"* en el título | El informe **no lleva nada de alimentación** (decisión ya tomada: eso va en la hoja del plan). Un título que anuncia valoración nutricional promete lo que el documento no trae |
| *"Resultados de medición · BiodyBis"* como subtítulo | Lo mismo al revés: el informe no son los resultados del equipo, es la lectura del modelo sobre ellos |
| La nota de "no constituye diagnóstico" tal cual | Se retiró el 1 de septiembre con una razón que sigue viva. Si vuelve, vuelve con otra redacción y es decisión de Santiago, no un efecto colateral de adoptar una maqueta |

**Y lo que la sugerencia NO tiene y nuestro informe sí** (no se pierde al adoptar su estructura): la banda
de trayectoria ("cómo vas respecto a tu medición anterior"), las rutas de atención en lenguaje de paciente,
las remisiones con su urgencia, el seguimiento y la próxima cita, y el freno que impide entregar un
documento que se contradice consigo mismo.

---

## 4 · Lo que queda esperando, y no lo decidimos nosotros

### 4.1 · Los colores de los anillos son la pregunta 9, que está abierta

La sugerencia pinta **tres bandas sólidas** (verde, amarillo, rojo). Eso es exactamente lo que la pregunta
9 del documento de dudas le plantea a Gildardo, y con una objeción de Santiago encima: los colores sólidos
parten la Diana en anillos y le quitan la superficie continua.

**Así que la maqueta se adopta con la escala de color de hoy**, y el día que él responda se cambia en un
sitio: los colores de la Diana, del radar y de las tarjetas del DFI salen de los mismos tokens clínicos.
Construir ahora con los tres sólidos sería adelantarnos a su respuesta en lo único de esta página que es
clínico.

### 4.2 · Las cinco frases de dominio son la pregunta 14

La sugerencia trae las frases de hoy, que son las lecturas clínicas de su archivo (*"Función celular
comprometida con microambiente hostil"*). En lenguaje de paciente no se entienden, y la pregunta 14 le pide
a él las suyas. La maqueta no cambia eso: cuando lleguen, se sustituyen.

---

## 5 · Cómo quedaría, en concreto

**Hoja 1, encabezado nuevo:**

```
[sin franja y sin nube: se retiran]

Informe ANI-BIS-E                                         Connected Nutrition Ventures
Evaluación bioeléctrica

┌─────────────────────┬─────────────────────┬─────────────────────┐
│ PACIENTE            │ DOCUMENTO           │ FECHA DE MEDICIÓN   │
│ [nombre]            │ [documento]         │ [fecha]             │
└─────────────────────┴─────────────────────┴─────────────────────┘
Te atendió: [profesional] · [profesión]        Fecha de la consulta: [fecha]

        EDAD BIOLÓGICA ESTIMADA
        76,4 años          +12,4 años
        Estimada por el modelo ANI-BIS-E sobre tu medición de bioimpedancia.
```

**Hoja 2, la Diana por áreas:** el radar con sus anillos de fondo, los cinco vértices rotulados con su
veredicto en color, la línea de leyenda debajo, y las cinco filas con su barra, su veredicto y su frase.

**Lo que se retira, como pidió Santiago:** la franja de marca del borde superior y la forma de fondo (la
"nube"). Las dos se habían puesto para que el documento se viera de la casa; la maqueta consigue lo mismo
con jerarquía tipográfica, que además fotocopia limpio y no gasta tinta.

**Tamaño:** media tanda. Es maquetación del PDF (y del HTML imprimible, que tiene que seguirlo), sin tocar
ni una cifra, ni el motor, ni el gateo de la EB-BIS. Los candados que hay que mover son los de la banda y
los del encabezado.

**Una cosa que conviene decidir antes de construir:** si el encabezado nuevo va **solo al informe del
paciente** o también a la hoja del plan y a la historia clínica. Nuestra recomendación es que vaya a los
tres: hoy los tres abren distinto, y un paciente que recibe dos documentos el mismo día no debería tener
que descubrir que son del mismo sistema.

---

## 6 · El PDF con datos de paciente: se movió a su propio registro

Este apartado traía un comando para sacar **un** archivo de los commits de hoy, bajo el supuesto de que
nada había salido a GitHub. Las dos cosas eran falsas: el push ya estaba hecho, y hay once PDF de paciente
en el historial desde el 1 de septiembre.

**El registro del incidente, con el alcance verificado y el runbook completo, vive en
`docs/incidents/2026-11-05-pdf-de-paciente-en-el-historial.md`.** No se duplica aquí: una copia de un
runbook se desactualiza y contradice al original, que es exactamente lo que acabó pasando con el comando
que estaba en este apartado.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
