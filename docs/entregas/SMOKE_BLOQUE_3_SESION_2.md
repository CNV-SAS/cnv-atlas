# Smoke del Bloque 3, sesión 2: anular, revisar, entregar y vender en consulta

**Qué se prueba:**
- que la página de Wompi siga abriendo con la firma nueva (con vencimiento);
- que anular un link libere sus unidades;
- que cobrar en efectivo con un link pendiente lo anule;
- que la entrega quede auditada;
- que un pago sobre un link anulado quede en revisión, sin factura, y que sus dos salidas funcionen;
- y la venta en la pestaña Tratamiento, con QR, en un navegador real.

**Dónde:** en `atlas.cnvsystem.com`, con Wompi y Alegra en **sandbox** (como hoy).

**Con qué:** el mismo producto de prueba en la bodega central y el paciente de prueba **1000898321**, sin Integrante, igual que la sesión 1.

**Regla:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

> ### ⚠ Dónde se corre cada cosa
>
> **Los comandos `node scripts/...` y `pnpm ...` van en PowerShell.** Los archivos `.sql` **NO se pegan en el editor SQL de Supabase**: el editor no sostiene la transacción, y un script partido puede aplicar la mitad y decir "success".
>
> **Las consultas de revisión** (VENTAS, SALDO, RESERVAS y ENTREGAS, más abajo) **van en el editor SQL de Supabase**. Solo leen.
>
> **Usa una ventana de PowerShell SOLO para esto, y ciérrala al terminar.** `$env:DATABASE_URL` gana sobre `.env.local`: un `pnpm dev` o los tests corridos en esa ventana apuntarían a la nube. Si no quieres cerrarla, al final corre `Remove-Item Env:DATABASE_URL`.

---

## 0. Antes de empezar

### 0.1 La migración 0140, ANTES del push

La sesión 2 trae la migración `0140` (entrega, anulación y revisión). Es aditiva. Va en la nube **antes** del push, igual que las anteriores (`DEPLOY.md`).

Abre una ventana nueva de PowerShell en la carpeta del proyecto, con la conexión **directa** de la nube (puerto 5432):

```powershell
$env:DATABASE_URL = "postgresql://...la directa de la nube, puerto 5432..."
pnpm db:check:cloud
```

- [ ] **Debe dar:** una pendiente, `0140_entrega_anulacion_y_revision`.

```powershell
pnpm db:migrate
pnpm db:check:cloud
```

- [ ] **Debe dar:** `141` y `141`, al día.

### 0.2 Push y deployment

- [ ] **Push** de `main`.
- [ ] **Deployment** de Production en **Ready**.

### 0.3 El producto de prueba

El de la sesión 1 quedó retirado (renombrado). Se crea otro, con los mismos dos lotes.

**Primero, en PowerShell:** limpia las ventas del anterior (ensayo y confirmación) y crea el nuevo.

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql --commit
```

- [ ] **Debe dar** la limpieza: `CONFIRMADO`. Si dice `no existe el producto de prueba`, no había nada que limpiar; sigue.
- [ ] **Debe dar** la preparación: `Producto de prueba creado: PRUEBA SMOKE BLOQUE 3`, `Lote SMOKE-A: 2 unidades`, `Lote SMOKE-B: 3 unidades` y `CONFIRMADO`.

### Las consultas de revisión (en el editor SQL de Supabase)

**Consulta VENTAS**: las ventas del producto de prueba, con todo lo nuevo:

```sql
select t.created_at, t.payment_method as medio, t.status, t.stock_state,
       t.cancelled_at is not null as anulada, t.review_reason as revision, t.review_resolution as resolucion,
       t.fulfillment_state as entrega, t.alegra_invoice_state as factura, ti.quantity
  from transactions t
  join transaction_items ti on ti.transaction_id = t.id
  join nutraceuticals n on n.id = ti.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by t.created_at;
