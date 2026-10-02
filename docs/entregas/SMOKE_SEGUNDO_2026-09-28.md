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

---

# R9 · Las dos tablas que parecían contradecirse, ahora una sola

## Lo que cambió, y por qué te perdiste leyéndolas

Arriba decía *"MULTI-CELL BASE, prescrito en 24"* y abajo *"MULTI-CELL BASE, 60 consultas"*. Son consultas
distintas y hechos distintos, pero en dos bloques separados se leen como dos cifras del mismo hecho.

**Y ojo con una cosa, porque induce al error:** 24 y 60 **no suman** las consultas donde el modelo lo
propuso. El profesional puede prescribir algo que el modelo **no** propuso (es su criterio clínico y cuenta
igual), y hay consultas con prescripción que ni siquiera tienen informe. **Las dos columnas se cruzan, no se
contienen.**

1. En **/direccion**, la sección "Qué se prescribe y qué se compra".
2. Ahora hay **una sola tabla**, "Producto por producto, de punta a punta", con el recorrido entero en una
   fila: *el modelo lo propuso en · de esas, sin prescribir · prescrito en · comprado en · comprado fuera del
   plan*.
3. **El control que importa:** que el texto de arriba diga que prescribir y recomendar **no son la misma
   lista**. Si esa frase no está, la tabla vuelve a leerse como contradictoria.
4. Y que los rótulos digan **en qué** se cuenta ("consultas"). "Prescrito en 41" no decía 41 de qué.

**La resta no cuadra, y no tiene por qué.** CURCUMIN sale "propuesto en 12, de esas sin prescribir 6,
prescrito en 11": 12 menos 6 son 6, no 11. No es un defecto de la cuenta. Quedan 6 propuestas y prescritas, y
las otras 5 son consultas donde **se prescribió sin que el modelo lo propusiera**, o consultas con
prescripción que no tienen informe. Lo confirman dos filas más: SARCO-PROTECT (1 menos 1 son 0, y sale
prescrito en 1) y LUVIA (propuesto en 0, prescrito en 1). **Ahora ese resto va entre paréntesis en la misma
celda** ("11 (5 sin proponerlo)"), que es donde se hace la resta.

---

# R10 · Lo que se deshizo

Sección nueva en **/direccion**, debajo de los insights.

1. **Lo primero tiene que ser la advertencia, arriba y visible:** *"Esto no se resta de lo de arriba"*. Allí
   una compra devuelta sigue contando como compra; aquí la pregunta es cuánto volvió. Si esa advertencia no
   está donde se lee, alguien va a restar una cifra de la otra.
2. **Las cuatro piezas:** cuántas ventas se deshicieron sobre cuántas pagadas (con su porcentaje), el dinero
   que volvió, la tabla por clase y estado, el porqué (las notas), y qué producto vuelve más **en unidades**.
3. **Los links van aparte, y es la decisión que más importa de la pantalla.** Un link anulado antes de
   cobrarse **no es una venta deshecha**: nadie compró. Tienen su propio bloque con cuatro líneas:
   - **Anulados a mano** (alguien cambió de opinión): es lo que hiciste con LUVIA.
   - **Reemplazados por un cobro en otro medio**: la venta **sí** ocurrió, en efectivo, y el link sobraba.
   - **Pagos que no se completaron**: la pasarela los rechazó. Nadie los anuló.
   - **Abiertos, sin usar**: siguen vivos.
4. **Una cosa que verifiqué y conviene que sepas:** *no hay nada que venza un link*. Un link pendiente se
   queda pendiente para siempre si nadie lo paga ni lo anula. Por eso no se distingue "lo anuló el sistema":
   ese caso no ocurre. Si esa cuenta de "abiertos, sin usar" crece mucho, es algo que decidir, no un defecto.

**El control que importa:** anula un link a mano y comprueba que **la cifra de "ventas deshechas" no se
mueve**, y que sube la línea de "anulados a mano". Si entrara arriba, la tasa de reversión diría que se
deshace mucho más de lo que se deshace.

**Y el segundo control, que era un defecto mío:** las devoluciones de arriba y las líneas de "qué vuelve"
tienen que **sumar lo mismo**. Salían 5 arriba y una sola línea abajo porque las otras cuatro eran de un
producto de prueba y el desglose los filtraba. Ahora se muestran **marcados** en vez de esconderlos: dos
cifras del mismo hecho que no cuadran se leen como un defecto, y con razón.

