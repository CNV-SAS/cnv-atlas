# API_INTEGRATIONS.md — Integraciones externas de Atlas (CNV)

**Versión:** 0.1 (esqueleto)
**Estado:** los detalles finos (endpoints exactos, formato de firmas, columnas del XLSX) se confirman contra la documentación vigente de cada proveedor y los sandboxes. Esto define el patrón.

## Principios comunes
- **Todo se llama server-side**, nunca desde el cliente (excepción: la clave pública de Wompi para el widget de checkout, que es pública por diseño).
- **Sin API keys hardcodeadas.** Todo por env (ver `DEPLOY.md`).
- **Timeout explícito** en toda llamada (`AbortSignal.timeout()` vía `core/http` o el provider).
- **Webhooks:** verifican firma HMAC e idempotencia. Nunca CORS abierto.
- **Reintentos** acotados y con backoff donde aplique; nada de loops infinitos.
- **Nunca PII al LLM.**

## 1. Biody Manager (Aminogram) — import de mediciones
- **Tipo:** software de terceros (nube + escritorio). No tiene API de integración con nosotros; el intercambio es por **archivo XLSX** que el profesional exporta.
- **Costura:** el profesional sube el XLSX a Atlas; se parsea con **`exceljs`** (elegido sobre SheetJS en B8: el parche de SheetJS solo vive en su CDN y rompe `minimumReleaseAge`; ver `DEPLOY.md`), se valida con Zod (tipos, rangos), se persiste en `bis_measurements` + `bis_raw_values` (modelo flexible nombre-valor), y se registra en `bis_import_logs`. **Una vez importado y validado, Atlas es el sistema de registro oficial.**
- **Validación:** rangos fisiológicos por variable, columnas requeridas, una fila por medición. Filas malformadas se rechazan con detalle en `bis_import_logs`. La identidad del paciente que trae el XLSX (nombre, fecha de nacimiento) se excluye explícitamente: nunca entra a `bis_raw_values`.
- **Mapeo de columnas (B8, provisional hasta B11):** el export real trae 180 columnas con encabezados ruidosos (español/inglés/francés, tokens internos de BiodyLife, unidades incrustadas). B8 persiste fielmente todos los valores numéricos usando como nombre de variable el encabezado normalizado; el mapeo canónico definitivo a las variables del motor (Re, Ri, Rinf, C, FMI, FFMI, MCA, SMM, AF, ECW, ICW, etc.) se acopla al motor y se cierra en B11. Los rangos fisiológicos son un subconjunto curado provisional. El XLSX de muestra real vive solo en `/reference` (gitignored, con PII); los tests usan un fixture sintético anonimizado.

## 2. Wompi — pagos (checkout de nutracéuticos)
- **Flujo:** Atlas crea una transacción interna (`transactions`, estado `pending`, con `idempotency_key`), genera el checkout (link/QR válido 24h, atado a orden y monto) y el paciente paga en Wompi.
- **Claves:** `NEXT_PUBLIC_WOMPI_PUBLIC_KEY` (cliente, widget), `WOMPI_PRIVATE_KEY` (server), `WOMPI_INTEGRITY_SECRET` (firma de integridad del checkout, server), `WOMPI_EVENTS_SECRET` (firma de webhooks, server).
- **Webhook:** `POST /api/webhooks/wompi`. Verifica la **firma del evento (HMAC con `WOMPI_EVENTS_SECRET`)**, registra el evento en `payment_webhook_events` (único por `provider`+`external_id`, idempotencia), y mapea el estado a `transactions.status` (`paid`/`failed`). Tras `paid`: genera el ingreso (`cnv_revenue`) y la comisión (`professional_revenue` con la tasa sellada).
- **PENDIENTE:** confirmar contra la documentación vigente de Wompi el formato exacto de la firma de integridad y de eventos, los endpoints y los campos. Requiere **credenciales de sandbox**.

## 3. Alegra — contabilidad
- **ESTADO REAL (verificado 2026-08-11): lo que hay es un STUB de SANDBOX, no una integración de facturación.** No sobre-afirmar "Alegra integrado". Lo que existe (`tryCreateAlegraInvoice`): usa un **cliente FIJO** (`ALEGRA_DEFAULT_CLIENT_ID`) y un **item FIJO** (`ALEGRA_DEFAULT_ITEM_ID`) del sandbox, factura **una sola línea con cantidad 1** (ignora los productos reales), y crea un **BORRADOR** que **NO emite a la DIAN** (sin CUFE, número ni estado DIAN). Sin esas envs de sandbox, **se omite**: hoy **ninguno de los dos medios de pago (Wompi ni efectivo) factura**. El `alegra_invoice_id` que guarda es el id del borrador de sandbox, no un consecutivo DIAN.
- **Auth:** Alegra usa `ALEGRA_EMAIL` + `ALEGRA_API_KEY` (server).
- **Idempotencia (parcial):** no crea dos facturas para la misma transacción (chequea `alegra_invoice_id` null), pero sin cola/reintento explícito.
- **PENDIENTE (bloque de facturación real, `BACKLOG.md` "[E2] Factura de la venta"):** contacto por paciente (solo identificación, nunca datos clínicos), mapeo producto→item de Alegra (el `name` del catálogo, nunca `indication`), EMISIÓN a la DIAN con captura de CUFE/número/estado, cola + reintento no bloqueante, unificado para Wompi y efectivo. Requiere **Alegra en Producción** (catálogo + impuesto 19% + resolución de facturación electrónica), trabajo de Santiago.

## 4. Groq / Gemini — IA (generación del menú)
- **Rol:** la IA **solo genera el menú/dieta** dados los objetivos del protocolo (calorías, proteína, restricciones). El diagnóstico NO es IA (es determinista, ver `CLINICAL_ENGINE.md`).
- **Abstracción:** `lib/ai/provider.ts` con timeout y posibilidad de elegir/fallback entre Groq y Gemini.
- **Sin PII:** al LLM solo van variables clínicas seudonimizadas (según la clasificación de 3 niveles), jamás nombre, documento ni contacto.
- **Prompts:** versionados en `modules/treatment/ai/prompts/<task>.<version>.ts`. Nunca inline.
- **Persistencia:** la respuesta se guarda en `ai_menu_suggestions` con `provider`, `model`, `prompt_version`, `status`, `latency_ms`. Inmutable. La sugerencia nunca se auto-aplica; el profesional decide.
- **Env:** `GROQ_API_KEY`/`GROQ_MODEL`, `GEMINI_API_KEY`/`GEMINI_MODEL`.

## Pendientes que destraban esta integración
- ~~XLSX de muestra real de Biody Manager~~ recibido; parseo y validación cerrados en B8 (mapeo canónico de variables provisional hasta B11, ver arriba).
- Credenciales de sandbox de Wompi y Alegra (cierran pagos y facturación).
- Verificar, en el bloque correspondiente, los formatos exactos de firma y los endpoints contra la documentación vigente de cada proveedor.
