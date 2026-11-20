# Las ventas históricas y la conciliación de inventario

**Al 19 de noviembre de 2026.** Todo lo planeado para la carga de las ventas atrasadas y para dejar
cuadrado el inventario, en un solo sitio. **No se carga nada todavía.**

> **La plantilla de aquí es una PROPUESTA, no un formato cerrado.** Santiago ya tiene un archivo avanzado
> y se trabaja sobre ese. Lo que importa de este documento no son los nombres de las columnas, sino **qué
> hechos hay que poder leer de cada fila** y **en qué orden se carga**. Si el archivo de Santiago ya trae
> un dato con otro nombre, manda el suyo; lo que no puede faltar es el dato.

> **Dónde encaja:** el arranque es el **viernes 20** (`SMOKE_COMERCIAL_FINAL.md`). Esto va **después**, y
> tiene dos fechas límite que puso contabilidad:
>
> | Qué | Para cuándo |
> |---|---|
> | La carga del xlsx | **lunes 30 de noviembre**, antes del cierre del mes |
> | La conciliación de inventario | a más tardar el **5.º día hábil de diciembre** |

---

## 1 · Qué es, en una frase

Las ventas reales que ya ocurrieron, se facturaron **a mano en Alegra** y todavía no están en Atlas. Al
entrar: **descuentan inventario**, **cuentan para los reportes**, y **no** emiten factura, **no** cobran
por Wompi y **no** generan comisión duplicada.

> **Confirmado en el código el 2026-11-18:** la venta retroactiva escribe `created_at` **y** `operated_at`
> **en la fecha real de la venta** (es el único camino de la app que escribe `created_at`), guarda el
> número de la factura que ya existe y **nunca llama a Alegra**. Y las cifras se acotan por **la fecha de
> la venta**. O sea que **las ventas atrasadas cuentan en su mes**.

**Y por eso el inicio de la operación es el 2026-08-08 y no el día del arranque.** Si la ventana de las
cifras empezara el 20 de noviembre, ninguna de estas ventas contaría.

---

## 2 · HOJA 1 · Las ventas

Una fila por **producto**. Si una venta llevó tres productos, son **tres filas** con el mismo número de
factura.

| Columna | Obligatoria | Qué va | Por qué |
|---|---|---|---|
| `vendedor` | **sí** | el nombre del Integrante, o **`CNV`** | hay ventas que hizo CNV sin Integrante (la del 8 de agosto). Decide si hay comisión |
| `fecha_de_la_venta` | **sí** | `AAAA-MM-DD` | **es la fecha que mandan las cifras** |
| `producto` | **sí** | el nombre exacto del catálogo | |
| `lote` | **sí** | el código del lote | el inventario se descuenta por lote, no por producto |
| `cantidad` | **sí** | entero | |
| `de_donde_salio` | **sí** | `vitrina` (la del vendedor) o `bodega` | decide **de qué ubicación** sale el descuento |
| `medio_de_pago` | **sí** | `efectivo`, `transferencia` o `pasarela` | |
| `paciente_documento` | no | la cédula, si la venta tiene paciente | vacío = venta sin paciente, y entonces el motivo es obligatorio |
| `motivo_sin_paciente` | si no hay paciente | texto | las 3 ventas de Diana Marcela no tienen paciente |
| `factura_alegra_numero` | **sí** | el consecutivo (p. ej. `FE97`) | permite cotejar, e impide emitir una segunda |
| `factura_alegra_fecha` | **sí** | `AAAA-MM-DD` | **sale tarde a propósito** |
| `recibo_numero` | no | el del recibo o anticipo | |
| `recibo_fecha` | no | `AAAA-MM-DD` | **coincide con la fecha de la venta** |
| `descuento_valor` | no | pesos descontados al paciente | la venta del 8 de agosto lleva descuento |
| `descuento_motivo` | si hay descuento | texto | un descuento sin motivo es un precio inventado |
| `notas` | no | lo que haga falta | |

### Las TRES fechas, y por qué son tres

Son **tres hechos distintos**, y confundirlos descuadra el mes:

