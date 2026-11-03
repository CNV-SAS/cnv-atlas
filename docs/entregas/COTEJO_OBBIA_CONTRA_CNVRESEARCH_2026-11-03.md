# /obbia contra su CNVResearch: qué falta, qué se queda y qué se construyó hoy

**Fecha:** 2026-11-03 · **Para:** Santiago · **Fuentes:** sus dos capturas de CNVResearch
(`cotejo-visual/html/cnv research/`) contra el código de `/obbia`.

> **Una nota antes de empezar: la carpeta `cotejo-visual/atlas-web/obbia/` está VACÍA.** Se creó hoy a
> las 07:22 y no tiene ningún archivo, así que las capturas de /obbia que usted dice haber actualizado no
> llegaron. El cotejo de abajo se hace contra el CÓDIGO de la pantalla, que para la lista de piezas es
> igual de exacto; lo único que no se puede juzgar sin las imágenes es el aspecto, y para eso basta su
> propio reporte (*"esas gráficas tan inmensas se ven muy extrañas"*), que ya está arreglado.

---

## Lo primero: la diferencia de fondo entre los dos paneles

Su CNVResearch contesta **"cómo se reparte la base"**. /obbia contesta **"qué de la base se puede usar"**.
No son dos versiones del mismo panel: son dos preguntas, y las dos hacen falta.

Y la segunda no es un adorno nuestro. Al leer su módulo el 24 de octubre se midió esto: **en las 385
líneas de su motor no aparece la palabra consentimiento, investigación ni autorización**, y el modo
"observatorio" solo deja en blanco el documento y el nombre. En su archivo eso no se ve como un defecto,
porque su consentimiento no tiene casilla de investigación. En Atlas, el mismo export sacaría a **53
personas que dijeron que no** y a **4 que lo revocaron**.

Así que el cotejo no es "copiar su panel": es **traerse lo que su panel contesta mejor, sin perder lo que
el nuestro contesta y el suyo no puede**.

---

## 1 · Lo que le faltaba a /obbia, y se construyó hoy

| Su pieza | Qué hacía falta | Estado |
|---|---|---|
| **Los cuatro consolidados** (por país, por ciudad, por sexo, por profesional), cada uno con Consultas · Pacientes · Con BIS · Con espectro · Edad media | Era lo más grande que faltaba, y lo que separa un panel de conteos de uno de investigación: *"cuántas consultas hay"* es una cifra, *"cómo se reparten"* es lo que decide si una cohorte sirve para un análisis | **Construido**, con sus cinco columnas tal cual |
| **Con espectro (Z5–Z500 crudos)** | Es la variable que su propia v11 §5.1 rescató porque *"se botaba al guardar"*. Sin saber cuántas la traen, no se puede plantear un análisis que la use | **Construido** |
| **Con encuesta completa** | Sin ella no hay DFI ni EB-BIS completa | **Construido** |
| **Con plan nutricional** | Las que llegaron hasta la prescripción, que es el desenlace | **Construido** |
| **Edad media, con su rango** | El rango va al lado a propósito, igual que en su archivo: una media de 41 sobre un rango de 18–79 y una sobre uno de 39–43 son dos cohortes distintas, y la media sola no las distingue. **Y se mide a la fecha de la medición, no a hoy**: una cohorte que envejece sola entre dos miradas no es una cohorte | **Construido** |

**Tres decisiones dentro de esos consolidados, por si se revisan:**

1. **La fila "Sin dato" se muestra.** Omitirla haría que las columnas no sumaran el total y nadie sabría
   por qué. Es lo que su módulo hace, y un candado contra la base comprueba que cada eje **suma la
   cohorte**: si alguna consulta no cae en ninguna fila, el caso falla.
2. **Sin edad se escribe un guion, no un cero.** Un cero ahí es un recién nacido, y "sin fecha de
   nacimiento" no es una edad de cero. Es la regla que cerró *"una fecha ilegible que se vuelve edad
   cero"*.
3. **El único eje que nombra a una persona es el del profesional**, que es quien atiende y no el sujeto de
   estudio. Su propio módulo lo hace igual. Aquí sigue sin salir ni una fila de paciente.

---

## 2 · Lo que le sigue faltando, y lo que cuesta

