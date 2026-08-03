# Plan: field_keys de los campos que leen los motores de TRATAMIENTO (2026-08-03)

Carril lento, con gate. Cierra el hueco del smoke (estrés/medicamentos) + lo que salga del inventario.

## (3) Inventario: qué campos leen los motores y no tienen field_key

Comparando lo que HAY (13-14 field_keys `engine:true`) con lo que leen las funciones de tratamiento:

- **Motores de tratamiento por profesión (D-008), sin field_key:**
  - `d3_29` (estrés) — motor psicológico.
  - `d5_40` (medicamentos) — motor médico (interacciones fármaco-nutriente).
- **Motor nutricional / cadena calórica (`motorTratNutri`, en pausa por C6), sin field_key:**
  - `d7_57` (sed reportada) — estrategia de hidratación.
- **Total a cubrir en esta migración: TRES — `d3_29`, `d5_40`, `d7_57`.** Los tres alimentan motores de tratamiento y ninguno el diagnóstico (verificado: el frozen de diagnóstico no los lee; `d3_29` solo el path muerto `RUTA_COND.R5`).
- **Fuera de alcance (bloque resumen, aparte):** los cuatro párrafos narrativos `_resumenXXXParrafo` leen además `d3_25, d3_27, d3_31, d6_43, d6_44, d6_qx, d7_55, d7_56, d7_agua, d8_59, d8_60`. Esos son del bloque de resumen clínico (no portado) y varios cambian con C9 (`d1_*`) / Q26 (`d7_agua`). NO entran ahora: se portan con el resumen, contra la encuesta ya estabilizada.

## (2) dfi.complete: el nudo, y por qué NO se rompe con este diseño

**El problema si se hace ingenuamente:** `expectedFieldKeys` (contra el que se mide `dfi.complete`) se computa hoy como "todas las preguntas CON field_key" (`pipeline-reader.ts:86-92`), sin mirar `used_in_diagnosis`. Si a los tres campos se les pone `engine:true` a secas, entrarían a `expectedFieldKeys`, y `dfi.complete` pasaría a exigir 3 campos MÁS. Consecuencias que verificaste:
- (a) **Demos mezclados:** unos evals responden estrés/meds/sed, otros los dejan null. Así que algunos diagnósticos NUEVOS saldrían incompletos.
- (2d) Con **D-007** (encuesta incompleta) pendiente, `complete` decidirá qué se emite. Exigir campos de TRATAMIENTO para la completitud del DIAGNÓSTICO sería incorrecto: esos tres campos NO afectan el diagnóstico, así que no deben suprimir nada de él.

**La solución (limpia, resuelve b/c/d de una vez): distinguir "campo de motor" de "campo de completitud del diagnóstico".**
- Ya existe la columna `used_in_diagnosis` (seed la setea = `engine`). Hoy coinciden porque todos los field_keys eran de diagnóstico.
- **Se añade field_key a los tres campos de tratamiento con `used_in_diagnosis = false`** (los lee un motor, pero NO el diagnóstico).
- **`expectedFieldKeys` pasa a filtrar por `used_in_diagnosis = true`** (no por presencia de field_key). Como los 13-14 actuales son todos `used_in_diagnosis=true`, el conjunto NO cambia: `dfi.complete` de los evals actuales queda IGUAL.
- Resultado: **`dfi.complete` no cambia** (sigue siendo el set del diagnóstico), así que:
  - (2 retroactivo) NO hay incompletitud retroactiva: el set del diagnóstico es el mismo; los diagnósticos sellados conservan su `complete` y su significado.
  - (2b) NO exige versión nueva de encuesta: no cambia lo que la encuesta declara AL PACIENTE (las preguntas ya existen) ni el set de completitud del diagnóstico. Cambia una marca interna (qué motor lee qué).
  - (2c) NO rompe la corregibilidad: sin versión nueva, las evaluaciones actuales siguen siendo corregibles (el gate del flujo de corrección compara `survey_version_id`).
  - (2d) D-007 queda correcto: `complete` gatea solo lo que depende del diagnóstico; los campos de tratamiento no lo suprimen.

## La migración (forward-only, con gate)

1. **Seed:** marcar `d3_29`, `d5_40`, `d7_57` para que reciban field_key SIN `used_in_diagnosis` (un flag nuevo, p. ej. `treatmentEngine: true`, que da `field_key = key` y `used_in_diagnosis = false`).
2. **Migración SQL:** setear `field_key` en esas tres preguntas de la versión de encuesta vigente, con `used_in_diagnosis = false`. Forward-only, sin DROP.
3. **`pipeline-reader.ts`:** `expectedFieldKeys` filtra `used_in_diagnosis = true` (backward-compatible: mismo set hoy). Golden que confirme que `dfi.complete` de un eval existente no cambia.
4. **Verificar el acoplamiento de `d5_40`:** las opciones (Metformina, Antihipertensivo, Estatinas, Levotiroxina, Insulina, Otros) contra las regex del motor médico (matchean Metformina→B12, Estatinas→toronja, Levotiroxina→calcio; "Antihipertensivo"/"Insulina" no matchean regex específica, igual que en el prototipo de Gildardo). Sin cambio de opciones.
5. **Display:** los readers de tratamiento ya leen por field_key; al existir, `estresCaptured`/`medsCaptured` pasan a true solos y aparece el valor real (auto-corrector, ya construido).

**Decisión que necesito antes de construir:** ¿de acuerdo con NO bumpear versión de encuesta y resolver por `used_in_diagnosis` (mi recomendación, no rompe corregibilidad ni completitud)? Es la pieza que hace todo lo demás seguro.