| Fecha | Qué afirma | Cuándo ocurrió |
|---|---|---|
| **de la venta** | el paciente compró y pagó | agosto a noviembre |
| **de la factura** | CNV emitió el documento en Alegra | **octubre o noviembre**, tarde |
| **del recibo o anticipo** | el dinero entró | **coincide con la de la venta** |

**Las cifras cuentan por la fecha de la VENTA. Confirmado**: el escritor de la venta retroactiva pone esa
fecha en las dos columnas que leen los cuatro lectores de cifras. La de la factura sirve para cotejar
contra Alegra; la del recibo es la que respalda la primera, y es la que hay que poder enseñar si alguien
pregunta por qué una venta de agosto tiene una factura de noviembre.

---

## 2bis · EL ARCHIVO QUE LLEGÓ, COTEJADO CONTRA LO DE ARRIBA (2026-11-19)

Santiago dejó el archivo el 19 de noviembre. **Está fuera de git** (lo cubre la regla
`docs/entregas/**/*.xlsx`, verificado con `git check-ignore`), y aquí no se escribe ni un
dato de paciente: solo cuentas.

**Lo que trae:** cuatro hojas. `Ventas` con **175 filas** de venta (del **2026-08-08** al
**2026-11-18**), `Catálogo` con los 5 productos, `Integrantes` con 11 personas más CNV, y
`Desglose NUTRIS`, que es una hoja de cuentas a mano (celdas sueltas, sin tabla) y **no se carga**:
sirve para cotejar totales, no para leerla con un programa.

**La estructura es buena.** Una fila por producto, que es justo lo que pide el cargador, y el vendedor con
`CNV` escrito tal cual cuando la venta no es de un Integrante. Lo que falta no es forma: son
**cuatro datos que el archivo no tiene** y sin los que el inventario no se puede descontar bien.

### a) Las columnas, una por una

| Lo que pide el cargador | Qué hay en el archivo | Veredicto |
|---|---|---|
| `vendedor` | **`Integrante`** (175/175, y CNV viene como `CNV`) | **sirve tal cual** |
| `fecha_de_la_venta` | **`Fecha de venta`** (175/175, fechas puras a 00:00 UTC) | **sirve tal cual.** Ver el aviso de abajo sobre la zona |
| `producto` | **`Producto`** (175/175, los 5 nombres exactos del catálogo) | **sirve tal cual** |
| `cantidad` | **`Cantidad`** (175/175) | **sirve**, menos una fila con `9,6` (ver abajo) |
| `paciente_documento` | `Paciente` trae **el NOMBRE**, nunca el documento (175 nombres, 120 pacientes distintos) | **se mapea, y es el mapeo más caro.** Atlas resuelve identidad **por documento exacto**; con el nombre no puede, y adivinar es colgarle una compra a otra persona |
| `descuento_valor` | `Descuento al paciente %` (un **porcentaje**: 0, 0,206, 0,4 y 0,434) | **se mapea**: pesos = PVP x cantidad x %. 8 filas con descuento |
| `factura_alegra_numero` | `ID / Factura Alegra`, **28 de 175 llenas** | **se mapea, con dos problemas** (ver abajo) |
| `lote` | **no está** | **se deduce**: hoy hay **un solo lote por producto**, así que sale del catálogo. Hay que escribirlo, no suponerlo |
| `de_donde_salio` | **NO ESTÁ, y es la que más falta** | **falta.** Sin ella no se sabe si la unidad salió de la vitrina del Integrante o de la bodega, y el descuento de inventario va a la ubicación equivocada |
| `medio_de_pago` | `Estado de pago` dice **si** se pagó (Pagado / Pendiente), no **cómo** | **falta** |
| `factura_alegra_fecha` | **no está** | **falta.** Es la fecha que explica por qué una venta de agosto tiene factura de noviembre |
| `recibo_numero` / `recibo_fecha` | **no están** | **faltan**, y son el respaldo del dinero |
| `motivo_sin_paciente` | **no está** | **puede que no haga falta**: las 175 filas traen paciente, incluidas **las 3 de Diana Marcela** (ver la pregunta 1) |
| `descuento_motivo` | **no está** | **falta** en las 8 filas con descuento |

