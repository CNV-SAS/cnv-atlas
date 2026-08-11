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

## Lo que prepara Santiago en Alegra (antes de construir) — SANDBOX primero

Igual que hicimos con Wompi: **primero SANDBOX** (configurar + probar el flujo completo ahí), **producción después**, cuando el flujo esté verificado. Instrucciones literales, en orden.

**En SANDBOX (lo que hay hoy):**
1. **Credenciales de sandbox** (ya existen): `ALEGRA_EMAIL`, `ALEGRA_API_KEY`, `ALEGRA_BASE_URL` apuntando al sandbox. Sensibles, NUNCA `NEXT_PUBLIC_`.
2. **Impuesto IVA 19%.** Configurar (o confirmar) el impuesto de venta al 19% y anotar su **id** → `ALEGRA_IVA_TAX_ID`.
3. **Ítems del catálogo.** Crear un ítem por cada nutracéutico, con el **nombre del catálogo** (sin la indicación), y anotar el **id de cada ítem** (para ST2). Que lleve el IVA 19% referenciado.
4. **Facturación electrónica en sandbox, SI el sandbox lo permite** (ver la pregunta abierta abajo). Si emite (simulado), se prueba ST3-ST4 completo ahí; si solo borradores, se prueba todo lo demás y la emisión real queda para producción.
5. Probar el flujo COMPLETO en sandbox (contacto + item real + emisión/borrador + captura).

**En PRODUCCIÓN (después, con el flujo verificado):**
6. Credenciales de producción (nuevas `ALEGRA_*`), impuesto, ítems y **resolución de facturación electrónica DIAN** (numeración + certificado) para emitir de verdad.
7. **Documento soporte electrónico — DEPENDENCIA (revisión contable 2026-08-12), no tarea paralela.** Sin él, un integrante SIN RUT no puede facturarle a CNV y **no puede cobrar** aunque haya completado todo lo demás; el bloqueo sería de CNV, no suyo. **Habilitarlo en Alegra ANTES de la primera liquidación de comisiones.**
8. **Contacto:** pendiente de la consulta de seguimiento al contable.

### PREGUNTA ABIERTA que decide cómo se prueba el bloque

**¿El sandbox de Alegra permite EMITIR a la DIAN (validación simulada) o solo crea borradores?** A confirmar con Alegra / la cuenta de Santiago. Decide la estrategia:
- **Si emite (simulado):** ST3-ST4 (emisión + captura de CUFE/número/estado DIAN + cola/reintento) se verifican en sandbox antes de producción. Ideal.
- **Si solo borradores:** en sandbox se prueban contacto, mapeo de ítems, y la cola; **la emisión real solo se ejercita en producción.** Eso obliga a llegar a producción con MUCHO cuidado (la primera emisión real es la primera prueba de esa parte). Habría que mitigar: un modo de "primera factura de prueba" acotado, o revisar manualmente las primeras.

## Dependencias y decisiones abiertas
- **Consulta de seguimiento al contable** (contacto): puede cambiar ST1.
- **Dos pendientes de la contadora** (tarifa exacta de retención, tratamiento del efectivo en custodia): NO bloquean la factura; sí la liquidación.
- La emisión real depende de "Lo que prepara Santiago"; hasta entonces, la venta se **sella internamente sin factura** (ya construido).
