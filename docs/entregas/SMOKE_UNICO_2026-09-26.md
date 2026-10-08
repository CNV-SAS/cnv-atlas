# Smoke único · todo lo que falta probar

**Para Santiago, 2026-09-26.** **Este documento reemplaza a los tres que estaban abiertos** y es el único que
hay que seguir. Los anteriores (`SMOKE_ACUMULADO_2026-09-24.md` y `SMOKE_ACUMULADO_2026-09-25.md`) quedan
marcados como reemplazados: sus pasos están aquí, y sus afirmaciones caídas están corregidas.

**Nueve partes, en el orden en que tiene sentido probarlas.** Cada una se puede parar sin dañar la siguiente.

| Parte | Qué | De dónde viene |
| --- | --- | --- |
| 1 | La devolución, con su dinero y su nota crédito | Comercial acumulado |
| 2 | Las ventas que ya ocurrieron | Comercial acumulado |
| 3 | Cómo llegó la plata (transferencia) | Comercial acumulado |
| 4 | Ver a un integrante desde admin | Comercial acumulado |
| 5 | Recibir una remesa sin teclearla | Comercial acumulado |
| 6 | Pacientes de prueba: proponer y confirmar | Depuración |
| 7 | El perfil en pestañas | Perfil |
| 8 | La modalidad de consignación | Perfil |
| 9 | Los tres exports del Biody y el cobro en tratamiento | Lanzamiento |
| 10 | Vender desde la bodega, y que alguien la despache | Lanzamiento |

---

## Antes de empezar

- **Migraciones: 184 en el repo, 184 aplicadas.** Al día, nada que correr.
- Entra como **admin / Dirección** para las partes 1 a 4, 6 y 8; como **integrante** para la 5 y la 7.
- Ten a mano un paciente de prueba, un producto, y **una venta pagada y entregada** (la parte 3 te deja crear
  una, así que puedes hacer la 3 antes de la 1).
- **Un dato que puede faltar y no es un fallo:** la cuenta puente de transferencias en Alegra. Si no está, una
  venta por transferencia **se registra bien** y su **factura espera**, con el motivo a la vista.

---

## Parte 1 · La devolución, con su dinero y su nota crédito

**Qué se prueba:** que devolver haga las **tres** cosas: la unidad espera verificación fuera del inventario
vendible, el ingreso y la comisión bajan **por la parte devuelta**, y queda pedida la nota crédito.

1. En **/pagos → Transacciones**, sobre una venta **pagada y entregada**, abre **"El paciente devolvió algo"**.
   Registra producto, unidades y motivo.
2. **En el mismo aviso** tiene que aparecer el valor de la nota crédito. Si solo habla del producto, el dinero
   no se movió.
3. **El inventario del integrante NO sube.** Lo devuelto no volvió a su vitrina.
4. **/comercial:** su comisión pendiente **bajó en la parte proporcional**. Si devolvió 1 de 2 unidades de una
   línea, baja la mitad **de esa línea**.
5. **El paso que no se puede saltar:** en /pagos, en el panel de reversas, la devolución aparece como
   **"Producto devuelto"** pidiendo su nota crédito **por la parte devuelta**. Escribe `NC-PRUEBA-1` y tiene
   que aceptarlo y cerrar el caso. Hasta el 25 esa nota crédito se **exigía** y **no había forma de
   registrarla**.
6. **Reincorporar al lote**, con destino y resultado de la verificación: sube el saldo de la ubicación elegida.
7. Otra devolución, esta vez **Dar de baja**: desaparece y **no sube ningún saldo**.

**Dos controles más:**

- **Devuelve la segunda unidad de la misma venta, en otro momento.** Tiene que dejarte.
- **Intenta devolver de una venta vieja** (anterior al reparto sellado por línea): tiene que **negarse**
  diciendo que se resuelve a mano con contabilidad.

**Y LUVIA:** devolver y reincorporar LUVIA tiene que **funcionar igual que cualquier otro producto**. La guía
del 24 decía lo contrario y estaba al revés: al momento de la venta el producto ya es de CNV.

---

## Parte 2 · Las ventas que ya ocurrieron

1. En **/admin/ventas-retroactivas**: quién vendió, a qué paciente, **una fecha de hace meses**, número de
   factura (`PRUEBA-001`), medio de pago y producto **con el precio de ese día**.
2. **Teclea el precio como lo harías de verdad: `11.900`.** Este paso es una prueba en sí: antes ese punto se
   leía como decimal y registraba una venta de **doce pesos** sin quejarse. Prueba también `11900` y `$11.900`.