```

**Consulta SALDO**:

```sql
select l.code as lote, i.stock_quantity as unidades
  from nutraceutical_inventory i join lots l on l.id = i.lot_id join nutraceuticals n on n.id = i.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by l.code;
```

**Consulta RESERVAS**:

```sql
select l.code as lote, r.quantity as unidades, r.released_at is not null as liberada, r.consumed_at is not null as consumida
  from inventory_reservations r join lots l on l.id = r.lot_id join nutraceuticals n on n.id = r.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by r.created_at, l.code;
```

**Consulta ENTREGAS**: la auditoría clínica de las entregas del producto:

```sql
select a.created_at, a.actor_email, a.payload
  from clinical_audit_log a
  join transaction_items ti on ti.transaction_id::text = a.entity_id
  join nutraceuticals n on n.id = ti.nutraceutical_id
 where a.event = 'nutraceutical.delivered' and n.name = 'PRUEBA SMOKE BLOQUE 3'
 order by a.created_at;
```

---

## 1. La página de Wompi abre con la firma nueva

**Esto va primero porque, si falla, no sirve ningún cobro con link.** Desde esta sesión la firma lleva la fecha de vencimiento del link.

En `/pagos`: checkout del paciente **1000898321**, **1 × PRUEBA SMOKE BLOQUE 3**. Abre el link en otra pestaña y pulsa el botón que lleva a Wompi.

- [ ] **Debe dar:** la página de pago de Wompi, con el monto. **No** un error de firma o de integridad.
- **No pagues.** Cierra esa pestaña.
- **Si Wompi rechaza la firma, para aquí y avísame.** La vuelta atrás es el deployment anterior (Instant Rollback); la 0140 se queda, porque es aditiva.

## 2. Anular un link libera sus unidades

Sigue con el link del paso 1.

- [ ] **Consulta RESERVAS:** SMOKE-A **1**, ni liberada ni consumida.
- [ ] En la lista de `/pagos`, esa venta tiene **Anular link**. Púlsalo: pide confirmación (*El paciente ya no podrá pagarlo*). Pulsa **Sí, anular**.
- [ ] **Debe dar:** el mensaje *Link anulado...* y la venta pasa a **Anulado** (no "Fallido").
- [ ] **Consulta VENTAS:** `failed`, `anulada` = `true`, `stock_state` = `liberado`.
- [ ] **Consulta RESERVAS:** esa reserva, **liberada**.
- [ ] Abre otra vez el link del paso 1. **Debe dar:** *Link no disponible*.

## 3. Cobrar en efectivo con un link pendiente lo anula

En `/pagos`: checkout del paciente 1000898321, **2 ×**. **No lo pagues.**

- [ ] **Consulta RESERVAS:** una nueva de SMOKE-A **2**, viva.

Ahora **venta en efectivo** del mismo paciente, **2 ×**:

- [ ] **Debe dar:** **no** se registra. Sale el aviso *Este paciente tiene un link de pago sin pagar con el mismo producto (PRUEBA SMOKE BLOQUE 3 x2 por ... COP, generado ...). Si cobras en efectivo, Atlas lo anula...*
- [ ] **Consulta VENTAS:** ninguna venta en efectivo nueva.
- [ ] Pulsa **Anular el link y cobrar en efectivo**. **Debe dar:** *Venta en efectivo registrada por ... COP. Se anuló el link de pago pendiente.*
- [ ] **Consulta VENTAS:**
  - el checkout de 2, `failed` y `anulada` = `true`;
  - la venta en efectivo, `paid`, `stock_state` = **`descontado`** (no `sin_saldo`: usó las unidades que tenía el link) y `entrega` = `pendiente`.
- [ ] **Consulta SALDO:** SMOKE-A **0**, SMOKE-B **3**.

## 4. La entrega queda auditada · HECHO el 2026-09-14

En la lista de `/pagos`, la venta en efectivo del paso 3 dice **Pagado, sin entregar** y tiene **Entregar**.

- [x] Pulsa **Entregar** y luego **Sí, lo entregué**. **Debe dar:** *Entrega registrada.* y la venta dice **Entregado el ...**.
- [x] **Consulta VENTAS:** `entrega` = `entregado`.
- [x] **Consulta ENTREGAS:** una fila, con tu correo y el `payload`:
  - `treatment_id` en `null`, porque la venta es de `/pagos`;
  - `items` con el producto y cantidad **2**;
  - **ni nombre ni documento del paciente**.
- [x] **Consulta SALDO:** sin cambios (SMOKE-A **0**, SMOKE-B **3**). **Entregar no mueve inventario**: se movió al pagar.

**Lo que salió y lo que cambió después:**

- **`treatment_id` en `null` es correcto, y está verificado en la nube:** la venta entregada es la de efectivo del paso 3, creada en `/pagos`, sin tratamiento. En el paso 6 (Tratamiento) tiene que salir con el tratamiento.
- **La hora de la entrega** ahora se ve en `/pagos` (*Entregado el 14/9/2026, 3:23:57 p. m.*), igual que en Tratamiento. Además va explícita en el `payload` como `delivered_at` (commit `3e22f6e2`). La entrega que ya hiciste no la tiene en el `payload`, porque se registró antes del cambio. **Las nuevas sí.** Se ve después del push de ese commit.

## 5. Un pago sobre un link anulado queda en revisión, sin factura

Es el cobro doble: el link se anula en Atlas, pero la página de Wompi que el paciente ya tenía abierta cobra igual.

> ### Lo que pasó el 2026-09-14, y por qué no fue un fallo de Atlas
>
> Wompi rechazó el pago con *"El monto mínimo de una transacción es $1,500 exceptuando impuestos"*. **El producto de prueba valía 1.190**, así que un cobro de **una** unidad nunca se podía pagar. Como el pago no llegó a crearse, no hubo evento. La venta quedó **anulada** (correcto: la anulaste tú) y no hay nada en revisión (también correcto).
>
> **El paso 5 de la sesión 1 sí pasó porque cobró tres unidades: 3.570**, por encima del mínimo.
>
> **Ese intento se queda como está.** En las consultas vas a ver un checkout de 1 `failed`, `anulada` = `true`, `liberado`, con su reserva liberada. No estorba y no hay que limpiarlo.

### Antes de seguir: push y deployment

Desde que paraste hay commits nuevos: la hora de la entrega y los scripts de este paso y del 6. **No traen migraciones.**

- [ ] **Push** de `main` y **deployment** de Production en **Ready**.

### 5.0 Subir el precio del producto de prueba a 11.900

En la ventana de PowerShell del smoke (ensayo y confirmación):

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-subir-precio.sql
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-subir-precio.sql --commit
```