---

# R11 · Empezar con las cifras limpias (para el día del arranque, no para hoy)

**Esto no se prueba en el smoke: se corre el día de las llaves reales.** Va aquí para que sepas qué va a
pasar y no lo leas como un defecto.

## Antes de nada: hoy no hay nadie marcado, y no lo marques todavía

La migración 0199 **solo añade la columna**, que nace en `false`. **Profesional Demo no está marcado**, ni en
local ni en la nube, así que tu recorrido cuenta normal y las cifras de dinero se pueden verificar como
siempre. La marca la pone una persona corriendo el script, y **eso va al final**.

**Por qué importa:** si marcas a Demo antes del recorrido, sus ventas dejan de contar en el bruto y en las
comisiones. Todo daría cero y no podrías distinguir el filtro de un defecto.

**El orden es: smoke completo → fecha de arranque → marca de Demo.**

Si quieres comprobarlo antes de empezar (10 segundos):

```sql
SELECT p.email, pp.is_test
  FROM professional_profiles pp JOIN profiles p ON p.id = pp.profile_id
 ORDER BY p.email;
```

Si alguno sale en `true`, desmárcalo antes del recorrido y vuelve a marcarlo al final:

```sql
UPDATE professional_profiles SET is_test = false WHERE is_test;
```

**No hay nada que reconstruir al desmarcar:** la marca no transforma datos, solo decide qué se cuenta.

## Las dos piezas

1. **La fecha de arranque** (`docs/entregas/sql/FECHA_DE_ARRANQUE_2026-09-30.sql`). Desde ese día, las cifras
   de resumen cuentan solo la operación real.
2. **Profesional Demo marcado** (`docs/entregas/sql/PROFESIONAL_DE_DEMOSTRACION_2026-09-30.sql`). La fecha
   limpia el pasado; esto limpia el futuro, porque Demo sigue operando después.

## Lo que vas a ver ese día, y es correcto

- **Los insights se vacían** y el **tablero de Dirección cae**. Las dos pantallas lo dicen con esas palabras:
  que están contando desde la fecha de arranque, y cuántas compras anteriores dejaron de contar.
- **El inventario NO cae**, a propósito: un saldo no es un flujo. Las unidades están hoy en la bodega.
- **Las comisiones de Dirección y la liquidación van a discrepar**, también a propósito: lo anterior al
  arranque **se sigue liquidando**, porque es plata que hay que pagar. La tarjeta lo dice.
- **Nada se borra.** Se deshace poniendo la fecha en NULL y las cifras vuelven.

**Lo que sí conviene probar hoy, en un minuto:** en **/admin**, que la lista de usuarios sigue mostrando a
todos. La marca no esconde a nadie, solo lo rotula.

## Y si quieres comprobar que el filtro sirve, hazlo al final y en dos minutos

No es obligatorio (hay un test contra la base que ya lo comprueba), pero si quieres verlo con tus ojos:

1. Apunta el **ingreso bruto** y las **comisiones** de /direccion.
2. Corre el script de la marca.
3. Recarga /direccion: **las dos tienen que bajar**, el **inventario no**, y la lista de /admin tiene que
   seguir mostrando a Demo, ahora con su rótulo.
4. Desmárcalo con `UPDATE professional_profiles SET is_test = false WHERE is_test;` y las cifras vuelven
   exactas. Si no vuelven exactas, avísame: eso sí sería un defecto.

---

# R12 · Dos cosas que preguntaste sobre las cifras

## Las tres tarjetas de arriba de los insights están en guion, y eso es correcto hoy

*"Compras con su consulta"*, *"dentro del plan"* y *"tarda en comprar"* salen vacías porque **ninguna venta
trae todavía su consulta**: el vínculo se construyó el 29 y las 18 de antes no podían decirla.

**Dejan de estar vacías en la Parte 14 / R8**, en cuanto registres **una** venta eligiendo una consulta. Con
esa sola venta:

- "Compras con su consulta" pasa a `1 de N`.
- "Dentro del plan" deja el guion y cuenta las líneas de esa compra.
- "Tarda en comprar" muestra los días entre la consulta y el cobro (si vendes el mismo día, **0 días**, que
  es un valor correcto, no un vacío).

**Así que ese bloque no se puede verificar antes de la Parte 14.** Si después de registrarla siguen en guion,
eso sí es un defecto y quiero saberlo.

