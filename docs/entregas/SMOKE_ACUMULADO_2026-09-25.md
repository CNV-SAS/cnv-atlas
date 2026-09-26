# Recorrido completo · 2026-09-25

> **REEMPLAZADO por `SMOKE_UNICO_2026-09-26.md`.** Santiago tenia tres guias abiertas y no encontraba una
> de ellas, asi que se refundieron en un solo documento. Sus pasos estan alli, con las afirmaciones corregidas.
> Este se conserva por su registro, no para seguirlo.

**Para Santiago.** Reemplaza al `SMOKE_ACUMULADO_2026-09-24.md`, que ya no sirve tal cual: dos de sus
afirmaciones cambiaron (el control de LUVIA se **invirtió** y la devolución ahora **sí** mueve el dinero).

Cubre lo que quedó pendiente del recorrido anterior y lo construido hoy, en un solo paso:

| Aquí | Es |
| --- | --- |
| Parte 1 | La devolución, desde donde se cayó, **ahora con su dinero** |
| Parte 2 | Las ventas que ya ocurrieron, **entera** |
| Parte 3 | El medio de pago (tu hallazgo 4: la venta que no dejaba registrar) |
| Parte 4 | La pantalla de admin por integrante (tu hallazgo 3) |
| Parte 5 | La recepción de una remesa, sin teclear (tu hallazgo 5) |

De tu mensaje entendí "la 4" como el **hallazgo** 4, porque el recorrido anterior solo tenía tres partes. Si
te referías a otra cosa, dime y la agrego.

---

## Antes de empezar

**1 · Las migraciones.** Hay **177 en el repo (0000 a 0176)** y la nube está en **172**. Faltan cinco, y sin
ellas la mitad de esto no arranca:

| Migración | Sin ella |
| --- | --- |
| 0172 | El botón para responder la encuesta con el paciente no guarda quién la respondió |
| 0173 | No existe "Transferencia" como medio de pago (parte 3) |
| 0174 | La factura de una transferencia no sabe a qué cuenta apuntar |
| 0175 | La devolución no puede mover el dinero (parte 1) |
| 0176 | Una segunda devolución sobre la misma venta choca |

Después de correrlas, verifica el conteo, que es el único control que no miente:

```sql
select count(*) from drizzle.__drizzle_migrations;  -- tiene que dar 177
```

**2 · Entra como admin / Dirección.** Todas estas pantallas son suyas.

**3 · Ten a mano** un paciente de prueba, un producto del catálogo, y **una venta pagada y entregada** (si no
tienes, la parte 3 te deja crear una, así que puedes hacer la 3 antes de la 1).

**4 · Un dato que puede faltar y bloquea la parte 3:** la cuenta puente de las transferencias en Alegra. Si
no está configurada, la venta **se registra bien** y su **factura espera**, con el motivo a la vista. Eso es
a propósito y no es un fallo: apuntarla a la cuenta del efectivo diría que un dinero que ya está en el banco
sigue por recoger.

---

## Parte 1 · La devolución, ahora con su dinero

**Qué se prueba:** que devolver un producto haga las **tres** cosas, no una: que la unidad espere
verificación fuera del inventario vendible, que **el ingreso y la comisión bajen por la parte devuelta**, y
que quede pedida la nota crédito para corregir la factura.

**Lo que cambió desde el recorrido anterior:** ahí la devolución solo movía producto. Eso fue tu hallazgo 1
("la devolución no mueve el dinero"), y es lo que se construyó.

### Los pasos

1. En **/pagos**, en **Transacciones**, sobre una venta **pagada y entregada**, abre **"El paciente devolvió
   algo"**. Registra un producto de esa venta, cuántas unidades y por qué.
2. **Qué tiene que verse, en el mismo aviso:** que la unidad queda en devueltas pendientes **y** el valor de
   la nota crédito que hay que emitir. Si el aviso solo habla del producto, el dinero no se movió.
3. **El control del inventario:** el saldo del integrante **NO sube**. Lo devuelto no volvió a su vitrina.
4. **El control del dinero, que es el nuevo.** Ve a **/comercial**: su comisión pendiente **bajó** en la
   parte proporcional. Si devolvió 1 de 2 unidades de una línea, baja **la mitad de esa línea**, no la venta
   entera ni nada más.
5. **El control de la nota crédito.** En **/pagos**, en el panel de reversas, esa devolución aparece como
   **"Producto devuelto"** pidiendo su nota crédito **por la parte devuelta**. Escribe un número de prueba
   (`NC-PRUEBA-1`) y tiene que aceptarlo y cerrar el caso.

   Este paso es el que hay que hacer sin saltarse: hasta esta mañana la devolución **exigía** esa nota
   crédito y **no había forma de registrarla** (el campo no se mostraba). Si vuelve a pasar, se ve aquí.
6. Vuelve a la unidad devuelta y elige **Reincorporar al lote**, con su destino y el resultado de la
   verificación. Desaparece de la lista y **ahora sí** sube el saldo de la ubicación elegida.
