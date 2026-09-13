# Guía del 2b: paso a producción

**Para:** Santiago, el 2026-09-14, de último en el día.
**Tiempo:** unos 30 minutos para la parte A y 45 para la ventana (B a D), sin contar la creación de ítems en Alegra.
**Regla de toda la guía:** si un paso no da lo que dice **Debe dar**, no sigas. Ve a la sección **F. Si algo sale mal**.

Las consultas marcadas **(lectura)** se pueden correr en el editor SQL de Supabase. Los scripts `.sql` **no**: esos se corren con `aplicar-migracion.mjs`, porque el editor de Supabase no sostiene la transacción.

---

## A. ANTES DE TOCAR NADA (nada de esto escribe)

### A1. Lo que tienes que tener a mano

- [ ] Credenciales de **Alegra producción**: correo y token de API de la cuenta de CNV.
- [ ] Llaves de **Wompi producción** (panel de Wompi, modo producción, sección Desarrolladores):
  - llave pública, empieza por `pub_prod_`
  - llave privada, empieza por `prv_prod_`
  - secreto de eventos, empieza por `prod_events_`
  - secreto de integridad, empieza por `prod_integrity_`
- [ ] El `DATABASE_URL` de la nube.
- [ ] **El comprador de la venta controlada**, disponible y con su tarjeta. Tiene que:
  - existir en Atlas como paciente **real** (no marcado de prueba);
  - tener bien su documento, nombres y apellidos (así sale la factura);
  - tener un correo que alguien pueda abrir durante la ventana.
- [ ] **Alguien de contabilidad** conectado a Alegra durante la ventana, para mirar la factura en cuanto salga.

### A2. Crear el archivo de credenciales de producción

En la raíz del proyecto, un archivo **nuevo** llamado `.env.produccion.local` (git ya lo ignora):

```
DATABASE_URL=<el de la nube>
ALEGRA_EMAIL=<correo de Alegra producción>
ALEGRA_API_KEY=<token de Alegra producción>
ALEGRA_BASE_URL=https://api.alegra.com/api/v1
```

- [ ] **No** pongas estas credenciales en `.env.local`. Si entran ahí, `pnpm dev` y los tests locales hablan con la cuenta real de CNV.

### A3. El código y la base están al día

```
git pull
node --env-file=.env.produccion.local scripts/check-migrations.mjs
```

- [ ] **Debe dar:** `137` en el repo y `137` en la base, sin migraciones pendientes.
- [ ] En Vercel, Deployments: el deployment de **Production** es del último commit de `main`.
- [ ] **Anota el nombre de ese deployment** (el de sandbox). Es a donde vuelves si algo sale mal (F3).

### A4. Wompi producción está listo

- [ ] La cuenta de Wompi está **activa en producción**, no solo en pruebas.
- [ ] En modo **producción**, la URL de eventos es exactamente `https://atlas.cnvsystem.com/api/webhooks/wompi`.

### A5. Alegra producción: lo que tiene que existir

Si falta algo, lo crea contabilidad en la pantalla de Alegra **antes** de seguir:

- [ ] **Cinco ítems**, con el nombre igual al de Atlas (el cotejo compara nombres), su precio **base sin IVA** y el impuesto **IVA 19%**:

  | Nombre | Base |
  |---|---|
  | MULTICELL BASE (o MULTI-CELL BASE) | 90.000 |
  | OMEGA COMPLEX | 90.000 |
  | CURCUMIN BIOACTIV | 90.000 |
  | D3-K2 OSTEO | 140.000 |
  | LUVIA | 75.630 |

- [ ] **Dos centros de costo:** uno de producto propio y otro de productos de terceros.
- [ ] **Dos cuentas puente**, de tipo efectivo y **nunca de tipo banco**: "Efectivo en poder de Integrantes" y "Wompi por liquidar".

### A6. Leer la cuenta de producción

```
node --env-file=.env.produccion.local scripts/leer-alegra.mjs
```

- [ ] **Debe dar:** `Ambiente: PRODUCCION` y la empresa CONNECTED NUTRITION VENTURES S.A.S.
- [ ] Numeración de factura con prefijo **FE**, `ELECTRONICA`, `active`, que no esté vencida y a la que le quede rango.
- [ ] En "ÚLTIMOS DOCUMENTOS": la última factura es **FE6** y la última nota crédito **NC2**. Si hay otra más reciente, está bien: Atlas sigue después de la que haya.
- [ ] Numeración de nota crédito `ELECTRONICA` y `active`.
- [ ] Los cinco ítems aparecen con `= Atlas "..."` y `precio ok`.
- [ ] **Debe dar:** `AVISOS: Ninguno.` Si hay avisos, se resuelven en Alegra y se vuelve a correr.

