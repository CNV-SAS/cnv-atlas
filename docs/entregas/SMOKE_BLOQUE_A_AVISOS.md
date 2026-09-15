# Smoke del Bloque A: los avisos de ventas

**Qué se prueba:**
- las marcas de quién recibe;
- la franja en cualquier pantalla;
- el correo de la mañana y el de la tarde, que no se repiten;
- el "en gestión";
- el correo inmediato al Integrante;
- y que soporte atienda sin resolver.

**Dónde:** en `atlas.cnvsystem.com`, con Wompi y Alegra en **sandbox**.
**Regla:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

> Los comandos van en PowerShell. Los `.sql` **no** se pegan en el editor de Supabase.

---

## Antes de empezar: lo que ya hay pendiente

Hoy hay **un** pendiente real en la nube, la venta del **12/9** a un paciente real que Atlas no factura contra el sandbox. Como es del 12, está **vencida**.

**Consecuencia:** desde que las tareas programadas estén activas, **el correo de las 7 a. m. te va a llegar todos los días con esa venta como VENCIDA**, hasta que la purga de ventas de prueba la borre (después de la venta controlada del 2b). Lo vencido vuelve aunque esté "en gestión": es la regla. Si prefieres no recibirlo, dímelo y lo resolvemos antes de encender las tareas.

## 0. Migración, variable y push

1. **Migración 0145:**

```powershell
$env:DATABASE_URL = "postgresql://...la directa de la nube, puerto 5432..."
pnpm db:check:cloud
pnpm db:migrate
pnpm db:check:cloud
```

- [ ] **Debe dar:** una pendiente, `0145_avisos`, y al final `146` y `146`.

2. **Vercel → Settings → Environment Variables → Production:** crea `CRON_SECRET` con una cadena larga aleatoria. En PowerShell sale una con:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

   Guárdala en Bitwarden: la vas a usar abajo.

3. **Push** de `main` y deployment en **Ready**.

- [ ] **Vercel → Settings → Cron Jobs:** aparecen dos, `/api/cron/avisos/am` (`0 12 * * *`) y `/api/cron/avisos/pm` (`0 22 * * *`).

## 1. Las marcas

En **Administración**, sección **Avisos de ventas**:

- [ ] Aparecen los usuarios con rol admin, dirección o soporte, cada uno con **Pendientes de ventas: no** y **Escalamiento: no**. Debajo: *Nadie recibe los pendientes de ventas.*
- [ ] Antes de poner ninguna marca, arriba de cualquier pantalla ves la franja roja *Nadie recibe los avisos de ventas. Pon la marca a alguien · hay 1 pendiente*.
- [ ] Pon **Pendientes de ventas: sí** en tu usuario. **Debe dar:** *Guardado.* y la franja cambia.
- [ ] Si hay otro usuario interno, pon **Escalamiento: sí** en él. Si solo estás tú, ponlo en tu usuario: el escalamiento no te llega dos veces (se quita a quien ya recibió el resumen).

## 2. La franja

- [ ] En cualquier pantalla (por ejemplo, **Pacientes**), arriba: *1 pendiente de ventas necesita acción (1 vencido). Ver en Pagos*, en rojo porque hay un vencido.
- [ ] **Ver en Pagos** lleva a `/pagos`.
- [ ] Entra como **Profesional Demo**: **no** ve la franja.

## 3. El correo de la mañana, y que no se repite

En PowerShell, con el secreto del paso 0:

```powershell
$env:CRON_SECRET = "...el secreto..."
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/am" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

- [ ] **Debe dar:** `estado: enviado`, `destinatarios: 1`.
- [ ] **Te llega un correo** con el asunto *Atlas · ventas por resolver: 1 vencida*. (Si hay más pendientes en la nube, el asunto los suma: *1 nueva, 1 vencida...*. Lo nuevo va siempre primero.) El cuerpo:
  - una sección **── VENCIDO ──** con *Ventas cobradas sin factura o sin pago registrado · 1 venta:* y el mismo motivo que muestra Pagos para esa venta;
  - debajo, la línea con el monto, el producto, *lleva N días* y *venció el 12/9/2026*;
  - el enlace a Pagos;
  - **ni nombre ni documento de paciente**.
- [ ] Si pusiste **Escalamiento** en otro usuario, a esa persona le llega *Atlas · ESCALAMIENTO: 1 pendiente de ventas vencido*.
- [ ] **El mismo comando otra vez.** **Debe dar:** `estado: ya_enviado`, y **no** llega otro correo.
- [ ] **Sin el secreto** (`Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/am"`). **Debe dar:** error **401**.