- [ ] **Debe dar:** `Precio del producto de prueba: 11.900 (antes 1.190)` y `CONFIRMADO`.
- Las ventas ya hechas conservan su precio: quedó sellado al crearlas.
- En `/pagos`, recarga: el producto aparece a **11.900**.

### 5.1 Provocarlo

1. En `/pagos`: checkout del paciente 1000898321, **1 ×** (ahora 11.900).
2. Abre el link en otra pestaña, pulsa el botón y **deja abierta la página de Wompi** con la tarjeta **4242 4242 4242 4242** escrita (fecha futura, cualquier CVC). **No pagues todavía.**
3. Vuelve a `/pagos` y **anula** ese link (paso 2).
4. Ahora, en la pestaña de Wompi, **paga**.

- [ ] **Debe dar**, al recargar `/pagos`:
  - esa venta con **En revisión**;
  - arriba, el panel **Ventas por revisar** con *Pago sobre un link anulado* y los botones **Fue una segunda compra** y **Ya se devolvió el pago**.
- [ ] **Consulta VENTAS:** `paid`, `revision` = `pago_sobre_link_anulado`, `stock_state` = `liberado`, `factura` **vacía**.
- [ ] **Consulta SALDO:** sin cambios (SMOKE-A **0**, SMOKE-B **3**). No se descontó.
- [ ] En Sentry, un aviso *Pago aprobado sobre un link de pago anulado*.
- [ ] **Pulsa Reintentar las pendientes** (panel de facturas). **Debe dar:** la venta sigue sin factura. El botón no la toca.
- [ ] En la venta no hay botón **Entregar**: dice *Pago en revisión por CNV: no entregues el producto*.
- **Si Wompi rechaza otra vez**, copia el mensaje exacto y para: ya no sería el mínimo.

