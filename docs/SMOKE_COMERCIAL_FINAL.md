# Smoke comercial final, y el checklist del arranque

**Al 17 de noviembre de 2026.** Este documento **reemplaza** a los guiones comerciales anteriores. Lo que
había que hacer está aquí, en orden, y nada más hay que abrir.

> **Lo que reemplaza y dónde quedó lo anterior:** `docs/entregas/SMOKE_UNICO_2026-09-26.md`,
> `docs/entregas/SMOKE_SEGUNDO_2026-09-28.md` y `docs/entregas/ARRANQUE_OPERACION_REAL_2026-09-26.md`
> **se conservan tal cual, versionados**, como el registro de lo que se probó y de lo que se decidió cada
> día. De ellos sobrevive aquí **lo que sigue abierto**; lo cerrado se queda allá con su resultado. La poda
> de documentos va después del 18 de noviembre, y su tabla está en el informe de ese día.

> **Dos cosas que hay que tener claras antes de empezar, y las dos muerden:**
>
> 1. **Una venta hecha con las llaves en sandbox NO se factura nunca**, ni cuando se monten las de
>    producción. `wompi_env` se sella **al crear** la venta y vale también para efectivo y transferencia. Por
>    eso el orden es: smoke → marcar lo del smoke → llaves → primera venta real. Nunca al revés.
> 2. **Marcar una venta como de prueba NO devuelve la unidad al inventario.** El libro de movimientos es
>    append-only porque describe algo que pasó. Lo que corrige un saldo es declararlo, y eso es el paso 3 del
>    checklist.

---

## 0 · Lo que hace falta tener antes de empezar

| | Qué | Dónde se prepara |
|---|---|---|
| 1 | **Un integrante de prueba en Comisión.** Sirve `Profesional Prueba`, que ya existe | ya está |
| 2 | **Un integrante de prueba en Distribución.** Sirve `Profesional demo 2`, que ya tiene la modalidad vigente | ya está |
| 3 | **Un paciente de prueba** por cada uno, marcado como de prueba | /pacientes |
| 4 | **Producto con saldo** en la vitrina de cada uno | /faltantes, bloque de remesas |
| 5 | **Las dos cuentas marcadas como de prueba AL FINAL**, no antes (ver la parte D) | /admin |

**El producto del smoke:** **MULTI-CELL BASE, lote `19826`**. No se usa ADAPTO-STRESS: desde el 15 de
octubre la central no deja despachar lo que no tiene, y de ADAPTO-STRESS no tiene nada.

**Cambiar la modalidad a Distribución rige HOY MISMO** si ese integrante no tiene ninguna venta en el corte
en curso; si tiene alguna, entra en el corte siguiente y la pantalla lo dice. Para una cuenta de prueba
recién usada, conviene hacerlo **antes** de registrarle ventas.

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

1. Mirar el panel de facturación en /pagos.
2. **Resultado esperado:** las dos ventas de arriba se emiten en el **sandbox** de Alegra, con su número, y
   el panel deja de pedirlas. El pago queda registrado contra la cuenta puente que corresponde (efectivo,
   pasarela o transferencia).
3. **Si una queda sin facturar, el panel dice por qué.** Un motivo *"No se factura aquí, por regla"* sobre
   una venta de un paciente de prueba es **correcto**: no se manda la identidad de un paciente al sandbox.

### B5 · La comisión

1. /comercial como admin → bloque de Comisión.
2. **Resultado esperado:** el integrante aparece con su base y su comisión al **20 %** de las dos ventas, y
   la retención calculada según su estado tributario. Las mismas cifras las ve él en **/comercial** (desde
   la barra lateral, **"Mis pagos"**) y en **/perfil**.
3. **Liquidar** y comprobar que la liquidación queda con su documento, su retención y su neto, y que al
   integrante le aparece en su historial.

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
   - en la factura va con el **centro de costo de tercero**, no con el de producto propio;
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

### Paso 2 · Fijar la fecha de arranque

```
scripts/ARRANQUE_A_PRODUCCION_2026-11-18.sql
```

**Se corre en el editor SQL de Supabase de producción, tal cual: termina en `rollback` y solo informa.** Se
leen los cuadros, y solo entonces se cambia `rollback` por `commit`.

**Qué hace:** marca como prueba lo operado antes de la fecha (al 17 de noviembre, **cero filas**: las 64
ventas ya cuentan como de prueba), anula las cuentas de Distribución de cortes anteriores **no pagadas** (al
17 de noviembre, **ninguna**: la única que existe está pagada), y **fija la fecha de arranque**, que es lo
único que de verdad tiene que pasar ese día.

**El de octubre NO se vuelve a correr:** su paso 4 volvería a poner `2026-10-15`, que es justo la fecha
equivocada que las pantallas estaban anunciando.

**Resultado esperado:** `fecha_de_arranque` queda en el día real, `ventas_reales_antes_del_corte` en **0**, y
las dos cifras clínicas (consultas y consentimientos) **idénticas** antes y después. Y las pantallas de
Dirección y de Inicio dejan de decir *"Todavía no se ha arrancado"* y empiezan a contar desde ese día.

### Paso 3 · Cargar el inventario real

```
scripts/CARGAR_EL_INVENTARIO_AL_ARRANQUE_2026-11-18.sql
```

Antes, correr el de lectura para refrescar las cifras:

```
node --env-file=.env.production.local scripts/EL_INVENTARIO_CONTRA_LO_RECIBIDO_2026-11-17.mjs
```

**Qué hace:** deja el saldo de cada vitrina **exactamente** en lo que esa persona recibió, con un movimiento
de `conciliacion` por línea (motivo y autor) y una fila de auditoría
`inventario.carga_inicial_al_arranque`. También termina en `rollback`.

