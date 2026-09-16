# Smoke del 3b, sesión 3: el cotejo con Wompi

**Qué se prueba:** que Atlas recupere un pago que Wompi aprobó y cuyo aviso no llegó. Es el hueco que vimos de verdad el 15/9: Wompi reintenta avisarnos tres veces en 24 horas y después deja de intentar, y esa venta quedaba cobrada, sin factura, sin comisión y sin que nadie se enterara.

**Dónde:** en `atlas.cnvsystem.com`, con Wompi y Alegra en **sandbox**.
**Regla:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

> Los comandos van en PowerShell. Los `.sql` **no** se pegan en el editor de Supabase.

---

## 0. La migración y el push

```powershell
$env:DATABASE_URL = "postgresql://...la de migrar, puerto 5432..."
pnpm db:check:cloud
pnpm db:migrate
pnpm db:check:cloud
```

- [ ] **Debe dar:** una pendiente, `0146_cotejo_con_wompi`, y al final `147` y `147`.

**Vercel → Settings → Environment Variables → Production:** comprueba que exista **`WOMPI_PRIVATE_KEY`** (la de sandbox, `prv_test_...`). Sin ella el cotejo no puede preguntar, y te lo va a decir en la pantalla.

Luego **push** y deployment en **Ready**.

- [ ] **Vercel → Settings → Cron Jobs:** ahora son tres. La nueva es `/api/cron/cotejo-wompi` (`0 13 * * *`, o sea 8 a. m. de Colombia).

## 1. La pantalla, sin nada que recuperar

En **/pagos**, como admin:

- [ ] Aparece el bloque **Pagos que Wompi aprobó y aquí no llegaron**, con el botón **Buscar pagos sin registrar** y la línea *Todavía no se ha hecho ninguna revisión.*
- [ ] Pulsa el botón. **Debe dar:** *Se revisaron N ventas y ninguna estaba pagada sin registrar. Todo al día.*
- [ ] La línea de abajo pasa a **Última revisión: <fecha y hora> (a mano). N ventas revisadas, 0 recuperadas.**
- [ ] Entra como **Profesional Demo**: **no** ve ese bloque. Tampoco un usuario de soporte.

## 2. El caso de verdad: un pago que Atlas no se entera

Aquí se provoca a mano lo que el 15/9 pasó solo. Prepara el producto si hace falta (paso 1 de `SMOKE_BLOQUE_A_RETOMA.md`).

1. Como **Profesional Demo**, en la pestaña **Tratamiento** de su paciente de prueba: **Cobrar con QR** de 1 unidad.
2. **Antes de pagar**, quita el aviso de Wompi para que no llegue: **Vercel → Settings → Environment Variables → Production**, edita **`WOMPI_EVENTS_SECRET`** y cámbiale un carácter. **Redeploy.**
   *Con el secreto cambiado, Atlas rechaza el aviso de Wompi por firma inválida: exactamente el efecto de un aviso que no llega.*
3. Paga el link en la página de Wompi con la tarjeta `4242 4242 4242 4242`.
4. Espera un minuto.

- [ ] En **/pagos**, la venta sigue **pendiente**: el pago no se registró. (Eso es lo que hoy quedaría así para siempre.)

Ahora **devuelve `WOMPI_EVENTS_SECRET` a su valor correcto** y vuelve a desplegar. **Este paso no se salta**, o el webhook seguirá roto para todo lo demás.

- [ ] En **/pagos**, pulsa **Buscar pagos sin registrar**. **Debe dar:** *Se recuperaron 1 pago que Wompi había aprobado. Míralos en la lista.*
- [ ] La venta pasa a **pagada**, con su factura de Alegra y el inventario descontado, igual que si el aviso hubiera llegado.
- [ ] Pulsa el botón **otra vez**. **Debe dar:** *ninguna estaba pagada sin registrar*, y la venta **no** se cobra ni se factura dos veces.
- [ ] En **Sentry** hay un aviso de nivel *warning*: *El cotejo recuperó un pago que Wompi aprobó y cuyo webhook no llegó*. Es correcto que esté: cada recuperación significa que un aviso se perdió.

## 3. La tarea programada

```powershell
$env:CRON_SECRET = "...el secreto de Vercel..."
Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/cotejo-wompi" -Headers @{ Authorization = "Bearer $env:CRON_SECRET" }
```

- [ ] **Debe dar:** `ambiente: test`, `revisadas: N`, `recuperadas: 0`, `discrepancias: 0`, `fallo:` vacío.
- [ ] **Sin el secreto** (`Invoke-RestMethod -Uri "https://atlas.cnvsystem.com/api/cron/cotejo-wompi"`). **Debe dar:** error **401**.
- [ ] En /pagos, la línea de la última revisión dice ahora **(automática)**.

## 4. Limpiar

1. Resuelve la venta recuperada como corresponda (si quedó en revisión, con **Ya se devolvió el pago**).
2. Y después:

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] `CONFIRMADO` en los dos.
- Cierra la ventana de PowerShell, o corre `Remove-Item Env:DATABASE_URL` y `Remove-Item Env:CRON_SECRET`.

---

## Dos cosas por verificar mientras haces el smoke

Salieron del sondeo y no cambian el código de esta sesión, pero deciden las siguientes:

1. **¿El listado de Wompi trae también las rechazadas y las anuladas?** En el sondeo salieron 20 transacciones y **todas** estaban aprobadas, así que no se pudo saber. Cuando pagues, **haz también un intento que falle** (Wompi sandbox rechaza con la tarjeta `4111 1111 1111 1111`) y vuelve a correr el sondeo: si la rechazada aparece en el listado, el cotejo puede detectar por esta vía un `VOIDED` sobre una venta ya pagada, que es lo que necesita la **sesión 1**.
2. **El campo `disbursement`.** Viene en cada transacción y podría traer el desembolso de esa venta, con su comisión y su retención. Si es así, nos ahorra el reporte de liquidación de Wompi para el margen. Correr el sondeo con una transacción ya desembolsada lo dirá.
