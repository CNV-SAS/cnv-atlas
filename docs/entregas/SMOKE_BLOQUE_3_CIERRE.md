# Smoke de cierre del Bloque 3: reparto en la línea, reporte por día y mapa de ítems

**Qué se prueba:** los pasos 5, 6 y 8 del 3.4. El paso 7 (titular de marca en la factura) va aparte, abajo, porque no se puede probar con el producto de prueba.
**Dónde:** en `atlas.cnvsystem.com`, con Wompi y Alegra en **sandbox**.
**Regla:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

> Los comandos van en PowerShell. Los `.sql` **no** se pegan en el editor de Supabase. Las consultas de revisión sí van en el editor, y solo leen.

---

## 0. Migraciones, push y producto de prueba

Trae **dos** migraciones: `0143` (reparto en la línea) y `0144` (mapa de ítems por ambiente).

```powershell
$env:DATABASE_URL = "postgresql://...la directa de la nube, puerto 5432..."
pnpm db:check:cloud
pnpm db:migrate
pnpm db:check:cloud
```

- [ ] **Debe dar:** dos pendientes, y al final `145` y `145`, al día.
- [ ] **Push** de `main` y deployment en **Ready**.

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql --commit
```

- [ ] **Debe dar:** `Producto de prueba creado` y `CONFIRMADO`. El item del sandbox ahora va al mapa nuevo (`alegra_items`).

## 1. El mapa de ítems por ambiente (paso 8)

Solo el ensayo, **sin** `--commit`:

```powershell
node scripts/aplicar-migracion.mjs scripts/vuelta-atras-alegra-sandbox.sql
```

- [ ] **Debe dar:** `Items del sandbox: CURCUMIN BIOACTIV -> 2, D3-K2 OSTEO -> 3, LUVIA -> 4, MULTI-CELL BASE -> 5, OMEGA COMPLEX -> 6`, `SIN ERRORES` y `Revirtiendo`. La 0144 copió el mapa de hoy tal cual.

## 2. El reparto sellado en la línea (paso 5)

En `/pagos`, **venta en efectivo** del paciente 1000898321, **1 × PRUEBA SMOKE BLOQUE 3** (11.900).

- [ ] La venta se registra, y su factura de sandbox sale **emitida**. Eso confirma que la factura encontró el item en el mapa nuevo.
- [ ] **Consulta** (editor de Supabase):

```sql
select ti.vat_rate, ti.commission_rate, ti.supplier_share, ti.modality,
       ti.base_amount, ti.commission_amount, ti.supplier_amount, ti.cnv_amount, ti.sealed_at is not null as sellada
  from transaction_items ti
  join nutraceuticals n on n.id = ti.nutraceutical_id
 where n.name = 'PRUEBA SMOKE BLOQUE 3'
 order by ti.sealed_at desc nulls last limit 1;
```

- [ ] **Debe dar:**
  - `vat_rate` **0.19**;
  - `commission_rate` **0**, porque el paciente no tiene Integrante y la venta la hace un administrador;
  - `supplier_share` **0**, porque es un producto propio;
  - `modality` **comision**;
  - `base_amount` **10000**, `commission_amount` **0**, `supplier_amount` **0**, `cnv_amount` **10000**;
  - `sellada` **true**.
- La parte del proveedor (LUVIA: 52.941 de 75.630) y la comisión con vigencia las prueban los tests de base real. En el smoke no se pueden: el único producto de tercero es LUVIA, que es inventario real, y un producto de prueba **no puede** ser de tercero (lo impide la base desde la 0121).

## 3. El reporte por día (paso 6)

En `/pagos`, panel **Ventas cobradas sin cerrar en contabilidad**:

- [ ] Debajo del campo **Día** aparece la línea *Días con ventas sin cerrar (últimos 30)* con cada día y su número, o no aparece si todo está en cero.
- [ ] Elige un día de esa lista y pulsa **Ver ese día**. **Debe dar:** solo las ventas de ese día, con *... cobradas el dd/mm/aaaa con la factura o el pago sin completar.*
- [ ] Elige **hoy**. Si la venta del paso 2 quedó facturada y con pago, **Debe dar:** *Ninguna del dd/mm/aaaa. Ese día quedó en cero.*
- [ ] **Ver todas** vuelve al total.

## 4. Limpiar

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] **Debe dar:** `CONFIRMADO` en los dos. El retiro también quita el item del mapa.
- [ ] Cierra la ventana de PowerShell.

---

## El titular de marca en la factura (paso 7): cómo se prueba

Lo que Atlas manda está probado: la línea de un producto de tercero viaja con `description: "Titular de marca: ..."`, y un tercero sin titular no se factura. **Lo que no está probado es si Alegra imprime esa descripción en el PDF.** Su documentación dice que el campo es "Descripción del producto/servicio" y no dice si sale impreso.

No se puede probar con el producto de prueba (no puede ser de tercero), y vender LUVIA en el smoke movería inventario real. Queda una vía, **que necesita tu permiso**, porque escribe en el sandbox de Alegra:

- **Yo emito UNA factura en el sandbox** para el contacto de prueba, con el item PRUEBA y la descripción *"Titular de marca: TITULAR DE PRUEBA S.A.S."*. Tú abres su PDF y miras si la línea la muestra. Es lo mismo que se hizo para comprobar qué campo se imprime (SETP990214717).
- **Si no la imprime,** hay que usar otro campo, y lo averiguamos con esa misma factura.