| Su pieza | Por qué no se construyó hoy | Tamaño |
|---|---|---|
| **El panel de filtros** (país, ciudad, sexo, profesional, edad desde/hasta, consulta desde/hasta, solo con bioimpedancia, solo con espectro, limpiar filtros, y el contador "6 de 6 consultas" en vivo) | Es la pieza que cambia la naturaleza de la pantalla: hoy /obbia es un **Server Component puro**, sin una línea de JavaScript de cliente, y filtrar en vivo pide estado. Se puede hacer sin romper eso (los filtros en la URL, el servidor recalculando), pero es una tanda propia y no cabía con el resto de hoy | media tanda |
| **La pestaña "Datos"** (la fila a fila) | **Cerrada a propósito, y no es falta de tiempo.** Un dataset fila a fila de esta cohorte sería SEUDONIMIZADO (dato personal bajo la Ley 1581), y la verificación de k-anonimato que `DATA_GOVERNANCE.md` exige para un export externo **no está construida**. El propio panel lo dice y lo CALCULA. Abrir esa pestaña sería sacar datos personales por una ruta sin ese control | bloqueada por el k-anonimato |
| **El botón de imprimir / guardar PDF del resumen** | Barato y útil. No entró hoy por orden, no por decisión | pequeño |
| **La línea de procedencia** (*"6 consulta(s) · 0 de la base compartida · 6 que aún no han sincronizado"*) | **No aplica.** Esa línea existe porque su archivo vive en un computador y sincroniza con la nube; en Atlas no hay nada que sincronizar: la base ES la base | — |
| **El aviso de "separación de permisos pendiente"** | **No aplica, y es la mejor noticia del cotejo:** ese banner dice que su separación entre dirección científica y consulta es *"de interfaz"* porque la clave del archivo es pública. En Atlas la separación es de servidor (RLS por rol), y /obbia está detrás de `canViewObbia` | — |

---

## 3 · Lo nuestro que se queda, y por qué no se puede perder

| Pieza | Por qué |
|---|---|
| **La cohorte por CONSENTIMIENTO** (autorizadas / sin autorización / el desglose por razón, con su peso) | Es lo que su módulo no mira, y la diferencia es jurídica. Sin esto, un export sacaría a 53 personas que dijeron que no |
| **La exclusión por CALIDAD DE DATO** (huella repetida) | Decisión suya del 25-oct. Una toma física en dos historias clínicas no se arregla anonimizándola: no se sabe de quién es el cuerpo |
| **La constelación de versiones del motor**, con las familias y el aviso de mezcla | Un dataset que mezcla versiones mayores compara lo incomparable. Y el aviso usa la MISMA función que la banda de trayectoria, para que no haya dos criterios de comparabilidad |
| **El nivel de anonimización DERIVADO** | No se teclea: sale de lo que el archivo lleva. Si mañana el export deja de llevar la llave del paciente, el rótulo cambia solo |
| **La exportación REGISTRADA** (`research_datasets` más el asiento de auditoría, en la misma transacción) | Su módulo exporta y no deja rastro. Un archivo de investigación sin registro es justo lo que esa tabla existe para impedir |
| **El texto de los pacientes del HTML** | *"No dijeron que no, nadie les preguntó. Si firman el consentimiento de Atlas, entran solas."* Un dato que se presenta como perdido no se recupera; uno que se presenta como pendiente, sí |

---

## 4 · Las gráficas inmensas: la causa, que era de libro

Su reporte: *"esas gráficas tan inmensas se ven muy extrañas."* Tenía razón y la causa es concreta.

El `viewBox` del SVG **se calculaba del número de barras** (`barras.length * 44 + 10`), así que con cinco
meses medía 230 × 150. Y el SVG lleva `w-full`. Un SVG con `viewBox` **escala el dibujo entero** para
llenar el ancho que se le da: en un panel de 1.100 px, esas 230 unidades se estiran casi cinco veces, y el
alto se va con ellas. La gráfica salía de unos 700 px de alta, con barras del grosor de una columna.

No era un problema de elegir un alto bonito: **el ancho lógico y el ancho real eran dos cosas distintas y
nadie las ataba**. `h-auto` significa "el que salga del viewBox", y el que salía dependía de cuántos meses
tuviera la cohorte: la misma pantalla se veía distinta en octubre y en noviembre.

**El arreglo:** el ancho lógico es una constante y las barras se reparten dentro, con un tope de grosor.
Así la proporción del dibujo (4:1) no depende de los datos, y la maqueta le pone su propio tope de ancho.
Con pocas barras salen anchas y con muchas finas, que es lo que se espera de una serie. Candado:
`el-resumen-de-la-cohorte`, que prohíbe volver a derivar el `viewBox` de los datos.

---

## 5 · Lo que recomiendo, en orden

1. **Los filtros** (media tanda). Es lo único grande que queda de su módulo, y es lo que vuelve el panel
   utilizable para plantear un análisis en vez de solo mirarlo.
2. **El botón de imprimir el resumen** (pequeño). Va con los filtros: un resumen filtrado que se puede
   guardar es lo que alguien lleva a una reunión.
3. **La pestaña de datos NO**, hasta que el k-anonimato esté construido. Y entonces es una decisión de
   gobierno, no de pantalla.

---

© Connected Nutrition Ventures SAS, 2026. Documento interno.