**Y hay diez columnas que el cargador NO necesita**, porque **Atlas las vuelve a calcular**: PVP unitario,
Total con IVA, Base sin IVA, IVA, % Integrante, Ganancia Integrante, Proveedor tercero, Ingreso neto CNV,
Cómo recibe la ganancia y Modalidad. **No se borran: se usan para COTEJAR.** Si lo que calcula Atlas no
coincide con lo que dice el archivo, ahí hay algo que mirar antes de cargar, y eso vale más que la columna.

> **⚠ LA ZONA HORARIA, que es el error fácil de este archivo.** Las 175 fechas están guardadas como
> **fechas puras a 00:00 UTC** y son correctas (la primera venta es el **8 de agosto**, no el 7). Pero si
> el cargador las convierte a la hora de Colombia, **retroceden un día** y las 175 ventas cambian de
> fecha: la del 8 de agosto se vuelve del 7, y una venta del día 1 de un mes se va al mes anterior. **Es
> un hazard ya documentado en el proyecto** (`edadEnFecha` en `src/lib/format/edad.ts`: una
> fecha pura no se pasa por la zona). El cargador lee los tres primeros campos de la fecha y nada más.

### b) Mejoras concretas, que Santiago puede aplicar a mano

Van en orden de lo que más duele:

1. **La columna `Código` de la hoja `Ventas` está rota: NO SE PUEDE LEER.** La celda tiene
   formato de fecha (`yyyy/mm/dd`), así que los 174 códigos quedaron convertidos en **fechas
   inválidas**. Un programa lee basura y una persona ve `#######` o una fecha absurda.
   **El arreglo:** seleccionar la columna, formato **Texto**, y volver a escribir los códigos.
   **Y de paso, el nombre engaña:** lo que hay ahí (`NUT-001`) es la **REFERENCIA**, no el código.
   El código de Alegra es el número (`2` a `6`). Esa confusión ya costó tiempo el 17 de
   noviembre. Mejor dos columnas: `Referencia` y `Código Alegra`.

2. **Añadir la columna `De dónde salió`**, con dos valores y nada más: `vitrina` o
   `bodega`. Es la que decide de qué ubicación se descuenta, y hoy **no hay forma de deducirla**:
   la modalidad no sirve, porque Angela vendió por Comisión y por Distribución. Si se deja vacía, el
   cargador tiene que frenar esa fila, no suponer.

3. **Partir `FE6 / NC1` en dos columnas.** Hoy **15 filas comparten esa misma celda**, y son de
   **tres días distintos** (3, 4 y 5 de septiembre): no pueden ser una sola factura. Y lleva una factura
   **y una nota crédito** en el mismo texto, que son dos documentos con efectos opuestos. Dos columnas:
   `Factura` y `Nota crédito`, cada fila con la suya.

4. **Añadir `Fecha de la factura`, `Medio de pago`, `Recibo` y
   `Fecha del recibo`.** Cuatro columnas. La fecha de la factura es la que explica el desfase; el
   medio de pago es obligatorio en Atlas para registrar el cobro.

