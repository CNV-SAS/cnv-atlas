# Smoke comercial final, y el checklist del arranque

**Al 20 de noviembre de 2026.** Este es **el documento comercial que hay que abrir**: lleva
el smoke, el checklist del arranque, los comandos en orden y lo que queda pendiente con su fecha. Lo de
las ventas históricas, que va después, está en `docs/PLAN_VENTAS_HISTORICAS_XLSX.md`.

> **La migración 0247 ya está aplicada y pusheada** (Santiago, 19 de noviembre: 248 = 248 en local y en
> la nube). Añadió el tipo de documento del representante legal, y es la que hace posible el paso
> **B4b**. El runbook con el que se aplicó se queda escrito en "Los comandos, en orden", como registro.

## ⚠ EL ARRANQUE ES EL VIERNES 20 DE NOVIEMBRE DE 2026, y no pasa de ese día

| Día | Qué |
|---|---|
| **viernes 20 (HOY)** | **el smoke completo** (partes A, B, C y D) y el **video** en sandbox, **y a continuación el arranque** (parte E). **Los dos son hoy, en ese orden**, y por eso el orden importa más que nunca: cada venta del smoke nace sellada en sandbox |
| **lunes 30** | el **xlsx de ventas atrasadas** cargado, antes del cierre del mes |
| **5.º día hábil de diciembre** | la **conciliación de inventario** |

> **Lo que reemplaza y dónde quedó lo anterior:** `docs/entregas/SMOKE_UNICO_2026-09-26.md`,
> `docs/entregas/SMOKE_SEGUNDO_2026-09-28.md` y `docs/entregas/ARRANQUE_OPERACION_REAL_2026-09-26.md`
> **se conservan tal cual, versionados**, como el registro de lo que se probó y de lo que se decidió cada
> día. De ellos sobrevive aquí **lo que sigue abierto**; lo cerrado se queda allá con su resultado.
>
> **NO SE PODA NI SE BORRA NINGÚN DOCUMENTO** (Santiago, 2026-11-18), ni después del 20. Lo que estaba
> propuesto como poda en el informe del 17 queda sin efecto: un documento viejo con una nota arriba cuesta
> nada y responde la pregunta "¿por qué se hizo así?"; borrado, no la responde nadie.

> **Dos cosas que hay que tener claras antes de empezar, y las dos muerden:**
>
> 1. **Una venta hecha con las llaves en sandbox NO se factura nunca**, ni cuando se monten las de
>    producción. `wompi_env` se sella **al crear** la venta y vale también para efectivo y transferencia. Por
>    eso el orden es: smoke → marcar lo del smoke → llaves → primera venta real. Nunca al revés.
> 2. **Marcar una venta como de prueba NO devuelve la unidad al inventario.** El libro de movimientos es
>    append-only porque describe algo que pasó. Lo que corrige un saldo es declararlo, y eso es el paso 3 del
>    checklist.
> 3. **El smoke corre en sandbox, pero el INVENTARIO es el de verdad.** Wompi y Alegra son de prueba; las
>    remesas y las ventas del smoke mueven unidades REALES de la bodega central. Esas unidades no se han
>    movido físicamente, así que el paso 3 del checklist devuelve a **cero** las vitrinas de las cuentas de
>    smoke. Está ya escrito en el script: no hay que acordarse.

---

## 0 · Lo que hace falta tener antes de empezar

| | Qué | Dónde se prepara |
|---|---|---|
| 1 | **Un integrante de prueba en Comisión.** Sirve `Profesional Demo`, que no tiene modalidad vigente y por eso es Comisión (sin fila de modalidad = Comisión) | ya está |
| 2 | **Un integrante de prueba en Distribución.** Sirven `Profesional demo 2` y `Profesional Prueba`: medido el 2026-11-18, **los dos tienen `distribucion` vigente**. **Las cuentas de smoke se quedan como están**: no hay que cambiarles nada | ya está |
| 3 | **Un paciente de prueba** por cada uno, marcado como de prueba | /pacientes |
| 3b | **DOS pacientes de prueba MENORES de edad** (fecha de nacimiento de hace ~10 años), para el B4b: uno se firma por el **camino remoto** (pide el tipo de documento del representante) y el otro por el **pase presencial** (no lo pide, y es el caso que tiene que quedar pendiente) | /pacientes |
| 4 | **Producto con saldo** en la vitrina de cada uno | /faltantes, bloque de remesas |
| 5 | **Las dos cuentas marcadas como de prueba AL FINAL**, no antes (ver la parte D) | /admin |

**El producto del smoke:** **MULTI-CELL BASE, lote `19826`**. No se usa ADAPTO-STRESS: desde el 15 de
octubre la central no deja despachar lo que no tiene, y de ADAPTO-STRESS no tiene nada.

### Las modalidades reales, medidas el 2026-11-18

| Integrante | Modalidad | Estado |
|---|---|---|
| **Katherine Ruiz Velez** | **Distribución**, vigente desde el **2026-11-18** | ya puesta. Es **persona jurídica** (ya está en su perfil) |
| **Zoraida Meneses** | **Comisión** | **se queda en Comisión**: no pasa a Distribución |
| Los demás Integrantes reales | **Comisión** | sin fila de modalidad = Comisión |

> **Katherine es hoy el único Integrante real en Distribución**, y eso tiene una consecuencia de dinero que
> hay que resolver antes de su primer corte: ver el **paso 5** del checklist y la sección de pendientes.

**Cambiar la modalidad a Distribución rige HOY MISMO** si ese integrante no tiene ninguna venta en el corte
en curso; si tiene alguna, entra en el corte siguiente y la pantalla lo dice. Para una cuenta de prueba
recién usada, conviene hacerlo **antes** de registrarle ventas.

> **Y desde el 2026-11-18 las ventas DE PRUEBA ya no aplazan el cambio.** Decía *"ya tiene 2 ventas en el
> período en curso"* sobre dos ventas marcadas como prueba, y las mandaba al corte siguiente. La regla
> existe para no liquidar un período con dos regímenes, y una venta de prueba no se liquida: no había nada
> que partir. Candado: `el-cambio-de-modalidad-no-cuenta-las-pruebas-db.test.ts`.

---

## PARTE A · Lo que quedó abierto del segundo smoke

**El orden es F · G · H · A · B · C · D · E.** La prueba **I** (conciliar el inventario) **no se corre**: la
bodega ya estaba cargada desde el 11 de septiembre y su sitio hoy es el paso 3 del checklist de arranque.

### A1 · F · Que admin vea cero

1. Entrar a **/pagos** como admin, **sin** el interruptor de prueba.
2. **Resultado esperado:** las cuatro cifras en cero. Ninguna venta de prueba en el historial de
   transacciones, ni en "ventas por revisar", ni en "pendientes sin salida" (ni el descartado), ni en
   "ventas cobradas sin cerrar". Y los **chips de días** de arriba dicen lo mismo que la lista de abajo: si
   un día dice "(3)", al pulsarlo salen tres.
3. **Al encender el interruptor**, aparece **todo** lo de prueba.
4. **Las devueltas pendientes son otra cosa:** ese panel cuenta unidades paradas en cuarentena, no ventas.
   Si queda alguna de producto real, no la quita ninguna marca: se cierra con los dos botones del panel
   (volver al lote, o dar de baja). Al 17 de noviembre **la cuarentena está en cero**.

> **Medido el 2026-11-17:** las **64** ventas de la nube cuentan **todas** como de prueba y **ninguna** es
> real. O sea que este punto debería pasar solo. Si aparece algo, es nuevo y hay que mirarlo.

### A2 · G · Que una venta de prueba no se facture

1. En /pagos, panel **"Ventas cobradas sin cerrar en contabilidad"**.
2. **Resultado esperado:** ninguna de las marcadas intenta facturarse, ni sola ni al pulsar "Reintentar".
   Si alguna aparece como *"No se factura aquí, por regla"*, eso **es correcto**: es el freno diciendo por
   qué.
3. Candado: `pnpm vitest run --project db src/tests/lo-de-prueba-no-llega-a-pagos-db.test.ts`.

### A3 · H · La venta que salió de la bodega

1. /pagos como **admin**, un paciente de prueba, medio efectivo o transferencia.
2. Marcar la casilla **"El producto salió de la bodega de CNV, no de la vitrina del Integrante"**.
3. **Resultado esperado:** la venta se registra, se descuenta de **la bodega** (no de la vitrina del
   integrante), sale el aviso de *"pagada y sin entregar: hay que despacharlo"*, y **la comisión sigue
   siendo del integrante**: la venta es suya, lo que cambió es de dónde salió el producto.
4. **Y al revés, que es el que importa:** entrar como Integrante y comprobar que esa casilla **no está**.

### A4 · A · La segunda cuenta del mismo corte

1. /comercial como admin, bloque de Distribución.
2. **Resultado esperado:** el corte **en curso** sale **sin botón**, con la fecha en que cierra. Un corte
   solo se puede facturar cuando ya cerró.
3. Para la re-emisión hace falta un corte cerrado con ventas sin facturar. Si no hay, lo cubre el candado:
   `pnpm vitest run --project db src/tests/rehacer-la-cuenta-de-distribucion-db.test.ts`.
4. **Resultado esperado de la re-emisión:** emitir dos veces no revienta; la segunda dice *"Cuenta
   rehecha... reemplaza a la anterior"*, lleva el corte **completo**, y en la pantalla del Integrante queda
   **una sola** cuenta viva.

### A5 · B · La alerta de vencimiento el mismo día

1. Marcar un lote que venza dentro de los próximos 60 días.
2. **Resultado esperado:** aparece **el mismo día**, en Mi inventario y en /faltantes, con borde punteado y
   el rótulo *"sin avisar todavía"*, diciendo que el correo sale mañana a las 8:30. **Al día siguiente** esa
   misma fila pasa al bloque de siempre, con su alerta registrada y su botón de "lo vi".

### A6 · C · La liquidación en la pantalla de admin

1. /comercial como admin, una liquidación con cargo por faltante sin girar.
2. **Resultado esperado:** **NO** sale *"si no estás de acuerdo, escribe a admin@cnvsystem.com"*. En la
   pantalla del profesional **sí sigue saliendo**. Hay que mirar las dos: es la misma fila.

### A7 · D · Los bloques sin fondo

1. Mi inventario con una remesa por confirmar, y /comercial del Integrante con una cuenta de Distribución.
   **La remesa se declara de 1 unidad de MULTI-CELL BASE lote `19826`.**
2. **Resultado esperado:** los dos son tarjeta blanca con sombra, con la tesela de icono azul y la cifra
   grande, y se leen igual de "vivos" que las liquidaciones de al lado.

### A8 · E · Que /mi-inventario no se caiga

1. No se puede provocar a mano (era el pooler de Supabase ocupado un instante).
2. **Resultado esperado de lo que sí se puede ver:** si alguna pantalla falla, **la barra lateral se queda
   en pie** y se puede ir a otra pantalla sin recargar.
3. Candado: `pnpm vitest run --project unit src/tests/reintento-solo-si-no-corrio.test.ts`.

