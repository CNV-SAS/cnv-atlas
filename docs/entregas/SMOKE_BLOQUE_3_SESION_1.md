# Smoke del Bloque 3, sesión 1: la venta mueve inventario

**Qué se prueba:** que un checkout reserve unidades, que el pago las descuente lote por lote, que un pago rechazado las libere, que una venta en efectivo sin saldo se registre igual y avise, y que "Generar de todos modos" genere.
**Dónde:** en `atlas.cnvsystem.com`, con Wompi y Alegra en **sandbox** (como hoy).
**Con qué:** un **producto de prueba** en la bodega central y el paciente de prueba **1000898321**, sin Integrante. Ninguna venta del smoke toca el inventario ni la comisión de un Integrante real, y la purga de ventas de prueba las borra después, con sus movimientos.
**Regla:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

> ### ⚠ Dónde se corre cada cosa
>
> **Los comandos `node scripts/...` van en PowerShell.** Los archivos `.sql` **NO se pegan en el editor SQL de Supabase**: el editor no sostiene la transacción, y un script partido o con su `commit` suelto puede aplicar la mitad y decir "success".
>
> **Las cuatro consultas de revisión** (VENTAS, SALDO, RESERVAS y MOVIMIENTOS, más abajo) **van en el editor SQL de Supabase**, no en la terminal. Solo leen.
>
> **Usa una ventana de PowerShell SOLO para esto, y ciérrala al terminar.** `$env:DATABASE_URL` queda puesto en esa ventana y **gana sobre `.env.local`**: un `pnpm dev`, un `pnpm db:check`, un `pnpm db:seed` o los tests corridos en esa misma ventana apuntarían a la base de la nube. Si no quieres cerrarla, al final corre `Remove-Item Env:DATABASE_URL`.

---

## Si ya empezaste y paraste en el paso 3 (2026-09-13)

El botón "Generar de todos modos" no generaba. Está arreglado en el commit `0049fb1b`.

1. **Push y deployment** con `0049fb1b` o posterior, en **Ready**.
2. **No repitas los pasos 1 y 2:** el paciente ya está sin Integrante y el producto ya existe.
3. **Sigue desde el paso 3**, que empieza dejando limpio lo que se haya creado antes.

---

## 0. Antes de empezar

- [ ] **Migraciones:** `140` y `140` (hecho).
- [ ] **Deployment:** Production en **Ready**, con el último commit de `main`.
- [ ] **Abre una ventana nueva de PowerShell** en la carpeta del proyecto y pon la base de la nube:

```powershell
$env:DATABASE_URL = "postgresql://...la de la nube..."
```

- [ ] **Quién crea los checkouts.** La venta sale de la ubicación del profesional que la crea; si quien la crea no es profesional, de la del paciente. Esta consulta (editor de Supabase) dice si tu usuario administrador tiene ubicación propia:

```sql
select pr.email, pr.full_name, l.kind as ubicacion_propia
  from profiles pr
  join user_roles ur on ur.user_id = pr.id
  join roles r on r.id = ur.role_id and r.name = 'admin'
  join professional_profiles pp on pp.profile_id = pr.id
  left join inventory_locations l on l.professional_id = pp.id and l.is_active;
```

  **Debe dar:** vacía, o tu usuario con `ubicacion_propia` vacía. **Vacía (lo que dio el 2026-09-13) es correcto:** ningún administrador tiene perfil profesional, así que los checkouts que crees desde tu cuenta de administrador salen de la ubicación del paciente, y con el 1000898321 sin Integrante, de la bodega central.

## 1. Dejar al paciente 1000898321 sin Integrante

En PowerShell, primero el ensayo, que no deja nada:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-desasignar-paciente.sql
```

- [ ] **Debe dar:** `Base:` con el host de la **nube** (no `127.0.0.1`), el aviso `se quito su relacion con <nombre del Integrante>`, `SIN ERRORES` y `Revirtiendo: esto fue un ENSAYO`.

Si cuadra, el mismo comando con `--commit`:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-desasignar-paciente.sql --commit
```

