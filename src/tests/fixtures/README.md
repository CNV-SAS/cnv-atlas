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

## `clinical-engine/biody-{hombre,mujer}-zm3-anon.json` — dos casos ZM3 reales, anonimizados

- Exports reales de un **BiodyXpert ZM3** (el equipo completo), traídos por Santiago para el seed y
  los smokes (2026-08-04). Anonimizados siguiendo el patrón del gold: nombre sintético
  (`"Paciente sintetico ZM3 ..."`), **sin fecha de nacimiento** (excluida, como el gold; el import la
  descarta de todos modos), IDs de medición en 0. Convertidos de `.xlsx` a JSON A PROPÓSITO: un
  `.xlsx` es binario y git no muestra qué cambió dentro; un fixture de datos clínicos tiene que poder
  revisarse en un diff (con todo lo que se encontró de datos mal capturados, un fixture ilegible en
  diff es un riesgo).
- **El femenino es el primero que ejercita la mitad SEXO-ESPECÍFICA del motor POR EL PIPELINE** (antes
  solo por unit test). Mujer ~46 años, IMC ~34, cintura 87 / cadera 113,9.
- **AVISO del hombre: sus circunferencias son ESTIMADAS, no medidas.** El export real del hombre no
  traía cintura ni cadera (el ZM3 no siempre las captura); Santiago les puso valores coherentes con su
  perfil (110 kg, 169 cm, IMC ~38,5): cintura 124 / cadera 120 (ICC ~1,03, ICT ~0,73). Ese registro
  EJERCITA el sistema, no es dato clínico medido. El motor NO consume cintura/cadera (verificado
  2026-08-04), así que no afecta el diagnóstico; solo el ratio antropométrico que se muestra.

## En resumen

| | valores | rarezas de estructura | uso |
|---|---|---|---|
| `biody_synthetic.xlsx` | placeholder (no motor) | sí | probar el import (B8) |
| `biody-juan-esteban-anon.json` | reales | sí | alimentar el motor (golden + golden-path) |