### A9 · J · El consentimiento del menor (lo que falta de esa prueba)

El **paso 3 ya está hecho y verificado** (los seis menores atienden). Quedan los pasos 1, 2, 4 y 5, que no
frenan a nadie y se pueden hacer cuando se quiera:

1. **Ficha** de uno de los seis: arriba de las autorizaciones sale *"Consentimiento de menor sin
   representante"*, con **"(por revisar; no bloquea la atención)"**, qué hacer, y que el consentimiento
   firmado **no se borra ni se invalida**. Las tres autorizaciones siguen *"Vigente"* abajo.
2. **Lista de pacientes:** ese paciente lleva esa misma etiqueta, y **NO** dice *"Sin autorización
   vigente"*.
3. **Fecha de nacimiento imposible:** sale marcada en tono neutro y sin frenar; al corregirla en la ficha,
   la marca desaparece sola. (En la nube no hay ninguno.)

---

## PARTE B · El smoke desde cero, integrante de COMISIÓN

**Todo con cuentas de prueba y pacientes de prueba.** Al terminar, cada paso deja una cifra que el
siguiente comprueba.

### B1 · Punto de partida

1. /faltantes como admin → bloque de remesas → declarar **5 unidades de MULTI-CELL BASE lote `19826`** a la
   vitrina del integrante de Comisión.
2. Entrar como ese integrante → **/mi-inventario** → **confirmar la remesa**.
3. **Resultado esperado:** su vitrina dice **5 unidades**, la bodega central bajó en 5, y la remesa
   desaparece de "por confirmar". Si confirma **menos** de lo declarado, el saldo sube por lo confirmado y
   la diferencia queda visible: es deliberado.

### B2 · Venta por pasarela (Wompi)

1. Como el integrante, abrir la consulta del paciente de prueba y **cobrar 1 MULTI-CELL BASE** por
   **pasarela**. O desde /pagos, creando el link.
2. Abrir el link de checkout y pagar con una **tarjeta de prueba de Wompi** (sandbox).
3. **Resultado esperado:**
   - la venta queda **pagada**, con su `wompi_transaction_id`;
   - la vitrina del integrante baja a **4**;
   - en /pagos, arriba, sigue el **aviso amarillo del modo de pruebas**: *"El sistema está en modo de
     pruebas. Una venta que se registre ahora queda marcada como pago de prueba..."*. **Que esté es
     correcto hoy**: significa que las llaves siguen en sandbox.
4. Si el webhook no llega, el cotejo lo resuelve: `node scripts/sondeo-wompi-consulta.mjs`.

### B3 · Venta en efectivo

1. /pagos → venta ya cobrada → **efectivo** → 1 MULTI-CELL BASE.
2. **Resultado esperado:** la venta nace **pagada**, la vitrina baja a **3**, y aparece en **"Ventas
   cobradas sin cerrar en contabilidad"** hasta que la factura salga.
3. **Y el detalle que importa:** esta venta también se sella `wompi_env = test` aunque sea efectivo. Es la
   razón del orden de las llaves.

### B4 · La factura en el sandbox de Alegra

> **ESTE PASO ESTABA MAL ESCRITO Y SE CORRIGIÓ EL 2026-11-18.** Decía que una venta de un paciente de prueba
> *"no se factura aquí, por regla"*, y es al revés. **La regla es simétrica, y el código ya la cumple**
> (`motivoSiPacienteYAmbienteNoCuadran` en `src/modules/payments/facturacion.ts`):
>
> | | sandbox | producción |
> |---|---|---|
> | **paciente de PRUEBA** | **SÍ se factura.** Es así como se prueba la facturación | **NO**: sería un documento fiscal real a nombre de alguien que no existe |
> | **paciente REAL** | **NO**: su identidad no viaja a un ambiente de pruebas | **SÍ** |
>
> Y hay una tercera regla, que no es ninguna de esas dos: **una venta que alguien MARCÓ a mano como prueba
> no se factura en NINGÚN ambiente**, porque un documento fiscal afirmaría un acto que ya se declaró que no
> ocurrió. Esa marca es por VENTA (migración 0217), no por paciente.
>
> **No hizo falta tocar el código: lo que estaba mal era el documento.**

1. Mirar el panel de facturación en /pagos. **Con el interruptor de pruebas puesto: `/pagos?prueba=1`.**
2. **Resultado esperado:** las dos ventas de arriba se emiten en el **sandbox** de Alegra, con su número, y
   el panel deja de pedirlas. El pago queda registrado contra la cuenta puente que corresponde.
3. **Si una queda sin facturar, el panel dice por qué**, con una de estas tres frases:
   - *"El paciente NO está marcado como de prueba y se está facturando contra sandbox"* → el paciente del
     smoke no quedó marcado. **Se marca y la venta sale sola de rechazada**, sin gastar intentos.
   - *"Alguien marcó esta venta como de PRUEBA"* → se le quitó la marca antes de tiempo. Las marcas del
     smoke van **al final** (parte D), no durante.
   - *"Ítems de otro ambiente"* o *"Sin ítem en Alegra"* → el mapa de items, no el paciente.

> **Por qué hay que poner `?prueba=1`, y no es un detalle:** los paneles de /pagos **ocultan** las ventas
> de prueba, y una venta de un paciente de prueba cuenta como tal. La cola **sí la va a facturar** (solo
> excluye la marca manual), pero **no la vas a ver en la bandeja** sin el interruptor. La línea gris de
> arriba dice cuántas hay ocultas y tiene el enlace "Verlas".

### B4b · El paciente MENOR de edad, y la factura a su representante legal

**La regla de contabilidad (C1):** la factura de un menor va a nombre de su **representante legal**, que
es quien compra y quien paga, con **su tipo y número de documento** y **su correo**. **Nunca los datos del
menor en un documento tributario.** Y nada de "consumidor final" por defecto.

> **La 0247 ya está aplicada** (Santiago, 19 de noviembre: 248 = 248). Si este paso falla por una columna
> que no existe, lo que falta es el push, no la migración.

#### Por qué son TRES casos y no cuatro

El caso *"menor sin representante"* **ya no se puede fabricar por el camino normal**: desde hoy el
consentimiento de un menor **exige** el representante con su tipo de documento, así que un menor nuevo no
puede terminar la encuesta sin él. Ese caso existe solo en **datos viejos** (los 6 menores que firmaron
antes), y esos son **pacientes reales**: no se facturan en un smoke.

Lo que sí hay que probar es que el freno **existe** y que **se sale solo de él**, y para eso sirve el caso
del tipo que falta, que además es el que va a seguir apareciendo de verdad (ver el paso 2).

#### Paso 1 · Menor con representante COMPLETO, y la factura sale a su nombre

1. Crear un **paciente de prueba menor de edad** (fecha de nacimiento de hace unos 10 años) y firmarle el
   consentimiento por el **camino remoto normal** (la encuesta). Ahora el formulario pide el **tipo** de
   documento del representante aparte del número: cédula, cédula de extranjería o pasaporte.
2. En la **ficha del paciente** tiene que aparecer el bloque del representante con sus datos y el botón
   **"Corregir el representante legal"**.
3. Venderle **1 MULTI-CELL BASE** en efectivo, como el B3.
4. **Resultado esperado:** la factura **se emite en el sandbox**, y en **Alegra** el cliente de esa factura
   es **el representante**: su nombre, **su** tipo y número de documento, y **su** correo. **Ningún dato
   del menor** aparece en el documento.
5. **Cotejarlo en Alegra, no solo en Atlas.** Es el punto entero de la prueba: en Atlas la factura se ve
   "emitida" igual en los dos casos, y lo que se está probando es **a nombre de quién salió**.

#### Paso 2 · Menor con representante SIN TIPO: pendiente, y sale solo al completarlo

**La forma más corta de dejarlo así es el PASE PRESENCIAL (el QR).** No es un truco para la prueba: es el
camino que **todavía** captura el representante sin tipo de documento, porque la tabla
`presencial_consent_sessions` no tiene esa columna (el remoto sí la pide). O sea que este paso
prueba el caso real que va a seguir llegando mientras eso no se cierre.

1. Crear un **segundo paciente de prueba menor** y firmarle el consentimiento por el **pase presencial**,
   con los datos del representante (nombre, documento, parentesco y correo). **No pide el tipo.**
2. Venderle **1 MULTI-CELL BASE** en efectivo.
3. **Resultado esperado:** en **`/pagos?prueba=1`**, panel de facturación, la venta aparece
   **rechazada** con un motivo que habla del **TIPO** de documento:
   *"...al representante legal le falta el TIPO de documento (cédula, cédula de extranjería o
   pasaporte). Alegra lo exige para emitir..."*. Y la venta **se registró, se pagó y descontó
   inventario** con normalidad: lo que se frena es la factura, no la venta.
   - **El contador de intentos NO sube.** El freno se decide antes de reclamar el intento, a propósito:
     una venta que está esperando un dato no gasta sus tres oportunidades esperando.
4. **En la ficha del paciente**, el bloque del representante **se abre solo** (no hay dato bueno que
   proteger, y lo que hay es una venta que no se puede facturar). Elegir el tipo de documento y guardar.
5. **Volver a /pagos y reintentar la factura.** **Resultado esperado: se emite, a nombre del
   representante**, sin tocar nada más. Eso es lo que significa "sale sola de este estado".

> **Por qué el motivo es DISTINTO del de "falta el representante":** en un caso falta la persona entera y
> alguien la puede completar; en este solo falta un campo. Decirle *"falta el representante"* a quien ya
> lo registró lo manda a buscar algo que está.

#### Paso 3 · El adulto de control, y es el que de verdad importa

1. Volver al paciente **adulto** del B2 y del B3 y facturar.
2. **Resultado esperado: sale exactamente igual que siempre, a su propio nombre.** Si un adulto queda
   frenado, o si su factura sale a nombre de otro, **para el smoke y avísame**: el freno estaría mirando
   "tiene representante" en vez de "es menor".

> **Un paciente SIN fecha de nacimiento NO se frena**, y es deliberado: no se sabe que sea menor, y
> frenar a todos los que no tienen fecha congelaría la facturación de adultos reales (hay pacientes
> reales sin fecha de nacimiento).

> **El contacto del representante no se guarda en el paciente.** Se resuelve por documento en cada
> factura, a propósito: si se cacheara, el día que ese menor cumpla 18 su factura seguiría saliendo a
> nombre del representante. Cuesta una llamada más a Alegra y es la única versión que no se queda vieja.

**Candados:** `la-factura-de-un-menor.test.ts` (15 casos, con el del adulto y el de que ningún
dato del menor viaja) y `la-factura-de-un-menor-db.test.ts` (el lector, con el borde de quien
cumplió 18 **después** de la venta; sus 5 casos **ya corren**, la columna existe en local).

### B5 · La comisión

1. /comercial como admin → bloque de Comisión.
2. **Resultado esperado:** el integrante aparece con su base y su comisión al **20 %** de las dos ventas, y
   la retención calculada según su estado tributario. Las mismas cifras las ve él en **/comercial** (desde
   la barra lateral, **"Mis pagos"**) y en **/perfil**.