### A7. Llenar y ensayar el SQL de configuración

1. Abre `scripts/config-alegra-produccion.sql` y cambia cada `<LLENAR>` por el id que mostró A6. Copia **mirando el nombre**, no la cifra: MULTICELL, OMEGA y CURCUMIN tienen el mismo precio.
2. Ensáyalo, **sin** `--commit`:

```
node --env-file=.env.produccion.local scripts/aplicar-migracion.mjs scripts/config-alegra-produccion.sql
```

- [ ] **Debe dar:** `El archivo corrio SIN ERRORES` y `Revirtiendo: esto fue un ENSAYO`.
- [ ] En los `NOTICE`, cada producto con su ítem y el centro de costo propio distinto del de tercero.
- Si dice `ABORTADO`, el mensaje dice qué falta. Corrige y repite.

### A8. El panel y los checkouts, tal como están

**(lectura)** Checkouts pendientes:

```sql
select id, amount, created_at, wompi_env from transactions
 where status = 'pending' order by created_at desc;
```

**(lectura)** Ventas cobradas a las que les falta algo:

```sql
select id, amount, alegra_invoice_state, alegra_attempts, alegra_last_attempt_at, wompi_env, alegra_env,
       left(alegra_last_error, 90) as motivo
  from transactions
 where status = 'paid'
   and (alegra_invoice_state is distinct from 'emitida' or alegra_payment_id is null)
 order by created_at desc;
```

- [ ] Anota lo que sale en las dos. Lo que ya estaba **no** es un problema nuevo.
- [ ] Ninguna venta está en proceso ahora mismo (sin `alegra_last_attempt_at` de hace menos de 2 minutos).

**Si llegaste aquí con todo marcado, empieza la ventana.** Desde B1 hasta que termine D, **nadie cobra nada** en Atlas.

---

## B. LA VENTANA: CAMBIAR DE AMBIENTE

### B1. Cerrar los checkouts pendientes

Un link creado antes del cambio y pagado después cruza de ambiente: se cobra con la llave de producción y la venta queda marcada "de prueba", así que nunca se factura.

```
node --env-file=.env.produccion.local scripts/aplicar-migracion.mjs scripts/cerrar-checkouts-pendientes.sql --commit
```

- [ ] **Debe dar:** `Checkouts pendientes cerrados: N` y `CONFIRMADO`.
- [ ] Si alguno era un paciente real esperando pagar, su profesional le genera un link nuevo **después de D**.

### B2. Aplicar la configuración

El mismo comando de A7, ahora con `--commit`:

```
node --env-file=.env.produccion.local scripts/aplicar-migracion.mjs scripts/config-alegra-produccion.sql --commit
```

- [ ] **Debe dar:** `SIN ERRORES` y `CONFIRMADO`.

Desde aquí, una venta facturada contra el sandbox fallaría. Por eso no se cobra nada en la ventana.

### B3. Cotejar Atlas contra Alegra producción

```
node --env-file=.env.produccion.local scripts/cotejo-alegra.mjs
```

- [ ] **Debe dar:** `Ambiente cotejado: produccion` y `COTEJO LIMPIO`.
- [ ] Si aparece `AVISO: ... ¿Invertidos?` o `¿Invertidas?`, confirma con contabilidad antes de seguir.
- [ ] `aviso: sin productKey` es esperado: la DIAN acepta con observación.
- **Si no sale limpio:** corrige el id en el SQL, vuelve a B2 y repite B3. Todavía no cambió nada que vea un usuario.

### B4. Cambiar las variables en Vercel

Settings → Environment Variables → entorno **Production**. Cambia **las siete a la vez**, porque con Alegra en un ambiente y Wompi en otro ninguna venta se factura:

| Variable | Valor nuevo | Comprobación |
|---|---|---|
| `ALEGRA_BASE_URL` | `https://api.alegra.com/api/v1` | no contiene `sandbox` |
| `ALEGRA_EMAIL` | el de producción | |
| `ALEGRA_API_KEY` | el de producción | |
| `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` | llave pública de producción | empieza por `pub_prod_` |
| `WOMPI_PRIVATE_KEY` | llave privada de producción | empieza por `prv_prod_` |
| `WOMPI_EVENTS_SECRET` | secreto de eventos de producción | empieza por `prod_events_` |
| `WOMPI_INTEGRITY_SECRET` | secreto de integridad de producción | empieza por `prod_integrity_` |

