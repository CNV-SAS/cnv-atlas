# Segundo smoke · lo construido el 26 y el 28

**Para Santiago, 2026-09-28.** **Este NO reemplaza al `SMOKE_UNICO_2026-09-26.md`**: son dos recorridos
distintos y conviene no mezclarlos. El único cubre lo comercial acumulado, la depuración y el perfil; este
cubre **lo que se construyó después de que empezaras a correrlo**.

**Antes de empezar:** migraciones **185 en el repo**. La 0184 está pendiente en la nube.

**Cinco partes. Las dos primeras son de la pantalla de Tratamiento y se prueban juntas.**

---

## Parte 1 · La ficha de LUVIA, tal cual su archivo

1. En una evaluación con diagnóstico, ve a **Tratamiento → sección 2 → "¿Quieres prescribir un producto
   diferente para el tratamiento del paciente?"**.
2. **Compara línea por línea con su HTML.** Tiene que decir:
   - `1 scoop (15 g) en un vaso con agua · Polvo · 600 g` (antes decía "15 g · polvo")
   - la descripción con **los ingredientes**: *"...a base de arroz con avena, linaza, psyllium y probióticos"*
   - **⚠ Alérgenos: Contiene avena** (antes: "avena", sin el "Contiene", y sin símbolo)
   - `INVIMA RSA-0019736-2022 · Laboratorio Naturex S.A.S. · Titular de marca: Centro de Nutrición Integral
     Katherine Ruiz S.A.S.`
3. **Lo único que su ficha NO tiene es el titular de marca**, y va a propósito: §7.7 obliga a mostrarlo (quien
   pone su marca se presume productor). **No reemplaza a Naturex, se suma.** Son dos hechos distintos y el
   modelo comercial pide expresamente no confundirlos.
4. **El diseño:** la línea de posología va en acento, el alérgeno en ámbar, y el registro pequeño y apagado.
   Si se ve plano otra vez, avísame.

## Parte 2 · Sin dosis ni días, y sin el botón clínico

1. En **sección 2**, agrega un nutracéutico recomendado. **Qué NO tiene que haber:** los campos "Dosis" y
   "Días", ni el botón "No lo recomiendo por razón clínica".
2. **Qué tiene que verse en su lugar:** debajo del nombre, **su posología del catálogo**, por ejemplo
   `30 mL/día · 1 vez al día · línea líquida`. Es la de la tabla de Gildardo, igual para todos los pacientes.
3. Guarda, y **abre el informe del paciente**. Tiene que decir la posología, **no** "LUVIA: 1 durante 1 días".
4. **El control de una consulta VIEJA:** si tienes una prescripción anterior donde alguien tecleó algo, el
   informe de ESA consulta sigue diciendo lo que se tecleó. No se reescribe el pasado.

## Parte 3 · El desplegable y el bloque del paciente

1. **Sección 2 → "¿Quieres prescribir un nutracéutico que el modelo no recomendó?"**: el desplegable **no debe
   traer** los que ya están arriba en "El modelo recomienda", ni LUVIA (que vive en su propio bloque).
2. **Sección 1 → "Rutas de atención"**: en pantalla **ya NO debe salir** el bloque "Tus suplementos" con texto
   dirigido al paciente ("salen de tu propia medición").
3. **Pero sí debe salir al imprimir.** Pulsa el botón de imprimir de esa hoja y compruébalo en la vista previa:
   ahí el bloque tiene que estar. Esa parte de la decisión del 19 no cambió; lo que cambió es a quién se le
   muestra en pantalla.

## Parte 4 · Vender desde la bodega

1. Con un nutracéutico prescrito **del que no tengas unidades** y que sí haya en bodega, en el bloque de venta
   aparece **"Cobrar y pedir que CNV lo despache desde la bodega"**.
2. **Antes de cobrar** tiene que decir que el paciente **no se lleva el producto hoy** y que el aviso le llega a
   un administrador.
3. Cóbralo. La venta dice **"Sale de la bodega de CNV: falta despacharla"**.
4. **EL CONTROL QUE IMPORTA.** Como **admin**, mira el correo de pendientes de ventas: tiene que aparecer
   **"Ventas pagadas cuyo producto sale de la bodega y falta despachar"**. Si no está, el resto no sirve.
