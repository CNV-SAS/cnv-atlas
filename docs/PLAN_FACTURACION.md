# PLAN_FACTURACION.md — Facturación real de la venta (Alegra), unificada para Wompi y efectivo

**Estado:** PLAN. NO construir todavía: la emisión real necesita **Alegra en Producción** (catálogo, impuesto, resolución de facturación electrónica), que es trabajo de Santiago (ver "Lo que prepara Santiago"). Cuando el terreno esté listo, se construye por sub-tareas.

## Por qué es un bloque, no un remiendo

Lo que hay de Alegra es un **STUB de sandbox** (`tryCreateAlegraInvoice`), no una integración: cliente fijo + item fijo del sandbox, una línea cantidad 1, **borrador que NO emite a la DIAN**; sin las envs de sandbox se omite. **Hoy ni Wompi ni efectivo facturan.** El bloque **reemplaza el stub** por una vía real y unificada que llaman los dos medios; no agrega una factura de efectivo al lado.

## Sub-tareas

Se derivan del dictamen contable (`entregas/gildardo-2026-08-10/RESPUESTAS_CONTABLES_FACTURACION.md`).

### ST1. Contacto por paciente en Alegra
- Crear/buscar el contacto en Alegra por documento, con **SOLO** nombre + tipo/número de documento + correo. **NUNCA** datos clínicos.
- Persistir el mapeo paciente→contacto (columna `alegra_contact_id` en `patients`, o tabla de mapeo) para no recrearlo.
- **GATED por la consulta de seguimiento al contable** (`CONSULTA_CONTABLE_FACTURACION.md`, seguimiento 2026-08-11): si Alegra permite facturar sin contacto persistente, esta sub-tarea se simplifica (contacto al vuelo o genérico) y no se acumulan contactos muertos. Confirmar antes de elegir el modelo.

### ST2. Mapeo producto → item de Alegra
- Cada nutracéutico del catálogo → un item de Alegra (columna `alegra_item_id` en `nutraceuticals`, o tabla de mapeo).
- El nombre del item en Alegra = el **`name`** del catálogo (limpio). **NUNCA** el campo `indication` ("Metabolismo glucosa-insulina" y similares no salen en la factura).
- Facturar los **items y cantidades REALES** (el stub factura una sola línea cantidad 1).

### ST3. Emisión a la DIAN + captura
- Cambiar de **borrador** a **emitir** (factura electrónica validada), no solo crear el draft.
- El cliente de Alegra captura y Atlas persiste **CUFE, número asignado por Alegra, estado DIAN** (migración: campos en `transactions` o tabla `invoices`).
- **Consecutivo SIEMPRE de Alegra** (Atlas nunca genera números).
- Estados: **"aprobada con observaciones" = VÁLIDA** (ni reintentar ni duplicar); solo **"rechazada"** obliga a corregir y reemitir.
- IVA **19%** referenciado por id del impuesto (sin él, Alegra factura IVA en 0). Precio a Alegra = base sin IVA (como hoy).

### ST4. Cola + reintento, no bloqueante e idempotente
- Si Alegra/DIAN no responden, **NO bloquear la venta** (ya sellada en Atlas): **encolar y reintentar** la emisión (estado de factura: pendiente/emitida/rechazada + reintento).
- **Una venta = una factura**, cubriendo timeouts y reintentos (no solo el doble-clic): la idempotencia va por transacción, no por request.

### ST5. Unificar los dos medios
- `emitInvoiceForTransaction(transaction)`, llamada por el **webhook de Wompi** (al pagar) y por la **venta en efectivo** (al registrar). Reemplaza `tryCreateAlegraInvoice`.
- Mixto (dos transacciones internas) = **una factura** por el total (el dictamen).

## Lo que prepara Santiago en Alegra (antes de construir)

Instrucciones literales, en orden. Esto es lo que hace que ST1-ST5 sean construibles; el terreno tiene que estar listo primero.

1. **Cuenta y credenciales de PRODUCCIÓN.** Confirmar/crear la cuenta de Alegra de producción y obtener:
   - `ALEGRA_EMAIL` (el correo de la cuenta).
   - `ALEGRA_API_KEY` (el token de API de producción; sensible, NUNCA `NEXT_PUBLIC_`).
   - `ALEGRA_BASE_URL` (el host de producción de la API).
   - Cargarlas en Vercel (Production/Preview/Development), como el resto (ver `DEPLOY.md`).
2. **Impuesto IVA 19%.** Configurar (o confirmar) el impuesto de venta al 19% en Alegra y anotar su **id** → `ALEGRA_IVA_TAX_ID`.
3. **Ítems del catálogo.** Crear en Alegra un ítem por cada nutracéutico, con el **nombre del catálogo** (sin la indicación), y anotar el **id de cada ítem** (para el mapeo de ST2). Que el ítem lleve el IVA 19% referenciado.
4. **Facturación electrónica (resolución DIAN).** Activar la facturación electrónica en Alegra: la **resolución de numeración** de la DIAN y el certificado, para que se pueda EMITIR (no solo borrador). Sin esto, ST3 no puede emitir.
5. **Documento soporte electrónico.** Activarlo también (para pagar comisiones a integrantes sin RUT; es de la liquidación, pero se habilita aquí de una vez).
6. **Contacto (pendiente de la consulta de seguimiento).** No requiere acción hasta que el contable responda si hay que crear contacto por paciente o no.

Cuando 1-5 estén listos, avisar: ahí se construye ST1-ST5.

## Dependencias y decisiones abiertas
- **Consulta de seguimiento al contable** (contacto): puede cambiar ST1.
- **Dos pendientes de la contadora** (tarifa exacta de retención, tratamiento del efectivo en custodia): NO bloquean la factura; sí la liquidación.
- La emisión real depende de "Lo que prepara Santiago"; hasta entonces, la venta se **sella internamente sin factura** (ya construido).
