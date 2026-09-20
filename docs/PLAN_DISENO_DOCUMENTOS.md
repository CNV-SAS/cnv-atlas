# Los documentos: diseño, y las dos preguntas de fondo (2026-09-20)

Tres documentos pendientes de diseño: **el plan de alimentación**, **el Informe ANI-BIS-E** y, desde hoy,
**el PDF del SOAP**. Santiago pregunta tres cosas: en qué herramienta se hace, si cada uno necesita su
plantilla o hay algo común, y si el informe debe seguir llevando el plan entero dentro.

---

## 1. La herramienta: ni Canva ni un editor visual, y no es una preferencia

**Estos documentos no se maquetan: se generan.** El plan sale de `plan-paciente-reader` y se imprime desde
el navegador; el informe lo arma `@react-pdf` a partir del snapshot sellado; el SOAP se compone de la
historia clínica. El contenido cambia con cada paciente: un plan tiene entre tres y siete bloques según lo
que el profesional prescriba, y la lista de intercambio depende de la ciudad.

**Una plantilla de Canva no puede ser el entregable**, porque nadie va a rellenarla a mano 40 veces al día.
Lo que sí puede ser es la **referencia**: una imagen de cómo debería verse, que después se traduce a código.

**Entonces la pregunta útil no es la herramienta, es quién decide el aspecto.** Dos caminos, y el segundo
es el que recomiendo:

| | Cómo | Cuándo conviene |
|---|---|---|
| **(a) Referencia primero** | Santiago (o un diseñador) hace una maqueta en Canva de cada documento y yo la traduzco | Cuando hay una identidad visual fuerte que respetar y alguien con criterio gráfico para definirla |
| **(b) Maqueta en código, revisión sobre el resultado** (recomendada) | Yo propongo el sistema (tipografía, escala, encabezado, tablas) aplicado a los tres, Santiago lo ve **impreso** y corrige sobre eso | Cuando lo que falta es orden y jerarquía, no una identidad nueva. Y cuando el que revisa no es diseñador: es mucho más fácil decir "este título es muy grande" mirando el PDF que imaginarlo desde un Canva |

**La razón de fondo para (b):** la parte difícil de estos documentos no es el aspecto, es el
**comportamiento**. Cuántas páginas ocupa, dónde parte, qué pasa cuando un bloque queda vacío, cómo se ve
un plan de tres bloques frente a uno de siete. Eso no se ve en una maqueta: se ve imprimiendo casos reales.
El defecto del SOAP de ayer (huecos de página) es exactamente de esa familia, y no lo habría cazado ninguna
plantilla.

---

## 2. ¿Plantillas separadas o algo común? Las dos cosas, en dos capas

**Sí se puede compartir, y conviene**, pero no la plantilla entera: **la base**.

**Capa común (una vez, la misma en los tres):**
- **El encabezado**, que ya existe y ya está compartido (`EncabezadoImpreso`): quién firma, a quién va,
  qué documento es y de cuándo.
- **La escala tipográfica**: un tamaño para el título del documento, uno para los títulos de sección, uno
  para el cuerpo y uno para las notas al pie. Hoy cada documento eligió los suyos.
- **El espaciado**: la distancia entre secciones, la sangría de las listas, el aire alrededor de las
  tablas. Es lo que hace que dos documentos "se vean de la misma casa" incluso con contenidos distintos.
- **El pie**: identificador del documento y numeración de página. El informe ya lo tiene; los otros dos no.
- **El color**: uno solo, el azul de marca, para títulos y reglas. Nada de color clínico en documentos del
  paciente (esa reserva es de los veredictos).

**Capa propia de cada uno:**
- **El plan**: la lista de intercambio y el menú, que son tablas largas y mandan sobre el resto.
- **El informe**: la gráfica, los bloques del diagnóstico y el plan embebido.
- **El SOAP**: los cuatro apartados, que se leen de corrido y necesitan respirar más que una tabla.

**Y hay una diferencia técnica que conviene tener presente:** el plan y el SOAP se imprimen **desde el
navegador** (CSS de impresión) y el informe se genera con **`@react-pdf`** (otro motor, otras unidades,
otras reglas de salto). La capa común se puede definir una vez como **decisiones** (esta escala, este
aire), pero se escribe dos veces: una en CSS y otra en estilos de react-pdf. No hay forma de compartir el
código entre los dos motores, y fingir que la hay es lo que produce documentos que divergen en silencio.

**Tamaño:** una tanda para definir y aplicar la capa común a los tres, más media por documento para lo
suyo. Recomiendo hacerlo **después** de (b) y (L), porque el diseño se hace una vez y conviene que sea
sobre los documentos ya estables.

---

## 3. ¿El informe debe seguir llevando el plan entero?

**Sí, y no por inercia.** Son dos usos distintos:

- **El plan** se imprime y se lleva **a la cocina**. Es una hoja de trabajo: se pega en la nevera, se
  mancha, se reemplaza el mes siguiente.
- **El informe** se manda por correo y **se guarda**. Es el documento de la consulta: el diagnóstico, lo
  que se decidió y lo que hay que hacer.

**Un informe que remitiera al plan en vez de llevarlo obligaría al paciente a tener dos archivos y a
cruzarlos.** Y el día que pierda uno de los dos, el que le quede no sirve solo: el diagnóstico sin el plan
no dice qué hacer, y el plan sin el diagnóstico no dice por qué.

**Lo que sí conviene, y es distinto:** que el informe **diga** que el plan va dentro, para que el
profesional sepa que no tiene que mandar las dos cosas. Hoy no lo dice en ninguna parte, y por eso surge la
duda. Es una línea de texto.

**Y la duplicación no es total:** el plan impreso no lleva el diagnóstico (decisión ya tomada: "es lo que
el paciente necesita en la cocina"), y el informe no lleva la lista de intercambio completa sino la
recortada por región. Son el mismo contenido con dos recortes, no dos copias.

---

## 4. Lo que hay que decidir antes de empezar

1. **¿Camino (a) o (b)?** Si es (a), hace falta quién haga las maquetas.
2. **¿Los tres documentos a la vez, o el informe primero?** El informe es el que más se manda; el plan el
   que más se imprime. El SOAP es el más nuevo y el que menos rodaje tiene.
3. **Tipografía:** hoy los PDF usan la de serie de `@react-pdf` (Helvetica). Cambiarla exige **incrustar**
   la fuente en el binario, y eso pesa. Si la identidad de marca pide una fuente concreta, se decide aquí.