5. Registra la entrega: el aviso **desaparece**.
6. **Y que no haga ruido:** una venta de tu propia vitrina, pagada y sin entregar, **no** aparece en ese aviso.

## Parte 5 · El aviso de arriba y el arranque

1. Con `ATLAS_FASE=lanzamiento` en Vercel, el aviso de arriba dice **"Operación real: lo que registres aquí
   cuenta..."**, y **ya no** "Entorno de pruebas. Nada de lo que registres aquí es real".
2. **El control que importa de ese texto:** dice que **actualices antes de repetir**, porque repetir un cobro
   puede duplicarlo. Es la frase que evita el daño, no el "puede haber errores".
3. **Sin la variable no sale ningún aviso**, y eso es correcto: es mejor callar que decirle "esto no es real" a
   alguien que está atendiendo.

---

## Qué reportar

Lo mismo que en el otro: lo que viste y **lo que no viste**. Y si algo se ve distinto de lo escrito aquí,
mándame la pantalla: el texto de esta guía es la afirmación que se está probando.

---

# Lo que se añadió el 29

**Migraciones: 188 en el repo.** La 0186 y la 0187 están pendientes en la nube.

## Parte 6 · Las condiciones BIS se corrigen

1. Abre una evaluación **con diagnóstico confirmado** y ve a la sección donde salen las condiciones BIS
   (contraindicaciones y dinamometría). Ahí tiene que haber un enlace para **corregirlas**.
2. Cámbialas y **escribe el motivo** (es obligatorio: sin él no deja).
3. **El control que importa:** eso **rehace el diagnóstico**. Verifica que la evaluación nueva dice lo que
   debe, y que la vieja queda **reemplazada** (no borrada: reemplazada, y no debe aparecer en los
   desplegables de evaluaciones).
4. Si la corrección no cambia nada clínico, igual queda el registro de quién la hizo y por qué.

## Parte 7 · El cargo por faltante SÍ se cobra

**Esto es lo más importante del segundo smoke.** El cargo existía y nadie lo cobraba.

1. Con un caso de faltante clasificado **injustificado** (las dos personas: admin propone, dirección
   confirma), ve a **/pagos → liquidaciones** y liquida a ese Integrante.
2. **Qué tiene que pasar:** la liquidación muestra una línea **"− faltante $X"** y el neto baja en ese valor.
3. **Y qué NO tiene que pasar:** el IVA y la retención **no** cambian. Se calculan sobre la comisión completa,
   porque el servicio se prestó entero; el faltante es otra obligación que se compensa. (Esa decisión está en
   consulta con contabilidad: `CONSULTA_CONTABLE_CARGO_DE_FALTANTE_2026-09-28.md`.)
4. **El control de no cobrar dos veces:** liquida otra vez. El mismo faltante **no** puede volver a aparecer.
5. **Y el canal de reclamo:** en el detalle del faltante del Integrante y en su liquidación tiene que salir
   **admin@cnvsystem.com**, textual y como enlace. En la liquidación solo mientras **no** se haya girado.

## Parte 8 · La alerta de vencimiento

**Ojo, necesita un lote preparado:** para verlo sin esperar meses, pídeme el SQL o cambia la fecha de
vencimiento de un lote de prueba a dentro de 30 días.

1. **Como Integrante**, en **Mi inventario** tiene que aparecer **"Producto por vencer"**, por LOTE (no por
   producto), con los días que quedan.
2. **La frase que importa:** dice que el vencido lo asume CNV **salvo** que hayas recibido el aviso y no hayas
   actuado. Sin esa frase el aviso es un dato curioso.
3. Pulsa **"Ya lo vi"**. Vuelve a entrar: ahora dice **"Marcaste que lo viste el (fecha)"** y el botón no
   está. **Esa fecha no se puede mover** (si alguien lo intenta por base, la base lo rechaza).
4. **Como admin**, en **Revisión de inventario** tiene que salir **"Vencimientos de lote"**, separado en lo que
   todavía se puede vender y lo que ya venció. En lo vencido sale **quién lo asume**, con la razón.