- [ ] **Debe dar:** `CONFIRMADO`. Ese Integrante deja de ver la historia del paciente de prueba; es lo esperado.

## 2. Crear el producto de prueba

En PowerShell (el primero ensaya y el segundo confirma; no hay nada que editar):

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql --commit
```

- [ ] **Debe dar:** `Producto de prueba creado: PRUEBA SMOKE BLOQUE 3`, `Ubicacion: ... (central)`, `Lote SMOKE-A: 2 unidades (vence primero). Lote SMOKE-B: 3 unidades.` y `CONFIRMADO`.
- Si dice `todavia tiene Integrante asignado`, el paso 1 no se confirmó.

**Qué son SMOKE-A y SMOKE-B.** Son los dos **lotes** del producto de prueba, que el script crea con fechas de vencimiento distintas:

| Lote | Unidades | Vence |
|---|---|---|
| **SMOKE-A** | 2 | en 90 días (**antes**) |
| **SMOKE-B** | 3 | en 180 días |

**Por qué dos:** la regla es que sale primero lo que vence primero, y una venta puede tomar de varios lotes. Con un solo lote no se vería ninguna de las dos cosas. Por eso una venta de 3 tiene que tomar las 2 de SMOKE-A y 1 de SMOKE-B.

### Las cuatro consultas de revisión (en el editor SQL de Supabase)

Cada paso dice cuál correr. Guárdalas en el editor para no volver a pegarlas.

**Consulta VENTAS**: las ventas del producto de prueba, en orden:

```sql
select t.created_at, t.status, t.stock_state, t.stock_last_error, t.alegra_invoice_state, ti.quantity
  from transactions t
  join transaction_items ti on ti.transaction_id = t.id
  join nutraceuticals n on n.id = ti.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by t.created_at;
```

**Consulta SALDO**: cuántas unidades hay en cada lote:

```sql
select l.code as lote, i.stock_quantity as unidades
  from nutraceutical_inventory i join lots l on l.id = i.lot_id join nutraceuticals n on n.id = i.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by l.code;
```

**Consulta RESERVAS**: qué unidades están apartadas por un checkout sin pagar:

```sql
select l.code as lote, r.quantity as unidades, r.released_at is not null as liberada, r.consumed_at is not null as consumida
  from inventory_reservations r join lots l on l.id = r.lot_id join nutraceuticals n on n.id = r.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by r.created_at, l.code;
```

**Consulta MOVIMIENTOS**: las entradas y salidas de inventario del producto:

```sql
select l.code as lote, m.type as tipo, m.delta as cambio
  from nutraceutical_stock_movements m join lots l on l.id = m.lot_id join nutraceuticals n on n.id = m.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by m.created_at, l.code;
```

## 3. El checkout reserva

### 3.0 Primero, dejarlo limpio

Si antes de este paso ya se creó algún checkout o venta del producto de prueba (un intento de más, un paso repetido, un smoke anterior), bórralos. **Si no hay nada, no pasa nada**: el script lo dice y no toca nada. Se puede correr cada vez que haga falta volver a empezar desde aquí.

En PowerShell, ensayo y después confirmación:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
```

- [ ] **Debe dar:** `Ventas del producto de prueba a borrar: N` (con su detalle por estado), `Reservas liberadas: M`, `Saldo que queda: ... lote SMOKE-A = 2` y `... lote SMOKE-B = 3`, y `CONFIRMADO`.
- Libera las reservas **antes** de borrar las ventas: una reserva que sobreviviera a su venta seguiría restando unidades disponibles.
- Solo toca ventas del producto de prueba, de pacientes de prueba y de sandbox. Si encuentra otra cosa, aborta sin tocar nada.
- [ ] **Consulta VENTAS:** vacía. **Consulta RESERVAS:** vacía. **Consulta SALDO:** SMOKE-A **2** y SMOKE-B **3**.

