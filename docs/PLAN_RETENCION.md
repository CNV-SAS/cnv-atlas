# PLAN_RETENCION.md — Rediseño del estado tributario del integrante (sobre el RUT)

**Estado:** PLAN. Pendiente de **luz verde del contable** en la decisión abierta (quién deriva los campos del RUT). NO construir hasta eso.

## El problema (revisión contable 2026-08-12)

La primera versión (formulario de 6 booleanos) tenía buen tono y diseño, pero **le pedía al integrante datos que no sabe fiablemente**: "¿eres declarante de renta?", "¿eres responsable de IVA?" — "como preguntarle su tipo de sangre de memoria". **El riesgo es de CNV:** si contesta mal, la retención sale mal, y ante la DIAN responde CNV (retener de menos se lo cobran a CNV). El síntoma ya salió en el smoke: el formulario aceptó **persona jurídica + "¿tienes RUT? No"**, que es imposible (toda jurídica tiene NIT y RUT).

**La solución: pedir el RUT, no las respuestas.** El RUT es un PDF que el integrante descarga de la DIAN y que **contiene todas esas respuestas certificadas**. En vez de que adivine, se lee el documento.

## Habilitador: subida de archivos — VERIFICADO, viable

El patrón existe (`src/modules/reports/data/report-storage.ts`): **bucket privado** + **service role** para subir + **URL firmada** validando ownership en un route handler. Se reusa tal cual.

**Tamaño de la subida del RUT (chico-medio):** (a) migración de Storage para un bucket privado nuevo (p. ej. `professional-documents`, con sus policies, como la 0004 hizo para `patient-reports`); (b) helper de storage (subir RUT / URL firmada); (c) input de archivo en el formulario + la acción recibe el `File` del FormData y lo sube; (d) route handler para que CNV/contabilidad LEA el RUT (con chequeo de acceso); (e) persistir `rut_path` en `professional_profiles`.

## LA DECISIÓN QUE DEFINE EL FLUJO (para el contable)

¿Quién deriva los campos certificados (declarante, responsable de IVA, obligado a facturar) del RUT?

- **Opción A (recomendada): el contable/CNV los deriva del RUT al LIQUIDAR.** El integrante sube el RUT y da solo lo que SABE (tipo de persona, documento, si tiene RUT, cuenta bancaria). Los 3 campos que no sabe **se quitan de su formulario** y los lee el contable del RUT cuando calcula la retención (que ya es su trabajo, y las tarifas ya están pendientes de la contadora). Ventaja: fiable (fuente certificada, leída por quien sabe), formulario mínimo, sin un flujo nuevo de CNV (va montado sobre la liquidación). Desventaja: la clasificación no está "lista" hasta la liquidación (pero la retención se difiere igual).
- **Opción A2: un paso de revisión de CNV al subir el RUT.** Alguien de CNV lee cada RUT y llena los campos en el momento. Más trabajo por adelantado; los campos quedan listos antes de la liquidación.
- **Opción B: extraer del PDF (OCR) y que el integrante confirme.** Complejo (parsear el RUT), y confirmar sigue apoyándose en el integrante, que es lo que se quería evitar.

**Recomendación: A.** Es lo que hace el dato fiable sin trabajo extra ahora. **Necesita el sí del contable** (define el formulario entero).

## Rediseño por prioridad (incorpora la lista del contable)

### ALTA
1. **Cargar el RUT (PDF)** como fuente de verdad. Los campos declarante / responsable de IVA / obligado a facturar **se derivan del RUT** (opción A/A2), NO se le preguntan al integrante. Requerido cuando el integrante tiene RUT (jurídica siempre; natural si dice que sí; natural sin RUT → CNV emite documento soporte, dictamen).
2. **Validación cruzada:** persona jurídica ⇒ tiene RUT (obligar el RUT para jurídica elimina el combo imposible del smoke). Revisar otras combinaciones imposibles.
3. **Cuenta bancaria** (banco, tipo de cuenta, número, titular), hoy ausente: sin eso no hay a dónde girar. **Regla: el titular debe ser el mismo integrante** (nada de la cuenta de un familiar; el contable dice que ya lo sufrieron).

### MEDIA
4. **Dígito de verificación** cuando es NIT.
5. **El documento se adapta:** natural pide tipo (CC, CE) + número; jurídica pide NIT + DV. Hoy es un campo genérico.
6. **Sin valores por defecto:** arrancar sin selección para forzar una respuesta consciente (no guardar sin leer).
7. **Fecha límite en el aviso:** "completa tus datos antes de X para recibir el pago en la liquidación de Y". Sin fecha, nadie se mueve. (Depende de las cadencias de la liquidación.)

### BAJA
8. **Copia:**
   - "CNV retiene el impuesto" → "**CNV, como agente de retención, debe retener un porcentaje de tu comisión y girarlo a la DIAN a tu nombre**" (obligación legal, no decisión de CNV).
   - Ejemplo con números: "si tu comisión es $100.000 y aplica retención del 11%, recibes $89.000 y CNV gira $11.000 a la DIAN a tu nombre, con certificado."

## Qué queda para el contable (antes de construir)
- La **decisión A/A2/B** (quién deriva los campos del RUT).
- Confirmar los campos de **cuenta bancaria** y la regla de titular = integrante.
- Confirmar la lógica del **RUT requerido** (jurídica siempre; natural con RUT; natural sin RUT → documento soporte).

Con eso, se construye el rediseño; las columnas de la migración 0060 se conservan (se llenan del RUT), y se suma la migración de Storage + cuenta bancaria + DV.