5. **El correo:** la tarea corre a las 8:30 a. m. de Colombia. Si quieres probarla ya, dime y te paso el
   comando. **Lo que hay que mirar es que el correo le llegue al INTEGRANTE**, no solo a CNV.
6. **Los lotes con vencimiento inventado:** si en Revisión de inventario sale el bloque ámbar de lotes
   "sin fecha de vencimiento real", complétalos. Mientras estén así, **su alerta no puede dispararse**.

## Parte 9 · Devolverle producto a CNV

1. **Como Integrante**, en **Mi inventario → "Devolverle producto a CNV"**, elige un lote, pon una cantidad y
   escribe el motivo. Declara.
2. **EL CONTROL QUE IMPORTA: tu saldo NO baja todavía.** Míralo en "Saldo actual". La pantalla lo dice antes
   y después de declarar. Si bajara al declarar, cualquiera podría vaciar su saldo por su propia palabra.
3. **Como admin**, en **Revisión de inventario → "Devoluciones de Integrantes por recibir"**, confirma lo que
   llegó.
4. **Confirma MENOS de lo declarado** (ej. declaró 4, llegaron 1). Verifica las tres cosas:
   - el saldo del Integrante baja **solo 1**, no 4;
   - en su pantalla sale **"No llegaron 3: siguen en tu saldo"**;
   - y esas 3 le van a aparecer como faltante en su próximo conteo, que es lo correcto: las puede justificar
     como devolución con guía.
5. **Confirma con 0** en otra: se cierra igual y no mueve nada. Cerrada con cero no es lo mismo que abierta.
6. **Intenta cerrarla dos veces:** no deja.

## Parte 10 · Distribución: lo que CNV le factura al Integrante

**Ojo: hoy los dos caminos de venta BLOQUEAN a un Integrante en Distribución**, así que para verlo necesitas
que yo te prepare unas ventas de prueba o que decidamos desbloquear la venta en esa modalidad. Dime cuál.

1. Como **admin**, en **/comercial** tiene que salir un bloque aparte, **"Distribución: lo que CNV le factura
   al Integrante"**, con su propio encabezado, separado de las liquidaciones.
2. **La razón de que estén separados:** bajo Comisión CNV **paga**; bajo Distribución **cobra**. Si los ves
   mezclados, avísame: así es como alguien termina girando plata que en realidad le deben.
3. Emite un corte. Verifica: la cuenta dice el período, las ventas y el total.
4. **EL CONTROL QUE IMPORTA:** vuelve a emitir el mismo corte. Tiene que decir que **no hay ventas sin
   facturar**. Una venta no puede entrar en dos cuentas.
5. Como **Integrante**, en /comercial sale **"Tus cuentas de Distribución"**, con el **detalle abierto**: día,
   producto, base con descuento e IVA por renglón. Sin eso no se puede objetar de forma sustentada.
6. Objeta una con un motivo. Como admin, **"Darle la razón y rehacerla"**: sus ventas vuelven a estar sin
   facturar y el corte se puede emitir otra vez. Con **"Sostener"**, la cuenta queda como estaba.
7. Registra el pago. **Intenta registrarlo dos veces:** no deja.

## Parte 11 · El envío a domicilio

**Necesita configuración tuya antes de poder probarse**, y eso es a propósito:

- una **tarifa de flete** en `commercial_config.flete_tarifa` (es lo que se le cobra al paciente, **con IVA
  dentro**, igual que el PVP);
- y al menos una fila en **`delivery_cities`** (ciudad, departamento y, si lo tienes, el código DANE).

Sin las dos cosas, **el bloque de envío ni siquiera aparece**. No es un olvido: el modelo dice que es
preferible no ofrecer el domicilio a un destino antes que ofrecerlo y perder dinero en cada envío.

1. Con eso puesto, en **/pagos** (tanto en el link de pago como en la venta en efectivo) sale **"Enviar a
   domicilio (flete $X)"**.