3. **Qué tiene que verse:** el total, y la venta con **la fecha que le pusiste**.
4. **Y la pantalla tiene que cargar completa**, con su lista de abajo (daba 500).
5. **/pagos: qué NO tiene que verse.** Esa venta no aparece en facturación pendiente ni como "por cobrar".
6. El inventario del integrante **bajó**. Si el saldo no alcanzaba, queda marcada *No alcanzó el saldo*, y eso
   también es correcto.

**Controles:** la misma factura dos veces se niega; una fecha futura se niega; borrarla se niega si ya descontó
inventario, y entonces se corrige con una devolución.

---

## Parte 3 · Cómo llegó la plata

1. En **/pagos → Registrar una venta cobrada** hay un campo **"Cómo pagó"** con **Efectivo** y
   **Transferencia**.
2. Registra una **por transferencia**. Se registra, y en facturación la factura **espera con el motivo dicho**
   si la cuenta puente no está configurada. No es un error: es una espera explicada.
3. Registra otra **en efectivo** y comprueba que sigue igual que antes.
4. En **/admin/ventas-retroactivas** el mismo desplegable tiene las tres opciones.

---

## Parte 4 · Ver a un integrante desde admin

1. En **/admin**, cada integrante tiene **"Ver su inventario, sus ventas y su comisión"**.
2. **Qué tiene que verse:** las cuatro cifras arriba (ahora **con fondo**, en tarjeta), su inventario **por lote
   y ubicación**, sus últimas ventas con estado, el margen causado/liquidado/pendiente, y los faltantes.
3. **El control que la hace útil:** con esta pantalla en otra pestaña, rehaz los pasos 3 y 4 de la parte 1. Lo
   devuelto tiene que verse aquí: el saldo que no subió y el margen pendiente más bajo.
4. **Y que no se pase de su papel:** esta pantalla **no tiene ningún botón que cambie nada** (salvo el de
   modalidad, que es la parte 8).
5. El producto en **cuarentena** sale marcado **"no vendible"**.

---

## Parte 5 · Recibir una remesa sin teclearla

1. Como **admin**, en **/faltantes**, declara una remesa: producto, cantidad y **lote**.
2. **El arreglo que hay que ver:** el lote ya **no dice "(opcional)"**. Intenta dejarlo vacío: el rechazo llega
   en el campo, antes de enviar.
3. Como **el integrante**, en **/mi-inventario**: la remesa pendiente y **un solo botón, "Llegó completo (N)"**.
   Ya no hay panel donde teclear nada.
4. Pulsa y el saldo sube por lo declarado.
5. Otra remesa, y al confirmar usa **"No llegó así"**: **ahí sí** se abren los campos.
6. **Los tres casos de esa rama:** menos de lo declarado (sube lo que dijiste, queda la diferencia); **cero**
   (faltante total); más (sube solo lo declarado, y el aviso dice **por qué**).
7. **Teclea `1.000`** en una confirmación o en un conteo físico: tiene que ser **mil**. Antes se leía como
   **1**, y en el conteo eso abría un faltante de 999 unidades con cargo económico al integrante.

---

## Parte 6 · Pacientes de prueba

**Qué se prueba:** que se puedan sacar de las cifras sin borrarlos, y que **hagan falta dos personas**.

**Y la respuesta a tu pregunta de quién marca:** **el profesional PROPONE con un motivo, y admin CONFIRMA.**
No es burocracia: marcar saca al paciente de las cifras, así que quien se beneficia de la exclusión no puede
autorizarla solo. Un profesional que pudiera marcar solo tendría cómo esconder de su propio conteo a pacientes
reales.

1. Como **integrante**, entra a un paciente suyo de prueba: **/pacientes → el paciente**. Al final hay
   **"¿Es un paciente de prueba?"** con un campo de motivo.
2. Propónlo. **Qué tiene que decir el aviso:** que un administrador lo confirma y que **hasta entonces sigue
   contando en las cifras**.
3. **El control:** en su **lista de pacientes** el chip dice **"Propuesto de prueba"**, no "De prueba". Y en su
   **tablero**, el conteo de pacientes **no cambió todavía**.
4. Intenta proponerlo con un motivo de dos letras: tiene que negarse **con palabras**.
5. Como **admin**, en **/admin** aparece **"Pacientes propuestos como de prueba"** con el motivo completo.
   Confírmalo.
