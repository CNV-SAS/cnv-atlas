# Fixtures de prueba del motor clínico

Dos fixtures de datos BIS con propósitos distintos. No son intercambiables.

## `biody_synthetic.xlsx` — SOLO para el IMPORT (B8)

- Estructura de un export de Biody Manager (hoja `Measures`, 180 columnas, headers reales).
- **Valores numéricos placeholder, NO fisiológicos.** Ejemplos: `Extracellular resistance = 59`,
  `Intracellular resistance = 6`, `FFMI = 73`. Están fuera del rango fisiológico que exige el
  motor (`assertEngineInputs` en `src/clinical-engine/edge/biody-import.ts`).
- **Sirve para probar el import** (parseo, mapeo de headers, exclusión de PII, rangos laxos de
  `import-schema`), **no para alimentar el motor**: si se corre el pipeline sobre estos valores,
  el motor los rechaza con `ClinicalInputError` (y hace bien: es su guardia fail-loud).
- Preserva a propósito las **rarezas de estructura** del export real que ejercen la regla de
  normalización: el sexo en inglés (`"Género" = "Male"`) y los antropométricos en `null`
  (`Chest/Biceps/Thighs Size cm`, caso del atleta). Ver `fixtures-integrity.test.ts`.
- Generado por `generate-biody-fixture.mjs`.

## `clinical-engine/biody-juan-esteban-anon.json` — VALORES REALES para el MOTOR

- Fila real del export de Biody, **anonimizada** (sin PII: el motor solo usa columnas numéricas
  + `Género`), con valores fisiológicos reales.
- Es el **gold** de los golden tests (`clinical-engine-golden.test.ts`) y la fuente del caso
  golden-path (`golden-path.seed.test.ts`), que construye un XLSX en memoria a partir de este
  JSON para pasarlo por el import BIS real.
- Trae **valores reales + las mismas rarezas** (`"Género " = "Male"`, `Chest/Biceps/Thighs = null`):
  por eso alimenta el motor de verdad y a la vez cubre el borde de normalización.

## En resumen

| | valores | rarezas de estructura | uso |
|---|---|---|---|
| `biody_synthetic.xlsx` | placeholder (no motor) | sí | probar el import (B8) |
| `biody-juan-esteban-anon.json` | reales | sí | alimentar el motor (golden + golden-path) |