2. Márcalo: aparece la ciudad (**lista, no campo libre**) y la dirección, y el total **con el envío sumado**.
3. Cobra. **Los tres controles:**
   - la venta sale de la **bodega de CNV**, no de tu vitrina (y por eso entra en el correo de "falta
     despachar");
   - el monto cobrado incluye el flete;
   - y el ingreso de CNV cuenta la **base** del flete (el IVA no es ingreso).
4. **Registra la entrega.** Ahí arranca el reloj: bajo la entrega tiene que salir **"Puede retractarse hasta
   el (fecha)"**, con lo que habría que reintegrarle, **envío incluido**.
5. **"El paciente se retracta" → "Volvió sellado":** lo acepta, dice el reintegro completo y revierte el
   flete del ingreso de CNV.
6. **En otra venta, "Volvió abierto":** NO procede, y lo dice por qué (bien de uso personal, numeral 7). El
   registro queda igual: un retracto negado también es una decisión.
7. **Intenta registrarlo dos veces:** no deja.

---

## Lo que NO se construyó, y por qué

- **El cargo por un vencido a cargo del Integrante.** La alerta llega hasta la **propuesta** de quién asume.
  El cargo se cobra "al precio de facturación", que es justo la cifra que está en consulta
  (`DECISION_PRECIO_DEL_FALTANTE_2026-09-29.md`). Construirlo antes de esa decisión sería construirlo dos
  veces.
- **La emisión de la cuenta de Distribución en Alegra.** La cuenta se arma, se objeta y se cobra en Atlas;
  emitir el documento fiscal necesita la configuración de producción, que está en el checklist de arranque.
- **Desbloquear la venta bajo Distribución.** El mecanismo del recaudo ya existe, así que ahora es una
  decisión tuya, no una falta de construcción.

---

# Añadido el 29 (tarde), tras las respuestas de contabilidad

**Migraciones: 193 en el repo.** Pendientes en la nube desde la 0186 (siete).

## Parte 12 · El faltante se cobra a la indemnización, no al PVP

1. Haz un conteo con faltante de un producto con PVP conocido (MULTICELL, 107.100).
2. **Lo que tiene que decir tu pantalla de faltantes:** "valor de venta 107.100" y, cuando el caso quede
   injustificado, **un cargo de 72.000**, no de 107.100.
3. **Y tiene que explicar la cuenta:** "sale del valor sin IVA (90.000) menos tu descuento comercial del 20%:
   no se te cobra el IVA, porque no hubo venta, ni el margen que habrías ganado."
4. **Como admin**, en Revisión de inventario el caso dice las dos cifras: el valor de venta y lo que se le
   cobraría.
5. **EL CONTROL DE DINERO:** liquida a ese Integrante. El descuento tiene que ser **72.000**, y el IVA y la
   retención siguen calculados sobre la comisión completa.
6. **Un caso viejo ya liquidado no cambia.** Si tienes alguno, verifica que conserva su cifra: reescribirla
   dejaría una liquidación girada que ya no cuadra.

## Parte 13 · El flete se teclea por envío

1. Marca "Enviar a domicilio". Ahora **no hay una tarifa fija**: hay un campo **"Cuánto cobra el
   domiciliario"**, precargado con el costo sugerido de esa ciudad si lo tiene.
2. Escribe 10.000. La cuenta que sale debajo tiene que decir: **10.000 del domiciliario · 10.300 de base ·
   1.957 de IVA = 12.257**.
3. **Y tiene que explicar el margen**: la diferencia es lo que se lleva la pasarela por cobrar el envío. Sin
   esa frase parece un recargo inventado.
4. Cambia el costo a 14.000 y verifica que la cuenta se rehace sola.
5. **El control que importa:** cobra, y mira que el monto total sea el producto **más 12.257**, no más 10.000.

## Parte 14 · El consolidado para pagarle al domiciliario

1. Como **admin**, en **/comercial** tiene que salir **"Envíos a domicilio, para pagarle al domiciliario"**,
   con dos cortes: el **cerrado** (el que toca pagar) y el **en curso**.
2. Cada envío con su día, destino, si ya se entregó, lo que cobra el domiciliario y lo que se le cobró al
   paciente.
3. **El total que importa es el del domiciliario**, no el cobrado: es la cifra del soporte.
4. **Y dice de quién es el documento:** lo emite Alegra (documento soporte o factura). Atlas pone el detalle,
   no el papel.

---

# ARREGLOS DEL SMOKE DEL 29 · repite desde la parte 2

**Migraciones: 194 en el repo.** Pendientes en la nube desde la 0186 (nueve).

**Antes de repetir, corre el SQL de las ciudades:** `docs/entregas/sql/CIUDADES_Y_FLETE_2026-09-29.sql`.
Sin él, el bloque de domicilio no aparece (y eso es correcto).

## R1 · La venta retroactiva, que era el bloqueante

**Qué pasaba, y no era el separador:** el validador de ids rechazaba los UUID del seed, así que el primer
producto de la lista era inválido **siempre**. Daba igual escribir 11900, 11.900 o 11,900.

1. Abre **Ventas que ya ocurrieron**. **Al abrir NO debe salir ningún aviso rojo.** Antes decía "Producto 1:
   revisa el precio" sobre un campo que no habías tocado.
2. Elige profesional, paciente, fecha, número de factura, producto, cantidad y precio. **Registra.**
3. **Tiene que pasar con 11900. Y con 11.900. Y con 11,900.** Las tres.
4. **El filtro nuevo:** al cambiar "Quién la vendió", la lista de "A quién" se reduce a **sus pacientes**. Si
   ese profesional no tiene ninguno asignado, salen todos con un aviso que lo dice.
5. Si algo falla ahora, **el mensaje ya no te manda a mirar los números** cuando el problema no es un número.

## R2 · El bruto y el inventario dicen lo mismo en las dos pantallas

1. **Compara Inicio (como admin) con /direccion.** La venta devuelta **ya no debe estar en el bruto** de
   ninguna de las dos.
2. **Y el inventario debe dar la misma cifra en las dos.** Antes eran 1.903 y 1.820.
3. **El control fino:** si devuelves **1 de 4 unidades**, el bruto baja solo esa unidad, no la venta entera.
   Quien devolvió una de cuatro sigue habiendo comprado tres.

## R3 · Los rótulos de la devolución

1. Devuelve un producto. **La venta ya no debe decir "Disputa ganada"**: tiene que decir **"Producto
   devuelto: se le reintegraron $X"**, y si falta la nota crédito, decirlo.
2. **El panel** ya no se llama "Contracargos y anulaciones" sino **"Ventas revertidas"**, y su texto nombra
   los dos caminos: el banco devolvió el dinero, o el paciente devolvió el producto.
3. **Y dice cuántas unidades:** "devolvió 1 de LUVIA", no los productos de toda la venta.

## R4 · Las cinco menores

1. **/comercial**: ya no dice "6 comisiones" contando reversiones. Dice las comisiones y, aparte, **"con N
   reversiones descontadas"**.
2. **El bloque de cobro** se llama ahora **"Registrar una venta ya cobrada"** (ofrece efectivo y
   transferencia).
3. **Una venta registrada por admin** sobre el paciente de otro sale con el rótulo **"Registrada por CNV"**.
   Las anteriores a hoy no lo llevan: no se guardaba quién la hizo y no se inventa.

## Y las dos que me preguntaste

- **Sí:** "Ventas cobradas sin cerrar en contabilidad" **es** el apartado de facturación que menciona la guía.
- **Sí:** que **ADAPTO-STRESS falle por no tener item en Alegra es correcto**. Es el freno explícito: un
  producto sin fila en ese ambiente se rechaza **por su nombre**, para que el error diga cuál falta en vez de
  facturar cualquier cosa.
- **Y la cuenta cuadra:** vendiste 2 unidades por 23.800. Con IVA dentro, la base es 20.000; de ahí el 80/20
  da **16.000 a CNV y 4.000 de comisión**. Exactamente lo que viste.

---

# ARREGLOS DEL 29 (tarde) · repite desde la parte 1

**Migraciones: 195 en el repo.** Pendientes en la nube desde la 0186 (diez).

## R5 · Las cifras de arriba, antes de tocar nada

**Lo que se arregló:** tu tarjeta de ventas **no podía ver tus propias devoluciones**. La cuenta era la misma
para los dos roles, pero `sale_reversals` solo la leían admin, dirección y soporte, así que para el
profesional la consulta devolvía cero filas y no descontaba nada. De ahí que el admin quedara con menos
ventas que tú.

1. **Compara Inicio como admin y como Profesional Demo.** Las dos tienen que descontar lo devuelto. El admin
   ya no puede tener menos ventas que un profesional.
2. **Las cuatro tarjetas ahora dicen qué dejan fuera:** "sin lo devuelto ni lo que está en revisión" y "sin
   los productos de prueba". Si una cifra te vuelve a extrañar, la tarjeta te dice por qué.
3. **En Mi inventario**, los productos de prueba salen ahora marcados: **"De prueba · no cuenta en las
   cifras"**. Así la lista y la tarjeta dejan de contradecirse (la lista los muestra, la cifra no los cuenta).

**Sobre las cifras que reportaste:**

- **Los 137.600** son las devoluciones del mes. El admin las restaba (bien) y tú no (mal). Ya está.
- **Tu inventario de 112 a 90** es el filtro de productos de prueba haciendo su trabajo: tus 22 unidades de
  PRUEBA SMOKE dejaron de contar en la tarjeta. **Siguen en tu lista, marcadas.** Las 4 que agregaste están
  ahí: en la lista, no en la cifra.
- **ADAPTO-STRESS (81 cargados, 1 vendido) no se toca.** No es producto de prueba, así que ni la lista ni el
  saldo cambian; lo único que cambió son las tarjetas agregadas. Verifícalo en Mi inventario: tiene que decir
  80.
- **La venta de María Camila (124.260, anulada) no ensucia nada.** Una venta anulada no es `paid`, así que no
  entra en el bruto ni en el ingreso. Lo que ves en /comercial ("$0 en 1 comisión, con 1 reversión
  descontadas") es la cuenta correcta y ahora se lee bien: una comisión y su reversión, neto cero. Puedes
  ignorarla.

---

# R6 · El bloqueo de la venta, y lo que destapó

**Migraciones: 198 en el repo.** Al día contigo.

## Qué pasaba, y por qué solo en una pantalla

**"Registrar una venta ya cobrada"** armaba su envío con un `FormData` **vacío** y tres campos puestos a mano,
así que **nada de lo que llenabas en pantalla viajaba**. El del **link de pago** sí recoge el formulario, y por
eso ahí funcionaba: el defecto era de una sola de las dos.

**Tres campos se perdían y solo uno se quejaba:**

| Campo | Desde | Cómo fallaba |
| --- | --- | --- |
| La consulta | hoy | **Se quejaba.** Es el que te bloqueó |
| Los del domicilio | hoy | **En silencio**: llenabas el envío y la venta se creaba sin él |
| **El canal (efectivo / transferencia)** | **el 25** | **En silencio**: toda venta se registraba como **efectivo** aunque eligieras transferencia |

El tercero llevaba cuatro días y tiene consecuencia contable: el medio viaja a la factura electrónica y decide
la cuenta contra la que se registra el pago.

## Qué verificar ahora

1. **En "Registrar una venta ya cobrada"**: elige la consulta y registra. **Tiene que pasar.**
2. **Marca "No sale de ninguna consulta"**, escribe el motivo y registra. También tiene que pasar.
3. **EL CONTROL QUE IMPORTA, y es el que llevaba cuatro días roto:** registra una venta con **Transferencia**.
   En la lista de ventas tiene que decir **transferencia**, no efectivo. Si dice efectivo, avísame.
4. **Y el domicilio por esta pantalla:** marca el envío, pon ciudad, costo y dirección, y cobra. La venta
   tiene que quedar **con su flete** y saliendo de la bodega de CNV. Antes se perdía sin avisar.
5. **La parte 13 hay que repetirla por las dos pantallas**, no solo por el link de pago: ahí es donde el
   defecto se escondía.

## Y donde NO hay que buscarlo

**La venta desde Tratamiento no estaba afectada.** También arma su envío a mano, pero no tiene campos: su
formulario son botones y los datos vienen del tratamiento. Igual quedó con candado, porque el día que alguien
le agregue un campo nacería roto.

---

# R7 · El mensaje de lo prescrito, y la pantalla de insights

## Lo que cambió del bloqueo

**La regla no se tocó** (es una decisión tuya, reportada en `LA_REGLA_DE_LO_PRESCRITO_2026-09-30.md`). Lo que
cambió es el mensaje, que no decía la salida:

> *"Ese producto no está prescrito en la consulta que elegiste. Si la compra no sale de ese plan, marca «No
> sale de ninguna consulta» y escribe por qué: la venta se registra igual."*

1. Intenta vender **PRUEBA SMOKE BLOQUE 3** eligiendo una consulta. **Tiene que salir ese mensaje**, no el de
   antes.
2. Marca **"No sale de ninguna consulta"**, escribe el motivo y registra. **Tiene que pasar.**
3. **El costo de hacerlo, que conviene que sepas:** esa venta sale de las cifras del plan. Aparece contada
   como compra sin consulta, con su motivo, que es la verdad de lo que quedó registrado.

## Parte 15 · La pantalla de insights

Está en **/direccion**, debajo de las cifras de dinero.

1. Lo primero que tiene que verse es **el aviso**: que esto mide si el modelo **vende**, no si **funciona**,
   porque comprar no es tomar. Si ese aviso no está arriba, avísame: es la mitad del valor de la pantalla.
2. **Y su ventana:** solo cuenta desde el 29 de septiembre. Antes una venta de /pagos nacía sin consulta.
3. **Con pocas ventas va a estar casi vacía, y eso es correcto.** Si no hay ninguna desde el 29, lo dice en
   una línea en vez de mostrar ceros.
4. Las tres cifras de arriba: compras con su consulta, líneas dentro de lo prescrito, y cuánto tarda en
   comprar (**mediana**, no promedio: con pocas filas un caso de ocho meses movería el promedio y diría que
   nadie compra).
5. **La tabla por producto:** prescrito en cuántas consultas, comprado en cuántas, y cuántas veces se compró
   fuera del plan.
6. **Y el bloque del modelo:** lo que recomendó y no se prescribió, con la frase de que eso **no es un
   error**. El modelo propone.

**El control que importa:** registra una venta **sin consulta** y verifica que **no** aparece contada como
"fuera del plan". Son dos hechos distintos, y mezclarlos diría que la gente se aparta de lo prescrito cuando
lo que pasa es que compró sin consulta.

---

# R8 · Vender fuera del plan, y la pantalla que ya muestra

## Lo que cambió

**Ya no bloquea: avisa y confirmas.** La venta queda **atada a la consulta** y contada como compra fuera del
plan, que es lo correcto si viene del seguimiento.

1. En **/pagos**, elige una consulta y agrega **PRUEBA SMOKE BLOQUE 3** (que ninguna prescribió).
2. Tiene que salir el aviso en ámbar: *"…no estaba prescrito en la consulta que elegiste. Puedes registrarlo
   igual: la venta queda atada a esa consulta y contada como compra fuera del plan…"*
3. Pulsa **"Registrarlo así"**. **Tiene que registrarse.**
4. **Pruébalo por las dos pantallas**, el link de pago y la venta ya cobrada.
5. **El control que importa:** en **/direccion**, esa venta tiene que aparecer como **línea fuera del plan**,
   NO como compra sin consulta. Son dos hechos distintos y es justo lo que se estaba perdiendo.

**Y en Tratamiento no cambia nada, a propósito:** esa pantalla solo ofrece lo prescrito. Si quieres venderle
algo más, lo prescribes primero con "¿Quieres prescribir un nutracéutico que el modelo no recomendó?" y
entonces ya está prescrito. Ofrecer ahí el catálogo entero crearía una segunda vía para lo mismo.

## La pantalla de insights ya no sale vacía

Medía solo desde el 29 y no mostraba nada. **Ahora mide todo**, como el resto del tablero.

1. En **/direccion**, debajo de las cifras de dinero.
2. **Lo primero sigue siendo el aviso**: esto mide si el modelo **vende**, no si **funciona**.
3. **Y ahora dice el asterisco que importa:** cuántas de las compras sin consulta son **anteriores al 29**.
   Esas no podían decirlo, porque el sistema no lo preguntaba. **No son compras fuera de plan, son compras de
   antes.**
4. Con los datos de los smokes vas a ver cifras raras, y está bien: eso es lo que hay. Para empezar limpio
   está la propuesta de `CIFRAS_LIMPIAS_PARA_EL_ARRANQUE_2026-09-30.md`.
