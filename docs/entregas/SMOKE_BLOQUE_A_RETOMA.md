# Retomar el smoke del Bloque A (2026-09-16)

El smoke del 15/9 se interrumpió en el paso 4 por un problema de la base, no del bloque. **Ya está resuelto** (la cadena de Vercel y el tamaño del pool). Esta guía reemplaza a los pasos 4 en adelante de `SMOKE_BLOQUE_A_AVISOS.md`, y deja lo demás igual.

**Lo que quedó bueno y no se repite:** las marcas (paso 1), la franja (paso 2) y el correo de la mañana con su `ya_enviado` y su 401 (paso 3).

**Lo que hay que rehacer:** el pago sobre el link anulado, porque el de ayer nunca llegó a registrarse. Era un pago de **Wompi en pruebas**, así que no hay dinero de por medio ni nada que recuperar.

**Regla de siempre:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

---

## 0. Que la base esté sana

Después del push del commit que habla del pool de 6.

- [ ] Abre **/pagos** como admin. **Debe dar:** carga en pocos segundos y **sin** el aviso rojo de *"Parte de esta pantalla no cargó"*.

Si el aviso sigue saliendo, para aquí y dime qué nombre aparece en Sentry.

## 1. En qué estado quedó todo

En el **editor SQL de Supabase** (esto solo lee):

```sql
select n.name, n.commercial_availability, n.unit_price,
       (select count(*) from alegra_items a where a.nutraceutical_id = n.id) as items_alegra,
       (select count(*) from transaction_items ti where ti.nutraceutical_id = n.id) as ventas
  from nutraceuticals n
 where n.name like 'PRUEBA SMOKE BLOQUE 3%'
 order by n.created_at desc;
```

- **Si sale una fila `PRUEBA SMOKE BLOQUE 3` (sin "retirado"), `en_consultorio`, precio `11900` y `items_alegra` = 1:** el producto está listo. **Sáltate el paso 2.**
- **Si no sale ninguna, o todas dicen "(retirado ...)":** hay que prepararlo. **Haz el paso 2.**
- **Si sale algo distinto** (precio diferente, `items_alegra` en 0): dímelo antes de seguir.

## 2. Preparar el producto (solo si el paso 1 lo pide)

```powershell
$env:DATABASE_URL = "postgresql://...la de migrar, puerto 5432..."
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-sesion2-demo.sql --commit
```

- [ ] **Debe dar:** `CONFIRMADO` en los dos, con el aviso de que creó el producto con sus dos lotes.

## 3. Liberar las dos franjas de hoy

El resumen sale una sola vez por día y franja. Para probar las dos hoy:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-avisos-reiniciar-hoy.sql --commit
```

- [ ] **Debe dar:** `CONFIRMADO`, con el número de envíos borrados.

## 4. El correo de la mañana, para tener contra qué comparar

```powershell
$env:CRON_SECRET = "...el secreto de Vercel..."
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/am" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

- [ ] **Debe dar:** `estado: enviado`.
- [ ] Llega el correo con la venta del **12/9** como vencida, y el escalamiento a quien tenga esa marca.
- [ ] **El orden es el nuevo:** si hubiera algo nuevo, iría **antes** de lo vencido. Con solo lo vencido, verás la sección **── VENCIDO ──**.

## 5. El pago sobre el link anulado, y el aviso al Integrante

Entra como **Profesional Demo**, en la pestaña **Tratamiento** de su paciente de prueba:

1. **Cobrar con QR** de 1 unidad.
2. Abre el link de pago y deja la página de Wompi lista con la tarjeta de prueba `4242 4242 4242 4242`.
3. Vuelve a Atlas y pulsa **Anular link**.
4. Ahora sí, paga en la página de Wompi.

- [ ] **A los pocos segundos**, en `/pagos` (como admin), en **Ventas por revisar**, aparece la venta de **11.900** con *Falta la versión del Integrante*.
- [ ] **Al correo de Profesional Demo** llega *Atlas · Un pago de tu venta necesita que nos cuentes qué pasó*, y dice que abra **la pestaña Tratamiento** (ya no "Pagos"). Trae fecha, monto y producto, **sin datos del paciente**. Si no tienes ese buzón, míralo en Resend → Emails.
- [ ] La franja de arriba pasa a **2 pendientes**.

**Si a los dos minutos no aparece en Ventas por revisar:** mira Sentry. Si hay un error con `area: wompi-webhook`, pásamelo y paramos ahí.

## 6. El correo de la tarde: solo lo nuevo

```powershell
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/pm" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

- [ ] **Debe dar:** `estado: enviado`, con el asunto *Atlas · ventas por resolver: 1 nueva (cierre del día)*.
- [ ] El cuerpo trae **── NUEVO ──** con el pago en revisión, y de lo vencido **solo** la línea *Además: 1 vencido sin resolver, que ya salió en el correo de la mañana.* La sección de vencidos **no** se repite.

## 7. "En gestión": que se cierre al guardar

En `/pagos`, sobre el pago en revisión:

- [ ] **Marcar en gestión**, nota *Esperando la versión de Profesional Demo*, fecha de **mañana**, y **Guardar**. **Debe dar:** el toast, **el formulario se cierra solo** y aparece *En gestión hasta el ... por ...*, con el botón **Actualizar la gestión**. Sin recargar la página.
- [ ] Ábrelo otra vez y prueba con la fecha de **ayer**. **Debe dar:** *La fecha no puede ser anterior a hoy.*
- [ ] La franja vuelve a **1 pendiente**: lo que está en gestión no suma.

## 8. Y sin nada nuevo, no llega correo

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-avisos-reiniciar-hoy.sql --commit
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/am" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/pm" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

- [ ] **La mañana:** `enviado`, con la vencida del 12/9 y, al final, *En gestión (no se repite hasta su fecha): 1.* El pago en revisión **no** aparece.
- [ ] **La tarde:** `estado: sin_envio`, con *Nada nuevo desde la mañana y ninguna venta de hoy sin documento.* **No** llega correo.

## 9. Soporte atiende, no resuelve (si existe un usuario de soporte)

- [ ] Ve **Pagos** y los dos paneles, y puede **Marcar en gestión**.
- [ ] **No** ve **Fue una segunda compra**, **Ya se devolvió el pago**, **Registrar la nota crédito** ni **Reintentar las pendientes**.

## 10. Limpiar

1. En `/pagos`, resuelve el pago en revisión como **Ya se devolvió el pago**: primero la versión (*Prueba del Bloque A*) y luego el comprobante `SMOKE-A`.
2. Y después:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] `CONFIRMADO` en los dos. El de limpiar dice cuántas ventas borró y cuántas unidades volvieron al saldo.
- **Deja puesta tu marca** de Pendientes de ventas si quieres seguir recibiendo los avisos, contando con que la venta del **12/9** llegará como vencida cada mañana hasta la purga.
- Cierra la ventana de PowerShell, o corre `Remove-Item Env:DATABASE_URL` y `Remove-Item Env:CRON_SECRET`.
