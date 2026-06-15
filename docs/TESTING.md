# TESTING.md — Estrategia de pruebas de Atlas

**Versión:** 1.0
**Acompaña a:** `CLINICAL_ENGINE.md`, `DATABASE.md`, `SECURITY.md`, `MVP.md`.

## Filosofía
Tests mínimos pero estratégicos. En un sistema clínico, los tests no son QA: son **seguridad clínica**. La prioridad número uno son los golden tests del motor. No perseguimos un porcentaje de cobertura por sí mismo; cubrimos a fondo las rutas crítico-clínicas y crítico-seguridad, y lo demás con cobertura razonable.

**Stack:** Vitest (unit + integración). Playwright (E2E) queda para Post-MVP (`BACKLOG.md`).

## Categorías de prueba, por prioridad

### 1. Golden tests del motor clínico (LA prioridad)
- **Qué:** paridad exacta `port (TS) == HTML (v7/final)`, hasta el decimal que defina Gildardo.
- **Dónde:** `src/clinical-engine/__tests__/golden/`.
- **Cómo se generan:** capturando valores oro al ejecutar las funciones del HTML real en Node contra cientos de casos reales. Las respuestas las decide el código viejo, no el agente. Fixtures versionadas.
- **Qué prueban:** que el port no cambió la lógica. **No** prueban corrección clínica; eso lo firma Gildardo sobre una muestra.
```ts
import goldens from './fixtures/ifc_irc_pabu.golden.json';
test.each(goldens)('IFC/IRC/PABU: paridad con el HTML', ({ input, expected }) => {
  const out = engine.computeIndicators(input);
  expect(out.ifc).toBeCloseTo(expected.ifc, 4);
  expect(out.irc).toBeCloseTo(expected.irc, 4);
  expect(out.pabu).toBeCloseTo(expected.pabu, 4);
});
```

### 2. Clasificaciones y cortes (donde se esconde el bug clínico)
- Probar **exactamente en los umbrales** (boundary testing). Por ejemplo IFC en 6.0 y 3.5; IRC en 2.0 y 3.4; cIAE en −5 y 5; cISCM en −1, 1, 2.5. Un off-by-one en el corte es una misclasificación clínica.
- Probar por sexo donde el corte depende del sexo (`cAF`, `cIR`, `cFMI`, `cFFMI`, `cSMM`).
- **El comportamiento exacto en el borde lo dicta el HTML.** Estos tests se derivan de los golden, no de suposiciones nuestras.

### 3. Mapeos de estado
- Fenotipo MCCB (12), sector FR (9), Diana EFR (81), PBI (9), EIEC: que la combinación de bandas resuelva al estado correcto. Probar las esquinas de la matriz y los bordes de banda. Verificar que las 81 entradas EFR existan y se indexen bien por la llave de 4 bandas.

### 4. Propagación de datos (el bug crónico de ATLAS)
- Que el dato fluya íntegro: encuesta → BIS → indicadores → diagnóstico → tratamiento → reporte, sin perderse ni mezclarse.
- Se prueba **primero contra el motor stub** (antes del HTML final) y luego contra el real. Ese es el de-risking: validamos el cableado antes de tener el motor definitivo.

### 5. RLS y policies
- **Policies de código** (`canViewPatient`, `canDiagnose`, `canSendReport`, `canManageDevices`, `canAccessAdmin`, `canViewAggregateData`): tests puros por rol.
- **RLS de base de datos:** con usuarios de prueba por rol, que cada uno vea solo lo suyo.
```ts
test('un profesional no ve pacientes de otro profesional', async () => {
  const rows = await asUser(profB).from('patients').select();
  expect(rows.find(p => p.id === pacienteDeA)).toBeUndefined();
});
test('obbia no puede leer PII', async () => {
  const { error } = await asUser(obbia).from('patient_profiles').select();
  expect(error).toBeTruthy();
});
```

### 6. Resolución de identidad
- Documento exacto → paciente existente (seguimiento). Sin match → nuevo (inicial). Similar sin match exacto → alerta de posible duplicado, nunca fusión automática.

### 7. Versionado y snapshot
- Cada registro clínico lleva su constelación de versiones (`engine_version`, `survey_version_id`, `model_version_id`, `rules_version`).
- El snapshot del reporte es inmutable.
- Cambiar la versión del modelo NO recalcula registros viejos: un diagnóstico v1.0 sigue calculado con v1.0.

### 8. Consentimiento
- No hay flujo clínico sin consentimiento registrado.
- El consentimiento queda versionado (`consent_version` + hash).

### 9. Pagos
- **Idempotencia:** el mismo webhook dos veces produce un solo efecto.
- **Firma HMAC:** un webhook con firma inválida se rechaza.
- **Snapshot de comisión:** cambiar el `commission_rate` del profesional NO recalcula comisiones pasadas.

### 10. Auditoría append-only
- `clinical_audit_log`: intentar UPDATE o DELETE falla (el trigger lo bloquea), incluso con service role.

### 11. Validación y sanitización
- Zod rechaza payloads malformados y oversized.
- XSS: no se renderiza HTML de usuario (sin `dangerouslySetInnerHTML`).
- SQLi: queries parametrizadas, sin concatenación de strings.

### 12. Superficies públicas
- Token de encuesta: opaco, mapea a (profesional, organización) en servidor.
- Link de seguimiento: un solo uso, se vence al completar, colchón de 30 días.
- Checkout: token 24h, atado a orden y monto, idempotente.

## El flujo golden (resumen)
Capturar valores del HTML → portar a TS → afirmar paridad → Gildardo firma una muestra como clínicamente correcta. Detalle en `CLINICAL_ENGINE.md`.

## Stub-first
El motor stub honra el contrato (`EngineInput` → `EngineOutput` con la forma correcta y valores dummy). Se construye y prueba la propagación y la UI contra el stub; al llegar el HTML, se portan las funciones reales y se cambia el stub. Los golden tests validan el motor real.

## Criterios de aceptación por bloque
Antes de cerrar un bloque (ver `CLAUDE.md`):
1. `tsc --noEmit` en verde.
2. `pnpm lint` en verde.
3. `pnpm vitest run` en verde, incluidos los golden tests si el bloque tocó el motor.
4. Smoke local (`pnpm dev`).
5. El criterio de aceptación del bloque documentado en `MVP.md`.

## CI
Tests en CI en cada PR. Scanner de secretos (gitleaks) y escaneo de dependencias. Sin `git push` directo (ver `CLAUDE.md`).

## Cobertura
No se persigue un porcentaje por sí mismo. Cobertura obligatoria en: motor (golden), clasificaciones (bordes), policies y RLS, propagación, idempotencia de pagos, append-only del audit. El resto, cobertura razonable.

## Fuera de MVP (ver `BACKLOG.md`)
E2E con Playwright, pruebas de carga y estrés, fuzzing.
