# VERSIONES — el esquema, y a qué corresponden los nombres anteriores a 1.0.0

**Qué es esto.** Gildardo pidió que todo quedara en la primera versión oficial, porque hay pacientes reales
con versiones que él lee como "de prueba". **Reetiquetar lo ya emitido no se puede** (ver abajo), así que
lo que se hace es numerar 1.0.0 de aquí en adelante y dejar aquí escrito a qué corresponde lo anterior.
Este documento es esa correspondencia.

**Por qué no se puede reescribir un sello.** La constelación de versiones (regla dura 7) no es una etiqueta
administrativa: **dice con qué se calculó**. Es lo que permite, dos años después, explicar una cifra o
recalcularla con la ciencia de su día. Poner `1.0.0` en un diagnóstico de agosto lo haría afirmar que salió
del motor de hoy, que es falso y no se puede sostener ante nadie.

**Y no hace falta.** Los tres nombres de versión (motor, modelo, reglas) se **copian al snapshot** al
diagnosticar, así que el renombre no toca ni un diagnóstico emitido: cada uno conserva el suyo, y esta
tabla dice qué significaba.

---

## El esquema, desde el 2026-09-09

| Artefacto | Formato | Hoy | Dónde vive |
|---|---|---|---|
| Motor clínico | **semver de tres** | `1.0.0` | `ENGINE_VERSION` (`src/clinical-engine/version.ts`) |
| Conjunto de protocolo | **semver de tres** | `1.0.0` | `PROTOCOL_ENGINE_VERSION` (mismo archivo) |
| Modelo | **semver de tres** | `1.0.0` | fila de `model_versions` (`version_name`) |
| Reglas | **semver de tres** | `1.0.0` | fila de `model_versions` (`rules_version`) |
| Encuesta | **entero** | `6` | fila de `survey_versions` (`version_number`) |

**Tres números, ni dos ni cuatro.** Con dos no se puede corregir un decimal sin anunciar cambio de ciencia;
con cuatro sobra un nivel que nadie usaría. Mayor = la ciencia cambia y lo emitido antes no es comparable;
menor = cambia lo que el motor PUEDE devolver; parche = corrección que no mueve ninguna cifra emitida.

**Sin prefijo dentro del valor.** El campo ya se llama `engine_version`; `anibise-` obligaba a parsear para
comparar dos versiones.

**Nunca fechas.** `2026-09-04` no ordena contra `1.4.0`, y no dice si el cambio fue de fondo o de forma.
Esa fue la razón concreta: el candado `peso-meta-composicion` comparaba versiones como cadenas y solo
funcionaba mientras todas fueran fechas.

**La encuesta se queda en entero, a propósito.** Es un instrumento, no software: un `6.0.1` de una encuesta
no significa nada. Sube de uno en uno cada vez que cambia lo que el paciente responde.

---

## La correspondencia con los nombres anteriores

Todo lo emitido **antes del 2026-09-09** lleva estos nombres. Son válidos y no se tocan.

| Nombre anterior | Corresponde a | Notas |
|---|---|---|
| `anibise-1.4.0` (motor) | **1.0.0** | El renombre no movió ninguna cifra. El historial de cada bump previo sigue escrito en `version.ts` |
| `anibise-1.3.1`, `1.3.0`, `1.2.x`, `1.1.0`, `1.0.0` (motor) | anteriores a 1.0.0 | Versiones del periodo de construcción y del Hito 1 |
| `anibise-protocolo-2026-09-04` | **1.0.0** | Mismos artefactos: los SHA del candado de versión no cambiaron |
| `anibise-protocolo-2026-08-*` y anteriores | anteriores a 1.0.0 | |
| `ANI-BIS-E 1.0` (modelo) | **1.0.0** | Misma fila, misma ciencia |
| `1.0` (reglas) | **1.0.0** | |
| Encuesta v2 a v6 | se mantienen | **v5 y v6 no son versiones de prueba**: v5 es el instrumento que Gildardo aprobó el 2026-08-19 |

### Lo que esto NO significa

- **No significa que las evaluaciones anteriores haya que repetirlas.** Medido en producción el
  2026-09-09: 51 respuestas en v5 y 19 en v6, de 59 pacientes reales, y solo 3 con diagnóstico sellado.
  Forzar una re-evaluación sería pedirle a 51 personas que respondan 64 preguntas otra vez para corregir
  una etiqueta. **Sus encuestas son válidas.**
- **No hace falta marcarlas a mano como desfasadas.** El mecanismo de vigencia (`emision-vigencia.ts`)
  compara lo sellado contra lo vigente y ya las muestra como tales, con el detalle de qué cambió.
- **No es una versión nueva del modelo.** No se crea un `model_version_id` nuevo, porque la ciencia no
  cambió: se actualiza la fila existente. Los diagnósticos emitidos conservan su copia de los nombres.

---

## Cómo se despliega un cambio de versión

**Las constantes de código** (`ENGINE_VERSION`, `PROTOCOL_ENGINE_VERSION`) viajan con el despliegue: no
necesitan migración.

**La fila del modelo** (`version_name`, `rules_version`) es una fila de base de datos y **sí** la necesita.
Y aquí hubo un hallazgo, el 2026-09-09: `model_versions` era el **quinto** catálogo sin canal a la nube, y
apareció justo al ir a cambiarlo. Ahora lo emite `scripts/gen-registry-migration.mjs` junto a los otros
cuatro, y `src/tests/registro-dos-canales.test.ts` afirma que el SQL commiteado es lo que el generador
produce hoy.

Así que un cambio de versión del modelo es: editar el seed, regenerar la migración, y aplicarla.
