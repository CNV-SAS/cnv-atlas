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

## 4. La entrega queda auditada

En la lista de `/pagos`, la venta en efectivo del paso 3 dice **Pagado, sin entregar** y tiene **Entregar**.

- [ ] Pulsa **Entregar** y luego **Sí, lo entregué**. **Debe dar:** *Entrega registrada.* y la venta dice **Entregado el ...**.
- [ ] **Consulta VENTAS:** `entrega` = `entregado`.
- [ ] **Consulta ENTREGAS:** una fila, con tu correo y el `payload`:
  - `treatment_id` en `null`, porque la venta es de `/pagos`;
  - `items` con el producto y cantidad **2**;
  - **ni nombre ni documento del paciente**.
- [ ] **Consulta SALDO:** sin cambios (SMOKE-A **0**, SMOKE-B **3**). **Entregar no mueve inventario**: se movió al pagar.

## 5. Un pago sobre un link anulado queda en revisión, sin factura

Es el cobro doble: el link se anula en Atlas, pero la página de Wompi que el paciente ya tenía abierta cobra igual.

### 5.1 Provocarlo

1. En `/pagos`: checkout del paciente 1000898321, **1 ×**.
2. Abre el link en otra pestaña, pulsa el botón y **deja abierta la página de Wompi** con la tarjeta **4242 4242 4242 4242** escrita (fecha futura, cualquier CVC). **No pagues todavía.**
3. Vuelve a `/pagos` y **anula** ese link (paso 2).
4. Ahora, en la pestaña de Wompi, **paga**.

- [ ] **Debe dar**, al recargar `/pagos`:
  - esa venta con **En revisión**;
  - arriba, el panel **Ventas por revisar** con *Pago sobre un link anulado* y los botones **Fue una segunda compra** y **Ya se devolvió el pago**.
- [ ] **Consulta VENTAS:** `paid`, `revision` = `pago_sobre_link_anulado`, `stock_state` = `liberado`, `factura` **vacía**.
- [ ] **Consulta SALDO:** sin cambios (SMOKE-B **3**). No se descontó.
- [ ] En Sentry, un aviso *Pago aprobado sobre un link de pago anulado*.
- [ ] **Pulsa Reintentar las pendientes** (panel de facturas). **Debe dar:** la venta sigue sin factura. El botón no la toca.
- [ ] En la venta no hay botón **Entregar**: dice *Pago en revisión por CNV: no entregues el producto*.

### 5.2 Salida "devuelto"

En el panel, **Ya se devolvió el pago** y luego **Sí, está devuelto**. En sandbox no hay nada que devolver de verdad.

- [ ] **Debe dar:** *Marcada como devuelta...* y la venta sale del panel.
- [ ] **Consulta VENTAS:** `status` = `refunded`, `resolucion` = `devuelto`, `factura` vacía.

### 5.3 Salida "segunda compra"

Repite **5.1** entero con **1 ×** otra vez. Esta vez, en el panel, pulsa **Fue una segunda compra** y luego **Sí, facturar**.

- [ ] **Debe dar:** *Marcada como segunda compra...*
- [ ] **Consulta VENTAS:** `resolucion` = `segunda_compra`, `stock_state` = `descontado`, y `factura` = `emitida` (sandbox).
- [ ] **Consulta SALDO:** SMOKE-B **2**.
- [ ] La venta tiene ahora **Entregar**.

## 6. La venta en la pestaña Tratamiento (PENDIENTE DE LA CUENTA DE PRUEBA)

**Este paso no se puede hacer todavía, y la razón es concreta.** La sección de venta solo la ve un **profesional**, y solo en una evaluación con:
- prescripción **entregada**;
- decisión **"sí, los adquiere"**;
- y el producto de prueba **prescrito**.

Verificado en la nube, solo lectura (2026-09-14):
- **ningún administrador tiene perfil profesional**;
- el paciente de prueba 1000898321 tiene **una evaluación en curso, sin diagnóstico ni tratamiento**.

**Lo que necesito que decidas:** con qué **cuenta profesional de prueba** se hace. Con eso preparo el script, igual que el de la sesión 1, que deje la evaluación lista para vender sin tocar pacientes reales.

Lo que el paso va a comprobar, para que lo tengas a la vista:

- [ ] **Productos:** la sección *Venta y entrega de nutracéuticos* reemplaza a *Entrega de nutracéuticos*. Muestra el producto prescrito con precio y **disponibles**, sin nada marcado.
- [ ] **QR:**
  - al marcar 1 y pulsar **Cobrar con QR**, aparece el QR y el link copiable;
  - la línea dice *Esperando el pago. La pantalla se actualiza sola.*;
  - al escanearlo con el teléfono y pagar con 4242, la venta pasa a **Pago recibido** **sin recargar a mano**, en unos segundos.
- [ ] **Entrega:** **Entregar** y confirmar. En **ENTREGAS**, `treatment_id` es el del tratamiento.
- [ ] **Efectivo:** pide confirmar lo recibido. Con un link del mismo producto pendiente, sale el aviso y **Anular el link y cobrar en efectivo**.
- [ ] **Validación del servidor:** un producto que no está prescrito no se puede cobrar desde ahí.
- [ ] **Hazards de formulario:**
  - las casillas no saltan al registrar;
  - "Generar otro link de todos modos" y "Registrar de todos modos" llegan al servidor, en vez de repetir el aviso.

## 7. Retirar el producto de prueba y cerrar la ventana

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] **Debe dar:** `CONFIRMADO` en los dos, y `Producto de prueba retirado`.
- [ ] **Cierra la ventana de PowerShell**, o corre `Remove-Item Env:DATABASE_URL`.

**Lo que queda después de limpiar:** las filas de **ENTREGAS** en la auditoría clínica. La auditoría no se borra, y eso es a propósito. Son de un paciente de prueba y del producto de prueba.

---

## Lo que este smoke NO prueba

- **Que la página de Wompi deje de cobrar a las 24 horas.** No se puede esperar un día en un smoke. Lo prueba el test de la firma, contra el ejemplo de la documentación de Wompi. El paso 1 prueba que Wompi **acepta** la firma con vencimiento.
- **El rechazo seguido de un aprobado en el mismo link.** En sandbox la 4111 no crea transacción (sesión 1). Lo prueban los tests de base real.
