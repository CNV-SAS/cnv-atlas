# LEEME — índice de la documentación de Atlas

Una línea por documento: qué es y cuándo se consulta. Ordenado por rol: primero los que GOBIERNAN (deciden qué se hace y cómo), después los OPERATIVOS (qué falta), después los de REFERENCIA. Si llegas nuevo, empieza por `README.md` y `ARCHITECTURE.md`.

## Gobiernan (la fuente de verdad)

- **`DECISIONES_ANIBISE.md`** — La fuente NORMATIVA de las decisiones clínicas (D-NNN) + las preguntas abiertas a Gildardo (P-NNN). Firmado por Dirección Científica, mantenido por el equipo. **Se consulta ANTES de preguntarle algo a Gildardo o de implementar una decisión clínica.** Manda sobre el archivo prototipo.
- **`ARCHITECTURE.md`** — Las 15 reglas duras, la estructura, los patrones por capa, el método de dos carriles, la regla frente al HTML de Gildardo, y el mecanismo de modificaciones autorizadas. **Se consulta antes de construir cualquier cosa.**
- **`DIVERGENCIAS.md`** — Qué hace Atlas distinto del prototipo de Gildardo, y por qué (DIV-N → D-NNN). Responde "¿por qué esto es distinto de su archivo?".
- **`LANZAMIENTO.md`** — El alcance del Hito 1 y los gates de lanzamiento (qué tiene que estar para lanzar).
- **`PLAN_ETAPAS.md`** — La SECUENCIA del trabajo en tres etapas (E1 clínico / E2 operativo / E3 pulido). Responde "¿en qué orden y qué falta de cada etapa?". Complementa `LANZAMIENTO.md` (gates) y enlaza a `BACKLOG.md` (detalle).
- **`PLAN_GRANTS.md`** — El plan de cerrar el acceso amplio del admin al contenido clínico (grants sobre las 22 tablas PHI). Espera la respuesta del abogado de Santiago a 3 decisiones antes de arrancar. Gate del Hito 3 (ver `LANZAMIENTO.md`).
- **`MVP.md`** — El plan de construcción por bloques (B0-B15 y los que siguen).
- **`README.md`** — Índice y contexto general del proyecto (punto de entrada).
- **`BOUNDARIES.md`** — Los límites con CNV Learning (qué NO se cruza).

### Guardarraíles de dominio (gobiernan su área; se leen cuando el bloque los toca)
- **`DATABASE.md`** — Esquema, tablas, RLS. · **`SECURITY.md`** — Seguridad, auth, superficies públicas. · **`DATA_GOVERNANCE.md`** + **`CONSENT_ATLAS.md`** — PII, anonimización, consentimiento, el LLM. · **`CLINICAL_ENGINE.md`** + **`SCIENTIFIC_MODEL.md`** — El motor, indicadores, clasificaciones, la Diana. · **`BRAND.md`** — UI y marca. · **`API_INTEGRATIONS.md`** — Wompi, Alegra, Groq/Gemini, import Biody. · **`DEPLOY.md`** — Setup, comandos, variables de entorno, runbooks, supply chain.

## Operativos (qué falta, dónde va)

- **`BACKLOG.md`** — El trabajo por hacer, las decisiones diferidas y los huecos conocidos, con fecha. **Se consulta para saber qué falta y qué se decidió posponer.**
- **`MAPA.md`** — El mapa del estado de construcción por superficie/bloque.
- **`GILDARDO_QUERIES.md`** — **ARCHIVO HISTÓRICO (retirado 2026-08-03).** Registro de la conversación Q1-Q28; las preguntas abiertas viven ahora en `DECISIONES_ANIBISE.md`. No se le agregan preguntas.

## Referencia (se leen cuando hacen falta)

- **Inventarios:** `INVENTARIO_ARCHIVO.md` (el archivo vigente de Gildardo vs Atlas, completo), `INVENTARIO_TRATAMIENTO.md` (la pantalla de tratamiento). Responden "¿qué de su prototipo está portado y qué no?".
- **Planes de bloque** (algunos ya ejecutados, se conservan como registro del diseño): `PLAN_FLUJO_CORRECCION.md`, `PLAN_S2_CORRECCION.md`, `PLAN_TRES_MOTORES.md`, `PLAN_SELLAR_DERIVADOS.md`, `PLAN_FIELDKEYS_TRATAMIENTO.md`, `DECISIONES_CONSOLIDADO_ESTRUCTURA.md`.
- **`entregas/`** — Lo que Gildardo entregó, por fecha (`gildardo-YYYY-MM-DD/`): sus archivos, sus respuestas verbatim, sus instrucciones. La ruta + el conteo de líneas desambigua (no el nombre; ver ARCHITECTURE).
- **Referencia técnica:** `GLOSSARY.md` (términos), `TESTING.md` (tests), `ENTORNO.md` (entorno local), `PROFESSIONAL_SURFACES.md` (superficies del profesional), `RESULTADOS_GAP.md` (brechas de la vista de resultados), `DELTA.md` + `DELTA2.md` (bloques delta), `FROZEN_EXPORTS_REQUEST.md` (lo que Gildardo debe exponer del frozen).

---

**Nota sobre CAMBIOS_AUTORIZADOS:** no es un archivo. Las modificaciones autorizadas de la ciencia congelada son (1) las entradas `D-NNN` del consolidado con "Afecta: frozen", y (2) el manifiesto ejecutable `src/clinical-engine/frozen/authorized-modifications.js` (con la instrucción verbatim de cada CA). Ver `DIVERGENCIAS.md` para la lista legible.
