# Plan — B7 completo: firma electrónica del consentimiento (dictamen 2026-08-09)

Fuente: `entregas/gildardo-2026-08-09/RESPUESTA_FIRMA_ELECTRONICA_CONSENTIMIENTO.md`. Veredicto: **integridad bien resuelta, identidad no.** El fix central es un OTP antes de aceptar. **No construir aún; este es el plan.**

## Estado de los 7 (cuál ya tenemos, verificado en código)

| # | Ítem | Estado | Evidencia |
|---|---|---|---|
| 5 | Conservar texto íntegro + normalización + hash reproducible | **RESUELTO** | `text/consent-v1.5.ts` (versionado en git), `normalizeConsentText` + SHA-256 en `consent-hash.ts`, `consent-hash.test`. Falta solo DOCUMENTAR el procedimiento para el legal (y considerar guardar el texto en BD por robustez). |
| 6 | Contexto de sesión (qué profesional, qué paciente) | **RESUELTO** | `intake-writer` liga `professionalId` + `patientId`; el link es por profesional. Asegurar que el evento de consentimiento lo referencie. |
| 7 | Registro inalterable (tamper-DETECTABLE, no solo inmutable) | **PARCIAL** | `consent.signed` va al `clinical_audit_log` (RLS sin update/delete + inline, regla 8). PERO no hay hash-chain: una modificación por service-role no sería detectable criptográficamente. Cerrar = hash chain en el audit log (infra mayor). |
| 1 | OTP antes de aceptar | **FALTA** | — |
| 2 | Cláusula de aceptación del medio electrónico | **FALTA** | — |
| 3 | Menores: OTP al representante + dos actos como eventos separados | **PARCIAL** | El asentimiento 14-17 ya existe y gatea; falta el OTP al representante y separar los dos actos como eventos con su timestamp. |
| 4 | Copia automática al paciente | **FALTA** | Resend (email) ya disponible → factible. |

## (b)/(c) reevaluados con el dictamen (se DESBLOQUEAN)

- **Las "rayas" (campos de firma) NO se quitan.** El dictamen: nombre y documento escritos siguen útiles como declaración del firmante y para cotejar contra el registro; con el OTP encima, el conjunto autentica. La cédula redundante **se queda** (deja de ser lo ÚNICO que autentica, pero sigue aportando).
- **(b) render con datos reales:** ahora tiene sentido pleno (los datos van al paquete probatorio). Sigue exigiendo tener los datos ANTES de la aceptación final → se integra con el sub-flujo del OTP (datos → OTP → aceptación con el texto renderizado con esos datos).

## Decisión de canal (Santiago) — solo tenemos EMAIL

**No hay SMS** (ningún proveedor en deps; solo Resend). Opciones:
- **(A, recomendada) Email OTP de arranque:** usa Resend, sin dependencia nueva, desbloquea Hito 3 ya. El dictamen admite email como alternativa.
- **(B) Agregar SMS (Twilio o similar):** más fuerte probatoriamente (el dictamen lo prefiere), pero es dependencia nueva (DEPLOY.md + supply-chain + costo por mensaje). Se puede agregar DESPUÉS como refuerzo, con el canal ya parametrizado.
Recomiendo A ahora, con el canal parametrizado para sumar SMS luego sin re-arquitectura.

## Plan, por prioridad

### BLOQUEANTES (antes de pacientes reales, gate del Hito 3)

**1. OTP (el más grande).** Nuevo sub-flujo en el intake:
- Tras llenar los datos (identidad/representante), ANTES de habilitar "Aceptar", enviar un código al contacto (email; celular si se agrega SMS). El paciente lo ingresa; se valida.
- Almacenamiento TEMPORAL del código con vigencia corta (5-10 min) + intentos limitados (reusar el patrón del rate-limit `@/core/rate-limit`, o una tabla efímera). **Nunca el código, ni cifrado.**
- Registrar en la traza: canal, destino ENMASCARADO (últimos 4 dígitos / correo con asteriscos), timestamp de envío y de validación exitosa.
- Server actions: enviar-código y validar-código (rate-limited, como el intake).

**2. Cláusula de aceptación del medio electrónico.** Una autorización NUEVA antes de las casillas: el paciente ACEPTA que su consentimiento se da por medios electrónicos con validez (Ley 527), no solo que se le informa. → toca el TEXTO del consentimiento → **nueva versión (v1.6 → v1.7)** con la cláusula + su hash. Se registra como una aceptación más.

**3. Menores.** El OTP va al contacto del REPRESENTANTE LEGAL (no al menor). Registrar los dos actos como EVENTOS SEPARADOS con su timestamp: `assent.minor` y `consent.representative` (aunque ocurran en la misma sesión). El asentimiento ya existe; se separan en la traza y se dirige el OTP.

### ESCALA (antes de escalar el piloto)

**4. Copia automática** por email (Resend) tras aceptar: texto íntegro de la versión + autorizaciones marcadas Y NO marcadas + fecha/hora + canal de derechos (`protecciondatos@cnvsystem.com`). Evento en la traza.
**5. Documentar + probar la verificación del hash:** el mecanismo y el test ya existen; falta el DOC del procedimiento para el legal y conservar el texto por versión (ya en git; evaluar guardarlo en BD por robustez).
**6. Contexto de sesión:** ya resuelto; asegurar el enlace explícito del evento de consentimiento al profesional + paciente.

### MEJORA CONTINUA
**7. Registro tamper-detectable:** hoy RLS-inmutable + inline; para tamper-DETECCIÓN criptográfica, un hash chain en el `clinical_audit_log` (infra mayor, beneficia a TODO el audit, no solo consentimiento). Registrar aparte. **+ evidencia de exposición al texto** (el "ver más" ya construido; opcionalmente gatear que se haya podido ver antes de habilitar las casillas).

## Versión del consentimiento
Solo el ítem 2 (cláusula de aceptación) toca el TEXTO → nueva versión v1.7 (hash nuevo, C1). El OTP, la copia y los eventos son FLUJO/REGISTRO, no tocan el texto.

## Tamaño
**GRANDE.** El OTP (1) es el grueso (sub-flujo + almacenamiento temporal + validación + eventos). El resto es acotado: la cláusula (2) es texto + una casilla + versión; menores (3) es dirigir el OTP + dos eventos; la copia (4) reusa Resend; 5/6 casi hechos; 7 es infra aparte.
