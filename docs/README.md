# Documentación de Atlas (CNV)

**Versión:** 1.0

Atlas es la plataforma clínica de Connected Nutrition Ventures: el sistema donde el modelo de atención ANI-BIS-E se aplica, se mide, se gobierna y se audita. Estos documentos son la fuente de verdad arquitectónica y operativa del proyecto.

## Los documentos

| Documento | Para qué sirve |
|---|---|
| `ARCHITECTURE.md` | 14 reglas duras, stack, estructura de carpetas, patrones por capa, el motor clínico, datos, seguridad, eventos, errores. Lectura obligatoria antes de codear. |
| `MVP.md` | Alcance, tabla de mínimo funcional por módulo, flujos transversales, recortes, orden de construcción, criterios de aceptación. |
| `CLAUDE.md` | Cómo debe comportarse Claude Code: reglas, flujo de trabajo, commits, restricciones técnicas y clínicas. |
| `DATABASE.md` | Esquema (DDL), enums, RLS, helpers, triggers, storage, seed, migraciones. |
| `SECURITY.md` | Postura de seguridad (RLS, policies, secretos, cifrado, headers, rate limiting, audit) y base legal (pendiente jurídico). |
| `DATA_GOVERNANCE.md` | Ciclo de vida del dato: clasificación, consentimiento, seudonimización/anonimización, retención, derechos, sub-encargados (pendiente jurídico). |
| `SCIENTIFIC_MODEL.md` | Qué es ANI-BIS-E (la ciencia). Co-propiedad de Gildardo / CNV Research. |
| `CLINICAL_ENGINE.md` | Cómo se implementa y porta el motor: contrato, funciones, golden tests, stub-first. |
| `TESTING.md` | Estrategia de pruebas: golden tests, cortes, propagación, RLS, pagos, audit. |
| `DEPLOY.md` | Operación: cuentas, env vars, setup, supply-chain, migraciones, backups, runbooks. |
| `BOUNDARIES.md` | Fronteras con el ecosistema CNV, entre módulos, con el motor y con sistemas externos. |
| `GLOSSARY.md` | Acrónimos clínicos, términos de negocio y técnicos. |
| `BACKLOG.md` | Lo diferido a Post-MVP. |
| `API_INTEGRATIONS.md` | Contratos de Wompi, Alegra, Groq/Gemini y el import de Biody Manager. *(pendiente)* |
| `BRAND.md` | Paleta, tipografía, tono, copy. *(pendiente)* |
| `README.md` | Este índice. |

## Orden de lectura inicial
1. `MVP.md` — qué construimos y qué no.
2. `ARCHITECTURE.md` — cómo se construye (las 14 reglas son no negociables).
3. `BOUNDARIES.md` — el contexto más amplio (Atlas no es todo CNV).
4. `DATABASE.md` — el modelo de datos.
5. `SECURITY.md` y `DATA_GOVERNANCE.md` — autorización, privacidad, cumplimiento.
6. `SCIENTIFIC_MODEL.md` y `CLINICAL_ENGINE.md` — el modelo y su motor.
7. `TESTING.md`, `DEPLOY.md` — al probar y operar.
8. `BRAND.md` — al construir UI.

## Para Claude Code
Al iniciar una sesión, el primer prompt debe incluir el contenido completo de `CLAUDE.md` y `ARCHITECTURE.md`. Al iniciar un bloque específico, pega además el bloque relevante de `MVP.md`, las tablas de `DATABASE.md`, las policies de `SECURITY.md`, y `CLINICAL_ENGINE.md` si el bloque toca el motor.

## Cómo actualizar estos documentos
Si una decisión nueva contradice estos documentos, **el documento se actualiza primero** y luego el código. No al revés. El proceso: PR que modifica el doc, self-review de consistencia, commit que explica el porqué, y solo después la implementación en un PR separado.

## Convenciones
- **Em-dash:** no se usa en **texto de cara al usuario** (copy de UI, correos, reportes, PDFs que recibe el paciente o el profesional), porque en español se ve raro. En docs de planeación, commits y comentarios no aplica.
- **Tono:** tuteo en interfaz; "usted" en documentación legal. Sin emojis en UI. Sin signos de exclamación múltiples.
- **Commits:** cada uno explica el porqué, no solo el qué. Migraciones, policies, fórmulas clínicas y prompts referencian el doc relevante.
- **Sin em-dash en producción, pnpm (no npm), motor clínico server-side, nunca PII al LLM.**

## Contacto
- Responsable técnico: Santiago Uribe.
- Dirección científica (modelo ANI-BIS-E): Gildardo de Jesús Uribe Gil.
- Incidentes: ver `SECURITY.md`, "Respuesta a incidentes".