6. **Qué tiene que pasar ahora:** el chip pasa a **"De prueba"**, y en el tablero del integrante el conteo
   **baja**. En **/admin/integrantes/[id]**, sus "Pacientes asignados" también.
7. **Lo que NO tiene que pasar:** que desaparezca de la lista. Sigue ahí, marcado, porque si no el profesional
   no podría usarlo para probar, que es para lo que lo creó.
8. Como admin, **desmárcalo**: vuelve a contar.
9. **Y el control de fondo:** si ese paciente tenía ventas, **siguen ahí**. Marcar no deshace nada: por eso es
   seguro, y por eso el borrado de verdad es otra cosa (un paciente con diagnóstico confirmado **no se puede
   borrar**, la base lo bloquea).

---

## Parte 7 · El perfil en pestañas

1. Como **integrante**, entra a **/perfil**. Arriba: tu nombre, tu profesión y tu estado, y **tres tarjetas**
   (documentos firmados, tu perfil en %, tu margen).
2. **El arreglo que hay que notar:** cambiar de pestaña es **instantáneo**. Tardaba 1 a 2 segundos porque cada
   clic volvía al servidor a rehacer la página entera para mandar lo mismo.
3. **Mis datos:** nombre, correo, profesión, registro y documento **de solo lectura**, con el aviso de a quién
   escribirle. Abajo, **celular y consultorio**, que sí guardas. Guárdalos y recarga.
4. **Tributaria** y **Bancaria** ahora son dos pestañas. **El control importante:** guarda solo la tributaria
   de un integrante que no tenga cuenta; su perfil **no** debe quedar "completo" (si lo quedara, la liquidación
   dejaría pasar un giro sin destino).
5. **Y el titular de la cuenta:** en Bancaria, pon un documento distinto del tuyo. Tiene que negarse.
6. **Adjuntos:** sale tu RUT vigente. Sube uno nuevo desde Tributaria y vuelve: ahora hay **dos**, uno vigente
   y uno **reemplazado con su fecha**.
7. La tarjeta **"Tu perfil"** dice **qué** falta, no solo un porcentaje.

---

> ### Antes de correr las partes 8, 9 y 10 (verificado contra el código el 2026-10-04)
>
> Coteje estas tres partes contra el código antes de que las corrieras, porque el documento se escribió el
> 26 de septiembre y desde entonces se retiraron cosas. **Resultado: todo sigue en pie menos el paso 9.5,
> que ya está tachado abajo.** Los demás los encontré implementados tal como los describe el texto: las tres
> cards de modalidad nombran "el Integrante", el guard de Distribución llega a los tres puntos de cobro con
> su propio mensaje, la hoja del Biody se busca por sus columnas y no por su nombre, y el bloque aparte de
> LUVIA y el aviso de la bodega están donde dice.
>
> **Y uno que conviene correr con atención: el 9.3** (el botón "El paciente no los adquiere por ahora"). Se
> reconstruyó el 2026-10-02 porque abría un `<form>` dentro de otro y por eso no registraba nada. Es la
> clase de defecto que solo se ve en un navegador, así que ese paso es el que de verdad lo prueba.

## Parte 8 · La modalidad de consignación

1. En **/admin/integrantes/[id]** hay **"Modalidad de consignación"** con las dos cards del modelo comercial y
   la que aplica hoy marcada.
2. **Lee las cards:** tienen que hablar de **"el Integrante"**, no de "él" y "le".
3. Intenta pasar a **Distribución sin marcar la casilla de requisitos**: tiene que negarse nombrándolos.
4. Márcala y cambia. **El control que importa: el cambio NO rige hoy.** El aviso dice desde cuándo, y "Hoy
   aplica" **sigue diciendo Comisión**. Es la regla del modelo: el período en curso se cierra completo en un
   solo régimen.
5. Pídelo **dos veces**: no se acumulan dos cambios futuros, queda el último.
6. **/perfil del integrante:** ahí ve las mismas dos cards **en solo lectura**, sin botón para cambiarlas.
7. **El control de que manda de verdad:** con un integrante en Distribución (fecha ya vigente), intenta
   generarle un **link de pago** o una **venta en efectivo**. Tiene que **negarse diciendo por qué**: bajo
   Distribución el paciente le paga a él, así que cobrar por CNV mandaría la plata al bolsillo equivocado. El
   registro de ventas bajo Distribución todavía no está en Atlas, y el mensaje lo dice.

