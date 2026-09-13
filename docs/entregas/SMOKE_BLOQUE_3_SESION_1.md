# Smoke del Bloque 3, sesión 1: la venta mueve inventario

**Qué se prueba:** que un checkout reserve, que el pago descuente lote por lote, que un pago rechazado libere, y que una venta en efectivo sin saldo se selle igual y avise.
**Dónde:** en `atlas.cnvsystem.com`, con Wompi y Alegra en **sandbox** (como hoy).
**Con qué:** un **producto de prueba** en la bodega central y el paciente de prueba **1000898321**, sin Integrante. Ninguna venta del smoke toca el inventario ni la comisión de un Integrante real, y la purga de ventas de prueba las borra después, con sus movimientos.
**Regla:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

> ### ⚠ Dos cosas antes de correr cualquier comando
>
> **1. Los archivos `.sql` NO se pegan en el editor SQL de Supabase.** El editor no sostiene la transacción: un script partido o con su `commit` suelto puede aplicar la mitad y decir "success". Se corren **siempre** con `node scripts/aplicar-migracion.mjs`, como está escrito abajo. En el editor de Supabase solo van las consultas marcadas **(lectura)**.
>
> **2. Usa una ventana de PowerShell SOLO para esto, y ciérrala al terminar.** `$env:DATABASE_URL` queda puesto en esa ventana y **gana sobre `.env.local`**: un `pnpm dev`, un `pnpm db:check`, un `pnpm db:seed` o los tests corridos en esa misma ventana apuntarían a la base de la nube. Si no quieres cerrarla, al final corre `Remove-Item Env:DATABASE_URL`.

---

## 0. Antes de empezar

- [ ] **Migraciones:** `140` y `140` (hecho).
- [ ] **Deployment:** Production en **Ready**, con el último commit de `main`.
- [ ] **Abre una ventana nueva de PowerShell** en la carpeta del proyecto y pon la base de la nube:

```powershell
$env:DATABASE_URL = "postgresql://...la de la nube..."
```

- [ ] **Quién crea los checkouts.** La venta sale de la ubicación del profesional que la crea, y si quien la crea no es profesional, de la del paciente. **(lectura)** Si tu usuario administrador tiene perfil profesional **con ubicación propia**, la venta saldría de ahí y no de la central:

```sql
select pr.email, pr.full_name, l.kind as ubicacion_propia
  from profiles pr
  join user_roles ur on ur.user_id = pr.id
  join roles r on r.id = ur.role_id and r.name = 'admin'
  join professional_profiles pp on pp.profile_id = pr.id
  left join inventory_locations l on l.professional_id = pp.id and l.is_active;
```

  **Debe dar:** tu usuario **no aparece**, o aparece con `ubicacion_propia` vacía. Si aparece con una ubicación, avísame antes de seguir.

## 1. Dejar al paciente 1000898321 sin Integrante

Primero el ensayo, que no deja nada:

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

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql --commit
```

(El primero ensaya y el segundo confirma. No hay nada que editar: el paciente ya está escrito en el script.)

- [ ] **Debe dar:** `Producto de prueba creado: PRUEBA SMOKE BLOQUE 3`, `Ubicacion: ... (central)`, `Lote SMOKE-A: 2 unidades. Lote SMOKE-B: 3 unidades.` y `CONFIRMADO`.
- Si dice `todavia tiene Integrante asignado`, el paso 1 no se confirmó.

**Las cuatro consultas del smoke (lectura, en el editor de Supabase)**, para usar en cada paso:

```sql
-- V · las ventas del producto de prueba
select t.created_at, t.status, t.stock_state, t.stock_last_error, t.alegra_invoice_state, ti.quantity
  from transactions t
  join transaction_items ti on ti.transaction_id = t.id
  join nutraceuticals n on n.id = ti.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by t.created_at;

-- S · el saldo por lote
select l.code, i.stock_quantity
  from nutraceutical_inventory i join lots l on l.id = i.lot_id join nutraceuticals n on n.id = i.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by l.code;

