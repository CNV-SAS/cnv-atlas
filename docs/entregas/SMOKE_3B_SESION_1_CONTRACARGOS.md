# Smoke del 3b, sesión 1: contracargos y anulaciones

**Qué se prueba:** que Atlas registre un contracargo, no toque el ingreso mientras la disputa viva, lo revierta solo al perderla, y que una anulación de Wompi sobre una venta ya pagada deje de pasar en silencio.

**Dónde:** en `atlas.cnvsystem.com`, con Wompi y Alegra en **sandbox**.
**Regla:** si un paso no da lo que dice **Debe dar**, para y avísame con lo que salió.

---

## 0. La migración y el push

```powershell
$env:DATABASE_URL = "postgresql://...la de migrar, puerto 5432..."
pnpm db:check:cloud
pnpm db:migrate
pnpm db:check:cloud
```

- [ ] **Debe dar:** una pendiente, `0147_reversas_de_venta`, y al final `148` y `148`.

Luego **push** y deployment en **Ready**.

## 1. Una venta pagada de la que partir

Prepara el producto de prueba si hace falta (paso 1 de `SMOKE_BLOQUE_A_RETOMA.md`), cobra con QR una unidad como **Profesional Demo** y **págala** con la `4242 4242 4242 4242`.

- [ ] En **/pagos** la venta queda **pagada**, con su factura de Alegra.

## 2. Abrir el contracargo

En **/pagos**, en esa venta de la lista de **Transacciones**:

- [ ] Aparece el botón **Registrar un contracargo**. (Como **Profesional Demo** no aparece; un usuario de soporte tampoco lo ve.)
- [ ] Púlsalo. Pide tres cosas: **referencia de la disputa**, **monto que debitó el banco** y **fecha del débito**.
- [ ] Pon la referencia `DISPUTA-SMOKE`, un monto **mayor** que la venta (por ejemplo `15000` más) y la fecha de hoy. **Abrir el caso.**
- [ ] **Debe dar:** *Caso abierto. El ingreso no se toca hasta que la disputa se resuelva...*
- [ ] Arriba aparece el panel **Contracargos y anulaciones** con la venta, el estado **Disputa abierta**, y el aviso naranja: *El débito difiere del valor de la venta en 15.000 COP más. La diferencia se concilia con contabilidad: la nota crédito va solo por el valor de la venta.*
- [ ] **En Dirección, las cifras NO cambian.** El ingreso de esa venta sigue contando: la factura es válida mientras la disputa viva.
- [ ] Intenta abrir otro contracargo sobre la misma venta. **Debe dar:** *Esa venta ya tenía un caso abierto.*

## 3. El aviso, con su plazo

- [ ] La franja de arriba suma un pendiente más.
- [ ] Corre el correo de la mañana (paso 4 de `SMOKE_BLOQUE_A_RETOMA.md`, con el reinicio antes). **Debe dar:** una sección **Contracargos y anulaciones (el banco devolvió el dinero)** con *Disputa abierta: hay que responderle al banco con los soportes*, y un plazo de **3 días hábiles** desde hoy.

## 4. Ganarla no mueve nada

- [ ] En el panel, **Se ganó la disputa**, con la referencia `BANCO-A-FAVOR`. **Debe dar:** *Disputa ganada. El ingreso nunca se movió...*
- [ ] En Dirección, las cifras **siguen igual**.
- [ ] El pendiente desaparece de la franja y del correo.

## 5. Perderla sí, y la nota crédito queda pendiente

Repite el paso 1 con **otra** venta pagada, ábrele el contracargo (paso 2) y ahora:

- [ ] **Se perdió la disputa**, con la referencia `BANCO-EN-CONTRA`. **Debe dar:** *Disputa perdida. Se revirtieron el ingreso y la comisión, y queda pendiente la nota crédito manual en Alegra, POR EL VALOR DE LA VENTA.*
- [ ] **En Dirección desaparecen las TRES cifras de esa venta**: el ingreso bruto (con un pago menos), el ingreso de CNV y la comisión del Integrante. La factura sigue existiendo en Alegra: lo que la anula es la nota crédito que emite contabilidad.
- [ ] El panel muestra **Disputa perdida** y pide el número de la nota crédito.
- [ ] En el correo, esa venta aparece ahora como *Disputa perdida: falta la nota crédito manual en Alegra*, con **5 días hábiles desde hoy** (no desde que se abrió).
- [ ] Escribe un número de prueba (`NC-SMOKE`) en **Registrar la nota crédito**. **Debe dar:** *Nota crédito registrada. El caso queda cerrado*, y el pendiente desaparece.

> **Ojo con lo que significa:** en producción ese número lo escribe Dirección **después** de que contabilidad emita la nota crédito en Alegra, por el **valor de la venta**, nunca por el débito total. La cuota de la disputa y la comisión de Wompi son gasto, no menor ingreso.

## 6. La anulación que antes pasaba en silencio

> **Corregido el 2026-09-17, tras el primer intento.** Anular en Wompi no hizo nada en Atlas. Antes de repetirlo, pega `scripts/revision-anulaciones-de-wompi.sql` en el editor SQL de Supabase (solo lee) y pásame el resultado: dice si Wompi mandó el aviso de la anulación y con qué estado. Si no lo mandó, el camino que queda es el cotejo diario, y hay que correrlo a mano (`Buscar pagos sin registrar`) para ver si detecta la anulación.

Esta es la parte que no se puede provocar desde Atlas: necesita que Wompi anule un pago aprobado. Si no tienes cómo hacerlo en el panel de Wompi sandbox, **sáltalo y dímelo**: queda cubierto por el candado `reversa-db`.

Si puedes anular una transacción aprobada desde Wompi:

- [ ] A los pocos minutos, en **/pagos**, aparece esa venta en el panel como **Anulada en Wompi · Disputa abierta**, abierta *por Atlas, desde Wompi*.
- [ ] En **Sentry** hay un error: *Wompi reportó VOIDED sobre una venta pagada: se abrió una reversa*.

## 7. Limpiar

```powershell
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-limpiar-ventas.sql --commit
node scripts/aplicar-migracion.mjs scripts/smoke-bloque3-retirar.sql --commit
```

- [ ] `CONFIRMADO` en los dos. Las reversas se borran con sus ventas.
- Cierra la ventana de PowerShell, o corre `Remove-Item Env:DATABASE_URL`.