7. Registra otra devolución y esta vez **Dar de baja**. Desaparece y **no sube ningún saldo**.

### Dos controles más

- **Devuelve la segunda unidad de la misma venta, en otro momento.** Tiene que dejarte. Es lo que la 0176
  arregla: antes la segunda choca contra un índice que asumía que una venta se revierte una sola vez.
- **Intenta devolver de una venta vieja** (anterior al reparto sellado por línea). Tiene que **negarse**
  diciendo que hay que resolverla a mano con contabilidad. Es correcto: sin el reparto sellado no se puede
  calcular la parte proporcional sin inventarla.

### Y una corrección al recorrido anterior: LUVIA

El control de LUVIA de la guía del 24 **estaba al revés y lo pedía por un motivo falso**. Decía que
reincorporar LUVIA debía negarse porque vuelve a la consignación del proveedor. **No es así:** en el modelo,
al momento de la venta el producto **ya es de CNV**, y el inventario de tercero en Atlas *es* la consignación.
Tú lo corregiste y el bloqueo se retiró.

**Entonces, ahora:** devolver y reincorporar LUVIA tiene que **funcionar igual que cualquier otro producto**.
Si se te niega, avísame: sería el bloqueo viejo sobreviviendo en algún sitio.

---

## Parte 2 · Las ventas que ya ocurrieron (entera)

**Qué se prueba:** registrar en Atlas ventas hechas antes, con su fecha real y la factura que ya existe, sin
que Atlas vuelva a facturar ni el paciente aparezca como deudor.

### Preparar

Un paciente, un producto y un número de factura inventado (`PRUEBA-001`). No necesita existir en Alegra:
Atlas no la va a llamar, que es el punto.

### Los pasos

1. En **/admin/ventas-retroactivas**, elige quién la vendió, a qué paciente, **una fecha de hace meses**, el
   número de factura, el medio de pago y el producto **con el precio que tenía ese día**.
2. **Teclea el precio como lo teclearías de verdad: `11.900`.** Este paso es una prueba en sí mismo. Antes
   ese punto se leía como decimal y registraba una venta de **doce pesos** sin quejarse de nada; hoy tiene que
   quedar en once mil novecientos. Pruébalo también con `11900` y con `$11.900`: los tres son lo mismo.
3. Pulsa **Registrar la venta**. **Qué tiene que verse:** el aviso con el total, y la venta en la lista con
   **la fecha que le pusiste**, no la de hoy.
4. **Y la pantalla tiene que cargar.** Mírala completa, con su lista de abajo: daba error 500 porque leía el
   nombre del paciente de la tabla equivocada.
5. En **/pagos**, **qué NO tiene que verse:** esa venta en facturación pendiente ni como "por cobrar". Si
   aparece, Atlas quiere cobrarle otra vez a alguien que ya pagó.
6. Mira el inventario del integrante: **bajó**. Si el saldo no alcanzaba, la venta queda marcada como *No
   alcanzó el saldo*, y eso también es correcto: los números no cuadran y se ve.

### Los controles

- **La misma factura dos veces:** tiene que negarse.
- **Una fecha futura:** tiene que negarse.
- **Bórrala** con *Borrarla*. Si ya descontó inventario, se niega y dice por qué; entonces se corrige con una
  devolución (parte 1).

---

## Parte 3 · Cómo llegó la plata (tu hallazgo 4)

**Qué se prueba:** que se pueda registrar una venta cobrada **por transferencia**. Antes solo existía
efectivo, y una transferencia se anotaba como efectivo.

**Por qué no era un matiz de etiqueta:** el medio viaja a la factura electrónica (la DIAN separa efectivo de
transferencia débito) y decide a qué cuenta se apunta el pago. "Efectivo en poder de Integrantes" dice que la
plata está en el bolsillo de alguien; una transferencia ya llegó a un banco.

### Los pasos

1. En **/pagos**, **Registrar una venta cobrada**. Ahora hay un campo **"Cómo pagó"** con **Efectivo** y
   **Transferencia**.
2. Registra una **por transferencia**.
3. **Qué tiene que verse:** la venta registrada, y en el panel de facturación, si la cuenta puente no está
   configurada, **la factura esperando con el motivo dicho**. No un error: una espera explicada.
4. Registra otra **en efectivo** y comprueba que sigue funcionando igual que antes (custodia del integrante
   incluida).
5. En **/admin/ventas-retroactivas** el mismo desplegable tiene las tres opciones, porque una venta vieja
   también pudo cobrarse por transferencia.

---

## Parte 4 · Ver a un integrante desde admin (tu hallazgo 3)

**Qué se prueba:** que se pueda mirar la operación de un integrante **sin entrar con su cuenta**. Era lo que
te faltaba para poder verificar cualquier cosa de las partes anteriores.

### Los pasos

1. En **/admin**, en la lista de usuarios, cada integrante tiene ahora **"Ver su inventario, sus ventas y su
   comisión"**.