3. **Liquidar** y comprobar que la liquidación queda con su documento, su retención y su neto, y que al
   integrante le aparece en su historial.

#### Qué muestra hoy la retención, y qué esperar

**Lo que contabilidad fijó el 2026-11-18**, y lo que el sistema hace hoy con cada caso:

| Caso | Lo que pidió contabilidad | Lo que hace Atlas hoy |
|---|---|---|
| Persona **natural** en Comisión | **10 %**, o la tabla del art. 383 si lo declara en su cuenta de cobro (casi siempre da 0) | **10 %** ✔ · y **11 %** si el acumulado del año pasa de 3.300 UVT (172.834.200) ✔ · **la tabla del 383 NO está construida** ✖ |
| Persona **jurídica** en Comisión | **11 %** | **11 %**, siempre, sin mirar el acumulado ✔ |
| Persona jurídica en **Distribución** | **no hay retención sobre comisión** | ✔ no se calcula ninguna: en Distribución no hay comisión |
| Sin datos tributarios | — | **no liquida, y dice cuáles faltan.** No asume ningún valor |

> **El 10 % NO está escrito a fuego**, que era la preocupación: son `RETENCION_BASE = 0.1` y
> `RETENCION_ALTA = 0.11` en `src/modules/payments/liquidacion.ts`, con la rama de jurídica y la del
> umbral. Lo único que falta es **la tabla del art. 383 como opción por integrante**, y está en los
> pendientes con fecha ("antes de la primera liquidación").

**En el smoke, con `Profesional Demo`** (persona natural, obligado a facturar, acumulado bajo el umbral):
la retención sale al **10 %** y el documento es **"factura del integrante"**. Si en vez de eso sale *"faltan
datos"*, es que a esa cuenta le falta alguno de los tres campos tributarios, y el mensaje dice cuál.

### B6 · El inventario, al final

1. /mi-inventario del integrante y /direccion como admin.
2. **Resultado esperado:** su vitrina dice **3**; la cifra "En las vitrinas" de /direccion lo refleja; y la
   bodega central salió de la cuenta de las vitrinas y se muestra aparte, con su nombre.

---

## PARTE C · El smoke desde cero, integrante de DISTRIBUCIÓN

**La diferencia de fondo:** en Comisión CNV le paga al integrante; en **Distribución el integrante le compra
a CNV**, y CNV le **cobra** por corte quincenal. Las dos direcciones del dinero son contrarias, y por eso
son dos bloques distintos de /comercial.

### C1 · La modalidad

1. /admin → el integrante de prueba → bloque de **Modalidad** → pasar a **Distribución**.
2. **Resultado esperado:** si no tiene ventas en el corte en curso, se ofrece aplicar **de inmediato** y
   rige hoy. Si tiene, la pantalla dice que rige desde el **próximo corte** y cuál es. Las dos son
   correctas; lo que no puede pasar es que no diga nada.

### C2 · La remesa de admin, y su aceptación

1. /faltantes como admin → remesas → declarar **10 unidades de MULTI-CELL BASE lote `19826`** a ese
   integrante.
2. **Resultado esperado del lado de admin:** si la bodega central no tuviera esas unidades, **la remesa se
   rechaza** y el disponible se muestra al lado del formulario.
3. Entrar como el integrante → /mi-inventario → **confirmar**.
4. **Resultado esperado:** su vitrina queda en **10**, la bodega central baja en 10, y la remesa deja de
   estar pendiente.

### C3 · La venta del integrante de distribución

1. Como él, cobrar **2 unidades** a su paciente de prueba, en efectivo.
2. **Resultado esperado:**
   - la venta queda pagada y su vitrina baja a **8**;
   - **NO se le ofrece cobrar por pasarela a nombre de CNV**: en Distribución el recaudo es suyo (candado:
     `distribucion-no-ofrece-cobrar.test.ts`);
   - **esa venta NO genera comisión**: genera deuda suya con CNV (candado:
     `distribucion-no-se-factura-db.test.ts`).

### C4 · La cuenta de distribución

1. /comercial como admin → bloque de Distribución.
2. **Resultado esperado:** el corte **en curso** aparece **sin botón**, con la fecha en que cierra. Solo un
   corte **cerrado** se puede emitir. Si hay uno cerrado, emitirlo.
3. Como el integrante → /comercial (**"Mis pagos"**) → **ahí está su cuenta**, con el detalle línea por
   línea, y el botón de **objetar**.
4. **Resultado esperado de objetar:** la cuenta queda objetada con su nota; admin la resuelve y, si la
   rehace, la segunda dice *"Cuenta rehecha... reemplaza a la anterior"* y **queda una sola viva**.

### C5 · El historial de pagos

1. Como el integrante, **/comercial** → es la entrada **"Mis pagos"** de la barra lateral.
2. **Resultado esperado:** ve sus cuentas de Distribución (vivas y pasadas) y sus liquidaciones, y nada de
   nadie más. **Esta entrada es nueva del 17 de noviembre:** antes la pantalla ya le servía y no había cómo
   llegar sin teclear la URL.

### C6 · LUVIA, el producto de tercero

1. Declararle **2 unidades de LUVIA lote `04197232`** y venderle **1** a su paciente de prueba.
2. **Resultado esperado:**
   - **LUVIA no cuenta como nutracéutico de CNV en ninguna superficie**: el pendiente de nutracéuticos del
     cierre de consulta **no** se cierra con ella, y el botón *"No prescribo nutracéuticos"* sigue
     disponible aunque LUVIA esté en la prescripción;
   - **bajo Distribución NO hay factura de CNV al paciente** (el recaudo es del integrante), así que lo
     del centro de costo de tercero **se comprueba en la parte B**, con el integrante de Comisión: ahí la
     factura de LUVIA lleva el centro de costo de **tercero**, no el de producto propio;
   - su reparto le deja a CNV solo su participación (el 10 % del piloto), no el margen entero;
   - el inventario baja igual que cualquier otro producto.

---

## PARTE D · Al cerrar el smoke: cómo se marca lo que se hizo

**Esto no es opcional:** es la condición para montar las llaves, y hay un guard que lo verifica.

| | Qué | Dónde |
|---|---|---|
| 1 | **Marcar a mano las ventas del smoke** (motivo de 10 caracteres). **No hace falta cazarlas una por una:** el script del arranque las marca TODAS por su ambiente, y este paso es para las que se quieran dejar explicadas con su propio motivo | /pagos, como admin |
| 2 | **Marcar las dos cuentas de prueba**: `Profesional Prueba` y `Profesional demo 2`. Hoy cuentan como **reales** a pesar del nombre. **ES LA MISMA ACCIÓN QUE EL PASO 4 DEL CHECKLIST, no dos**: se hace UNA VEZ, aquí o allá, y queda hecha en los dos sitios. Está escrita dos veces porque cierra el smoke y además es requisito del arranque | /admin |
| 3 | **Marcar los pacientes del smoke.** La fila 2 arrastra a los suyos hacia atrás, así que solo queda a mano el que tenga `es_real_confirmado`: hay **uno** en toda la base, y se arregla con **"Quitar la confirmación"** en su fila | /admin/integrantes/[id] |
| 4 | **Decidir ADAPTO-STRESS.** CNV no lo tiene: va a `no_disponible` desde /nutraceuticos, y sus **16 unidades** se llevan a cero por **conciliación**, no por baja (baja afirmaría que CNV destruyó 16 frascos que nunca tuvo) | /nutraceuticos |

> **El script de las llaves de Alegra NO va aquí.** Estaba como fila 5 de esta tabla y se quitó: `scripts/config-alegra-produccion.sql` **solo se puede correr con los valores de PRODUCCIÓN**, que no existen hasta haberlos leído con `leer-alegra.mjs`, y el propio script **aborta** mientras quede un `<LLENAR>` o mientras un valor sea idéntico al del sandbox. **Su sitio es el paso 7 del checklist**, y ahí está completo, con su ensayo y su `--commit`.

> **Lo que NO hay que limpiar a mano: el inventario del smoke.** Las remesas y las ventas del smoke sacaron
> unidades REALES de la bodega central, y esas unidades siguen físicamente ahí. El **paso 3 del checklist**
> ya devuelve a cero las vitrinas de `Profesional Demo`, `Profesional Prueba`, `Profesional demo 2` y
> `Santi pruebas`, y deja la bodega en su cifra. **No hay que tocar nada**: lo único que hay que hacer es
> leer el cuadro **(4b) VEREDICTO** de ese script, que dice CUADRA o NO CUADRA por producto.

> **Un paciente NO se marca por parecido.** Hay uno de la cuenta real de la dirección científica cuyo
> nombre lo delata y que **no** es de prueba: marcarlo lo sacaría de las cifras y de la cohorte sin que
> nadie lo haya decidido, que es el error contrario y más difícil de ver.

**Lo que NO hay que limpiar:** el producto `PRUEBA SMOKE BLOQUE 3` y sus 60 unidades retiradas en la
central. Ninguna cifra de dinero las cuenta y ninguna pantalla de venta las ofrece a una cuenta real. El
inventario **sí** las muestra, y es deliberado: esa pantalla existe para contar.

---

## PARTE E · EL CHECKLIST DE ARRANQUE

**En este orden. Cada paso supone el anterior hecho.**

### Paso 1 · Marcar o limpiar lo de prueba

Toda la **parte D** de arriba, completa. **Resultado esperado:** en /pagos, sin el interruptor, las cuatro
cifras en cero.

### Paso 2 · El corte de pruebas y el inicio de la operación

```
scripts/ARRANQUE_A_PRODUCCION_2026-11-20.sql
```

> ### ⚠ CUÁNDO se corre: JUSTO ANTES del paso 5 (las variables de Vercel), y otra vez DESPUÉS del paso 8
>
> **Lleva el número 2 porque es el segundo que se documenta, no el segundo que se corre.** Los números de
> paso son nombres (hay una docena de referencias a ellos en este documento); el orden real del día está en
> **"LOS COMANDOS, EN ORDEN"**, y ahí este script va en el momento **3**, pegado a las variables.
>
> **Por qué lo más tarde posible:** su criterio son las ventas **selladas en sandbox**, y el smoke y el
> arranque son el mismo día. Cada venta que se registre mientras el sistema siga con las llaves de prueba
> nace así. Corriéndolo al final, atrapa todas; corriéndolo primero, deja fuera todo lo que pase después.
>
> **Y se corre DOS VECES:**
>
> | | Cuándo | Cómo | Qué tiene que salir |
> |---|---|---|---|
> | **1.ª pasada** | justo antes del paso 5 | simulación, leer **(1b)**, y luego `commit` | (1b) con las ventas del smoke, una por una |
> | **2.ª pasada** | después del paso 8 (el redespliegue) | **solo `rollback`** | **(1b) VACÍO** |
>
> **Si la segunda pasada NO sale vacía**, hay que mirar la columna `registrada_a_las` de cada venta, porque
> son dos problemas distintos:
>
> - **registrada ANTES del redespliegue** → alguien vendió en la ventana. Se corre otra vez con `commit` y
>   queda resuelto.
> - **registrada DESPUÉS del redespliegue** → **el redespliegue no tomó las llaves nuevas.** Lo que hay que
>   arreglar son las variables, no la venta. Es el mismo síntoma que el aviso amarillo del paso 8, visto
>   desde la base.
>
> **Conviene avisar a los Integrantes de que no registren ventas durante esa ventana** (entre la primera
> pasada y el redespliegue). No es obligatorio, para eso está la segunda pasada, pero desmarcar una venta
> hay que hacerlo a mano desde /pagos y es más barato no tener que hacerlo.