## "18 pagos" en Dirección y 17 pagados en el historial de Demo

**No está contando el anulado, y no puede:** el bruto pide `status = 'paid'`, y un link anulado queda en
`failed`. Además deja fuera el efectivo no recibido ("Anulada por CNV", que sí es una venta `paid`) y las
ventas con disputa perdida.

**La diferencia es de alcance, no de estado:** /direccion cuenta **toda la organización** y el historial de
/pagos te muestra lo que ves tú. 17 de Demo más 1 de otro profesional (o una venta sin profesional, que las
registra admin) son 18. Para salir de dudas en diez segundos:

```sql
SELECT coalesce(p.email, '(sin profesional)') AS profesional, count(*)::int AS pagos
  FROM transactions t
  LEFT JOIN professional_profiles pp ON pp.id = t.professional_id
  LEFT JOIN profiles p ON p.id = pp.profile_id
 WHERE t.status = 'paid' AND t.cash_not_received_at IS NULL
 GROUP BY 1 ORDER BY 2 DESC;
```

**Si la suma no da 18, avísame.** Si da 18, el número está bien y lo que engañaba era comparar dos pantallas
con alcances distintos.

## Y ya puedes ver qué hay en el inventario

La tarjeta decía "6 productos en 9 ubicaciones" sin decir cuáles. Debajo de las cifras hay ahora un
desplegable **"Qué hay en el inventario, y dónde"**, con las unidades por producto y por ubicación. Sale de
las **mismas filas** que la tarjeta, así que no pueden discrepar, y solo lista lo que tiene saldo.

---

# R13 · Lo que salió del repaso de las partes 1 y 2

**Cinco arreglos. Vuelve a cargar antes de seguir.**

## 1. "Tu mes" se contradecía a sí mismo

Registrar la venta retroactiva de 30.000 no movía **Ventas** y sí subía **Tu comisión** 5.042, en la misma
pantalla. La comisión se anclaba a la fecha de **su fila** (hoy) y las ventas a la fecha de **la venta**
(enero). Ahora las dos miran la fecha de la venta.

**Lo que tienes que ver ahora:** una venta retroactiva con fecha de un mes anterior **no mueve ninguna de las
dos** tarjetas de "Tu mes", y sí mueve el **ingreso bruto** de Dirección, que es de todo el histórico. Si
quieres verla en "Tu mes", la fecha tiene que ser de este mes.

*(Ojo con lo que registraste: la lista dice `2/1/2026`, o sea 2 de enero, aunque la factura se llame
"30 SEPTIEMBRE". Si querías el 30 de septiembre, revisa el campo de la fecha.)*

## 2. La venta que no pudo descontar ya llega a la bandeja

La LUVIA quedó "no alcanzó el saldo", que es lo previsto. Lo que no estaba previsto: la bandeja de **ventas por
revisar** miraba los últimos 30 días por la fecha **de la venta**, y una retroactiva nace con fecha vieja, así
que entraba ya vencida y no aparecía nunca. Ahora la ventana mira **cuándo se registró**.

**Compruébalo:** esa venta de LUVIA tiene que aparecer en ventas por revisar. Es la que dice que la vitrina
está contando una unidad que salió hace meses.

## 3. La venta retroactiva ya pide de qué consulta sale

Con la misma salida de "no sale de ninguna consulta" y su motivo. En una venta de hace meses lo normal es la
salida, y está bien: lo que no puede pasar es que quede suelta sin que nadie lo diga.

**Compruébalo:** intenta registrar una sin elegir ni marcar la salida. Tiene que rechazarla con el mismo
mensaje que /pagos.

## 4. La devolución parcial ya no pide conciliar nada

Decía *"el débito difiere del valor de la venta en 11.900 menos... la nota crédito va solo por el valor de la
venta"*, mientras el mensaje de la devolución decía *"emitir la nota crédito por 11.900"*. **Sobre el importe
de un documento fiscal, y quien siguiera el panel la habría emitido por el doble.** Ese aviso es de un
contracargo (donde se disputa la venta entera); en una devolución parcial el débito menor **es** la definición.

## 5. "Por qué" pasó a ser "La nota de cada caso"

Las líneas *"Devolución de 1 de 2 unidades de la línea"* las escribe el sistema: **el formulario de devolución
no pide motivo.** Ahora se marcan como automáticas y la pantalla lo dice. Si quieres saber **por qué** vuelve
un producto, hay que pedirlo al registrar la devolución: es una decisión tuya, no la tomo yo.