2. Ábrelo. **Qué tiene que verse:** las cuatro cifras de arriba (unidades en custodia, pacientes asignados,
   comisión pendiente, faltantes abiertos), su inventario **por lote y ubicación**, sus últimas ventas con
   estado, la comisión causada/liquidada/pendiente, y los faltantes que esperan algo.
3. **El control que la hace útil:** con esta pantalla abierta en otra pestaña, rehaz el paso 3 y 4 de la
   parte 1. Lo que devolviste tiene que verse aquí: el saldo que no subió, y la comisión pendiente más baja.
4. **Y el control de que no se pasa de su papel:** esta pantalla **no tiene ningún botón que cambie nada**.
   Si encuentras uno, avísame: corregir por una segunda puerta se salta los controles de la primera.
5. Una cosa que sí tiene que aparecer: el producto que está en **cuarentena** sale marcado **"no vendible"**.
   Es lo que distingue "tiene 3 unidades" de "tiene 3 unidades que no puede vender".

---

## Parte 5 · Recibir una remesa sin teclearla (tu hallazgo 5)

**Qué se prueba:** que el profesional **confirme lo que CNV declaró**, en vez de volver a escribirlo.

**Por qué se cambió:** tenías razón en que pedirle que teclee producto, cantidad y lote es pedirle que
vuelva a declarar algo ya declarado, y cada tecleo es una oportunidad de que los dos números difieran sin que
nadie mienta.

### Los pasos

1. Como **admin**, en **/faltantes**, declara una remesa a un integrante: producto, cantidad y **lote**.
2. **El arreglo que hay que ver aquí:** el lote ya **no dice "(opcional)"**. Decía eso y al enviar no dejaba
   continuar, con un mensaje escrito además para quien *recibe*, no para quien declara. Ahora lo pide de
   frente, y el rechazo llega en el campo, antes de enviar. Intenta dejarlo vacío para comprobarlo.
3. Entra como **el integrante**, a **/mi-inventario**.
4. **Qué tiene que verse:** la remesa pendiente con lo que CNV declaró, y **un solo botón: "Llegó completo
   (N)"**. Ya no hay panel de "Registrar recepción" donde teclear nada.
5. Pulsa **Llegó completo**. El saldo sube por lo declarado.
6. Declara otra remesa y esta vez, al confirmar, usa **"No llegó así"**. Ahí **sí** se abren los campos, y
   ese es el sitio donde tiene sentido teclear: cuando lo que llegó no coincide.
7. **Los dos casos que importan de esa rama:**
   - Confirma **menos** de lo declarado: el saldo sube por lo que dijiste (se te cree lo que tienes) y queda
     registrada la diferencia.
   - Confirma **cero**: es la vía para decir "no llegó nada". Tiene que aceptarlo y quedar como faltante
     total.
   - Confirma **más**: el saldo sube solo por lo declarado y el aviso dice **por qué**. El excedente queda
     para que CNV lo revise.
8. Prueba también las **cantidades tecleadas** de esa rama: escribe `1.000` en una confirmación o en un
   conteo físico. Tiene que ser **mil**. Antes se leía como **1**, y en el conteo físico eso abría un faltante
   de 999 unidades con cargo económico al integrante.

---

## Lo de hoy que no tiene paso propio

Cosas que se arreglaron y se comprueban solas si lo demás funciona. Están aquí para que sepas qué mirar si
algo se ve raro:

- **/pagos carga sin errores.** No era lentitud de consultas: eran ocho lecturas en paralelo contra un pool
  de seis conexiones. Ahora van en tandas de tres. Si vuelve a dar timeout, es otro problema, no este.
- **La importación del archivo real** de 160 pacientes. Un paciente con un dato ilegible ya no tumba a los
  otros 159: se rechaza él y el archivo pasa. Y el mensaje dice **cuál campo de cuál paciente**, nunca el
  valor (el archivo trae historias clínicas).
- **El sexo, el tipo de documento y el patrón alimentario** de lo importado. El HTML manda "Masculino" y
  Atlas guardaba "M": todo paciente importado quedaba sin sexo, y dos lectores asumen hombre cuando falta.
  Si ves un diagnóstico importado con cifras raras, empieza por ahí.
- **El botón para responder la encuesta con el paciente presente**, en la evaluación. Queda registrado que la
  respondió el profesional y no el paciente, y la HC lo dice discretamente. **Necesita la 0172.**

---

## Qué reportar

De cada parte, lo que viste y sobre todo **lo que no viste**. Si algo se ve distinto de lo escrito aquí,
mándame la pantalla tal cual, sin arreglarlo: **el texto de esta guía es la afirmación que se está probando**,
y si la realidad no coincide puede estar mal la guía y no el código. Pasó dos veces ya, y las dos veces la
guía era la equivocada (LUVIA, y el "(opcional)" del lote).

**Al terminar:** las ventas y devoluciones de prueba se pueden dejar, son de un paciente de prueba. Lo único
que conviene no dejar a medias es una **liquidación calculada y sin girar**, porque retiene comisiones que
quedarían fuera de la siguiente.
