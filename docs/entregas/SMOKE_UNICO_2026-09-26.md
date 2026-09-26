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
5. **Lo clínico, en la línea del producto.** En cada nutracéutico prescrito hay **"No lo recomiendo por razón
   clínica"**. Úsalo y comprueba que la contraindicación queda **con el nombre del producto**, no como
   "General" (antes quedaba general, aunque el motivo fuera de un producto concreto).
6. **Los dos bloques.** El desplegable de nutracéuticos ya **no trae LUVIA**, y hay un bloque aparte:
   **"¿Quieres prescribir un producto diferente para el tratamiento del paciente?"** con la ficha de LUVIA
   (presentación, INVIMA, fabricante, y el alérgeno aparte en ámbar). El alérgeno **se muestra**, no se cruza
   con lo que declaró el paciente: eso lo sigue haciendo la yuxtaposición, como siempre.
7. **El stock que no bloquea a ciegas.** Con la vitrina en cero de un producto, el mensaje ahora dice **cuántas
   hay en la bodega de CNV** y que pidas una remesa. Antes decía "Sin unidades disponibles" y ahí terminaba,
   aunque en bodega hubiera de sobra.

---

## Qué reportar

De cada parte, lo que viste y sobre todo **lo que no viste**. Si algo se ve distinto de lo escrito aquí,
mándame la pantalla tal cual: **el texto de esta guía es la afirmación que se está probando**, y si la realidad
no coincide puede estar mal la guía. Ya pasó tres veces, y las tres la guía era la equivocada.

**Al terminar:** las ventas y devoluciones de prueba se pueden dejar. Lo único que conviene no dejar a medias es
una **liquidación calculada y sin girar**, porque retiene comisiones que quedarían fuera de la siguiente.