#### ⚠ Son DOS fechas, no una

Es la corrección de Santiago del 18 de noviembre, y evita que las ventas atrasadas se queden fuera de las
cifras para siempre:

| | Qué es | Valor | Cómo se expresa |
|---|---|---|---|
| **El corte de pruebas** | el día del arranque. Todo lo registrado antes es de prueba | **2026-11-20** | con la marca `cuenta_como_de_prueba` de cada venta, no con una fecha |
| **El inicio de la operación** | desde cuándo cuentan las cifras de Dirección | **2026-08-08** | `commercial_config.fecha_de_arranque` |

**Por qué el inicio es el 8 de agosto:** es la **primera venta real**. La hizo CNV (la vendió Gildardo, sin
comisión y con descuento al paciente). La primera venta de un Integrante fue de **Ángela, el 2026-09-03**;
manda la del 8 de agosto.

**Por qué no pueden ser la misma fecha:** las ventas atrasadas del xlsx tienen fechas de **agosto a
noviembre**, anteriores al arranque. Si la ventana de las cifras empezara el 20, **no contaría ninguna**, y
la proporción entre lo prescrito y lo comprado saldría falsa por el lado que más importa.

**Y no hace falta ninguna migración**, porque los dos mecanismos ya estaban separados en el sistema: el
corte de pruebas nunca se expresó con esa fecha, se expresa con la marca, que los lectores de cifras ya
miran por su cuenta. Lo que estaba confundido era el **nombre** de la columna.

#### Qué hace el script

**Se corre en el editor SQL de Supabase de producción, tal cual: termina en `rollback` y solo informa.** Se
leen los cuadros, y solo entonces se cambia `rollback` por `commit`.

1. **Lista** las ventas **selladas en sandbox** (`wompi_env = 'test'`) que todavía cuentan como reales
   (cuadro **(1b) VA A MARCAR**).
2. **Las marca** como prueba, con motivo y una fila de auditoría por venta.
3. **Anula** las cuentas de Distribución de cortes anteriores **no pagadas**.
4. **Pone `fecha_de_arranque = 2026-08-08`**, que es lo que enciende las cifras.

> **¿Marca o solo lista? MARCA, y lista antes.** Es deliberado: una venta que se escape y siga contando
> como real **puede ser facturada por la cola en el Alegra de producción**, donde cada factura va a la DIAN
> y deshacerla es una nota crédito con su hueco en el consecutivo. Y marcarla **sí** se deshace: se le quita
> la marca desde /pagos. La asimetría decide.

#### ⚠ El criterio de marcar ya NO es la fecha: es el ambiente (2026-11-20)

**Era "todo lo operado antes del corte". Ahora es `wompi_env = 'test' and not cuenta_como_de_prueba`, sin
fecha.** El hueco que lo obligó: el smoke y el arranque son el mismo día, así que una venta que un
profesional **real** registre hoy antes de cambiar las llaves nace sellada en sandbox, **nunca se podrá
facturar** (el candado exige que el pago y la factura sean del mismo mundo) y aun así contaría como real en
las cifras y en las comisiones. Con el criterio viejo el script no la veía, porque era del día 20.

**Se consideró poner el corte en `now()`, el momento de ejecución, y se descartó por tres razones:**

1. **El script se corre dos veces**, y con `now()` la segunda pasada marcaría como prueba una venta **real**
   hecha justo después del redespliegue. Con el ambiente no puede: esa venta nace `produccion`.
2. **La fecha se vuelve una trampa en cuanto entre el xlsx.** Las ventas atrasadas se registran con su fecha
   de operación **histórica** (agosto a noviembre), o sea anterior al corte, y son **reales**. Volver a
   correr el script después de cargarlas marcaría **las 175** de un golpe. El ambiente las deja en paz.
3. **El ambiente sigue al hecho y el reloj no.** Un link creado en la ventana pero **pagado** después del
   cambio de llaves lo corrige el evento de Wompi a `produccion`, y esa venta sí es real.

**No hay agujero de nulos:** `wompi_env` es `not null` y solo vale `test` o `produccion`, y se sella también
en efectivo y transferencia.

**El corte sigue en el bloque (0)**, pero ya no decide a quién se marca: le quedan anular las cuentas de
Distribución de cortes anteriores y ser la etiqueta del rastro de auditoría.

**El de octubre NO se vuelve a correr:** su paso 4 volvería a poner `2026-10-15`.

**Resultado esperado:** `fecha_de_arranque` queda en **2026-08-08**, `sandbox_que_cuentan_como_real` en
**0**, y las dos cifras clínicas (consultas y consentimientos) **idénticas** antes y después. Dirección deja
de decir *"Todavía no se ha arrancado"* y empieza a contar desde el 8 de agosto, que hasta que entre el
xlsx mostrará muy poco: es correcto.

> **El inventario no lo toca esta fecha, ni ninguna.** Un saldo no es un flujo: las unidades que hay están
> hoy donde están, las haya puesto quien las haya puesto. Y tampoco recorta **lo que se le debe a alguien**:
> una comisión anterior se liquida igual. Las dos reglas tienen candado.

### Paso 3 · Cargar el inventario real

**Va al final del smoke, cuando ya no se vaya a mover ni una unidad más en pruebas.** Desde el 2026-11-20
va **ANTES** del script del arranque, no después: ese script se movió a pegarse a las variables de Vercel
(ver su propio paso 2), y los dos son independientes porque **el del arranque no toca el inventario**.

> **Lo único que los ata es la ventana.** Una venta registrada entre esta carga y el redespliegue
> **descuenta inventario de verdad**, y marcarla como de prueba **no devuelve la unidad** (el libro de
> movimientos es append-only). Así que **si la segunda pasada del script del arranque trae alguna venta**
> (momento 7 de los comandos), hay que volver a correr este script: es idempotente, declara el saldo otra
> vez y deja las vitrinas donde tienen que estar.

```
scripts/CARGAR_EL_INVENTARIO_AL_ARRANQUE_2026-11-20.sql
```

Antes, correr el de lectura para ver cómo quedó todo tras el smoke:

```
node --env-file=.env.production.local scripts/EL_INVENTARIO_CONTRA_LO_RECIBIDO_2026-11-17.mjs
```

**Qué hace:** deja el saldo de cada vitrina **exactamente** en lo que esa persona recibió, con un movimiento
de `conciliacion` por línea (motivo y autor) y una fila de auditoría
`inventario.carga_inicial_al_arranque`. También termina en `rollback`.

#### Lo que cambió el 18 de noviembre

- **Entran VÍCTOR CANO y MARÍA TERESA ARAGÓN HERRERA**, que faltaban en la lista: **15 unidades de cada uno
  de los cuatro nutracéuticos, sin LUVIA**. Son 120 unidades que estaban contadas en la bodega y no lo
  estaban. Los dos **existen ya en el sistema, con su vitrina**: el script los resuelve sin problema.
- **La bodega esperada baja** de 375/374/301/183/33 a **345 / 344 / 271 / 153 / 33**. Verificado línea por
  línea contra la lista: 500−155, 500−156, 426−155, 300−147, 84−51. **Las cinco cifras de Santiago cuadran
  exactas.**
- **Las vitrinas de las cuatro cuentas de smoke vuelven a cero** (ver la parte D).
- **El neto ya no es una cifra escrita a mano: el script lo calcula.** La del 17 de noviembre (+12 y +8)
  dejó de valer en cuanto el smoke movió unidades.

#### Lo que cambió el 20 de noviembre · las cifras corregidas (ESTAS son las que se cargan)

Santiago revisó el inventario a fondo con el chat contable, y el archivo corregido mueve **tres cifras de
lo recibido**: dos de una Integrante (OMEGA y LUVIA) y una de otra (OMEGA). Nada más se movió, y los otros
ocho quedan idénticos. **El detalle por persona vive solo en el script de carga**
(`scripts/CARGAR_EL_INVENTARIO_AL_ARRANQUE_2026-11-20.sql`, bloque 2), que es donde se aplica.

- **La bodega esperada pasa a 345 / 328 / 271 / 153 / 31**, que es 500−155, 500−172, 426−155, 300−147,
  84−53. Solo cambian OMEGA (344 → **328**) y LUVIA (33 → **31**).
- **LA PRUEBA DE QUE LAS CIFRAS NUEVAS SON LAS BUENAS ES LUVIA.** Con la cifra corregida, lo entregado de
  LUVIA da 53 y la bodega queda en **31**, que es **exactamente el conteo físico del 19 de noviembre**.
  Antes daba 33 contra un conteo de 31, y nadie sabía de dónde salían esas dos.
- **Lo que se carga sigue siendo LO RECIBIDO, no el saldo de hoy.** El archivo corregido trae las dos
  cifras (su sección 3a es lo recibido, su 3d es lo que debería quedar hoy). Se carga la primera porque
  cargar la segunda **y después** subir el xlsx de ventas atrasadas restaría esas ventas **dos veces**. El
  plan no cambia: el xlsx resta después, y el aviso de ventas históricas se queda hasta entonces.
- **La simulación del 20 de noviembre, contra producción:** 40 líneas cambian (25 suben, 15 bajan) y el
  **neto por producto es +12 MULTI-CELL y +8 OMEGA, cero en los otros tres**, que es **exactamente** lo que
  las ventas de prueba se llevaron (46 movimientos, 56 unidades, de las cuales 12 MULTI, 8 OMEGA y 1 LUVIA
  son de producto real; el resto es ADAPTO-STRESS y PRUEBA SMOKE, que son `is_test`). Al terminar, el total
  por producto queda en **500 / 500 / 426 / 300 / 84**. **VEREDICTO: cuadra en los cinco.**
- **Y queda un hallazgo, que NO lo cierra esta carga:** el conteo físico del 19 dio 334 / 304 / 254 / 151 /
  31. Contra lo recibido menos los despachos directos de bodega, las ventas de precio especial y las compras
  de socios, sobran **cuatro unidades** (1 de cada uno de los cuatro propios) que salieron sin registro.
  **Las cierra el conteo físico de C5**, no el arranque. Tres de las siete que el archivo marcaba sí tienen
  explicación: son las que vendió la Integrante inactiva, y el archivo no las había restado.

#### Qué hay que leer, en este orden