5. **Poner el DOCUMENTO del paciente al lado del nombre.** Es lo que deja cargar las ventas sin
   adivinar. Si para una fila no se sabe, se deja vacía: **una fila sin documento se carga a mano y se
   revisa, y eso es mucho mejor que colgarla al paciente equivocado.** El encabezado ya lo pedía ("solo
   nombre o ID") y quedó con el nombre completo; con el documento al lado, el nombre se puede incluso
   borrar antes de pasar el archivo a nadie.

6. **Revisar la fila con `Cantidad = 9,6`** (Katherine, OMEGA COMPLEX, Distribución, sin factura).
   No existen 9,6 frascos. Deja su saldo en **14,4 unidades**, que no es un inventario.

7. **Completar las cédulas de la hoja `Integrantes`**: solo **2 de 11** la tienen, y las dos en
   **formatos distintos** (`42107382-2` con dígito de verificación y `43.868.949` con
   puntos). Atlas cruza por documento exacto: conviene **un solo formato, sin puntos ni guiones**.

8. **Borrar las cuatro columnas vacías del final** de la hoja `Ventas` (20 a 23). No estorban al
   cargador, pero hacen que la tabla parezca tener 23 columnas y se preste a escribir en la equivocada.

9. **La hoja `Integrantes` dice "Falta RUT" en cinco**, y el 19 de noviembre ya habían entregado
   RUT y cuentas de cobro. Actualizarla, o el archivo contradice lo que ya se sabe.

### c) Lo que el archivo NO puede resolver, y hay que preguntar

1. **Las 3 ventas de Diana Marcela SÍ tienen paciente en el archivo**, y el plan de arriba (§6.1) asumía
   que no. ¿Son pacientes de Atlas, con documento, o son nombres anotados sin ficha? **De la respuesta
   depende si la pieza "venta SIN PACIENTE" hace falta para cargar el xlsx**, o si se puede dejar para
   después.

2. **147 de las 175 filas no tienen número de factura.** Concentradas así: Angela **101 de 119**, María
   Teresa **19 de 19**, CNV **16 de 16**, María Camila **4 de 4**, Diana **3 de 3**, Katherine **1 de 1**,
   Valentina **3 de 13**. Por mes: agosto 4 de 4, septiembre 39 de 60, octubre 74 de 81, noviembre 30 de
   30. **¿Están sin facturar, o están facturadas y el número no se anotó?** No es lo mismo: lo primero es
   un pendiente con la DIAN, lo segundo es solo transcripción. Y si están sin facturar, **¿se emiten al
   cargarlas o se cargan ya emitidas?**

3. **Ninguna fila dice de dónde salió el producto.** Sé que varias de Angela salieron de la bodega, pero
   el archivo no lo dice en ninguna. **¿Cuáles?** Sin eso, el descuento de inventario va a la vitrina del
   Integrante en todas, y ahí es donde aparece el saldo negativo del informe.

4. **Angela está declarada en `Comisión` en la hoja Integrantes, y en la hoja Ventas tiene las
   dos modalidades** (109 unidades por Comisión y 23 por Distribución). La observación de la hoja dice
   "tiene 2 ventas por distribución", pero son **23 unidades, no 2**. ¿Cuál manda? En Atlas la modalidad
   es **vigente con fecha**, así que si cambió, la fecha del cambio decide cada venta.

5. **Angela tiene `% Retención comisión = 0,1`** (10 %) en la hoja Integrantes. Atlas calcula la
   retención del Integrante con la tabla del art. 383 y la tarifa configurada. **¿El 10 % lo dijo la
   contadora para ella en particular?** Si sí, es un dato por persona y no una tarifa general.

6. **12 filas están `Pendiente` de pago** (CNV 8, María Camila 3, Angela 1). **El producto ya
   salió**, así que el inventario se descuenta igual; lo que queda es una **cuenta por cobrar**.
   ¿Se cargan como venta pagada con cartera, o como venta sin cobro registrado?

7. **Cuatro Integrantes tienen producto y ninguna venta** en el archivo: Zoraida, Frank, Camilo y Víctor.
   ¿Es que no han vendido, o es que sus ventas no están en el archivo? Lo primero no se arregla; lo
   segundo cambia el inventario de cuatro vitrinas.

8. **La hoja `Desglose NUTRIS` tiene totales a mano** que conviene cotejar contra lo que calcule
   Atlas (menciona "Ingresos 12 ventas" de Valentina, y un "no me ha confirmado" de María Camila). ¿Es la
   fuente de algo, o son cuentas de trabajo que se pueden descartar?

9. **Tres columnas calculadas no tienen valor guardado**, solo la fórmula: `% Integrante` (16
   filas), `Ganancia Integrante` (1) y `Proveedor tercero` (169). Si el archivo se exporta
   a CSV **salen vacías**. No importa para cargar (Atlas las recalcula), pero sí importa si alguien las
   usa para cuadrar a mano.

---

## 3 · HOJA 2 · El conteo de la bodega central

| Columna | Qué va |
|---|---|
| `producto` | el nombre exacto |
| `lote` | el código |
| `cantidad_contada` | lo que de verdad hay, contado a mano |
| `fecha_del_conteo` | `AAAA-MM-DD` |

---

## 4 · El orden de carga, y por qué es ese

1. **Primero las ventas.** Cada una descuenta de donde diga `de_donde_salio`. Al terminar, el inventario
   del sistema ya no está inflado: las unidades que salieron, salieron.
2. **Después** se compara lo que queda con el conteo físico.
3. **La diferencia se ajusta con un movimiento de `conciliacion`** por producto y lote, con su motivo.

> **Al revés no sirve, y es la parte que importa.** Si se concilia primero y se cargan las ventas después,
> las ventas descuentan sobre un saldo ya corregido y la bodega baja **dos veces por lo mismo**. Y si se
> conciliara **en vez** de cargar las ventas, el número cuadraría **tapando** lo que pasó: nadie sabría
> qué se vendió, ni a quién, ni habría cómo cotejarlo contra Alegra.
>
> **La conciliación final NO tapa errores, los muestra.** Si después de cargar todas las ventas el saldo
> sigue sin cuadrar con el conteo, esa diferencia **es un hallazgo** y queda escrita con su motivo.

---

## 5 · La validación del archivo, ANTES de cargar

El cargador corre en **dos pasadas**, igual que los scripts del arranque: la primera **valida y no escribe
nada**, e imprime el cuadro "LO QUE VA A PASAR" (cuántas ventas, cuánto dinero, cuántas unidades por
producto, cómo queda cada vitrina y cómo queda la bodega).

**Se rechaza el archivo entero si:**

| Qué | Por qué no se puede dejar pasar |
|---|---|
| un `producto` o un `lote` no existe en el catálogo | descontaría de donde no es, o no descontaría |
| un `vendedor` no existe (y no es `CNV`) | la venta quedaría sin dueño |
| falta `factura_alegra_numero` | sin él no hay cómo cotejar, y es lo que impide emitir una segunda |
| ese número **ya está en Atlas** | sería la misma venta dos veces |
| hay paciente y el documento no existe | mejor parar que crear un paciente desde una hoja de cálculo |
| no hay paciente y no hay `motivo_sin_paciente` | |
| hay `descuento_valor` y no hay motivo | |
| la fecha de la venta es anterior al **2026-08-08**, o va más de 90 días antes de su factura | atrapa el año mal tecleado y dos columnas invertidas |
| `de_donde_salio` = `vitrina` y esa vitrina **no tiene saldo suficiente** del lote | el descuento dejaría un saldo negativo |

---

## 6 · Las tres piezas que hay que construir

**Las tres van antes del 30 de noviembre. Dos días y medio en total.**

### 6.1 · La venta SIN PACIENTE · media jornada

**El hueco está en el escritor, no en el esquema:** `registrarVentaRetroactiva` **exige** un `patientId`,
pero `transactions.patient_id` **sí admite nulo** en la base.

**Y NO se resuelve con un "paciente genérico".** Uno inventado contaminaría la lista de pacientes, las
cifras clínicas, la cohorte de investigación y el conteo de consentimientos, **y se vería igual que uno
bueno**. Es la clase de dato falso que nadie detecta después.

**Qué hay que hacer:** aceptar `patientId = null` **con motivo obligatorio**, igual que la venta suelta ya
exige el suyo cuando no sale de ninguna consulta. La factura no se emite, que es lo que ya hace toda venta
retroactiva.

> **Ojo al hazard 6 en el formulario:** `required={!sinPaciente}`, **nunca** `required` a secas, o la
> salida queda bloqueada por el navegador y quien tiene que registrar la venta inventa un paciente para
> poder enviar.

**Las 3 ventas de Diana Marcela son el caso que lo obliga:** vendió 1 OMEGA, 1 CURCUMIN y 1 D3-K2 siendo
integrante, **sin paciente asociado**. Esas ventas tienen que quedar **a su nombre** en su historial, y al
descontar sus 3 unidades la dejan **en cero**, que es donde tiene que terminar.

### 6.2 · La venta de CNV sin Integrante, y el descuento comercial · una jornada

**Estaban dimensionados y sin construir. Pasan a ser requisito del xlsx**, porque la venta del 8 de agosto
es las dos cosas a la vez: la hizo CNV (la vendió Gildardo), **sin comisión** y **con descuento** al
paciente.

| Pieza | Qué hace falta |
|---|---|
| **Venta sin Integrante** | `professional_id = null`. El sellado **ya lo contempla** (*"una venta sin profesional no se bloquea: no hay modalidad de nadie"*, candado existente) y **no crea fila de comisión**, que es justo lo que se quiere. Falta la superficie |
| **Descuento comercial** | un valor y un motivo por línea. **El IVA se calcula sobre el precio ya descontado**, y el reparto también: un descuento que no baje la base haría que CNV pagara IVA sobre plata que no cobró |

**Para el xlsx basta con que el cargador sepa ponerlos**; la pantalla puede ir después.

### 6.3 · El cargador · una jornada

Lee las dos hojas, valida, imprime el cuadro y escribe por los caminos que ya existen.

---

## 7 · El interruptor `VENTAS_HISTORICAS_CARGADAS`

Vive en `src/modules/nutraceuticals/carga-de-ventas-historicas.ts` y hoy vale **`false`**.

Mientras sea `false`, **las tres pantallas de inventario** (`/mi-inventario`, `/faltantes` y la tarjeta
"En las vitrinas" de `/direccion`) avisan de que el sistema **muestra más unidades de las que hay**.

**Se pone en `true` en el mismo commit que carga el xlsx**, y ese commit es el registro de que se cargó.
Su candado falla ese día, para obligar a mirar las tres pantallas antes de quitar el aviso.

---

## 8 · LA CONCILIACIÓN DE INVENTARIO (contabilidad, 2026-11-18)

**Antes del cierre de noviembre, y a más tardar el 5.º día hábil de diciembre.** En este orden, y el orden
es parte de la instrucción:

### Paso 1 · Cargar el xlsx de ventas atrasadas

Todo lo de arriba. **Va primero**, por la razón de la sección 4.

### Paso 2 · El conteo físico

**Dos conteos, no uno:**

- la **bodega central de CNV**;
- y el **stock de cada Integrante**, **confirmado con cada una**. No es un dato que alguien reporte por
  ellas: la vitrina está en su custodia y el conteo es su declaración.

> Atlas ya tiene la ventana de conteo (`conteo_dia_de_apertura` / `conteo_dias_de_ventana`,
> hoy día 1 y 5 días) y la pantalla "Conteo físico" de `/mi-inventario`. **Ese es el camino**: no hace
> falta nada nuevo para que cada Integrante declare su conteo.

### Paso 3 · Comparar los TRES saldos, por producto

| Saldo | De dónde sale |
|---|---|
| **Atlas** | todas las ubicaciones sumadas (bodega + vitrinas), no solo la bodega |
| **El conteo** | lo que se contó en el paso 2 |
| **Alegra** | el inventario de la contabilidad |

### Paso 4 · Ajustar los DOS sistemas al conteo

- **En Atlas:** un movimiento de `conciliacion` con su motivo (**"conteo físico"** y la fecha). Visible,
  con autor, inmutable.
- **En Alegra:** lo hace la contadora.
- **Cada diferencia queda explicada.** Una diferencia sin explicación es el error que vuelve el mes
  siguiente.

### Y la regla que empieza en diciembre

**En cada cierre mensual, el total por producto de Atlas tiene que ser igual al de Alegra.**

Es una regla nueva y permanente, y conviene decir lo que implica: hoy nadie compara esos dos números, así
que el primer cierre en que no cuadren va a ser el primero en que alguien se entere. **Vale la pena
plantearse un cotejo automático** (`scripts/cotejo-alegra.mjs` ya cruza el catálogo; cruzar los saldos es
el paso siguiente). Queda anotado, sin fecha.

---

## 9 · Lo que NO cambia, y conviene tenerlo escrito

- **El xlsx no emite ninguna factura.** Ya se emitieron a mano, y el número de cada una viaja en la fila.
- **No cobra por Wompi.**
- **No duplica comisiones ya pagadas**: las ventas de antes del arranque están marcadas como prueba y el
  liquidador las excluye.
- **La misma venta física queda dos veces en Atlas**: la de antes del arranque (marcada como prueba, que
  no cuenta en ninguna cifra) y la del xlsx. Contabilidad lo confirmó el 2026-11-18.