- [ ] No toques `NEXT_PUBLIC_APP_URL` ni `DATABASE_URL`.

### B5. Redesplegar

Deployments → el deployment de Production → menú **⋮** → **Redeploy**.

- [ ] **Hay que redesplegar sí o sí.** La llave pública de Wompi se incrusta al construir; sin un deployment nuevo, Atlas sigue cobrando con la de pruebas.
- [ ] Espera a que diga **Ready**.

---

## C. LA VENTA CONTROLADA

**Producto recomendado:** 1 × LUVIA, por 90.000. Es la cifra que dio contabilidad, es la venta más pequeña posible y ejercita el centro de costo de terceros y el redondeo del IVA. En el sandbox esa misma venta salió así (SETP990214714, leída por API): base 75.630, IVA 14.370, total 90.000, centro "Productos de Terceros", tarjeta crédito, pagada y con saldo 0. **La de producción tiene que salir igual.**

### C1. Crear el checkout

1. En Atlas, `/pagos`: checkout del comprador, 1 × LUVIA.
2. **(lectura)** Antes de pagar:

```sql
select id, amount, status, wompi_env from transactions order by created_at desc limit 1;
```

- [ ] **Debe dar:** `amount 90000`, `status pending`, **`wompi_env produccion`**.
- **Si dice `test`: PARA.** El deployment no tomó la llave nueva. Revisa B4 y B5 y crea otro checkout.

### C2. Pagar

1. El comprador abre el link y paga con su tarjeta real.
- [ ] La pantalla de Wompi **no** muestra ningún aviso de pruebas o sandbox. Si lo muestra, **PARA** antes de pagar.
- [ ] Wompi dice aprobado.

### C3. Revisión en Atlas (lectura)

Espera un minuto y corre:

```sql
select status, amount, wompi_env, alegra_env, alegra_invoice_state, alegra_invoice_number,
       alegra_cufe is not null as tiene_cufe, alegra_legal_status, alegra_payment_id,
       payment_method_type, payment_card_type, alegra_last_error
  from transactions order by created_at desc limit 1;
```

- [ ] `status` = `paid`
- [ ] `wompi_env` = `produccion` y `alegra_env` = `produccion`
- [ ] `alegra_invoice_state` = `emitida`. Si dice `emitida_sin_sellar`, la DIAN no ha respondido: espera un minuto, pulsa **Reintentar** en `/pagos` y vuelve a correr la consulta.
- [ ] `alegra_invoice_number` empieza por **FE** y es el siguiente al último que viste en A6
- [ ] `tiene_cufe` = `true`
- [ ] `alegra_payment_id` no está vacío
- [ ] `payment_method_type` = `CARD` y `payment_card_type` = `CREDIT` o `DEBIT`
- [ ] `alegra_last_error` vacío
- [ ] En `/pagos`, esa venta **no** aparece en "Ventas cobradas sin cerrar en contabilidad".

### C4. Revisión en Alegra (contabilidad, en pantalla)

Abre la factura FE nueva:

- [ ] **Cliente:** el comprador, con su documento y su nombre.
- [ ] **Una línea:** LUVIA, cantidad 1, precio base 75.630.
- [ ] **IVA 19%:** 14.370. **Total:** 90.000.
- [ ] **Centro de costo:** el de productos de terceros.
- [ ] **Medio de pago:** tarjeta crédito o tarjeta débito, según la tarjeta usada.
- [ ] **Estado DIAN:** aceptada, o aceptada con observaciones (vale).
- [ ] **Pago registrado** por 90.000 contra **"Wompi por liquidar"**, **no** contra el banco. Saldo 0.

### C5. El correo

- [ ] El comprador recibió el correo de Alegra con la factura. Mira también en spam.
- Si no llega en unos minutos, **no bloquea abrir la venta**: en Alegra, ficha del contacto, revisa que el correo esté bien, y en la factura mira la sección "Actividad".

### C6. En Wompi

- [ ] En el panel de Wompi producción, la transacción aparece **aprobada** por 90.000.

---

## D. ABRIR LA VENTA

**Solo si C3, C4 y C6 quedaron completos.**

