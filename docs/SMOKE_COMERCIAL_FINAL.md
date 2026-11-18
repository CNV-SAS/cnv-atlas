# Smoke comercial final, y el checklist del arranque

**Al 18 de noviembre de 2026.** Este es **el único documento comercial que hay que abrir**: lleva el
smoke, el checklist del arranque, los comandos en orden y lo que queda pendiente con su fecha.

## ⚠ EL ARRANQUE ES EL VIERNES 20 DE NOVIEMBRE DE 2026, y no pasa de ese día

| Día | Qué |
|---|---|
| **martes 18** | smoke, partes A y B |
| **miércoles 19** | smoke, parte C · y el **video**, todavía en sandbox |
| **viernes 20** | **el arranque**: la parte E de este documento, de arriba abajo |

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
| 1 | **Marcar a mano las ventas del smoke** (motivo de 10 caracteres) | /pagos, como admin |
| 2 | **Marcar las dos cuentas de prueba**: `Profesional Prueba` y `Profesional demo 2`. Hoy cuentan como **reales** a pesar del nombre | /admin |
| 3 | **Marcar los pacientes del smoke.** El paso 2 arrastra a los suyos hacia atrás, así que solo queda a mano el que tenga `es_real_confirmado`: hay **uno** en toda la base, y se arregla con **"Quitar la confirmación"** en su fila | /admin/integrantes/[id] |
| 4 | **Decidir ADAPTO-STRESS.** CNV no lo tiene: va a `no_disponible` desde /nutraceuticos, y sus **16 unidades** se llevan a cero por **conciliación**, no por baja (baja afirmaría que CNV destruyó 16 frascos que nunca tuvo) | /nutraceuticos |
| 5 | **Correr el script de las llaves en ensayo** (sin `--commit`) y revisar la lista de ventas que la cola emitiría | `scripts/config-alegra-produccion.sql` |

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

1. **Lista** las ventas anteriores al corte que todavía cuentan como reales (cuadro **(1b) VA A MARCAR**).
2. **Las marca** como prueba, con motivo y una fila de auditoría por venta.
3. **Anula** las cuentas de Distribución de cortes anteriores **no pagadas**.
4. **Pone `fecha_de_arranque = 2026-08-08`**, que es lo que enciende las cifras.

> **¿Marca o solo lista? MARCA, y lista antes.** Es deliberado: una venta que se escape y siga contando
> como real **puede ser facturada por la cola en el Alegra de producción**, donde cada factura va a la DIAN
> y deshacerla es una nota crédito con su hueco en el consecutivo. Y marcarla **sí** se deshace: se le quita
> la marca desde /pagos. La asimetría decide.

**El de octubre NO se vuelve a correr:** su paso 4 volvería a poner `2026-10-15`.

**Resultado esperado:** `fecha_de_arranque` queda en **2026-08-08**, `ventas_reales_antes_del_corte` en
**0**, y las dos cifras clínicas (consultas y consentimientos) **idénticas** antes y después. Dirección deja
de decir *"Todavía no se ha arrancado"* y empieza a contar desde el 8 de agosto, que hasta que entre el
xlsx mostrará muy poco: es correcto.

> **El inventario no lo toca esta fecha, ni ninguna.** Un saldo no es un flujo: las unidades que hay están
> hoy donde están, las haya puesto quien las haya puesto. Y tampoco recorta **lo que se le debe a alguien**:
> una comisión anterior se liquida igual. Las dos reglas tienen candado.

### Paso 3 · Cargar el inventario real

**Va DESPUÉS del script del arranque y al final del smoke, no antes.**

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

### Paso 4 · Anular los documentos de prueba

**Autorizado por contabilidad el 2026-11-18**, con la verificación de Santiago contra el Alegra real: **no
hay factura ni documento soporte en producción** por ninguno de ellos. Así que lo que queda es un documento
vivo dentro de Atlas que no corresponde a nada, y hay que retirarlo **sin borrarlo**.

#### Qué hay que anular, medido el 2026-11-18