## 4. El aviso al Integrante y lo nuevo en la tarde

Prepara el producto de prueba (y súbele el precio si hace falta):

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-preparar.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-sesion2-demo.sql --commit
```

Como **Profesional Demo**, en la pestaña Tratamiento de su paciente de prueba, provoca un pago sobre un link anulado:

1. **Cobrar con QR** de 1 unidad.
2. Abre el link y deja la página de Wompi con la 4242.
3. **Anular link**.
4. Paga en la página de Wompi.

- [ ] **Al correo de Profesional Demo** llega *Atlas · Un pago de tu venta necesita que nos cuentes qué pasó*. Trae la fecha, el monto y el producto, y le dice que abra **la pestaña Tratamiento** de ese paciente y use *Cuéntale a CNV qué pasó en la consulta*. **Sin datos del paciente.** (Si no tienes acceso a ese buzón, míralo en Resend → Emails.)
- [ ] La franja (en tu usuario) pasa a *2 pendientes de ventas necesitan acción (1 vencido)*.

Ahora la tarde:

```powershell
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/pm" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

- [ ] **Debe dar:** `estado: enviado`. Asunto: *Atlas · ventas por resolver: 1 nueva (cierre del día)*.
- [ ] El correo trae la sección **── NUEVO ──** con el pago en revisión (*Falta la versión del Integrante*). La venta del 12/9 **no** se repite como sección: solo la línea *Además: 1 vencido sin resolver, que ya salió en el correo de la mañana.*

## 5. "En gestión", y que sin nada nuevo no llega correo

En `/pagos`:

- [ ] En el pago en revisión, **Marcar en gestión**, con la nota *Esperando la versión de Profesional Demo* y la fecha de **mañana**. **Debe dar:** *Marcado en gestión...* y la línea *En gestión hasta el ... por ...: Esperando la versión...*.
- [ ] Con una fecha de **ayer**. **Debe dar:** *La fecha no puede ser anterior a hoy.*
- [ ] La franja vuelve a *1 pendiente... (1 vencido)*: lo que está en gestión no suma.

Para repetir las dos franjas hoy, borra el registro de envíos de hoy (solo toca esa tabla y solo el día de hoy):

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-avisos-reiniciar-hoy.sql --commit
```

Y corre las dos:

```powershell
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/am" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/avisos/pm" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

- [ ] **La mañana:** `enviado`. El correo trae **solo la VENCIDA** (la del 12/9) y al final *En gestión (no se repite hasta su fecha): 1.* El pago en revisión **no** aparece.
- [ ] **La tarde:** `estado: sin_envio`, con *Nada nuevo desde la mañana y ninguna venta de hoy sin documento.* **No** llega correo.

## 6. Soporte atiende, no resuelve (si hay un usuario de soporte)

Entra con un usuario de **soporte**:

- [ ] Ve **Pagos** en el menú y los paneles **Ventas por revisar** y **Ventas cobradas sin cerrar**.
- [ ] Puede **Marcar en gestión**.
- [ ] **No** ve **Fue una segunda compra**, **Ya se devolvió el pago**, **Registrar la nota crédito** ni **Reintentar las pendientes**.

## 7. Limpiar

1. Resuelve el pago en revisión como **Ya se devolvió el pago**: primero la versión (*Prueba del Bloque A*) y el comprobante `SMOKE-A`.
2. Luego:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] `CONFIRMADO` en los dos.
- **Deja tu marca de Pendientes de ventas puesta** si quieres recibir los avisos desde mañana, con la advertencia del principio sobre la venta del 12/9.
- Cierra la ventana de PowerShell, o corre `Remove-Item Env:DATABASE_URL` y `Remove-Item Env:CRON_SECRET`.
