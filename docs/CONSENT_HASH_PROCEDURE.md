# Procedimiento de cálculo y verificación del hash del consentimiento

Documento para el registro legal (dictamen de firma electrónica 2026-08-09, Pregunta 5): un hash sin el texto original y sin el procedimiento de cálculo no tiene valor probatorio. Aquí queda el procedimiento exacto, para poder reproducirlo y demostrar, años después, que el texto archivado no se alteró.

## Qué prueba el hash (y qué no)

- **Prueba INTEGRIDAD:** que el texto exacto que se le mostró al paciente no se modificó después de la aceptación. Es la condición 2 del art. 4 del Decreto 2364 de 2012, que el dictamen da por **bien resuelta**.
- **NO prueba IDENTIDAD** (quién aceptó). Eso lo resuelve el OTP (ver `PLAN_B7_FIRMA.md`), no el hash.

## El hash identifica la VERSIÓN, no la instancia firmada

`patient_consents.document_hash` se calcula sobre el texto CANÓNICO de la versión, **con los placeholders (`________`) intactos** (sin rellenar con los datos del paciente). Consecuencia: dos pacientes que aceptan la misma versión comparten el mismo `document_hash`. Qué persona, qué profesional y cuándo se firmó se registran aparte (identidad + evento en `clinical_audit_log`).

## Procedimiento EXACTO de cálculo

Implementado en `src/modules/consent/consent-hash.ts`:

1. **Normalización** (`normalizeConsentText`): tomar el texto canónico y
   - separar por saltos de línea (`\r\n`, `\r` o `\n`),
   - eliminar espacios y tabulaciones al final de CADA línea (`/[ \t]+$/`),
   - reunir las líneas con salto de línea LF (`\n`).
2. **Hash:** `SHA-256` del texto normalizado, codificado en **UTF-8**, en representación hexadecimal.

En código: `createHash("sha256").update(normalizeConsentText(texto), "utf8").digest("hex")`.

## Conservación del texto íntegro de cada versión

El texto de cada versión se conserva VERBATIM en un archivo versionado del repositorio, uno por versión, nunca editado tras publicarse:
- `src/modules/consent/text/consent-v1.2.ts`
- `src/modules/consent/text/consent-v1.5.ts`
- (cada versión futura, su propio archivo)

El historial de git preserva el contenido exacto de cada versión publicada. **El `document_hash` de un registro apunta a la versión (`consent_version`); con la versión se recupera el texto de su archivo y se recalcula el hash.**

## Cómo reproducir la verificación ante un reclamo

Dado un registro `patient_consents` con `consent_version = X` y `document_hash = H`:
1. Recuperar el texto canónico de la versión X (su archivo `consent-vX.ts`, en el repositorio / historial de git).
2. Aplicar la normalización y el SHA-256 de arriba.
3. El resultado debe ser idéntico a `H`. Si coincide, el texto mostrado y aceptado no se alteró.

## Anclaje automatizado (candado)

`src/tests/consent-hash.test.ts` recomputa el hash del texto vigente y lo compara contra el valor esperado anclado: cualquier cambio del texto rompe la prueba, forzando una subida de versión consciente. Esto garantiza que el par (texto, hash) nunca se desincroniza en silencio.

## Pendiente (robustez, no bloqueante)

Hoy el texto vive en el repositorio (git). Para robustez probatoria adicional, evaluar **guardar el texto íntegro de cada versión también en la base de datos** (una tabla de versiones de consentimiento), de modo que la prueba no dependa del acceso al repositorio. Registrado en `PLAN_B7_FIRMA.md`.