| Documento | De quién | Estado | Cifra |
|---|---|---|---|
| **1 cuenta de Distribución** `3d11d03b` | `Profesional demo 2` | **PAGADA** el 2026-10-12 | 171.360, corte 1→15 de octubre |
| **3 liquidaciones de comisión** `03a94ec3`, `13e0f838`, `ff7b2b76` | `Profesional Demo` (ya marcada como de prueba) | **PAGADAS** | bases 522.252, 2.000 y 20.000, retención 10 % |
| **1 liquidación de comisión** `57906fba` | `Profesional Prueba` (**NO** marcada como de prueba) | **sin pagar** | base 288.000, retención 10 % = 28.800 |

#### ⚠ ESTE PASO ESTÁ PENDIENTE DE UNA AUTORIZACIÓN DE SANTIAGO: necesita una migración

**No se puede hacer con lo que hay hoy, y no es por falta de ganas:**

- **La cuenta de Distribución está PAGADA, y un trigger prohíbe retirar una pagada** (migración 0215, con
  su razón escrita: *"retirar una cuenta ya pagada dejaría un pago registrado contra un documento que dice
  no existir, y la plata ya se movió"*). La regla es correcta; lo que falta es la puerta de servicio para
  este caso, que contabilidad acaba de autorizar.
- **Las liquidaciones de comisión NO TIENEN NINGÚN MECANISMO DE ANULACIÓN.** `commission_settlements` no
  tiene `superseded_at` ni equivalente: una liquidación emitida no se puede retirar por ningún camino.

**Lo que propongo construir, en cuanto Santiago diga que sí** (es media jornada, y entra antes del 20):

1. **Una migración** que añada a las dos tablas el trío `anulada_at` / `anulada_motivo` / `anulada_por`,
   con el estado **"anulada - prueba"** como uno de los valores admitidos, y que **relaje el trigger de lo
   pagado SOLO por esa vía**: la anulación se marca con una bandera de transacción
   (`set local atlas.anulacion_de_prueba = 'on'`) que el trigger comprueba, de modo que **ningún camino
   normal de la aplicación puede retirar una cuenta pagada** y este sí. Nada se borra.
2. **Un procedimiento auditado** `scripts/ANULAR_LO_DE_PRUEBA_2026-11-20.sql`, con modo simulación
   (`rollback` por defecto), que liste los cinco documentos, los anule con su motivo y escriba una fila de
   `clinical_audit_log` por cada uno.
3. **Las comisiones NO vuelven al pozo de pendientes.** Sus ventas ya cuentan como de prueba y el liquidador
   las excluye, así que devolver `settlement_id` a nulo las dejaría pareciendo "por pagar". Lo que se anula
   es **el documento**, no la cuenta.

**Mientras tanto, lo que SÍ se puede hacer y hay que hacer en el paso 1 (parte D):** marcar como de prueba
`Profesional Prueba` y `Profesional demo 2`, que hoy cuentan como **reales**. Eso saca sus cifras de todas
las pantallas de dinero. Lo que no hace es retirar el documento, que es lo que esta migración resuelve.

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

> **Estos ids hay que CONFIRMARLOS con `leer-alegra.mjs` el día 20, antes de escribirlos.** Vienen de leer
> lo que Santiago copió, no de haber consultado la cuenta: un id mal puesto manda el pago a la cuenta
> equivocada y el banco deja de cuadrar contra su extracto.
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

### Durante el smoke (18 y 19), solo lectura

| Cuándo | Comando | Qué tiene que salir |
|---|---|---|
| Para ver cómo va el inventario en cualquier momento | `node --env-file=.env.production.local scripts/EL_INVENTARIO_CONTRA_LO_RECIBIDO_2026-11-17.mjs` | ocho bloques. El 2 es el saldo por vitrina; el 8, la simulación de la carga |
| Si una venta por pasarela no pasa a pagada sola | `$env:WOMPI_PRIVATE_KEY = "prv_test_..."` y luego `node scripts/sondeo-wompi-consulta.mjs` | la transacción de Wompi con su estado. **Al terminar: `Remove-Item Env:WOMPI_PRIVATE_KEY`** |

> **Ninguno de los dos escribe nada.** Se pueden correr las veces que haga falta.

### El día del arranque (viernes 20), en este orden

#### 1 · El corte y el inicio de la operación — *editor SQL de Supabase*

1. Abrir `scripts/ARRANQUE_A_PRODUCCION_2026-11-20.sql` y **revisar el bloque (0)**: `corte` en
   `'2026-11-20'`, `inicio_operacion` en `'2026-08-08'`, el correo.
2. Pegarlo entero en el editor SQL de producción y darle a correr. **Termina en `rollback`: no guarda
   nada.**
3. **Leer:** el cuadro **(1b) VA A MARCAR** (las ventas que se van a marcar, una por una) y el **(5)
   DESPUES** (`ventas_reales_antes_del_corte` en **0**, y `consultas` y `consentimientos` **idénticas** a
   las del cuadro (1)).
4. **Si cuadra:** cambiar la última línea `rollback;` por `commit;` y volver a correr.
5. **Si NO cuadra:** no se cambia nada. Ya está en `rollback`, así que no hay nada que deshacer.

#### 2 · Anular los documentos de prueba — *editor SQL* · ⚠ PENDIENTE DE CONSTRUIR

Ver el **paso 4** del checklist: necesita una migración que Santiago tiene que autorizar. Si no entra, el
arranque **sigue adelante**: lo que hace falta de verdad es marcar las dos cuentas como de prueba, y eso es
desde /admin.

#### 3 · Cargar el inventario — *editor SQL de Supabase*

**Al final del smoke, después del script anterior.**

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
   numeraciones y **las tres cuentas puente**. Aquí se confirman los ids 6, 5 y 3 de la tabla del paso 7.
3. Cotejar el catálogo contra la base:
   ```
   node scripts/cotejo-alegra.mjs
   ```
4. Rellenar **todos** los `<LLENAR>` de `scripts/config-alegra-produccion.sql` y correrlo **en ensayo**:
   ```
   node scripts/aplicar-migracion.mjs scripts/config-alegra-produccion.sql
   ```
   **Qué tiene que salir:** "SIN ERRORES", y la lista de ventas que la cola emitiría en cuanto quede puesto.
   **Aborta mientras quede un `<LLENAR>`.**
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

### Si algo sale distinto

| Qué pasó | Qué hacer |
|---|---|
| Un script en `rollback` sacó algo raro | **No pasó nada.** Se lee el cuadro, se corrige el bloque de parámetros y se vuelve a correr |
| Ya se hizo `commit` y el inventario quedó mal | **No se borra.** Se corrige con otro movimiento de conciliación, con su motivo |
| Las llaves entraron y algo falla | **Paso 11:** devolver las variables a sandbox y redesplegar. La base no se toca |
| Una factura salió mal **en el Alegra real** | **Nota crédito, a mano.** No hay botón, y no se deshace de otra forma |

---

## PENDIENTE COMERCIAL, CON FECHA

**Esta es la lista. Todo lo comercial que quede abierto vive aquí**, no en otro documento.

### ⚠ Antes del viernes 20 (el arranque)

| | Qué | Quién | Estado |
|---|---|---|---|
| 1 | **La migración de las anulaciones** y su procedimiento auditado (paso 4 del checklist) | Claude, en cuanto Santiago autorice la migración | **esperando autorización** |
| 2 | El **smoke** completo, partes A, B y C | Santiago | en curso, parte A empezada |
| 3 | El **video**, en sandbox | Santiago | el 19 |
| 4 | **Los datos tributarios de Katherine**: `tax_is_withholding_agent` (hoy nulo) | Santiago, con la contadora | **ver abajo** |
| 5 | Confirmar **los ids de las tres cuentas puente** con `leer-alegra.mjs` | Santiago, el día 20 | parte del paso 7 |

**Ya hecho el 18 de noviembre:** el aviso de ventas históricas en las tres pantallas de inventario; que el
cambio de modalidad ignore las ventas de prueba; las dos fechas separadas en los scripts y en las pantallas;
Víctor y María Teresa en la carga de inventario.

### Antes del lunes 30 de noviembre (cierre del mes)

**Es la fecha que puso contabilidad**, y lo que la obliga es que el inventario está inflado hasta entonces.

| | Qué | Por qué tiene esa fecha |
|---|---|---|
| 1 | **La venta SIN PACIENTE** (`patient_id` nulo con motivo obligatorio) | sin ella las 3 ventas de Diana Marcela no se pueden registrar, y el xlsx no puede cargarse completo |
| 2 | **La venta de CNV sin Integrante**, y el **descuento comercial** | la venta del 8 de agosto es las dos cosas a la vez. Pasan de "dimensionado" a **requisito del xlsx** |
| 3 | **La carga del xlsx de ventas atrasadas**, con su hoja de conteo de bodega | es lo que desinfla el inventario y lo deja igual al físico |
| 4 | **La conciliación de bodega** contra el conteo de la hoja 2 | cierra la diferencia que quede, visible y con motivo |
| 5 | Apagar `VENTAS_HISTORICAS_CARGADAS` (poner `true`) y quitar el aviso | el mismo commit de la carga |

### Antes de la primera liquidación real

**La primera liquidación de comisión real cae en el corte que cierra después del arranque.** Hasta entonces
se puede vender; lo que no se puede es **pagar**.

| | Qué | Hoy |
|---|---|---|
| 1 | **La tabla del art. 383** como opción por integrante (persona natural que lo declara en su cuenta de cobro) | no construida. El 10 % y el 11 % sí están |
| 2 | **Los datos tributarios de los 13 perfiles reales** (tipo de persona, responsable de IVA, obligado a facturar) | **solo Katherine tiene tipo de persona.** Sin los tres, el sistema **no liquida** y dice cuáles faltan |
| 3 | **Los datos bancarios** de cada uno | ninguno de los 13 los tiene |
| 4 | `tax_is_withholding_agent` **de Katherine** | nulo → hoy su cuenta de Distribución saldría **con retención 0** |

### Sin fecha (lo que queda en el backlog comercial)

- **El traslado automático de ventas rezagadas** al corte siguiente. Hoy es manual y la pantalla lo dice.
  Contabilidad lo pidió, y el 2026-11-18 confirmó que **la prioridad es el xlsx**, no esto.
- **"Mover inventario"**: retirarle unidades a un Integrante y pasarlas a la bodega o a otro. Hoy no existe
  como acción (solo despachar y devolver). **Media jornada**, y va a repetirse.
- **"Ya facturada por fuera"** sobre una venta ya registrada: la salida si una venta real queda sellada como
  prueba. Hoy esa cuenta está en cero.
- **El cargo por un vencido a cargo del Integrante**: la alerta llega hasta la propuesta de quién asume.
- **La emisión de la cuenta de Distribución en Alegra**: se arma, se objeta y se cobra en Atlas.
- **Que la remesa mueva el saldo con ubicación de tránsito.** La mitad barata ya está.
- **El "Facturar ahora"** de una rezagada que cruza de bimestre: pide una decisión de contabilidad primero.

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

**Lo que contabilidad fijó el 2026-11-18, y lo que falta para cumplirlo.**

### Lo que ya está construido, y es casi todo

| Regla | Dónde vive | Estado |
|---|---|---|
| Natural en Comisión: **10 %** | `RETENCION_BASE` | ✔ |
| Natural que pasa de **3.300 UVT** al año: **11 %** desde ese pago | `RETENCION_ALTA` + `UMBRAL_UVT` | ✔ |
| **Jurídica** en Comisión: **11 %** siempre | rama `juridica` | ✔ |
| **Sin datos tributarios no se liquida**, y se dice cuáles faltan | `faltantes` | ✔ |
| **Distribución: no hay retención sobre comisión** | no hay comisión que retener | ✔ |
| **La retención del 2,5 % que el Integrante agente retenedor le practica a CNV** | `RETEFUENTE_COMPRA = 0.025` | ✔ **ya construida** |
| Base mínima para esa retención: **27 UVT** | `UVT_MINIMA_RETEFUENTE` | ✔ |

**Todo en `src/modules/payments/liquidacion.ts` y `src/modules/payments/distribucion.ts`.**

### La base mínima de la retención de Katherine, con su cifra

**27 UVT × 52.374 = `$`1.414.098.** Por encima de esa base (sin IVA, en el corte quincenal), Atlas le
calcula la retención del 2,5 % a favor de ella; por debajo, cero.

> **Lo que hay que preguntarle a la contadora no es "cuál es la base mínima", sino CONFIRMAR ESTAS DOS
> CIFRAS para 2026:** que la UVT es **52.374** y que la base mínima de retefuente por compras es **27 UVT**.
> Las dos salen del modelo comercial §4.1 y llevan ahí desde septiembre; conviene que alguien las firme
> antes del primer corte real.

### ⚠ Lo único que falta para Katherine, y es un dato, no código

`tax_is_withholding_agent` está **en nulo** en su perfil. Y el código es explícito: *"NULL = sin verificar,
y entonces no se anticipa retención"*. O sea que **hoy su cuenta de Distribución saldría con retención
cero**, y ella le retendría el 2,5 % al pagar sin que Atlas lo hubiera previsto: la cuenta y el giro no
cuadrarían.

| Campo | Valor | Estado |
|---|---|---|
| `tax_person_type` | `juridica` | ✔ **ya está** |
| `tax_is_withholding_agent` | **`true`** (código 07 del RUT) | ✖ **nulo** |
| `tax_id_number` + `tax_id_dv` | **901819710** + **6** | hay que verificarlo |
| `tax_is_vat_responsible` · `tax_must_invoice` | — | nulos |

### Cuándo es la primera liquidación real, que es la fecha límite

- **Katherine (Distribución, quincenal):** su primer corte real va del **20 al 30 de noviembre** y se emite
  **después del 30**.
- **Los demás (Comisión, mensual):** el corte de noviembre cierra el **30**, y se liquida en los primeros
  días de diciembre.

**Así que la fecha límite de todo lo tributario es el 30 de noviembre**, la misma que la del xlsx. Hasta
entonces se puede vender sin problema: lo que no se puede es pagar.

### Lo que falta construir: la tabla del art. 383

**Una opción por integrante**, para la persona natural que la declara en su cuenta de cobro (y que casi
siempre da 0). Hoy no existe: toda persona natural va al 10 %.

**Lo que haría falta:** un campo en el perfil (`retencion_metodo`: `tarifa_fija` | `tabla_383`), la tabla
por rangos de UVT, y que la liquidación elija el camino y **selle cuál usó**, como ya sella la tarifa.

**Los datos que hay que pedirle a la contadora para construirla:**

1. **Los rangos de la tabla del art. 383 vigentes en 2026**, en UVT, con su tarifa marginal y su base
   restada (los cinco tramos: 0, 19 %, 28 %, 33 %, 35 %, 37 % y 39 %).
2. **Si la depuración previa aplica** (el 25 % de renta exenta y su tope en UVT), que es lo que hace que casi
   siempre dé 0.
3. **Qué pasa si alguien cambia de método a mitad de año**: ¿rige desde el pago siguiente, o desde el
   corte siguiente?
4. Y la confirmación de las dos cifras de arriba: **UVT 2026 = 52.374** y **base mínima 27 UVT**.


---

## EL XLSX DE VENTAS ATRASADAS

**Se carga DESPUÉS del arranque del 20 y ANTES del 30 de noviembre.** No se carga nada todavía: esto es la
plantilla y el plan.

### Qué es, en una frase

Las ventas reales que ya ocurrieron, se facturaron **a mano en Alegra** y todavía no están en Atlas. Al
entrar: **descuentan inventario**, **cuentan para los reportes**, y **no** emiten factura, **no** cobran por
Wompi y **no** generan comisión duplicada.

> **Confirmado en el código el 2026-11-18:** la venta retroactiva escribe su `created_at` **en la fecha
> real de la venta** (es el único camino de la app que lo hace), guarda el número de la factura que ya
> existe y **nunca llama a Alegra**. Y las cifras de Dirección se acotan por **la fecha de la venta**, no por
> la de su registro. O sea que **las ventas atrasadas van a contar en su mes**, que es lo que había que
> confirmar.

### HOJA 1 · Las ventas

Una fila por venta. Si una venta llevó tres productos, son **tres filas** con el mismo número de factura.

| Columna | Obligatoria | Qué va | Por qué |
|---|---|---|---|
| `vendedor` | **sí** | el nombre del Integrante, o **`CNV`** | hay ventas que hizo CNV sin Integrante (la del 8 de agosto). Decide si hay comisión |
| `fecha_de_la_venta` | **sí** | `AAAA-MM-DD` | **es la fecha que mandan las cifras.** Es la que va a `created_at` |
| `producto` | **sí** | el nombre exacto del catálogo | |
| `lote` | **sí** | el código del lote | el inventario se descuenta por lote, no por producto |
| `cantidad` | **sí** | entero | |
| `de_donde_salio` | **sí** | `vitrina` (la del vendedor) o `bodega` | decide **de qué ubicación** sale el descuento. Sin esto hay que adivinar |
| `medio_de_pago` | **sí** | `efectivo`, `transferencia` o `pasarela` | |
| `paciente_documento` | **no** | la cédula, si la venta tiene paciente | vacío = venta sin paciente, y entonces `motivo_sin_paciente` es obligatorio |
| `motivo_sin_paciente` | si no hay paciente | texto | las 3 ventas de Diana Marcela no tienen paciente |
| `factura_alegra_numero` | **sí** | el consecutivo (p. ej. `FE97`) | es lo que permite cotejar y lo que impide emitir otra |
| `factura_alegra_fecha` | **sí** | `AAAA-MM-DD` | **sale tarde a propósito**: muchas se emitieron en octubre o noviembre sobre ventas de agosto |
| `recibo_numero` | no | el del recibo o anticipo | |
| `recibo_fecha` | no | `AAAA-MM-DD` | **coincide con la fecha de la venta**, y por eso es la prueba de cuándo ocurrió de verdad |
| `descuento_valor` | no | pesos descontados al paciente | la venta del 8 de agosto lleva descuento |
| `descuento_motivo` | si hay descuento | texto | un descuento sin motivo es un precio inventado |
| `notas` | no | lo que haga falta | |

> **Las tres fechas son tres hechos distintos y hay que llevar las tres.** La venta ocurrió en agosto, la
> factura salió en noviembre y el recibo es de agosto. **Las cifras cuentan por la fecha de la VENTA**; la
> de la factura sirve para cotejar contra Alegra; la del recibo es la que respalda la primera.

### HOJA 2 · El conteo de la bodega central

| Columna | Qué va |
|---|---|
| `producto` | el nombre exacto |
| `lote` | el código |
| `cantidad_contada` | lo que de verdad hay, contado a mano |
| `fecha_del_conteo` | `AAAA-MM-DD` |

### El orden de carga, y por qué es ese

1. **Primero las ventas.** Cada una descuenta de donde diga `de_donde_salio`. Al terminar, el inventario
   del sistema ya no está inflado: las unidades que salieron, salieron.
2. **Después se compara la bodega resultante con el conteo de la hoja 2.**
3. **La diferencia se ajusta con UN movimiento de `conciliacion` por producto y lote**, con motivo
   **"conteo físico del 30 de noviembre"**. Visible, con autor y con fecha.

> **Por qué en ese orden y no al revés.** Si se concilia primero y se cargan las ventas después, las ventas
> vuelven a descontar sobre un saldo ya corregido y la bodega queda baja por el mismo motivo dos veces.
> Y si se conciliara **en vez** de cargar las ventas, cuadraría el número **tapando** lo que pasó: nadie
> sabría qué se vendió, ni a quién, ni habría cómo cotejarlo contra Alegra.
>
> **La conciliación final NO tapa errores, los muestra.** Si después de cargar todas las ventas la bodega
> todavía no cuadra con el conteo, esa diferencia **es un hallazgo** y tiene que quedar escrita con su
> motivo, no absorbida en silencio.

### Cómo se valida el archivo ANTES de cargar

El cargador corre en **dos pasadas**, igual que los scripts del arranque: primero valida y no escribe nada.

| Se rechaza el archivo entero si | Por qué no se puede dejar pasar |
|---|---|
| un `producto` o un `lote` no existe en el catálogo | descontaría de donde no es, o no descontaría |
| un `vendedor` no existe (y no es `CNV`) | la venta quedaría sin dueño |
| falta `factura_alegra_numero` | sin él no hay forma de cotejar, y es lo que impide emitir una segunda |
| un `factura_alegra_numero` **ya está en Atlas** | sería la misma venta dos veces |
| hay paciente y el documento no existe | mejor parar que crear un paciente desde una hoja de cálculo |
| no hay paciente y no hay `motivo_sin_paciente` | |
| hay `descuento_valor` y no hay motivo | |
| la `fecha_de_la_venta` es **posterior** a la de la factura en más de 90 días, o anterior al 2026-08-08 | atrapa el error de teclear el año o invertir dos columnas |
| `de_donde_salio` = `vitrina` y esa vitrina **no tiene saldo suficiente** del lote | el descuento dejaría un saldo negativo, que el sistema no admite |

**Y la pasada de validación imprime, antes de escribir:** cuántas ventas, cuánto dinero, cuántas unidades
por producto, cómo queda cada vitrina y cómo queda la bodega. Es el mismo cuadro "LO QUE VA A PASAR" de los
otros dos scripts.

### Lo que hay que construir para que esto se pueda cargar

**Son tres piezas, y las tres van antes del 30 de noviembre.**

#### 1 · La venta SIN PACIENTE

**El problema, medido:** `registrarVentaRetroactiva` **exige** un `patientId`. La columna
`transactions.patient_id` **sí admite nulo** en la base, así que el hueco está en el escritor y en el
formulario, no en el esquema.

**Y NO se resuelve con un "paciente genérico".** Un paciente inventado contamina la lista de pacientes, las
cifras clínicas, la cohorte de investigación y el conteo de consentimientos. Sería un dato falso que se ve
igual que uno bueno.

**Lo que hay que hacer:** aceptar `patientId = null` **con `motivo_sin_paciente` obligatorio**, igual que
la venta suelta ya exige su motivo cuando no sale de ninguna consulta. Y la factura: **no se emite**, que es
lo que ya hace toda venta retroactiva.

**Tamaño: media jornada.** Relajar el escritor, añadir el campo al formulario de `/admin/ventas-retroactivas`
con su `required` condicional (**ojo al hazard 6**: `required={!sinPaciente}`, nunca `required` a secas), y
su candado.

#### 2 · La venta de CNV sin Integrante, y el descuento comercial

**Estaban dimensionados y sin construir. Pasan a ser requisito del xlsx**, porque la venta del 8 de agosto
es las dos cosas a la vez: la hizo CNV, sin comisión, y con descuento al paciente.

| Pieza | Qué hace falta |
|---|---|
| **Venta sin Integrante** | `professional_id = null`. El sellado ya lo contempla (*"una venta sin profesional no se bloquea: no hay modalidad de nadie"*, candado existente) y **no crea fila de comisión**, que es justo lo que se quiere. Falta la superficie |
| **Descuento comercial** | un valor y un motivo por línea. El IVA se calcula sobre el precio **ya descontado**, y el reparto también: un descuento que no baje la base haría que CNV pagara IVA sobre plata que no cobró |

**Tamaño: una jornada las dos.** Para el xlsx basta con que el **cargador** sepa ponerlos; la pantalla puede
ir después.

#### 3 · El cargador del xlsx

Lee las dos hojas, valida, imprime el cuadro y escribe por los caminos que ya existen. **Una jornada.**

**Total: dos días y medio de trabajo**, y hay ocho días hábiles. Cabe, pero no sobra.