### 3.1 Crear el checkout

En `/pagos`: checkout del paciente **1000898321**, **3 × PRUEBA SMOKE BLOQUE 3**. **No lo pagues todavía.**

- [ ] El link se genera.
- [ ] **Consulta VENTAS:** una venta `pending`, `stock_state` = `reservado`.
- [ ] **Consulta RESERVAS:** SMOKE-A **2** y SMOKE-B **1**, ninguna liberada ni consumida. Salió primero el lote que vence antes.
- [ ] **Consulta SALDO:** SMOKE-A **2** y SMOKE-B **3**. **Reservar no descuenta:** las unidades siguen en la bodega hasta que se pague.

**Si hubo más de un intento sin limpiar**, las cifras de RESERVAS son otras y pueden estar bien. Lo que tiene que cumplirse:

- **Cada checkout toma primero lo que queda en SMOKE-A**, y solo pasa a SMOKE-B cuando A ya no alcanza.
- **La suma de todas las reservas vivas no pasa de 5**, las unidades que hay.

Ejemplo real del 2026-09-13: un checkout de 1 y otro de 3 dieron SMOKE-A **1**, SMOKE-A **1** y SMOKE-B **2**. El primero tomó 1 de A. El segundo tomó la última de A y 2 de B, porque A ya no daba para más. Son 4 de 5, y es correcto. Para seguir el recorrido con las cifras de esta guía, vuelve a **3.0**.

## 4. El aviso de duplicado ya no bloquea, y sin existencias no hay checkout

Otro checkout del **mismo** paciente, **3 × PRUEBA SMOKE BLOQUE 3**.

- [ ] Sale el aviso: *Este paciente ya tiene un cobro pendiente de PRUEBA SMOKE BLOQUE 3...* Es correcto: el del paso 3 sigue sin pagar.
- [ ] Pulsa **Generar de todos modos**. **Ahora sí llega al servidor:** en vez de repetir el aviso, tiene que responder el error de existencias: *Solo hay 2 unidades de "PRUEBA SMOKE BLOQUE 3" disponibles, y la venta pide 3.*
- [ ] **Consulta VENTAS:** sigue habiendo **una** sola venta.
- Si vuelve a salir el mismo aviso de duplicado, el deployment no tiene el arreglo: para.

## 5. El pago descuenta

Paga el link del paso 3 con la tarjeta de prueba **4242 4242 4242 4242** (cualquier fecha futura y cualquier CVC).

- [ ] **Consulta VENTAS:** `paid`, `stock_state` = `descontado`, `stock_last_error` vacío.
- [ ] **Consulta MOVIMIENTOS:** además de las dos recepciones iniciales, dos movimientos `venta`: SMOKE-A **−2** y SMOKE-B **−1**.
- [ ] **Consulta SALDO:** SMOKE-A **0** y SMOKE-B **2**.
- [ ] **Consulta RESERVAS:** las dos reservas del paso 3, **consumidas**.
- [ ] La factura de sandbox sale como siempre (`alegra_invoice_state` = `emitida` en la consulta VENTAS). Si no, mira su motivo en `/pagos`: no es parte de este smoke, pero conviene saberlo.

## 6. Un pago rechazado libera

Checkout de **1 ×** y págalo con la tarjeta **4111 1111 1111 1111** (declina).

- [ ] **Consulta VENTAS:** la venta nueva queda `failed`, `stock_state` = `liberado`.
- [ ] **Consulta RESERVAS:** su reserva, **liberada**.
- [ ] **Consulta SALDO:** SMOKE-B sigue en **2**.

## 7. Pagada sin saldo: se registra igual y avisa

En `/pagos`, **venta en efectivo** del paciente 1000898321, **4 ×** PRUEBA SMOKE BLOQUE 3. Solo hay 2.

