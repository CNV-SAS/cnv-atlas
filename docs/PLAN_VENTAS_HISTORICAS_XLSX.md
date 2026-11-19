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