| Cuadro | Qué tiene que decir |
|---|---|
| **(3c) SALDO FUERA DEL PLAN** | **vacío.** Si trae una ubicación con saldo, esa ubicación no está declarada y sus unidades quedarían sueltas |
| **(4) LO QUE VA A PASAR** | línea por línea. Al 18 de noviembre, **39 líneas** (24 suben, 15 bajan), antes del smoke |
| **(4b) VEREDICTO** | **CUADRA en los cinco productos.** Compara el total que va a quedar contra la primera tanda: 500 / 500 / 426 / 300 / 84 |

**Si el veredicto dice NO CUADRA, no se corre el `commit`.** El cuadro (3c) dice dónde está la diferencia.

> **Por qué fija el saldo y no suma:** las ventas de prueba ya descontaron unidades, y marcar una venta
> **no** devuelve la unidad. Sumar encima de un saldo contaminado da otra cifra equivocada. Lo que se afirma
> es el saldo resultante, que es exactamente lo que significa un movimiento de `conciliacion`.
>
> **Por qué no es una remesa:** una remesa más su aceptación son el Integrante **declarando que recibió X
> hoy**. Estas unidades llegaron en agosto y la mayoría ya está en su saldo: sería una fecha falsa y una
> doble cuenta. **La remesa sigue siendo el camino de toda entrega NUEVA.**

### Paso 4 · Marcar como prueba las dos cuentas del smoke

**Desde /admin, sin ningún script.** Es lo único de este bloque que entra antes del arranque.

> **ES LA MISMA ACCIÓN QUE LA FILA 2 DE LA PARTE D, no una segunda.** Se hace **una vez**. Aparece en los
> dos sitios porque es a la vez el cierre del smoke y un requisito del arranque; si ya se hizo al cerrar el
> smoke, aquí solo hay que **comprobar** que las dos cuentas figuran como de prueba.

| Cuenta | Hoy cuenta como | Qué hacer |
|---|---|---|
| `Profesional Prueba` | **REAL** (`is_test = false`) | marcarla como de prueba |
| `Profesional demo 2` | **REAL** (`is_test = false`) | marcarla como de prueba |

**Qué resuelve:** sus ventas, sus comisiones y su cuenta de Distribución salen de **todas** las pantallas
de dinero y de todas las cifras. Es el 90 % del problema, y no necesita nada construido.

**Qué NO resuelve, y queda para antes del 30:** los documentos siguen **vivos** dentro de Atlas. La
anulación formal con el estado **"anulada - prueba"** y su motivo, **sin borrar**, la decidió contabilidad
(C4) y **va después del arranque**, no antes.

<details>
<summary>Los documentos que se anularán después del 20, y por qué necesitan una migración</summary>

| Documento | De quién | Estado | Cifra |
|---|---|---|---|
| **1 cuenta de Distribución** `3d11d03b` | `Profesional demo 2` | **PAGADA** el 2026-10-12 | 171.360, corte 1→15 de octubre |
| **3 liquidaciones** `03a94ec3`, `13e0f838`, `ff7b2b76` | `Profesional Demo` | **PAGADAS** | bases 522.252, 2.000 y 20.000 |
| **1 liquidación** `57906fba` | `Profesional Prueba` | sin pagar | base 288.000 |
| **+ la liquidación del B5 de HOY** | `Profesional Demo` | la que deje el smoke | **anotar su id al liquidar** |

**Eran cinco y son SEIS**, porque el B5 del smoke de hoy liquida una comisión con `Profesional Demo`, y eso
deja **un documento de prueba más**, nacido después de haberse contado los cinco. No es un caso nuevo: es
exactamente el mismo que las tres liquidaciones pagadas de esa cuenta, y entra en la misma migración. **Al
liquidar en el B5, anotar el id de la liquidación** para no tener que buscarla después. Y si el smoke
liquida más de una, van todas.

**Son dos obstáculos distintos:**

1. **Un trigger prohíbe retirar una cuenta de Distribución PAGADA** (migración 0215), y su razón está
   escrita y es buena: *"retirar una cuenta ya pagada dejaría un pago registrado contra un documento que
   dice no existir, y la plata ya se movió"*.
2. **`commission_settlements` no tiene NINGÚN mecanismo de anulación**: no hay `superseded_at` ni
   equivalente.

**Lo que se construirá:** una migración que añada `anulada_at` / `anulada_motivo` / `anulada_por` a las dos
tablas, con el estado "anulada - prueba", y que **relaje el trigger solo por esa vía** (una bandera de
transacción que el trigger comprueba, de modo que ningún camino normal de la app pueda retirar una cuenta
pagada y este sí). Más un procedimiento auditado con simulación. **Las comisiones NO vuelven al pozo de
pendientes:** sus ventas ya cuentan como de prueba, y devolver `settlement_id` a nulo las dejaría
pareciendo "por pagar". Se anula **el documento**, no la cuenta.

**Verificado por Santiago el 2026-11-18:** no hay factura ni documento soporte en el Alegra real por
ninguno de los cinco.

</details>

---

### Paso 5 · Las variables en Vercel

Todas en el entorno **Production** (y conviene dejar Preview en sandbox, para poder seguir probando):

