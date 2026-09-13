# Smoke del Bloque 3, sesión 1: la venta mueve inventario

**Qué se prueba:** que un checkout reserve, que el pago descuente lote por lote, que un pago rechazado libere, y que una venta en efectivo sin saldo se selle igual y avise.
**Dónde:** en `atlas.cnvsystem.com`, con Wompi y Alegra en **sandbox** (como hoy).
**Con qué:** un **producto de prueba** creado para esto. Ninguna venta del smoke toca el inventario real de un Integrante, y todas las borra después la purga de ventas de prueba, con sus movimientos.
**Regla:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

Las consultas **(lectura)** se pueden correr en el editor SQL de Supabase. Los scripts `.sql` se corren con `aplicar-migracion.mjs`.

---

## 0. Antes de empezar

- [ ] **Migraciones:** aplica la `0138` y la `0139` como las anteriores (pueden ir juntas). **Debe dar:** `140` y `140`.
- [ ] **Deployment:** Production en **Ready**, con el último commit de `main` (el de la sesión 1 del Bloque 3).
- [ ] **El paciente de prueba:** uno de los dos marcados de prueba (1000898123 o 1000898321). **(lectura)** Mira si tiene Integrante asignado:

```sql
select p.document_number, count(r.*) as integrantes_asignados
  from patients p left join patient_professional_relationships r on r.patient_id = p.id
 where p.is_test group by p.document_number;
```

  Mejor uno con **0**: así el producto de prueba vive en la bodega central y ningún Integrante lo ve.

## 1. Crear el producto de prueba

1. En `scripts/smoke-bloque3-preparar.sql`, cambia `<DOCUMENTO>` por el documento del paciente de prueba.
2. Ensaya y después confirma:

```
node --env-file=.env.nube.local scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql
node --env-file=.env.nube.local scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql --commit
```

(`.env.nube.local` es cualquier archivo con el `DATABASE_URL` de la nube.)

- [ ] **Debe dar:** `Producto de prueba creado: PRUEBA SMOKE BLOQUE 3`, la ubicación (idealmente `central`) y `Lote SMOKE-A: 2 unidades. Lote SMOKE-B: 3 unidades.`

**Las cuatro consultas del smoke (lectura)**, para usar en cada paso:

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

## 2. El checkout reserva

En `/pagos`: checkout del paciente de prueba, **3 × PRUEBA SMOKE BLOQUE 3**. **No lo pagues todavía.**

- [ ] El link se genera.
- [ ] **V:** una venta `pending`, `stock_state` = `reservado`.
- [ ] **R:** SMOKE-A **2** y SMOKE-B **1**, ninguna liberada ni consumida. Sale primero el lote que vence antes.
- [ ] **S:** SMOKE-A **2** y SMOKE-B **3**. **La reserva no mueve el saldo.**

## 3. Sin existencias no hay checkout

Otro checkout, **3 × PRUEBA SMOKE BLOQUE 3**.

- [ ] **Debe dar** el error en pantalla: *Solo hay 2 unidades de "PRUEBA SMOKE BLOQUE 3" disponibles, y la venta pide 3.*
- [ ] **V:** sigue habiendo **una** sola venta.

## 4. El pago descuenta

Paga el link del paso 2 con la tarjeta de prueba **4242 4242 4242 4242** (cualquier fecha futura y cualquier CVC).

- [ ] **V:** `paid`, `stock_state` = `descontado`, `stock_last_error` vacío.
- [ ] **M:** dos movimientos `venta`: SMOKE-A **−2** y SMOKE-B **−1**.
- [ ] **S:** SMOKE-A **0** y SMOKE-B **2**.
- [ ] **R:** las dos reservas del paso 2, **consumidas**.
- [ ] La factura de sandbox sale como siempre (`alegra_invoice_state` = `emitida`). Si no, mira su motivo en `/pagos`: no es parte de este smoke, pero conviene saberlo.

## 5. Un pago rechazado libera

Checkout de **1 ×** y págalo con la tarjeta **4111 1111 1111 1111** (declina).

- [ ] **V:** la venta nueva queda `failed`, `stock_state` = `liberado`.
- [ ] **R:** su reserva, **liberada**.
- [ ] **S:** SMOKE-B sigue en **2**.

## 6. Pagada sin saldo: se sella igual y avisa

En `/pagos`, **venta en efectivo** del paciente de prueba, **4 ×** PRUEBA SMOKE BLOQUE 3. Solo hay 2.

- [ ] La venta se registra, **no se rechaza**.
- [ ] **V:** `paid`, `stock_state` = `sin_saldo`, y `stock_last_error` dice *faltaron 2*.
- [ ] **S:** SMOKE-B **0**. Se descontó lo que había, sin saldo negativo.
- [ ] **M:** un movimiento `venta` de **−2** en SMOKE-B.

## 7. Retirar el producto de prueba

```
node --env-file=.env.nube.local scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] **Debe dar:** `Producto de prueba retirado: ya no se puede vender.`
- [ ] En `/pagos` ya no aparece en la lista de productos.

Las ventas del smoke quedan en la base hasta la purga de ventas de prueba, que ya borra también sus movimientos y devuelve el saldo.

---

## Lo que este smoke NO prueba (va en la sesión 2)

- La venta desde **Tratamiento** (¿lo adquiere?, forma de entrega, QR) y la **entrega auditada**.
- Un aviso **en pantalla** de las ventas `sin_saldo` o `fallido`. Por ahora quedan en la venta y en Sentry.
- Que la sección de entrega actual siga funcionando igual: no se tocó.