### 5.2 Salida "devuelto"

En el panel, **Ya se devolvió el pago** y luego **Sí, está devuelto**. En sandbox no hay nada que devolver de verdad.

- [ ] **Debe dar:** *Marcada como devuelta...* y la venta sale del panel.
- [ ] **Consulta VENTAS:** `status` = `refunded`, `resolucion` = `devuelto`, `factura` vacía.

### 5.3 Salida "segunda compra"

Repite **5.1** entero con **1 ×** otra vez. Esta vez, en el panel, pulsa **Fue una segunda compra** y luego **Sí, facturar**.

- [ ] **Debe dar:** *Marcada como segunda compra...*
- [ ] **Consulta VENTAS:** `resolucion` = `segunda_compra`, `stock_state` = `descontado`, y `factura` = `emitida` (sandbox).
- [ ] **Consulta SALDO:** SMOKE-A **0**, SMOKE-B **2**.
- [ ] La venta tiene ahora **Entregar**.

## 6. La venta en la pestaña Tratamiento, con Profesional Demo

**Cuándo:** después del paso 5. Este paso carga unidades en la ubicación de **Profesional Demo** y usa **su** paciente de prueba, no el 1000898321. Las ventas de los pasos anteriores siguen saliendo de la central.

### 6.1 Lo comercial, con el script

En la ventana de PowerShell del smoke (ensayo y confirmación):

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-sesion2-demo.sql
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-sesion2-demo.sql --commit
```

- [ ] **Debe dar:**
  - `Profesional Demo (nutricionista): 3 unidades de PRUEBA SMOKE BLOQUE 3 (lote SMOKE-B) cargadas en su ubicacion.`
  - `Paciente de prueba: documento ...`: **anota ese documento**;
  - una línea por evaluación de ese paciente, con lo que le falta;
  - `CONFIRMADO`.
- Si aborta con `tiene N pacientes DE PRUEBA`, avísame. Verificado en la nube: hoy tiene **uno**.

**Verificado en la nube (solo lectura, 2026-09-14):** ese paciente tiene una evaluación **en curso, sin diagnóstico ni tratamiento**. Así que la línea va a decir *SIN tratamiento*.

### 6.2 Lo clínico, en la pantalla (el script no lo hace, a propósito)

**El script no escribe diagnóstico, tratamiento, prescripción, emisión ni decisión.** Son registros clínicos, con su constelación de versiones y su auditoría. Fabricarlos por script dejaría una historia clínica que nadie hizo.

Entra como **Profesional Demo**, abre la evaluación del paciente del documento que anotaste y llévala hasta:

1. **Diagnóstico** y **tratamiento**.
2. En *Nutracéuticos recomendados*, **prescribe PRUEBA SMOKE BLOQUE 3** y guarda.
3. **Entrega la prescripción** (imprímela o envíala). Sin eso la sección de venta no aparece.
4. En *¿El paciente los adquiere?*, registra **Sí**.

### 6.3 La venta

- [ ] **Productos:**
  - la sección se llama *Venta y entrega de nutracéuticos* (ya no *Entrega de nutracéuticos*);
  - muestra PRUEBA SMOKE BLOQUE 3 a **11.900 COP · disponibles: 3**, sin nada marcado.
- [ ] **QR:**
  - marca el producto con **1** y pulsa **Cobrar con QR**. Aparecen el QR y el link copiable, con *Esperando el pago. La pantalla se actualiza sola.*;
  - **escanéalo con el teléfono** y paga con **4242**. La venta pasa a **Pago recibido** **sin recargar a mano**, en unos segundos.
- [ ] **Entrega:** pulsa **Entregar** y confirma. Debe decir **Entregado el ...** con la hora.
- [ ] **Consulta ENTREGAS:** la fila nueva trae `treatment_id` con un id (no `null`) y `delivered_at`.
- [ ] **Efectivo con link pendiente:**
  - con **1**, **Cobrar con QR** y **no lo pagues**;
  - marca otra vez **1** y pulsa **Cobrar en efectivo**. Pide confirmar lo recibido: **Sí, lo recibí**;
  - **Debe dar:** el aviso del link pendiente con **Anular el link y cobrar en efectivo**. Púlsalo: *Se anuló el link de pago pendiente*.
- [ ] **Anular desde Tratamiento:** un tercer **Cobrar con QR** con **1** y, en su tarjeta, **Anular link**. **Debe dar:** *Link anulado.*
- [ ] **Hazards de formulario:** las casillas no saltan ni se desmarcan solas al registrar, y la página no salta al inicio.
- [ ] **Consulta SALDO**, en la ubicación de Profesional Demo. Esta consulta la separa de la central:

```sql
select l.kind as ubicacion, lo.code as lote, i.stock_quantity as unidades
  from nutraceutical_inventory i
  join inventory_locations l on l.id = i.location_id
  join lots lo on lo.id = i.lot_id
  join nutraceuticals n on n.id = i.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by l.kind, lo.code;