| Variable | Qué cambia | Alcance |
|---|---|---|
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` | de `pub_test_...` a `pub_prod_...` | pública por diseño (widget) |
| `WOMPI_PRIVATE_KEY` | de `prv_test_` a `prv_prod_` | **solo server** |
| `WOMPI_EVENTS_SECRET` | la firma HMAC del webhook de producción | **solo server** |
| `WOMPI_INTEGRITY_SECRET` | la firma de integridad del checkout de producción | **solo server** |
| `ALEGRA_EMAIL` · `ALEGRA_API_KEY` | las credenciales de la cuenta real | **solo server** |
| `ALEGRA_BASE_URL` | la base de la API de producción | **solo server** |
| `ALEGRA_DEFAULT_CLIENT_ID` · `ALEGRA_DEFAULT_ITEM_ID` · `ALEGRA_IVA_TAX_ID` | los ids de la cuenta real | **solo server** |

> **Ninguna de las de "solo server" lleva prefijo `NEXT_PUBLIC_`.** La llave pública de Wompi es la única
> que sí, y es pública por diseño.

**`NEXT_PUBLIC_WOMPI_PUBLIC_KEY` es la que decide el ambiente de cada venta:** empieza por `pub_prod_` y la
venta nace real; cualquier otra cosa y nace sellada como prueba, para siempre.

### Paso 6 · El webhook de Wompi

En el panel de Wompi, registrar el endpoint de producción:

```
https://atlas.cnvsystem.com/api/webhooks/wompi
```

y copiar de ahí `WOMPI_EVENTS_SECRET` y `WOMPI_INTEGRITY_SECRET` al paso 5.

**Resultado esperado:** una venta pagada por pasarela pasa a `paid` **sola**, sin tener que correr el
sondeo.

### Paso 7 · Los ids de los productos en el Alegra REAL

**Los ids del sandbox NO sirven en producción, y en este caso ni siquiera se parecen.** Medido el 17 de
noviembre, el sandbox tiene los productos en los items **5, 6, 2, 3 y 4**, mientras que en la cuenta real
los **códigos** que dio Santiago son 2, 3, 4, 5 y 6. Son dos numeraciones distintas y **no hay que
suponer** que una se mapea a la otra.

1. Con las credenciales de producción ya puestas en el entorno, leer la cuenta real:
   ```
   node scripts/leer-alegra.mjs
   node scripts/cotejo-alegra.mjs
   ```
2. Copiar los valores en `scripts/config-alegra-produccion.sql` (todos los `<LLENAR>`):
   numeración de **factura electrónica**, numeración de **nota crédito**, **id del IVA al 19 %**, los **dos
   centros de costo** (propio y tercero, ojo a no invertirlos) y las **tres cuentas puente**.

#### Las tres cuentas puente del Alegra REAL

Lo que Santiago copió de Alegra. **"Banco 1" ya no existe: se renombró.**

| Canal de pago | Cuenta en Alegra | Id | Tipo |
|---|---|---|---|
| **pasarela** (Wompi) | **Wompi por liquidar** | **6** | efectivo |
| **efectivo** | **Efectivo en poder de Integrantes** | **5** | efectivo |
| **transferencia** | **Bancolombia Ahorros 6997** | **3** | banco |

#### ⚠ LOS TRES IDS COINCIDEN EXACTAMENTE CON LOS DEL SANDBOX

Los ids anotados para producción (**pasarela 6, efectivo 5, transferencia 3**) son **los mismos** que ya
están en `alegra_config` para el sandbox. **Puede ser casualidad** (Alegra numera por cuenta, y dos
cuentas nuevas se parecen) **o puede ser que se copiaron de la cuenta de pruebas.** Las dos cosas se ven
igual desde aquí.

**Y el daño de la segunda no avisa:** un id de sandbox en la fila de producción factura contra algo que
allí no existe, o peor, contra otra cosa que por casualidad tenga ese id.

**Lo mismo vale para TODOS los demás valores**, que en el sandbox son:

| Valor | En el sandbox |
|---|---|
| numeración de factura | **16** |
| numeración de nota crédito | **17** |
| IVA 19 % | **4** |
| centros de costo (propio y tercero) | **1** y **2** |

**Ninguno se copia del sandbox.** El día 20, con las credenciales de **producción** puestas,
`leer-alegra.mjs` tiene que mostrar **cada id JUNTO A SU NOMBRE**:

- **"Wompi por liquidar"** → pasarela
- **"Efectivo en poder de Integrantes"** → efectivo
- **"Bancolombia Ahorros 6997"** → transferencia

**El nombre es lo que distingue una cuenta de otra. El id solo, no.**

> **El script lo hace cumplir desde el 2026-11-19.** `config-alegra-produccion.sql` **ABORTA** si algún
> valor de producción es idéntico al del sandbox, y solo sigue cuando se responde `'si'` en el parámetro
> nuevo **`confirmo_que_los_lei_en_produccion`** del bloque 1. No prohíbe que coincidan: **prohíbe que
> coincidan sin que nadie lo haya mirado.** Lo mismo con los items de los cinco productos.
>
> **Las dos primeras son de tipo "efectivo" a propósito, y no es un error:** cuando Atlas registra el pago,
> la plata está retenida en Wompi o en el bolsillo del Integrante. **Nunca el banco.** Decir que llegó al
> banco haría que el banco dejara de cuadrar.

#### La numeración: la asigna Alegra, Atlas solo la lee

| | |
|---|---|
| **Resolución** | **No. 18764111168067** del **12-06-2026** |
| **Rango** | **FE1 a FE5000**, vigente hasta el **12-06-2028** |
| **Por dónde va** | ~**FE120** |

> **Atlas NUNCA genera el consecutivo**, y está verificado en el código: `src/lib/alegra/client.ts` envía
> `numberTemplate: { id }` (la numeración configurada) y **lee** `numberTemplate.fullNumber` de la
> respuesta. El comentario del archivo lo dice con estas palabras: *"quien asigna el consecutivo. Atlas
> nunca lo calcula"*. Lo que hay que acertar es el **id de la numeración**, no el número.
3. Correrlo primero sin `--commit`:
   ```
   node scripts/aplicar-migracion.mjs scripts/config-alegra-produccion.sql
   ```
   y luego con `--commit` cuando el ensayo diga "SIN ERRORES".

> **La cuenta puente de TRANSFERENCIA no es opcional**, aunque la columna la admita nula: sin ella la
> factura de una venta pagada por transferencia se emite y **el pago no se registra**, así que el paciente
> figura "por cobrar" en Alegra. Y **no hereda la del efectivo**: "Efectivo en poder de Integrantes" dice
> que la plata está en el bolsillo de alguien, y una transferencia ya llegó.
>
> **Y el id del IVA mal puesto saca la factura al 0 % sin que nada falle.** Es el valor que más conviene
> cotejar dos veces.

**El script aborta mientras quede un `<LLENAR>`, y aborta también si su bandeja de ventas sin revisar sigue
en `<REVISAR>`.** Es el único sitio por el que se pasa obligatoriamente para montar las llaves, y antes de
escribir nada **lista las ventas que la cola emitiría** en cuanto quede puesto.

### Paso 8 · Redesplegar

Las variables de Vercel **no se recargan solas**. Redesplegar producción y esperar a que termine.

**Resultado esperado, y es la comprobación de que las dos llaves quedaron puestas:** abrir **/pagos** y ver
que **el aviso amarillo del modo de pruebas DESAPARECIÓ**. Si sigue ahí, la de Wompi no entró, y toda venta
que se registre seguirá naciendo sellada como prueba.

> Con Wompi en producción y Alegra todavía en sandbox, las ventas nacen **reales** y no se pueden facturar
> en ningún lado. Las dos van juntas.

### Paso 9 · La primera venta real, vigilada

**Una venta genuina, de un paciente real, no una de prueba.** En Alegra producción cada factura va a la
DIAN: no se puede "ensayar" aquí.

1. Avisar al integrante que va a hacerla y estar mirando.
2. **Resultado esperado:** la venta nace sin el aviso amarillo, se paga, se **factura en Alegra real** con
   su consecutivo, el pago queda registrado contra su cuenta puente, el inventario baja en la vitrina
   correcta, y la comisión aparece en /comercial.
3. Cotejar el número de la factura en Alegra. Si algo sale mal, **se corrige con nota crédito**, que la hace
   una persona: no hay botón.

### Paso 10 · Qué mirar en Sentry

Durante la primera hora, y con el filtro del entorno de producción:

| Buscar | Qué significa |
|---|---|
| `NEXT_REDIRECT` reportado como error | **NO es un fallo**: así señaliza Next un redirect. Si aparece, es que a algún `catch` le falta el `unstable_rethrow` delante |
| errores de `/api/webhooks/wompi` | la firma HMAC no cuadra: el `WOMPI_EVENTS_SECRET` es el del otro ambiente |
| errores de Alegra con `401` o `403` | credenciales mal puestas |
| errores de Alegra con `404` sobre un item | el mapa de items apunta a ids que no existen en producción: volver al paso 7 |
| `Load failed` / `NetworkError` desde un móvil | red del paciente, no nuestra. Ya tiene su manejo |

### Paso 11 · Cómo volver atrás

**La vuelta atrás es de las VARIABLES, y es rápida.** No hay que tocar la base.

1. En Vercel, devolver las variables del paso 5 a sus valores de sandbox.
2. Redesplegar.
3. **Resultado esperado:** el aviso amarillo del modo de pruebas vuelve a /pagos.
4. **El mapa de items del sandbox sigue intacto:** desde la migración 0144 los dos ambientes conviven en
   `alegra_items`, así que no hay que "devolver" ningún id. Lo que escribió el paso 7 fue la fila de
   producción, que no estorba. Y si hiciera falta, está `scripts/vuelta-atras-alegra-sandbox.sql`.
5. **Lo que NO se deshace:** una factura ya emitida en Alegra real. Esa se corrige con nota crédito.
6. **Lo que tampoco se deshace:** el paso 3 (el inventario). Un movimiento no se borra, se corrige con otro
   movimiento en sentido contrario.
7. **La fecha de arranque sí se puede mover:** `update commercial_config set fecha_de_arranque = null;`
   devuelve las pantallas a *"todavía no se ha arrancado"*, sin borrar nada.

---

## LOS COMANDOS, EN ORDEN

**Todo esto se corre desde `C:\\Users\\sarro\\Proyectos\\cnv-atlas`, en PowerShell.** Los que dicen "editor
SQL" no son comandos: se pegan en el editor SQL de Supabase, en el proyecto de **producción**.

### ✓ La migración 0247, ya aplicada (se queda como registro)

**HECHA el 19 de noviembre**, en las dos bases: 248 = 248. Añadió el tipo de documento del representante
legal. Sin ella el paso B4b no corre **y la facturación entera falla**, porque el lector de la venta hace
un `select` explícito de esa columna.

**El ensayo contra la nube dio 4 autorizaciones de representante vigentes SIN tipo de documento**, y esas
cuatro están en la lista de pendientes: se completan desde la ficha de cada paciente, una por una.

**Esto queda escrito porque es el runbook de `DEPLOY.md` y vale para la próxima: migrar ANTES de
pushear, en las DOS bases.**

1. **Ensayo contra la nube** (corre todo y revierte, no deja nada):
   ```
   node --env-file=.env.production.local scripts/aplicar-migracion.mjs drizzle/0247_el_tipo_de_documento_del_representante.sql
   ```
   **Qué tiene que salir:** `El archivo corrio SIN ERRORES`, y tres avisos con cuántas autorizaciones de
   representante hay, **cuántas sin tipo de documento** y cuántas sin número. Las que salgan sin tipo son
   las que habrá que completar desde la ficha del paciente.

2. **La base LOCAL** (aplica la migración y regenera los tipos, los dos en un comando):
   ```
   pnpm db:sync
   ```
   **Sin esto la suite de BD queda en rojo** por una columna que existe en la nube y no en local. Es un
   hallazgo ya registrado en `DEPLOY.md`. El diff de `src/types/database.generated.ts` se commitea.

3. **Ver qué falta en la nube** (solo lee, va por el pooler):
   ```
   DATABASE_URL="<url-directa-de-la-nube-5432>" pnpm db:check:cloud
   ```

4. **Aplicarla en la nube**, con la conexión **DIRECTA** (puerto 5432, **no** el pooler 6543: el DDL en
   transacción no va bien por el pooler):
   ```
   DATABASE_URL="<url-directa-de-la-nube-5432>" pnpm db:migrate
   ```

5. **Confirmar** con el `db:check:cloud` del paso 3: tiene que decir "al día".

6. **Y AHORA sí, push.**

> **El orden importa y está escrito como regla dura:** Vercel despliega el código pero **no** corre las
> migraciones. Pushear antes de migrar deja la nube con código que lee una columna que no existe, y eso no
> tumba "la pantalla nueva": tumba la facturación entera.

### Durante el smoke, solo lectura

| Cuándo | Comando | Qué tiene que salir |
|---|---|---|
| Para ver cómo va el inventario en cualquier momento | `node --env-file=.env.production.local scripts/EL_INVENTARIO_CONTRA_LO_RECIBIDO_2026-11-17.mjs` | ocho bloques. El 2 es el saldo por vitrina; el 8, la simulación de la carga |
| Si una venta por pasarela no pasa a pagada sola | `$env:WOMPI_PRIVATE_KEY = "prv_test_..."` y luego `node scripts/sondeo-wompi-consulta.mjs` | la transacción de Wompi con su estado. **Al terminar: `Remove-Item Env:WOMPI_PRIVATE_KEY`** |

> **Ninguno de los dos escribe nada.** Se pueden correr las veces que haga falta.

### El día del arranque (viernes 20), en este orden

#### 1 · Marcar como prueba las dos cuentas del smoke — *desde /admin, sin script*

`Profesional Prueba` y `Profesional demo 2`, que hoy cuentan como **reales**. Paso 4 del checklist.

**La anulación formal de esos documentos va DESPUÉS del arranque** (contabilidad, C4): necesita una
migración y queda en el pendiente "antes del 30". **Son seis**, contando la liquidación que deje el B5 de
hoy.

#### 2 · Cargar el inventario — *editor SQL de Supabase*

**Al final del smoke, cuando ya no se vaya a mover ni una unidad más en pruebas.**

1. Primero, leer cómo quedó todo tras el smoke:
   ```
   node --env-file=.env.production.local scripts/EL_INVENTARIO_CONTRA_LO_RECIBIDO_2026-11-17.mjs
   ```
2. Pegar `scripts/CARGAR_EL_INVENTARIO_AL_ARRANQUE_2026-11-20.sql` en el editor SQL y correrlo. **Termina en
   `rollback`.**
3. **Leer los tres cuadros:** **(3c)** vacío · **(4)** línea por línea · **(4b) VEREDICTO** diciendo
   **CUADRA** en los cinco productos.
4. **Si los tres están bien:** cambiar `rollback;` por `commit;` y volver a correr. El cuadro **(6) TOTAL
   POR PRODUCTO** tiene que decir CUADRA también, ahora sobre el resultado.
5. **Si el veredicto dice NO CUADRA:** parar. El cuadro (3c) dice qué ubicación tiene saldo sin declarar.

> ⚠ **Después del `commit` no se deshace.** Un movimiento no se borra: se corrige con otro movimiento. El
> paso 3 no es opcional.

#### 3 · El corte y el inicio de la operación — *editor SQL de Supabase* · **JUSTO ANTES de las variables**

**Va aquí, lo más tarde posible, y no al principio.** Su criterio son las ventas selladas en sandbox, y
cada venta que se registre mientras el sistema siga con las llaves de prueba nace así: corriéndolo pegado a
las variables, atrapa todas. (Es el paso 2 del checklist; ahí está el porqué completo.)

1. Abrir `scripts/ARRANQUE_A_PRODUCCION_2026-11-20.sql` y **revisar el bloque (0)**: `corte` en
   `'2026-11-20'`, `inicio_operacion` en `'2026-08-08'`, el correo.
2. Pegarlo entero en el editor SQL de producción y darle a correr. **Termina en `rollback`: no guarda
   nada.**
3. **Leer:** el cuadro **(1b) VA A MARCAR** (las ventas selladas en sandbox que todavía cuentan, una por
   una) y el **(5) DESPUES** (`sandbox_que_cuentan_como_real` en **0**, y `consultas` y `consentimientos`
   **idénticas** a las del cuadro (1)).
4. **Si cuadra:** cambiar la última línea `rollback;` por `commit;` y volver a correr.
5. **Si NO cuadra:** no se cambia nada. Ya está en `rollback`, así que no hay nada que deshacer.

> **Antes de empezar esta ventana, avisar a los Integrantes de que no registren ventas** hasta que el
> redespliegue termine. Una venta registrada en la ventana se arregla (con la segunda pasada del momento
> 7), pero desmarcarla si no hacía falta es trabajo a mano.

#### 4 · Las variables en Vercel y el webhook

No son comandos: pasos 5 y 6 del checklist, en el panel de Vercel y en el de Wompi.

#### 5 · Los ids del Alegra real — *PowerShell*

1. Poner las credenciales de producción en el shell:
   ```
   $env:ALEGRA_EMAIL = "..."
   $env:ALEGRA_API_KEY = "..."
   $env:ALEGRA_BASE_URL = "https://api.alegra.com/api/v1"
   ```
2. Leer la cuenta real:
   ```
   node scripts/leer-alegra.mjs
   ```
   **Qué tiene que salir:** los cinco items con sus ids, el impuesto del 19 %, los centros de costo, las
   numeraciones y **las tres cuentas puente, CADA UNA CON SU NOMBRE**. Es el único sitio donde se
   distingue "Wompi por liquidar" de "Efectivo en poder de Integrantes": **por el nombre, no por el id**.
   Los ids anotados (6, 5, 3) coinciden con los del sandbox, así que aquí es donde se sale de la duda.
3. Cotejar el catálogo contra la base:
   ```
   node scripts/cotejo-alegra.mjs
   ```
4. Rellenar **todos** los `<LLENAR>` de `scripts/config-alegra-produccion.sql`, **incluido el parámetro
   nuevo `confirmo_que_los_lei_en_produccion`** (se responde `'si'` solo después de haber visto cada id
   junto a su NOMBRE en la salida de `leer-alegra.mjs`), y correrlo **en ensayo**:
   ```
   node scripts/aplicar-migracion.mjs scripts/config-alegra-produccion.sql
   ```
   **Qué tiene que salir:** "SIN ERRORES", y la lista de ventas que la cola emitiría en cuanto quede puesto.
   **Aborta mientras quede un `<LLENAR>`**, y **aborta también si algún valor es idéntico al del sandbox**
   mientras no se confirme que se leyeron en producción (los ids de las tres cuentas puente coinciden hoy
   exactamente con los del sandbox: ver el paso 7).
5. Y solo entonces, con `--commit`:
   ```
   node scripts/aplicar-migracion.mjs scripts/config-alegra-produccion.sql --commit
   ```
6. **Al terminar:** `Remove-Item Env:ALEGRA_EMAIL, Env:ALEGRA_API_KEY, Env:ALEGRA_BASE_URL`

> **`--commit` es la bandera REAL.** Cualquier otra cosa (`--apply`, `--go`) se ignora **en silencio**, el
> script corre en ensayo y dice que todo salió bien sin haber guardado nada. Ya pasó una vez.

#### 6 · Redesplegar, y la comprobación de que las llaves entraron

Redesplegar producción desde Vercel, y abrir **/pagos**: **el aviso amarillo del modo de pruebas tiene que
haber DESAPARECIDO.** Si sigue ahí, la llave de Wompi no entró, y toda venta que se registre nacerá sellada
como prueba para siempre.

#### 7 · La SEGUNDA pasada del script del arranque — *editor SQL de Supabase*

**Cierra la ventana.** Entre el momento 3 y el redespliegue puede haberse registrado una venta, y esa nació
sellada en sandbox igual que las del smoke.

1. Pegar otra vez `scripts/ARRANQUE_A_PRODUCCION_2026-11-20.sql` **tal cual, en `rollback`**.
2. **El cuadro (1b) tiene que salir VACÍO.** Si sale vacío, se acabó: no se hace `commit` y no hay nada que
   hacer.
3. **Si NO sale vacío**, mirar la columna `registrada_a_las` de cada fila:
   - **antes del redespliegue** → alguien vendió en la ventana: cambiar `rollback;` por `commit;` y correr.
   - **después del redespliegue** → **las variables no entraron.** No se hace `commit`: se arregla Vercel y
     se vuelve a redesplegar. Es el mismo problema que el aviso amarillo, visto desde la base.

> **Esta pasada es gratis y detecta dos cosas con una sola consulta:** una venta en la ventana, y un
> redespliegue que no tomó las llaves. Vale la pena aunque se esté seguro de las dos.

> ⚠ **Y si trae alguna venta, el inventario también quedó movido.** Esa venta descontó unidades de verdad, y
> la marca de prueba **no las devuelve**. Hay que volver a correr el **momento 2** (la carga del inventario),
> que es idempotente: declara el saldo otra vez y deja cada vitrina donde tiene que estar.

### Si algo sale distinto

| Qué pasó | Qué hacer |
|---|---|
| Un script en `rollback` sacó algo raro | **No pasó nada.** Se lee el cuadro, se corrige el bloque de parámetros y se vuelve a correr |
| Ya se hizo `commit` y el inventario quedó mal | **No se borra.** Se corrige con otro movimiento de conciliación, con su motivo |
| Las llaves entraron y algo falla | **Paso 11:** devolver las variables a sandbox y redesplegar. La base no se toca |
| La **segunda pasada** del script del arranque trae ventas | mirar `registrada_a_las`: antes del redespliegue, `commit` y resuelto; después, **las variables no entraron** y lo que se arregla es Vercel |
| Una factura salió mal **en el Alegra real** | **Nota crédito, a mano.** No hay botón, y no se deshace de otra forma |

---

## PENDIENTE COMERCIAL, CON FECHA

**Esta es la lista de lo comercial abierto.** Lo único que vive en otro documento es el plan de las
ventas históricas y la conciliación, que es largo: `docs/PLAN_VENTAS_HISTORICAS_XLSX.md`.

### ⚠ Antes del viernes 20 (el arranque)

| | Qué | Quién | Estado |
|---|---|---|---|
| 1 | El **smoke** completo, partes A, B, C y D, **incluido el B4b de pacientes menores** | Santiago | **hoy 20**, antes del arranque |
| 2 | El **video**, en sandbox | Santiago | **hoy 20**, antes del arranque |
| 3 | ~~Aplicar la 0247 y hacer push~~ | Santiago | **HECHO el 19**: 248 = 248 en las dos bases |
| 3b | **Completar el TIPO de documento de los 4 representantes legales reales que lo tienen vacío.** Se hace desde la **ficha de cada paciente menor**, con el bloque "Corregir el representante legal". Hasta entonces, la compra de esos menores se registra y **no se factura**, con su motivo visible | Santiago, o el profesional que los atienda | **antes de venderles**. Son 4, medidos en el ensayo de la 0247. La columna nació el 19, así que **ninguna** autorización anterior la tiene: no es que se hayan llenado mal |
| 4 | Confirmar **los ids de Alegra por su NOMBRE** con `leer-alegra.mjs` | Santiago, el día 20 | paso 7. **El script ahora aborta si se copian del sandbox** |

**Ya hecho el 19 de noviembre:** **la facturación a menores completa** (la factura sale a nombre del
representante legal, con su tipo y número de documento y su correo; el representante se captura en el
consentimiento y se completa o corrige desde la ficha del paciente); el freno de los ids copiados del
sandbox en el script de las llaves.

**Ya hecho el 18 de noviembre:** el aviso de ventas históricas en las tres pantallas de inventario; que el
cambio de modalidad ignore las ventas de prueba; las dos fechas separadas; Víctor y María Teresa en la
carga de inventario.

### Antes del lunes 30 de noviembre (cierre del mes)

| | Qué | Por qué tiene esa fecha |
|---|---|---|
| 1 | **Las anulaciones formales** de los documentos de prueba, con estado "anulada - prueba" y motivo, sin borrar. **Necesita migración.** **Son SEIS, no cinco**: los cinco contados el 18 más **la liquidación que deja el B5 del smoke de hoy** con `Profesional Demo` (anotar su id al liquidarla) | contabilidad (C4) lo dejó para después del arranque. El día 20 solo se marcan las dos cuentas como de prueba |
| 2 | **Registrar (no calcular) la retención de Katherine** · va **antes de su primer PAGO**, que es después del 30 | contabilidad (C3) y Santiago, 2026-11-19. Ver abajo |
| 3 | **La venta SIN PACIENTE** (`patient_id` nulo con motivo obligatorio) | sin ella las 3 ventas de Diana Marcela no entran, y el xlsx no se puede cargar completo |
| 4 | **La venta de CNV sin Integrante** y el **descuento comercial** | la venta del 8 de agosto es las dos cosas a la vez |
| 5 | **La carga del xlsx de ventas atrasadas** | es lo que desinfla el inventario y lo deja igual al físico |
| 6 | Poner `VENTAS_HISTORICAS_CARGADAS` en `true` y quitar el aviso | el mismo commit de la carga |

**El plan completo de 3 a 6 está en `docs/PLAN_VENTAS_HISTORICAS_XLSX.md`.**

### Antes del 5.º día hábil de diciembre

| | Qué |
|---|---|
| 1 | **La conciliación de inventario** de contabilidad (C5): conteo físico de la bodega **y de cada Integrante confirmado con ella**, comparar los **tres** saldos (Atlas, conteo, Alegra), y ajustar los **dos** sistemas al conteo con cada diferencia explicada |
| 2 | Y desde diciembre, la regla permanente: **en cada cierre mensual el total por producto de Atlas tiene que ser igual al de Alegra** |

**Detalle completo en `docs/PLAN_VENTAS_HISTORICAS_XLSX.md`, sección 8.**

### Antes de la primera liquidación real

**Katherine cierra su primer corte el 30 de noviembre; los demás, el 30 también.** Hasta entonces se puede
vender; lo que no se puede es **pagar**.

| | Qué | Hoy |
|---|---|---|
| 1 | **La tabla del art. 383** y su **depuración** con los cuatro pasos y los dos topes, la **base mensual por persona**, y el cambio de método desde el **pago siguiente** | no construida. El 10 % y el 11 % sí están. Tabla completa arriba, en "La retención por integrante" |
| 2 | **Los datos tributarios de cada perfil real** (tipo de persona, responsable de IVA, obligado a facturar) | **los integrantes ya entregaron RUT y cuentas de cobro: los datos existen, falta cargarlos.** Sin los tres, el sistema **no liquida** y dice cuáles faltan |
| 3 | **Los datos bancarios** de cada uno | lo mismo: ya los entregaron, falta cargarlos |

### Después del 20, sin fecha fija

| | Qué |
|---|---|
| 1 | **EL PASE PRESENCIAL (QR) TIENE QUE PEDIR EL TIPO DE DOCUMENTO DEL REPRESENTANTE.** Hoy no lo pide: el camino remoto sí, el presencial captura nombre, documento, parentesco y correo, y el tipo no existe en ese camino. **Necesita migración**: una columna nueva en `presencial_consent_sessions` (el mismo enum `document_type` restringido a CC, CE y PA, como la 0247), el campo en su formulario, y que `actions.qr.ts` lo mande. **Hoy no se construye: se arranca primero.** Mientras no se cierre, **cada menor nuevo que entre por el pase presencial nace con el representante sin tipo**, o sea con su primera compra registrada y pendiente de facturar, con su motivo visible. Es el caso del paso 2 del B4b, y por eso el smoke lo usa: la prueba mide el hueco real |
| 1b | **Y junto con ella, completar el TIPO de los 4 representantes legales reales que ya existen**, desde la ficha de cada paciente menor. Son dos mitades del mismo asunto: la columna nació el 19 de noviembre, así que **ninguna autorización anterior lo tiene**, y el pase presencial sigue creando nuevos sin tipo. Cerrar solo una de las dos deja el problema abierto por el otro lado. El detalle de los 4 está arriba, en "Antes del viernes 20", ítem 3b |

### Sin fecha (backlog comercial)

- **El traslado automático de ventas rezagadas** al corte siguiente. Contabilidad confirmó el 2026-11-18
  que **la prioridad es el xlsx**, no esto.
- **"Mover inventario"**: retirarle unidades a un Integrante y pasarlas a la bodega o a otro. Hoy no existe
  (solo despachar y devolver). **Media jornada**, y va a repetirse.
- **El cotejo automático de saldos Atlas / Alegra**, que es lo que haría sostenible la regla mensual nueva.
- **"Ya facturada por fuera"** sobre una venta ya registrada.
- **El cargo por un vencido a cargo del Integrante.**
- **La emisión de la cuenta de Distribución en Alegra.**
- **Que la remesa mueva el saldo con ubicación de tránsito.** La mitad barata ya está.
- **El "Facturar ahora"** de una rezagada que cruza de bimestre.

### Pendientes de la contadora

| | Qué | ¿Bloquea? |
|---|---|---|
| 1 | **La base mínima de retefuente por compras**: ¿**10 UVT** (523.740) o **27 UVT** (1.414.098)? | **no**: Atlas pasa a registrar lo retenido, no a calcularlo |
| 2 | **Validar la tabla del art. 383** y su depuración | **sí**, antes del primer pago |

---

## Lo que queda fuera de este smoke, y es a propósito

**No se prueba aquí, y la lista completa con sus fechas está arriba, en "PENDIENTE COMERCIAL, CON FECHA".**
Dos listas de lo mismo acaban diciendo cosas distintas, así que solo hay una.

Lo de aquí es solo el recordatorio de por qué no se prueba:

- **Las ventas atrasadas del xlsx** van **después** del arranque, por definición: necesitan que la fecha de
  la operación ya esté puesta y que el inventario ya esté cargado.
- **Todo lo demás de la lista** (rezagadas automáticas, "ya facturada por fuera", el cargo por vencido, la
  emisión de la cuenta de Distribución en Alegra, la ubicación de tránsito, el "Facturar ahora" de otro
  bimestre) **no está construido**, así que no hay nada que probar. No bloquea vender.

---

## LA RETENCIÓN POR INTEGRANTE

**Lo que fijó contabilidad el 2026-11-18 (C2 y C3), y lo que falta para cumplirlo.** Nada de esto se
construye antes del arranque.

### Lo que ya está construido

| Regla | Dónde vive | Estado |
|---|---|---|
| Natural en Comisión: **10 %** | `RETENCION_BASE` | ✔ |
| Natural que pasa de **3.300 UVT** al año: **11 %** desde ese pago | `RETENCION_ALTA` + `UMBRAL_UVT` | ✔ |
| **Jurídica** en Comisión: **11 %** siempre | rama `juridica` | ✔ |
| **Sin datos tributarios no se liquida**, y se dice cuáles faltan | `faltantes` | ✔ |
| Distribución: **no hay retención sobre comisión** | no hay comisión que retener | ✔ |
| **UVT 2026 = 52.374** | `UVT_2026` | ✔ **confirmada por contabilidad** |

Todo en `src/modules/payments/liquidacion.ts`.

---

### ⚠ 1 · LA RETENCIÓN DE KATHERINE: Atlas la REGISTRA, no la calcula

**Esto cambia lo que hay construido hoy, y hay que saberlo antes de tocar su perfil.**

**Lo que contabilidad decidió (C3):** la retención del 2,5 % por compras que Katherine le practica a CNV
al pagar su cuenta **la calcula ELLA**, no Atlas. Atlas solo **registra el valor que ella efectivamente
retuvo**, tomado de su pago o de su certificado, para que la cuenta por cobrar cuadre.

**Lo que Atlas hace hoy:** si `tax_is_withholding_agent = true`, **ANTICIPA** el 2,5 % por su cuenta
(`RETEFUENTE_COMPRA`, con base mínima de 27 UVT) y lo descuenta del neto esperado de la cuenta.

**Por qué anticipar está mal aunque la tarifa sea correcta:** la base mínima no está confirmada
(contabilidad dice que **probablemente son 10 UVT = 523.740**, no 27), y sobre todo **quien decide si
retiene y cuánto es ella**. Si Atlas anticipa 2,5 % y ella retiene otra cosa (o no retiene porque la base
no llegó al mínimo), la cuenta por cobrar y el giro no cuadran, y el descuadre **no avisa**: las dos
cifras son plausibles.

> ### 🔴 NO marques hoy el campo de agente de retención de Katherine
>
> Está en **nulo**, y en nulo **Atlas no anticipa nada**: su cuenta sale por el **valor bruto**, que es
> exactamente lo que contabilidad quiere ver hasta que esté el cambio. Marcarlo hoy haría que el sistema
> calculara una retención que no le corresponde calcular.
>
> **Se marca cuando esté construido el registro del valor real, no antes.**

#### Qué hay que construir, y para cuándo

**NO es urgente** (Santiago, 2026-11-19). Va **antes de su primer PAGO**: su primer corte cierra el **30 de
noviembre**, y el pago es después. No bloquea el arranque ni el smoke.

| Pieza | Qué |
|---|---|
| **La cuenta sale en BRUTO** | `armarCuentaQuincenal` deja de restar `retencionDelIntegrante`. El `netoEsperado` pasa a ser el total: es lo que le toca pagar |
| **Con su AVISO al lado** | *"Integrante agente de retención: al pagar puede retener; revisar con la contadora."* Un aviso, no una cifra: Atlas no calcula nada |
| **Al registrar el pago, se captura lo retenido** | dos campos: **valor retenido** y **soporte** (número del certificado o referencia del pago) |
| **La cuenta por cobrar cuadra** | **pagado + retenido = total de la cuenta**. Si no cuadra, se dice; no se absorbe |
| **`tax_is_withholding_agent` cambia de significado** | deja de ser "anticipa el 2,5 %" y pasa a ser "a esta persona se le espera una retención al pagar": gobierna el AVISO, no un cálculo |

**Media jornada.** Lo que ya está (la tarifa del 2,5 %, la base mínima, el UVT) **no se borra**: queda como
el valor **esperado** contra el que cotejar el real, que es más útil que no tener referencia.

---

### 2 · LA TABLA DEL ART. 383 (C2)

**Para la persona natural que la declara en su cuenta de cobro.** Hoy toda persona natural va al 10 %.

#### La tabla, sobre la base depurada del MES, en UVT

| Base depurada (UVT) | Retención |
|---|---|
| 0 – 95 | **0 %** |
| 95 – 150 | (base − 95) × **19 %** |
| 150 – 360 | (base − 150) × **28 %** + 10 UVT |
| 360 – 640 | (base − 360) × **33 %** + 69 UVT |
| 640 – 945 | (base − 640) × **35 %** + 162 UVT |
| 945 – 2.300 | (base − 945) × **37 %** + 268 UVT |
| > 2.300 | (base − 2.300) × **39 %** + 770 UVT |

#### La depuración previa, EN ESTE ORDEN

1. **aportes obligatorios** a salud y pensión, si los acredita;
2. **deducciones certificadas**, si las hay;
3. **renta exenta del 25 %**, con tope de **790 UVT al año** (≈ **65,83 al mes**);
4. **tope global**: deducciones + rentas exentas **no pasan del 40 % del ingreso** ni de **1.340 UVT al
   año**.

> **El orden no es decorativo: cambia el resultado.** La renta exenta del 25 % se calcula sobre lo que
> queda después de restar los aportes y las deducciones, no sobre el ingreso bruto. Y el tope global se
> aplica **al final**, sobre la suma de los dos conceptos.
>
> **Por eso "casi siempre da 0":** 95 UVT son **4.975.530** al mes de base ya depurada. Una comisión
> normal no llega.

#### Qué hay que construir

| Pieza | Qué |
|---|---|
| **El método, en el perfil** | `retencion_metodo`: `tarifa_fija` (lo de hoy) o `tabla_383`. **Solo para persona natural**; una jurídica va siempre al 11 % |
| **La base MENSUAL por persona** | hoy la liquidación calcula sobre **su propia base**. La tabla pide **todos los pagos de CNV de ese mes calendario**, sumados. Es un cambio real: hay que leer lo ya pagado en el mes antes de retener |
| **La depuración, con sus cuatro pasos y sus dos topes** | módulo neutro y puro, como `liquidacion.ts`, con su tabla de casos |
| **Los soportes** | lo que acredita los aportes y las deducciones. Sin soporte no se depura: se retiene sobre el bruto |
| **El cambio de método** | **rige desde el pago SIGUIENTE a la nueva declaración**, no desde el corte siguiente ni retroactivamente |
| **El sello** | la liquidación ya sella la tarifa aplicada; tiene que sellar también **el método y la base depurada**, o dentro de un año no se podrá explicar la cuenta |

**Una jornada y media**, y es donde más cuidado hay que tener: es el único punto del sistema donde un
error se convierte directamente en plata mal girada y en una declaración mal presentada.

> **Contabilidad la valida antes del primer pago.** Lo de arriba es lo que se construye; lo que se
> construye no se da por bueno hasta que ella lo firme.

---

### 3 · Cuándo es la primera liquidación real: la fecha límite

| Quién | Cadencia | Primer corte real | Se liquida |
|---|---|---|---|
| **Katherine** (Distribución) | quincenal | **20 → 30 de noviembre** | después del 30 |
| **Los demás** (Comisión) | mensual | **noviembre**, cierra el **30** | primeros días de diciembre |

**Así que la fecha límite de todo lo tributario es el 30 de noviembre.** Hasta entonces se puede vender
sin problema: lo que no se puede es **pagar**.

---

### 4 · Lo que sigue pendiente de la contadora

1. **La base mínima de retefuente por compras**: contabilidad dice que **probablemente son 10 UVT
   (523.740)**, y lo que hay escrito en el modelo comercial son **27 UVT (1.414.098)**. **Pendiente de
   confirmar.** No bloquea, porque Atlas pasa a registrar y no a calcular.
2. **La validación de la tabla del art. 383** y de su depuración, antes del primer pago.

---

## EL XLSX DE VENTAS ATRASADAS Y LA CONCILIACIÓN

**EN PAUSA hasta después del arranque.** Santiago ya tiene un archivo avanzado y se trabaja sobre ese.

**Todo lo planeado vive en `docs/PLAN_VENTAS_HISTORICAS_XLSX.md`:** las dos hojas con sus columnas, las
tres fechas, el orden de carga, la validación en dos pasadas, las tres piezas que hay que construir (la
venta sin paciente, la venta de CNV con descuento y el cargador), el interruptor
`VENTAS_HISTORICAS_CARGADAS`, y **la conciliación de inventario completa** que fijó contabilidad.

**Dos fechas límite:** la carga, el **30 de noviembre**; la conciliación, a más tardar el **5.º día hábil
de diciembre**.