- [ ] Avisa a los Integrantes de que ya pueden cobrar.
- [ ] **Primer día:** que contabilidad mire en Alegra la **primera factura de un producto propio** (MULTICELL, OMEGA, CURCUMIN o D3-K2) y confirme que su centro de costo es el **propio**. La venta controlada solo probó el de terceros.
- [ ] Y la **primera venta en efectivo**: su pago tiene que ir contra **"Efectivo en poder de Integrantes"**.
- [ ] Borra `.env.produccion.local` cuando termines, o guárdalo fuera del proyecto.

---

## E. LO QUE ES NORMAL Y NO ES UN PROBLEMA

- **Ventas de prueba en el panel** con "No se factura aquí, por regla": son pagos del smoke con tarjeta de prueba. En producción no se facturan nunca, que es justo lo que se quiere, y el reintento no les gasta intentos.
- **"sin productKey"** en el cotejo y **"aceptada con observaciones"** en la DIAN: es la observación FAZ09. No invalida la factura.
- **Una factura "Numerada sin sellar"** en el panel: la DIAN tardó en responder. Pulsa **Reintentar** en `/pagos` pasado un minuto y se completa sola. No crea una segunda factura.

---

## F. SI ALGO SALE MAL

### F1. Decide cuál es el caso

| Lo que ves | Qué haces |
|---|---|
| C1 dice `wompi_env test` | No pagues. Revisa B4 y B5, redespliega, y crea otro checkout |
| Wompi aprobó, pero en Atlas la venta sigue `pending` después de 2 minutos | El webhook no entró: el secreto de eventos (B4) o la URL (A4) están mal. Corrige y redespliega. **No marques la venta a mano:** el cobro existe en Wompi y avísame para sellarlo |
| La venta está `paid` y `alegra_invoice_state` es `fallida` | Lee `alegra_last_error`. Si es un dato mal configurado, corrígelo (B2 y B3) y pulsa **Reintentar** en `/pagos`. El pago del comprador ya quedó guardado |
| La factura salió, pero **mal** (ítem, IVA, centro de costo, cuenta del pago) | Nadie más cobra. Contabilidad emite **nota crédito manual** en Alegra sobre esa factura. Corrige el mapeo (B2 y B3) y haz **otra** venta controlada (C). Atlas todavía no emite notas crédito: eso llega en el 3b |
| No sabes qué pasa, o hay más de un problema | Vuelta atrás completa (F3) |

### F2. Antes de volver atrás

- [ ] **Nadie cobra.**
- [ ] Cierra los checkouts pendientes (mismo comando de B1). Un link de producción pagado después de la vuelta atrás se cobraría con la llave de pruebas, y al volver a producción se le emitiría una factura real.
- [ ] **Mira el panel de Wompi producción.** Cada transacción aprobada tiene que estar `paid` en Atlas. Si hay una aprobada que en Atlas quedó `failed` o `pending`, **anótala**: es dinero real que Atlas no registró, y hay que resolverla a mano con contabilidad.

### F3. Vuelta atrás completa

1. **Vercel → Deployments → el deployment que anotaste en A3 → ⋮ → Instant Rollback.** Tarda un minuto, y ese deployment trae **sus** variables, las de sandbox.
2. **Vercel → Settings → Environment Variables:** devuelve las siete variables de B4 a sus valores de sandbox. Sin esto, el próximo push despliega otra vez con las de producción.
3. Hasta que se pulse **Undo Rollback** en Vercel, los push nuevos **no se publican**. Es lo esperado.
4. **Solo si se va a volver a probar en sandbox:**

```
node --env-file=.env.produccion.local scripts/aplicar-migracion.mjs scripts/vuelta-atras-alegra-sandbox.sql --commit
```

**Lo que NO se deshace:**

- Las facturas que ya emitió Alegra producción: son documentos fiscales y se corrigen con nota crédito.
- Los contactos que se crearon en Alegra producción.
- La fila `produccion` de `alegra_config`: se queda, no estorba y sirve para el siguiente intento.

**Lo que pasa con una venta real cobrada durante el problema:** queda `paid`, con la factura en "No se factura aquí, por regla" ("Es un pago REAL y Alegra está en sandbox"). **No se pierde:** cuando se vuelva a producción, pulsa **Reintentar** en `/pagos` y se factura. Esas decisiones no gastan intentos.

### F4. Volver a intentarlo otro día

Repite desde A6. `config-alegra-produccion.sql` se puede correr otra vez sin problema: deja los mismos valores.