---

## Parte 9 · Los exports del Biody y el cobro en tratamiento

1. **Los tres exports.** En una evaluación con encuesta y condiciones, importa medición BIS con cada archivo:
   - **"Exportar medidas"** → funciona, como siempre.
   - **"Exportar medidas y datos del paciente"** → **ahora también funciona**. Antes se rechazaba porque su
     hoja de medidas se llama con el **nombre del paciente**; ahora la hoja se busca por sus columnas.
   - **"Exportar solo datos del paciente"** → se rechaza, y **el mensaje dice cuál archivo es y cuál hace
     falta**. Ese archivo no trae ninguna columna de medición: no hay nada que podamos hacer con él.
2. **El cobro, sin esperar el reporte.** Prescribe un nutracéutico y guarda. **Qué tiene que verse:** el bloque
   de venta con su link y su QR, **sin haber impreso ni enviado nada**. Antes exigía haber entregado el plan, y
   con la respuesta correcta ahí no aparecía nada: eso es lo que viviste como "no se abría el enlace".
3. **Ya no hay pregunta de tres opciones.** Donde estaba "¿el paciente adquiere los nutracéuticos?", ahora hay
   **un solo botón bajo los recomendados: "El paciente no los adquiere por ahora"**, que abre un campo de
   motivo. Pruébalo y comprueba que **no se vuelve a ofrecer** (dice lo que quedó registrado).
4. **El "sí" no se declara.** Véndele el producto sin tocar ningún botón de decisión, y mira el **cierre de la
   consulta**: el pendiente de nutracéuticos **ya no está**. La venta es el "sí".
   Y al revés: en una consulta sin venta y sin el botón, el pendiente **sí está**, y su texto nombra las dos
   salidas.
5. ~~**Lo clínico, en la línea del producto.**~~ **ESTE PASO YA NO APLICA: no lo busques** (corregido el
   2026-10-04, al verificar el documento contra el código antes de correrlo).

   El botón **"No lo recomiendo por razón clínica"** se **retiró el 2026-09-28**, a pedido tuyo y con una
   razón que sigue en pie: no tiene sentido que el profesional **agregue** un producto y en la misma línea
   diga que no lo recomienda. Si no lo recomienda, no lo agrega.

   **Lo que hay que saber, y es lo único que importa de este paso:** ese botón era **el único sitio que
   escribía `patient_contraindications`**, así que hoy ese registro **no tiene ninguna superficie que lo
   llene**. La tabla estaba vacía, así que no se perdió nada registrado; lo que se perdió es la capacidad, y
   su sitio propio ya está previsto (`observacion_clinica`, una contraindicación del paciente independiente
   de prescribir). Eso es lo que hay que construir cuando se retome, **no volver a poner el botón en la
   línea del producto**.

   **Lo que SÍ sigue y conviene mirar de paso:** el aviso de contraindicaciones del paciente se muestra
   **arriba** del bloque de nutracéuticos, en tono crítico, y trae las de **todas** sus consultas. Si alguna
   vez hubo una registrada, tiene que verse ahí.
6. **Los dos bloques.** El desplegable de nutracéuticos ya **no trae LUVIA**, y hay un bloque aparte:
   **"¿Quieres prescribir un producto diferente para el tratamiento del paciente?"** con la ficha de LUVIA
   (presentación, INVIMA, fabricante, y el alérgeno aparte en ámbar). El alérgeno **se muestra**, no se cruza
   con lo que declaró el paciente: eso lo sigue haciendo la yuxtaposición, como siempre.
7. **El stock que no bloquea a ciegas.** Con la vitrina en cero de un producto, el mensaje dice **cuántas hay en
   la bodega de CNV**. Antes decía "Sin unidades disponibles" y ahí terminaba. Lo que se puede hacer con eso es
   la parte 10.

---

## Parte 10 · Vender desde la bodega, y que alguien la despache

**Qué se prueba:** que un profesional con la vitrina en cero pueda **cobrar** y que CNV despache, y sobre todo
que esa venta **no se pueda olvidar**.