## Y para responder las dos del inventario, con la base

```sql
-- De dónde salieron las 90 de ADAPTO-STRESS, que NO estaban en la carga inicial
SELECT m.created_at::date AS dia, l.name AS ubicacion, m.type, m.delta, m.reason
  FROM nutraceutical_stock_movements m
  JOIN nutraceuticals n ON n.id = m.nutraceutical_id
  JOIN inventory_locations l ON l.id = m.location_id
 WHERE n.name = 'ADAPTO-STRESS' ORDER BY m.created_at;

-- Y por qué LUVIA sigue en 84 habiendo vendido una
SELECT m.created_at::date AS dia, l.name AS ubicacion, m.type, m.delta, m.reason
  FROM nutraceutical_stock_movements m
  JOIN nutraceuticals n ON n.id = m.nutraceutical_id
  JOIN inventory_locations l ON l.id = m.location_id
 WHERE n.name = 'LUVIA' ORDER BY m.created_at;
```

---

# R14 · Descartar un pendiente que no tiene salida, y las dos preguntas del inventario

**Migración 0205. Aplícala y vuelve a cargar `/pagos`.**

## 1. El descarte, que es lo que pediste

De los seis pendientes que manda el correo de las 7 y las 5, **dos no se pueden cerrar con ninguna acción en
Atlas**:

- **Cobrada sin saldo.** Se arregla contando la vitrina, fuera de Atlas. La venta se queda con ese estado para
  siempre.
- **Pagada y sin entregar.** El producto salía de la bodega. Si ya se entregó por fuera, nadie va a marcar un
  despacho que no ocurrió aquí.

Y "en gestión hasta" no servía: solo **posponía**, y su lista de tipos ni siquiera incluía estos dos.

Ahora hay un panel nuevo en `/pagos`, **Pendientes sin salida**, con un botón **Descartar** que pide el motivo.
Lo escribe quien ve el ingreso (administración y dirección; soporte ve el panel y no descarta), queda firmado
con su nombre y en el registro de auditoría, y el pendiente deja de aparecer en el correo y en la franja de
arriba.

**Lo que NO hace, a propósito:** no esconde la venta. La fila sigue en el panel, apagada, diciendo quién la
descartó, cuándo y por qué, con un botón para **reactivarla**.

## 2. Y caduca si el hecho cambia

Esto es lo que lo hace seguro, y es lo que añadí sobre lo que pediste. **Un descarte es un juicio sobre el
hecho tal como estaba**, no un permiso permanente sobre esa venta. Si la venta cambia después (se le agrega una
línea, cambia el importe, el descuento se reintenta y vuelve a fallar por otra razón, cambia de ubicación o
entra en revisión), **el descarte caduca y el pendiente vuelve**, con el aviso de que se había descartado y de
que el hecho cambió. Quien lo mire puede volver a descartarlo con un motivo nuevo; el anterior queda en el
historial.

Sin esta pieza, descartar una vez apagaría el aviso de esa venta **para siempre**, y el fallo sería silencioso.

**Compruébalo así:** descarta la venta de LUVIA que dice "no alcanzó el saldo". Tiene que desaparecer del
correo y del aviso de arriba, y seguir visible en el panel con tu motivo. Después tócale algo (reintenta el
descuento) y tiene que volver, marcada como "se había descartado, pero la venta cambió después".

## 3. Tu pregunta: ¿puedes mandar ADAPTO-STRESS sin saldo en central?

**Sí. La remesa no mira el saldo de central y no lo descuenta.** Una remesa **declara** un envío; el saldo del
Integrante sube cuando **él confirma** la recepción. Está escrito así desde la migración 0052, a propósito. Así
que no te va a bloquear.

**Pero encontré algo que sí es un hueco, y es una decisión tuya, no mía:** cuando el Integrante confirma la
recepción, **nada descuenta de central**. Se escribe el movimiento que le suma a él y no se escribe el que le
resta a la bodega. Por eso el total de inventario de `/direccion` **crece con cada recepción**, y es
exactamente por lo que viste ADAPTO pasar de 1.810 a 1.900 al recibir 90 unidades: las 90 se sumaron sin
restarse de ningún lado.

Las dos salidas posibles:

- **(a) Que la recepción descuente central.** La remesa pasa a ser un traslado de verdad: lo que sale de la
  bodega deja de estar en la bodega, el total no crece y central puede quedar en negativo si se manda más de lo
  que hay (que es información, no un error).
- **(b) Que el número de central sea informativo.** Entonces hay que quitarlo del total de `/direccion`, porque
  hoy ese total suma dos cosas distintas y se lee como una.

**No la tomo yo:** cambia una cifra que ya estás mirando y toca el saldo de la bodega. Dime cuál y la
construyo.

## 4. Tu otra pregunta: qué se perdió al cargar el inventario por SQL

Lo verifiqué contra el script (`scripts/carga-inventario-inicial.sql`, sección 4) y la respuesta es doble:

**(a) ¿Quedó registrada la remesa, o solo el saldo?** Solo las **recepciones**. El script escribe un movimiento
`recepcion` por Integrante y producto, con su lote y su razón ("Carga inicial: primera tanda del laboratorio,
entregada al Integrante antes del corte de arranque"), y otro para el resto que quedó en central, calculado
como recibido-del-laboratorio menos entregado. **No hay ninguna remesa declarada** contra la que cotejar.

**(b) ¿Hay constancia de que cada uno recibió lo que recibió?** Hay **rastro de custodia** (qué producto, qué
lote, cuántas unidades, con fecha y motivo), y no hay **firma**: nadie confirmó nada, el movimiento se escribió
por ellos. El propio sistema ya lo dice de esas filas: una recepción sin remesa de respaldo es una **"recepción
no respaldada"**, y aparece así en el panel de CNV. El comentario del script lo deja escrito: *"`remesa_id` va
nulo a propósito... y está bien: es verdad"*.

**Así que el camino normal habría dado una cosa más, y solo una: la firma del Integrante.** Si quieres tenerla
para esas siete cargas, se puede reconstruir (declarar las remesas con fecha de entonces y pedirles que
confirmen) **sin mover ningún saldo**, porque una remesa no mueve inventario. Es trabajo operativo suyo, no
código: dime si lo quieres y preparo las declaraciones.

---

# R15 · El total de inventario ya no cuenta la bodega

**Tu salida (b), hecha: se arregla la cifra, no los movimientos.** La mecánica de la remesa se queda como
está hasta que se rehaga el módulo de bodega con lo de Gildardo.

**La tarjeta de `/direccion` ahora se llama "En las vitrinas"** y cuenta solo eso. El alcance va en el nombre
de la cifra, no en letra chica: es lo que ya aprendimos con "Tu mes".

**Y encontré una segunda cosa que inflaba el mismo total, que no habías pedido: la cuarentena.** El producto
que vuelve de un paciente y espera verificación (hoy, 233 unidades) tampoco está en ninguna vitrina, no se
puede vender, y ya tiene su propio panel en `/pagos`. Contarlo en el total era el mismo defecto por otra
puerta, así que entra en la misma regla.

**Las dos se muestran aparte**, dentro de "Qué hay en el inventario, y dónde", bajo el rótulo *"Fuera de las
vitrinas (no suma en la cifra de arriba)"*, con su nombre, sus unidades y la razón escrita: que es
informativo, que la bodega no baja al despachar una remesa, y que se corrige cuando se construya el módulo.

**Lo que tienes que ver:** el total baja (sale la bodega y sale la cuarentena) y **deja de crecer cuando un
Integrante confirma una recepción**, que era el síntoma. Las unidades no desaparecen de la pantalla: están
abajo, nombradas.

**El candado:** `una unidad en la bodega central no sube el total, y si aparece aparte`, en
`src/tests/tablero-direccion-inventario-db.test.ts`. Comprueba la relación, no una cifra, porque una cifra
concreta envejece y el día que falla lo hace por otra razón.

*(De paso se arregló el fixture del caso vecino: elegía "la primera ubicación activa", que resultó ser la
bodega central, y al cambiar el total empezó a fallar por un motivo que no era el suyo.)*

## Y el ADAPTO-STRESS del smoke: confirmado, puedes arrancar

Que esté en el portafolio pero no exista físicamente es la elección correcta para no ensuciar la trazabilidad
de los cuatro que sí se fabricaron. Y **la remesa no mira el saldo de la bodega central ni lo descuenta**, así
que mandarla no te va a bloquear por no tener saldo ahí. Adelante.