```

  **Debe dar:** en `integrante`, SMOKE-B **1** (3 cargadas, menos la del QR pagado y la del efectivo). La central, sin cambios.

## 7. Retirar el producto de prueba y cerrar la ventana

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] **Debe dar:** `CONFIRMADO` en los dos, y `Producto de prueba retirado`.
- [ ] **Cierra la ventana de PowerShell**, o corre `Remove-Item Env:DATABASE_URL`.

**Lo que queda después de limpiar:**

- **Las filas de ENTREGAS** en la auditoría clínica. La auditoría no se borra, y eso es a propósito. Son de pacientes de prueba y del producto de prueba.
- **Las 3 unidades cargadas a Profesional Demo** en el paso 6: la limpieza borra las ventas y devuelve su saldo, pero la recepción es un movimiento inmutable. Quedan en su inventario como producto retirado, en su cuenta de pruebas.
- **La evaluación del paciente de prueba de Profesional Demo**, con la prescripción del producto de prueba. Es historia clínica de un paciente de prueba y no se borra.

---

## El mínimo de Wompi, también para producción

**Wompi no cobra por debajo de $1.500 por transacción** (soporte de Wompi: "Agregador: desde $1.500"; el mensaje dice *"exceptuando impuestos"*). No es del sandbox: aplica igual en producción.

- **Hoy no afecta a ningún producto real:** el más barato en consultorio es LUVIA, a 90.000.
- **Sí afecta** a un cobro que no llegue a 1.500, por ejemplo un producto nuevo barato o una venta con descuento. Ese cobro sale bien de Atlas y **falla dentro de la página de Wompi**, con el paciente delante. En efectivo no hay mínimo.

## Lo que este smoke NO prueba

- **Que la página de Wompi deje de cobrar a las 24 horas.** No se puede esperar un día en un smoke. Lo prueba el test de la firma, contra el ejemplo de la documentación de Wompi. El paso 1 prueba que Wompi **acepta** la firma con vencimiento.
- **El rechazo seguido de un aprobado en el mismo link.** En sandbox la 4111 no crea transacción (sesión 1). Lo prueban los tests de base real.