> **Antes de empezar, dos cosas que cambiaron el 7 de octubre y se ven aquí mismo** (las pidió Santiago al
> revisar las cifras):
>
> - **Cada línea del historial de /pagos dice ahora de quién es:** el nombre del paciente con su documento, y
>   **"Sale de una consulta"** como enlace cuando la venta la tiene atada (o **"Sin consulta atada"** cuando no,
>   que es un caso normal: viene del seguimiento o el paciente la pidió). Antes nueve líneas de 107.100 del
>   mismo producto eran indistinguibles.
> - **La tarjeta "Ingreso bruto facturado" de /direccion ahora cierra su propia resta:** dice cuántos pagos
>   hubo **y cuántos se devolvieron**, porque el conteo cuenta las pagadas y el importe descuenta el dinero de
>   las devueltas. Es lo que hizo dudar de la cifra en el recorrido anterior.

**Por qué esto último es el punto:** vender desde la bodega convierte un bloqueo visible ("no puedo vender") en
un olvido invisible ("cobré y nadie llevó nada"). Lo que lo hace seguro es el aviso, así que **el paso 5 es el
que importa.**

1. Como **integrante**, en una evaluación con un nutracéutico prescrito **del que no tengas unidades** (y que sí
   haya en bodega): en el bloque de venta aparece un interruptor, **"Cobrar y pedir que CNV lo despache desde la
   bodega"**.
2. **Qué tiene que verse ANTES de cobrar, al encenderlo:** que el paciente **no se lleva el producto hoy**, que
   la venta sale de la bodega, y que le llega el aviso a un administrador. Si no dice eso, avísame: cobrar
   creyendo que entregas es el error que esto viene a evitar.
3. **Y la línea que evita una segunda equivocación:** dice que **toda la venta sale del mismo sitio**, y que si
   quieres entregarle hoy lo que sí tienes, lo cobres en una venta aparte. Es porque la venta guarda **una sola**
   ubicación de origen.
4. Con el interruptor encendido, el producto **se puede marcar** y las unidades disponibles que muestra son
   **las de la bodega** (lo dice: "disponibles: N en la bodega de CNV"). Cobra, con QR o en efectivo.
5. **EL CONTROL QUE IMPORTA.** En la lista de ventas de esa consulta, la venta dice **"Sale de la bodega de CNV:
   falta despacharla"**. Y como **admin**, mira el correo de pendientes de ventas (o dispáralo): tiene que
   aparecer **"Ventas pagadas cuyo producto sale de la bodega y falta despachar"**.
   Si el aviso no está, el resto no sirve: significa que la venta puede quedarse sin que nadie la lleve.
6. **Registra la entrega** de esa venta. El aviso **desaparece**.
7. **El control de que no hace ruido:** una venta normal (de tu propia vitrina) pagada y sin entregar **no**
   aparece en ese aviso. Si apareciera, el aviso sonaría todo el día con ventas que se entregan en minutos y se
   dejaría de mirar.

**Y una cosa que NO cambió, a propósito:** el interruptor **no se enciende solo**. Si le falta producto, hay que
marcarlo. Encenderlo por su cuenta haría que una venta saliera de la bodega sin que nadie lo decidiera.

---

## Qué reportar

De cada parte, lo que viste y sobre todo **lo que no viste**. Si algo se ve distinto de lo escrito aquí,
mándame la pantalla tal cual: **el texto de esta guía es la afirmación que se está probando**, y si la realidad
no coincide puede estar mal la guía. Ya pasó tres veces, y las tres la guía era la equivocada.

**Al terminar:** las ventas y devoluciones de prueba se pueden dejar. Lo único que conviene no dejar a medias es
una **liquidación calculada y sin girar**, porque retiene comisiones que quedarían fuera de la siguiente.

// ====== //
## RESULTADOS SANTIAGO

**Smoke de números que hago a la vez mientras hago el smoke completo:**
(por favor, revisa los numeros, que no haya nada raro, que todo sume o reste segun lo que deba de dar, ya que estos datos comerciales son extremadamente importantes y criticos).
// Entro a como admin y en inicio aparece:
"Tu mes
Tu comisión
$ 539.378
Ventas
$ 3.233.100
Unidades en inventario
1903"

y si voy a /direccion aparece:
"Dirección
Agregados, sin datos personales.

Ingreso bruto facturado
$ 3.233.100
15 pagos
Ingreso CNV
$ 2.104.571
Comisiones a profesionales
$ 539.378
Inventario
1819 unidades
6 productos en 9 ubicaciones"

Ahi lo unico raro que veo es que no coinciden en el inventario.

Por otro lado, en la cuenta de profesional demo inicio asi:
"Tu mes
Tu comisión
$ 524.252
Ventas
$ 3.143.100
Unidades en inventario
34"