**Resultado esperado (medido el 2026-11-17):** **31 líneas** cambian, 16 suben y 15 bajan, y el **ajuste
neto** es **+12 MULTI-CELL BASE y +8 OMEGA COMPLEX** y **cero** en los otros tres. Esas 20 unidades son
exactamente las que se llevaron las ventas de prueba. Al terminar, el total por producto es la primera tanda
completa: **500 / 500 / 426 / 300 / 84**.

**Si el neto da otra cosa, algo más se movió y hay que mirarlo antes de confirmar.**

### Paso 4 · Las variables en Vercel

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

### Paso 5 · El webhook de Wompi

En el panel de Wompi, registrar el endpoint de producción:

```
https://atlas.cnvsystem.com/api/webhooks/wompi
```

y copiar de ahí `WOMPI_EVENTS_SECRET` y `WOMPI_INTEGRITY_SECRET` al paso 4.

**Resultado esperado:** una venta pagada por pasarela pasa a `paid` **sola**, sin tener que correr el
sondeo.

### Paso 6 · Los ids de los productos en el Alegra REAL

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
   numeración de **factura electrónica** (prefijo FE, continuando la numeración de la facturación manual),
   numeración de **nota crédito**, **id del IVA al 19 %**, los **dos centros de costo** (propio y tercero,
   ojo a no invertirlos) y las **tres cuentas puente**: efectivo, pasarela y **transferencia**.
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

### Paso 7 · Redesplegar

Las variables de Vercel **no se recargan solas**. Redesplegar producción y esperar a que termine.

**Resultado esperado, y es la comprobación de que las dos llaves quedaron puestas:** abrir **/pagos** y ver
que **el aviso amarillo del modo de pruebas DESAPARECIÓ**. Si sigue ahí, la de Wompi no entró, y toda venta
que se registre seguirá naciendo sellada como prueba.

> Con Wompi en producción y Alegra todavía en sandbox, las ventas nacen **reales** y no se pueden facturar
> en ningún lado. Las dos van juntas.

### Paso 8 · La primera venta real, vigilada

**Una venta genuina, de un paciente real, no una de prueba.** En Alegra producción cada factura va a la
DIAN: no se puede "ensayar" aquí.

1. Avisar al integrante que va a hacerla y estar mirando.
2. **Resultado esperado:** la venta nace sin el aviso amarillo, se paga, se **factura en Alegra real** con
   su consecutivo, el pago queda registrado contra su cuenta puente, el inventario baja en la vitrina
   correcta, y la comisión aparece en /comercial.
3. Cotejar el número de la factura en Alegra. Si algo sale mal, **se corrige con nota crédito**, que la hace
   una persona: no hay botón.

### Paso 9 · Qué mirar en Sentry

Durante la primera hora, y con el filtro del entorno de producción:

| Buscar | Qué significa |
|---|---|
| `NEXT_REDIRECT` reportado como error | **NO es un fallo**: así señaliza Next un redirect. Si aparece, es que a algún `catch` le falta el `unstable_rethrow` delante |
| errores de `/api/webhooks/wompi` | la firma HMAC no cuadra: el `WOMPI_EVENTS_SECRET` es el del otro ambiente |
| errores de Alegra con `401` o `403` | credenciales mal puestas |
| errores de Alegra con `404` sobre un item | el mapa de items apunta a ids que no existen en producción: volver al paso 6 |
| `Load failed` / `NetworkError` desde un móvil | red del paciente, no nuestra. Ya tiene su manejo |

### Paso 10 · Cómo volver atrás

**La vuelta atrás es de las VARIABLES, y es rápida.** No hay que tocar la base.

1. En Vercel, devolver las variables del paso 4 a sus valores de sandbox.
2. Redesplegar.
3. **Resultado esperado:** el aviso amarillo del modo de pruebas vuelve a /pagos.
4. **El mapa de items del sandbox sigue intacto:** desde la migración 0144 los dos ambientes conviven en
   `alegra_items`, así que no hay que "devolver" ningún id. Lo que escribió el paso 6 fue la fila de
   producción, que no estorba. Y si hiciera falta, está `scripts/vuelta-atras-alegra-sandbox.sql`.
5. **Lo que NO se deshace:** una factura ya emitida en Alegra real. Esa se corrige con nota crédito.
6. **Lo que tampoco se deshace:** el paso 3 (el inventario). Un movimiento no se borra, se corrige con otro
   movimiento en sentido contrario.
7. **La fecha de arranque sí se puede mover:** `update commercial_config set fecha_de_arranque = null;`
   devuelve las pantallas a *"todavía no se ha arrancado"*, sin borrar nada.

---

## Lo que queda fuera de este smoke, y es a propósito

- **Las ventas atrasadas del xlsx.** Van **después** del arranque. Descuentan inventario y cuentan para
  reportes, pero **no** emiten factura en Alegra (ya se hizo a mano), **no** cobran por Wompi y **no**
  duplican comisiones ya pagadas. La superficie que falta para eso es "registrar una venta como **ya
  facturada por fuera**", que está dimensionada y no construida.
- **El traslado automático de ventas rezagadas** al corte siguiente (decisión de contabilidad). Hoy es
  manual y la pantalla lo dice.
- **El cargo por un vencido a cargo del Integrante**: la alerta llega hasta la propuesta de quién asume.
- **La emisión de la cuenta de Distribución en Alegra**: la cuenta se arma, se objeta y se cobra en Atlas.
- **Que la remesa mueva el saldo con ubicación de tránsito**, y el escritor para registrar unidades en
  central. La mitad barata (que la central no despache lo que no tiene) ya está.
- **El "Facturar ahora"** de una rezagada que cruza de bimestre: pide una decisión de contabilidad primero.
