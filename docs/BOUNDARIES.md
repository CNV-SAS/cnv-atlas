# BOUNDARIES.md — Fronteras de Atlas (CNV)

**Versión:** 1.0
**Propósito:** evitar el acoplamiento cruzado. Antes de integrar con otro producto o de ceder a la tentación de un import cruzado, consulta este documento.

## Regla general
Cuando sientas la tentación de cruzar una frontera (importar código de otro dominio, leer directo la base de otro sistema, meter lógica de un módulo en otro), **detente e integra por la costura definida** (API, eventos o contratos compartidos). Cruzar la frontera es deuda que se paga cara.

## Atlas frente al ecosistema CNV

### Atlas y CNV Learning
- **Repositorios independientes.** Atlas no importa código de CNV Learning ni viceversa.
- La integración es la **habilitación del profesional**: Atlas consulta si un profesional está habilitado/certificado. En MVP es un gate de estado; la integración real con Learning va por **API**, no por imports ni por base de datos compartida.

### Atlas y CNV Research / ObBIA-Latam
- Research **no accede directo** a la base de Atlas ni a PII.
- Consume data **gobernada** (anonimizada o agregada) vía los exports de `research-datasets`. La PII nunca sale en esos exports.

### Atlas y "CNV Core"
- En el MVP **no existe** un CNV Core compartido (decidimos repo independiente). Si en el futuro emerge (cuando haya una segunda app que de verdad lo necesite), la integración será por contratos compartidos, no por acoplamiento directo.

## Fronteras internas de Atlas

### Entre módulos de dominio
- Un módulo no importa el código interno de otro. Lo que un módulo expone a otros son sus tipos y servicios públicos.
- El acceso a datos siempre pasa por el repositorio del módulo dueño de esa tabla (regla dura 1).
- La comunicación entre dominios va por eventos (bus) o por llamadas a servicios, no por imports de capas internas.

### El motor clínico
- `src/clinical-engine/` no importa **nada** de la app (ni Next, ni React, ni Supabase). Es TypeScript puro. La frontera se hace cumplir con ESLint.
- Se ejecuta **solo en servidor**. Nunca se envía al cliente.
- Recibe objetos tipados (el `EngineInput`) y devuelve objetos tipados (el `EngineOutput`). Esa interfaz es el contrato; todo lo demás (UI, persistencia) vive afuera.

### Frontera ciencia / implementación / datos
- La ciencia la define Gildardo (`SCIENTIFIC_MODEL.md`).
- La implementación la porta Atlas con fidelidad (`CLINICAL_ENGINE.md`).
- Los cortes, mapas y las 81 entradas EFR son datos versionados del `model-registry` (`DATABASE.md`); las fórmulas son código del engine.

### Frontera servidor / cliente
- Server Components por defecto. La lógica de negocio, el motor clínico y las llamadas a terceros viven en servidor.
- El cliente es delgado: UI y captura, nunca cálculo clínico ni secretos.

## Fronteras con sistemas externos

- **Biody Manager (Aminogram):** sistema de terceros. La costura es el **import del XLSX**: una vez Atlas importa y valida, **Atlas es el sistema de registro oficial**. No dependemos de Biody Manager como fuente de verdad de la data derivada.
- **Wompi:** pagos. La costura son el checkout y los **webhooks** (firma HMAC + idempotencia). Atlas no maneja datos de tarjeta; eso vive en Wompi.
- **Alegra:** contabilidad. La costura es la sincronización de transacciones/facturas.
- **Groq / Gemini:** apoyo de IA. La costura es el provider con timeout; **nunca PII**, solo variables clínicas seudonimizadas.

## Cuándo PARAR y pedir input
- Tentación de importar código entre dominios CNV.
- Tentación de leer directo la base de otro sistema.
- Tentación de meter lógica del motor clínico fuera de `clinical-engine`, o lógica de negocio en pages/actions.
- Cualquier integración nueva con un sistema externo que no tenga una costura definida aquí.