Por cierto, el profesional maria Camila habia hecho un ejercicio de prueba vendidendo 1 LUVIA, yo lo devolvií y aparecio asi en inicio de admin:
"Tu comisión
$ 524.252
Ventas
$ 3.233.100
Unidades en inventario
1904"

Por qué aumentaron las ventas sabiendo que antes devolvimos una LUVIA? y los numeros si cuadran?

Y en direccion aparece:
"Dirección
Agregados, sin datos personales.

Ingreso bruto facturado
$ 3.233.100
15 pagos
Ingreso CNV
$ 2.097.008
Comisiones a profesionales
$ 524.252
Inventario
1820 unidades
6 productos en 9 ubicaciones"


Entonces resumiendo, antes de empezar el smoke completo iniciamos asi:
Admin pagina inicio:
"Tu comisión
$ 524.252
Ventas
$ 3.233.100
Unidades en inventario
1904"

Admin pagina direccion:
"Dirección
Agregados, sin datos personales.

Ingreso bruto facturado
$ 3.233.100
15 pagos
Ingreso CNV
$ 2.097.008
Comisiones a profesionales
$ 524.252
Inventario
1820 unidades
6 productos en 9 ubicaciones"

y voy a hacer el smoke con el producto "PRUEBA SMOKE BLOQUE 3" que tiene 3 unidades. Cada unidad cuesta 11.900

Parte 1:

Ahora entro como profesional demo y al paciente con documento 1000898123 le vendo 2 unidades en efectivo y pongo que lo pagó en efectivo. (23.800). Luego los marco como entregados.

Actualizo entonces el tablero comercial:
"Admin inicio:
Tu comisión
$ 528.252
Ventas
$ 3.256.900
Unidades en inventario
1902
"
"Admin direccion
Dirección
Agregados, sin datos personales.

Ingreso bruto facturado
$ 3.256.900
16 pagos
Ingreso CNV
$ 2.113.008
Comisiones a profesionales
$ 528.252
Inventario
1820 unidades
6 productos en 9 ubicaciones
"
"Profesional demo inicio:
Tu comisión
$ 528.252
Ventas
$ 3.166.900
Unidades en inventario
32
"

No entiendo por que difieren las venntas ya que profesional demo es el unico que ha vendido, ya que el producto que vendio Maria Camila se devolvio, entonces adminy  profesional demo deberian dar lo mismo, no?

Ahora voy entro al perfil de admin, voy a /pagos al bloque transacciones y le doy al "paciente devolvio algo" donde voy a devolver solo un producto (11.900) y coloco de motivo "SMOKE PRUEBA PARTE 1".

Aparece este toast de exito:
"Devolución registrada. La unidad queda en devueltas pendientes de verificación, no vendible. Se revirtió el ingreso y la comisión de esas unidades: hay que emitir la nota crédito por 11.900 en Alegra.
"

El inventario de profesional demo no subio, apenas quedó una unidad disponible del producto.

Así quedaron los datos:
"Admin inicio:
Tu comisión
$ 526.252
Ventas
$ 3.256.900
Unidades en inventario
1903
"
"Admin direccion:
Dirección
Agregados, sin datos personales.

Ingreso bruto facturado
$ 3.256.900
16 pagos
Ingreso CNV
$ 2.105.008
Comisiones a profesionales
$ 526.252
Inventario
1820 unidades
6 productos en 9 ubicaciones
"

"Profesional demo inicio:
Tu comisión
$ 526.252
Ventas
$ 3.166.900
Unidades en inventario
32
"

Por otro lado, como admin fui a /comercial y aparece:
"Profesional Demo
$2.000 en 5 comisiones"
Si está bien, verdad? ya que el PVP del producto es 11.900, pero segun entiendo trae IVA, entonces la comision se da sobre la base sin IVA (10.000) entonces creo que está bien, ya que es el 20% de un producto que no se devolvio. El problema es que dice "5 comisiones" cuando realmente apenas fue 1. Me imagino que aparece 5 de smokes acumulados de antes que venia y los devolvia.

Como admin vuelvo a /pagos y en el bloque de transacciones del cual vendí las 2 unidades, pero devolví 1 aparece asi:
"23.800 COP
PRUEBA SMOKE BLOQUE 3 x2
27/9/2026, 1:37 p. m. · Efectivo · Factura SETP990214740
Entregado el 27/9/2026, 1:37 p. m.
Disputa ganada: el dinero volvió y la venta sigue en pie.
Pagado"

Esto si está bien? ese mensaje de disputa ganada aparece en rojo. Y el estado dice pagado. Que piensan?