- [ ] La venta se registra, **no se rechaza**.
- [ ] **Consulta VENTAS:** `paid`, `stock_state` = `sin_saldo`, y `stock_last_error` dice *faltaron 2*.
- [ ] **Consulta SALDO:** SMOKE-B **0**. Se descontó lo que había, sin saldo negativo.
- [ ] **Consulta MOVIMIENTOS:** un movimiento `venta` de **−2** en SMOKE-B.

## 8. Retirar el producto de prueba y cerrar la ventana

En la misma ventana de PowerShell:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] **Debe dar:** `Producto de prueba retirado: ya no se puede vender.` y `CONFIRMADO`.
- [ ] En `/pagos` ya no aparece en la lista de productos.
- [ ] **Cierra la ventana de PowerShell**, o corre `Remove-Item Env:DATABASE_URL`.

Las ventas del smoke quedan en la base hasta la purga de ventas de prueba, que ya borra también sus movimientos y devuelve el saldo. Si prefieres no dejarlas, corre el paso **3.0** antes de retirar el producto: hace lo mismo, solo para el producto de prueba.

---

## Si la factura no vuelve: lo que pasó en el paso 5 (2026-09-14)

Al pagar el paso 5, Alegra **sí** emitió la factura **SETP990214715** (id interno **16**), pero tardó más de lo que Atlas esperaba: la venta quedó `fallida`, sin número, y el pago no se registró ("por cobrar" en Alegra). **Reintentar habría emitido una segunda factura.** Mientras no esté hecho lo de abajo: **no pulses Reintentar**, que reintenta **todas** las ventas pendientes, y **no limpies** esa venta con el paso 3.0.

En Alegra también vas a ver **SETP990214717**, del mismo paciente, por 1.190 y emitida el 14: **la emití yo** para comprobar qué campo sale impreso en la factura. No es un duplicado ni es de este smoke.

**Para cerrarla** (necesita el arreglo `05e274bf` desplegado):

1. **Push y deployment** con `05e274bf` o posterior, en **Ready**.
2. En la ventana de PowerShell, además de `$env:DATABASE_URL`, pon las credenciales del **sandbox** de Alegra (las mismas de `.env.local`):

```powershell
$env:ALEGRA_EMAIL    = "...el del sandbox..."
$env:ALEGRA_API_KEY  = "...el del sandbox..."
$env:ALEGRA_BASE_URL = "...la del sandbox..."
```

3. Asocia la venta con la factura SETP990214715. Primero el ensayo:

```powershell
node scripts/adoptar-factura-alegra.mjs --numero SETP990214715
```

   **Debe dar:** `Alegra: ... (sandbox)`, las seis comprobaciones en `ok` (ambiente, cliente, total, fecha, líneas, estado) y `UNA venta cumple todo`. Si alguna sale `[X]`, para y avísame.

```powershell
node scripts/adoptar-factura-alegra.mjs --numero SETP990214715 --commit
```

   **Debe dar:** `CONFIRMADO: la venta ... queda con la factura SETP990214715.`

4. **Si en el paso 7 pasó lo mismo** (la venta en efectivo quedó `fallida` con tiempo agotado), busca su factura en Alegra y haz lo mismo con su número (`--numero SETP...`) **antes** de seguir.
5. **Ahora sí, Reintentar** en `/pagos`.
6. **Consulta VENTAS:** la venta del paso 5 queda con `alegra_invoice_state` = `emitida`. En Alegra, la **SETP990214715** pasa a **pagada** (saldo 0) y **no aparece una factura nueva** de esa venta.

## Lo que este smoke NO prueba (va en la sesión 2)

- La venta desde **Tratamiento** (¿lo adquiere?, forma de entrega, QR) y la **entrega auditada**.
- Un aviso **en pantalla** de las ventas `sin_saldo` o `fallido`. Por ahora quedan en la venta y en Sentry.
- "Confirmar el cargo" / "Rechazar" de un **faltante**, que tenía el mismo defecto del botón y quedó arreglado por la misma vía. No hay conteos corriendo, así que no se puede probar hoy.