-- R · las reservas
select l.code, r.quantity, r.released_at is not null as liberada, r.consumed_at is not null as consumida
  from inventory_reservations r join lots l on l.id = r.lot_id join nutraceuticals n on n.id = r.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by r.created_at, l.code;

-- M · los movimientos
select l.code, m.type, m.delta
  from nutraceutical_stock_movements m join lots l on l.id = m.lot_id join nutraceuticals n on n.id = m.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3' order by m.created_at, l.code;
```

## 3. El checkout reserva

En `/pagos`: checkout del paciente **1000898321**, **3 × PRUEBA SMOKE BLOQUE 3**. **No lo pagues todavía.**

- [ ] El link se genera.
- [ ] **V:** una venta `pending`, `stock_state` = `reservado`.
- [ ] **R:** SMOKE-A **2** y SMOKE-B **1**, ninguna liberada ni consumida. Sale primero el lote que vence antes.
- [ ] **S:** SMOKE-A **2** y SMOKE-B **3**. **La reserva no mueve el saldo.**

## 4. Sin existencias no hay checkout

Otro checkout del mismo paciente, **3 × PRUEBA SMOKE BLOQUE 3**.

- [ ] **Debe dar** el error en pantalla: *Solo hay 2 unidades de "PRUEBA SMOKE BLOQUE 3" disponibles, y la venta pide 3.*
- [ ] **V:** sigue habiendo **una** sola venta.

## 5. El pago descuenta

Paga el link del paso 3 con la tarjeta de prueba **4242 4242 4242 4242** (cualquier fecha futura y cualquier CVC).

- [ ] **V:** `paid`, `stock_state` = `descontado`, `stock_last_error` vacío.
- [ ] **M:** dos movimientos `venta`: SMOKE-A **−2** y SMOKE-B **−1**.
- [ ] **S:** SMOKE-A **0** y SMOKE-B **2**.
- [ ] **R:** las dos reservas del paso 3, **consumidas**.
- [ ] La factura de sandbox sale como siempre (`alegra_invoice_state` = `emitida`). Si no, mira su motivo en `/pagos`: no es parte de este smoke, pero conviene saberlo.

## 6. Un pago rechazado libera

Checkout de **1 ×** y págalo con la tarjeta **4111 1111 1111 1111** (declina).

- [ ] **V:** la venta nueva queda `failed`, `stock_state` = `liberado`.
- [ ] **R:** su reserva, **liberada**.
- [ ] **S:** SMOKE-B sigue en **2**.

## 7. Pagada sin saldo: se sella igual y avisa

En `/pagos`, **venta en efectivo** del paciente 1000898321, **4 ×** PRUEBA SMOKE BLOQUE 3. Solo hay 2.

- [ ] La venta se registra, **no se rechaza**.
- [ ] **V:** `paid`, `stock_state` = `sin_saldo`, y `stock_last_error` dice *faltaron 2*.
- [ ] **S:** SMOKE-B **0**. Se descontó lo que había, sin saldo negativo.
- [ ] **M:** un movimiento `venta` de **−2** en SMOKE-B.

## 8. Retirar el producto de prueba y cerrar la ventana

En la misma ventana de PowerShell:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] **Debe dar:** `Producto de prueba retirado: ya no se puede vender.` y `CONFIRMADO`.
- [ ] En `/pagos` ya no aparece en la lista de productos.
- [ ] **Cierra la ventana de PowerShell**, o corre `Remove-Item Env:DATABASE_URL`.

Las ventas del smoke quedan en la base hasta la purga de ventas de prueba, que ya borra también sus movimientos y devuelve el saldo.

---

## Lo que este smoke NO prueba (va en la sesión 2)

- La venta desde **Tratamiento** (¿lo adquiere?, forma de entrega, QR) y la **entrega auditada**.
- Un aviso **en pantalla** de las ventas `sin_saldo` o `fallido`. Por ahora quedan en la venta y en Sentry.
- Que la sección de entrega actual siga funcionando igual: no se tocó.