Ahora si voy al panel de reversas en /pagos aparece esto:
"Contracargos y anulaciones
El banco devolvió el dinero de una venta ya cobrada. Mientras la disputa esté abierta el ingreso no se toca: la factura sigue siendo válida. Responde al banco con los soportes, porque una disputa sin respuesta a tiempo se pierde.

23.800 COP
PRUEBA SMOKE BLOQUE 3 x2
Devolución del paciente · Producto devuelto
Abierta el 27/9/2026, 1:44 p. m. por Santiago Arroyave · el banco debitó 11.900 COP · resuelta el 27/9/2026 por Santiago Arroyave

El débito difiere del valor de la venta en 11.900 COP menos. La diferencia se concilia con contabilidad: la nota crédito va solo por el valor de la venta."

No dice cuantos productos se devolvieron.

Coloqué la nota credito: "NC-PRUEBA-1" y la registré. Aperece este toast de exito: "Nota crédito registrada. El caso queda cerrado."

Si me deja reincorporar el producto y si selecciono dar de baja, no vuelve a aparecer.

Por cierto, el producto LUVIA que habia vendido Maria Camila en una prueba que hice con ella si me dejó volversela a reincorporar.

Por ultimo, en el mismo bloque que habia vendido los 2 productos, voy a devolver el otro restante para devolverlo al inventario de profesional demo y quedar con 2 productos y todo salio bien.

Este es el cierre de la parte 1, profesional demo quedó con 2 productos del smoke en el inventario, que CC revise que el tercer producto no se haya devuelto a ningun lado.

Los datos quedaron asi:
"Admin inicio:
Tu mes
Tu comisión
$ 524.252
Ventas
$ 3.256.900
Unidades en inventario
1903
"
"Admin direccion:
Dirección
Agregados, sin datos personales.

Ingreso bruto facturado
$ 3.256.900
16 pagos
Ingreso CNV
$ 2.097.008
Comisiones a profesionales
$ 524.252
Inventario
1820 unidades
6 productos en 9 ubicaciones
"
"Profesional demo inicio:
Tu mes
Tu comisión
$ 524.252
Ventas
$ 3.166.900
Unidades en inventario
33
"
Porfa revisen que los numeros si cuadran, personalmente me parece un poco extraño.

Ademas, en /comercial aparece esto: "Profesional Demo
$0 en 6 comisiones" y el botón de liquidar. ¿Aqui hay que corregir algo?


Si voy a /pagos al bloque "Registrar venta en efectivo
Cobro en efectivo, ya pagado. El precio y el producto son de CNV; el dinero que recaudas es de CNV y lo custodias hasta consignar.", ahora aparece un selector "cómo pagó" y pone efectivo o transferencia. Es ilogico? o no es  tan ilogico y solo toca cambiarle el nombre al bloque. Ya que puede pasar que falle wompi y en ese caso toca que paguen directamente a la cuenta bancaria de CNV.

Una duda, yo estaba haciendo el ejercicio con producto smoke y compré 2 unidades que tambien marqué como entregadas.
Ambas unidades en total valieron 23800.
Entonces el ingreso bruto facturado si sube 23800, pero en ingresos CNV apenas aumentó 16000. Por que? Tiene iva y luego se quita el 20% a la base sin iva?
En comisión a profesionales apenas fueron 4000.


Parte 2:
Una observacion que noté, si pongo "quien la vendio" cualquier nombre y "a quien" tambien me deja poner cualquier nombre. Esto no deberia pasar, verdad? solo deberian aparecer los nombres de los pacientes en "a quien" del profesional correspondiente. Ya que asi facilitamos el ejercicio y no mezclamos los pacientes de un profesional que pueden tener 140 con otro profesional de 10 pacientes.

Inicio pruebas nuevamente con el profesional demo y el paciente con identificacion 1000898123:

Factura SMOKE PRUEBA-001 que haya ocurrido el 1/1/2026
Supongamos que vendí 90 productos MULTICELL BASE a PVP con IVA incluido a 11900.

Aparece este texto rojo en error: "Revisa producto 1 (el producto). Las cifras se pueden escribir con puntos o comas (11.900 o 11900)."

Aparece este toast de error: "Revisa producto 1 (el producto). Las cifras se pueden escribir con puntos o comas (11.900 o 11900)."

Entonces me acordé que solo podia hacer movimiento de las cantidades que tengo en inventario. Asi que fue a mandarle en remesas 81 de adapto estress (ya tenia otros 10 anteriormente enviados). Luego en profesional demo acepté la remesa. Y quedó asi los datos:

"Admin inicio:
Tu mes
Tu comisión
$ 524.252
Ventas
$ 3.256.900
Unidades en inventario
1984
"

"Admin direccion:
Dirección
Agregados, sin datos personales.

Ingreso bruto facturado
$ 3.256.900
16 pagos
Ingreso CNV
$ 2.097.008
Comisiones a profesionales
$ 524.252
Inventario
1901 unidades
6 productos en 9 ubicaciones
"

"Profesional demo inicio:
Tu comisión
$ 524.252
Ventas
$ 3.166.900
Unidades en inventario
114"

Si están bien? En inventario del profesional si subieron los 81. Pero en admin antes aparecia 1903 y ahora 1820 y ahora dice 1984 y 1901.

Ahora si me devolvi a ventas-retroactivas y puse que vendí 90 adapto stress a 11900 Total: $1.071.000 con la factura SMOKE PRUEBA-001.

Pero aparecio el mismo texto de error: "Revisa producto 1 (el producto). Las cifras se pueden escribir con puntos o comas (11.900 o 11900)." y toast error: "Revisa producto 1 (el producto). Las cifras se pueden escribir con puntos o comas (11.900 o 11900).
" 
Le puse punto y coma al 11900 y da el mismo texto de error. No funciona. No puedo seguir el smoke de esta parte.


Parte 3:
No veo como tal un apartado de registrar una venta cobrada, sino Registrar venta en efectivo y crear checkout. En registrar efectivo aparece la opción de si pagó en efectivo o transferencia. Pienso que habria que revisar si está bien asi o no. O simplemente cambiarle el nombre al bloque.

Voy a vender al mismo paciente con identificacion 1000898123 en efectivo 1 adapto stress y pago transferencia.

Aparece asi en el historial de transacciones:
"107.100 COP
ADAPTO-STRESS x1
27/9/2026, 2:44 p. m. · Efectivo
Pagado, sin entregar
Pagado" 

Aparece esto en el bloque Ventas cobradas sin cerrar en contabilidad:
"107.100 COP
27/9/2026, 2:44 p. m.
Falló
1 de 5 intentos
Sin ítem en Alegra: ADAPTO-STRESS. La factura diría un producto que no es.
"

Luego pagué otra en transferencia de SMOKE BLOQUE 3 y aparece esto en el historial de transacciones:
"11.900 COP
PRUEBA SMOKE BLOQUE 3 x1
27/9/2026, 2:47 p. m. · Efectivo · Factura SETP990214741
Pagado, sin entregar
"

No entiendo es la parte donde dice CC dice en la guia: "Se registra, y en facturación la factura **espera con el motivo dicho**
   si la cuenta puente no está configurada. No es un error: es una espera explicada." ¿donde está el apartado de facturacion?
o es simplemente en el historial de transacciones que dice la factura y si se puede facturar o no?

En ventas retroactivas aparece el desplegable con las opciones (efectivo, transferencia, Pasarela wompi).
Por cierto, apenas abro ventas retroactivas aparece un texto rojo: "Producto 1: revisa el precio." No entiendo por que.

Por otro lado, yo creo que tal vez me pude haber enredado y haber hecho algunas de las ventas desde admin y no desde profesional demo, pero aun asi aperecen en el perfil de profesional demo. Entonces eso quiere decir que todas las hice desde profesional demo, correcto? pienso que seria bueno marcar que si alguna la hizo un admin quede con un rotulo de admin. En caso de que me confunda y realice un checkout o venta en efectivo/transferencia desde admin.


Paro acá y vuelvo a mandar los stats para que revises que todo está bien:

Admin inicio:
"Tu mes
Tu comisión
$ 544.252
Ventas
$ 3.375.900
Unidades en inventario
1982"

Admin direccion:
"Dirección
Agregados, sin datos personales.

Ingreso bruto facturado
$ 3.375.900
18 pagos
Ingreso CNV
$ 2.177.008
Comisiones a profesionales
$ 544.252
Inventario
1900 unidades
6 productos en 9 ubicaciones"

Profesional demo inicio:
"Tu mes
Tu comisión
$ 544.252
Ventas
$ 3.285.900
Unidades en inventario
112"

Paro acá. Continuo por si toca corregir algo y volver a hacer smoke completo y profundo de esos 3 puntos.