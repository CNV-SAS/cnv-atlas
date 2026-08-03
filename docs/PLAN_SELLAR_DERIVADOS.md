# Inventario + plan: sellar lo que el motor produce y no llega al snapshot (2026-08-03)

**Por qué.** Cuarta vez del mismo patrón (el motor produce algo que no llega donde hace falta): nutracéuticos recomendados (sellados solo dentro de un texto), suplementación (en el panel médico, siendo nutricional), cAF/cIR (calculados y no llamados), y ahora ASMI (calculado y no sellado). `protocol_suggested` y el snapshot del reporte son write-once: cada vez que se sella sin un campo, ese registro queda incompleto para siempre. Este inventario cubre TODOS los derivados de una vez, antes de la migración.

## (a) Qué computa el pipeline que NO llega al snapshot

| Valor | Se computa en | ¿Sellado? | Recuperable |
|---|---|---|---|
| **ASMI** (MMEM/talla²) | `biody-import` (derivado); alimenta el fenotipo | **NO** (ni en los 12 indicadores del reporte, ni en `protocol_suggested`) | Re-derivable de `bis_raw_values` (MMEM+talla), pero eso duplica la derivación del borde (familia del bug de cintura) |
| FMI, FFMI | motor | SÍ (12 indicadores, snapshot reporte) | — |
| AF, MCA_dif, hidSG, hidSG_ref, ECM_BCM, sector | protocolo | **SÍ** (protocol_suggested, badge inputs Niveles II/III) | — |
| caloricoInputs (ffm, talla, edad, sexoM) | protocolo | SÍ (protocol_suggested) | — |
| Columnas crudas Biody (MMEM, AEC, ACT, MCA, ángulo, smmW...) | import | En `bis_raw_values` (persistido, no en el snapshot) | Sí, del raw |

**Conclusión: el único derivado que NO está sellado ni en el snapshot ni en protocol_suggested, y que un consumidor necesita, es ASMI.** Los badge inputs ya se sellan (protocol_suggested); los crudos están en bis_raw_values. ASMI es exactamente "un dato que se computa y se descarta antes de sellar" (tu observación): sellarlo no agrega ciencia, deja de perder algo que ya existe.

## (b) Qué consumen los tres motores + la cadena calórica

- **Médico:** `bis.{talla, peso, sexo, FFMI, ASMI}`. Gap: **ASMI**.
- **Ejercicio:** `bis.{talla, peso, sexo, FMI, FFMI, ASMI}`. Gap: **ASMI**.
- **Psicológico:** solo encuesta. Sin gap.
- **Cadena calórica (futura, `motorTratNutri`):** lee `b.{talla, peso, FMI, FFMI, ASMI, iehh, AEC, ACT, sexo, edad}`. talla/peso/sexo/edad (medición+paciente), FMI/FFMI/IEHH sellados, **ASMI gap**, AEC/ACT crudos (bis_raw_values). Así que la cadena suma la misma dependencia de ASMI y los dos crudos de hidratación (recuperables del raw).

**El gap común y único es ASMI.** No hay un segundo campo derivado-y-perdido que los consumidores necesiten: el resto o está sellado o está en el raw.

## (c) Plan alimentario + T3, hasta donde se anticipa

- **Plan alimentario:** consume kcal/proteína/macros, que la cadena calórica sella en `protocol_suggested.calorico`. Sin gap nuevo de derivados BIS.
- **T3 (nutracéuticos estructurados P1/P2/dosis):** el string recomendado ya se sella; la estructura es catálogo de producto (referencia). Sin gap de derivados BIS.
- No se anticipa un segundo derivado BIS perdido para estos.

## La migración: sellar ASMI (y solo ASMI, el inventario lo confirma)

- **Qué:** exponer `ASMI` en el `EngineOutput` (adaptador TS, NO frozen: ASMI ya se deriva en `biody-import`, solo se pasa a la salida), para que el pipeline lo selle en el snapshot del reporte junto a FMI/FFMI.
- **Alcance:** carril lento (toca la forma del snapshot SELLADO). Es ADITIVO: no cambia ningún valor existente; los snapshots viejos no tienen `output.ASMI` (undefined), los nuevos sí. El snapshot es `jsonb`, así que NO hay migración de esquema SQL, es cambio de código de la salida + re-ancla del golden del snapshot.
- **Versión:** NO cambia ningún valor sellado existente (es aditivo, como cuando se agregó `emission_versions`), así que probablemente NO exige bump de `ENGINE_VERSION`; a decidir en el plan detallado (criterio cMMEM: si no cambia lo sellado, no bumpea).
- **Consumo:** los tres motores (y la cadena) leen `bis.ASMI` del snapshot; para snapshots viejos sin ASMI, el motor degrada como ya hace ante un input ausente (sarcopenia por FFMI). Se documenta.
- **Gate y verificación:** golden del snapshot que asserta que ASMI se sella con el valor derivado; que coincide con el reportado por el equipo (ancla anti-bug-cintura, ya existe para el fenotipo).

**Decisión que necesito antes de construir:** ¿ASMI se sella en el snapshot del REPORTE (junto a FMI/FFMI, mi recomendación, porque es dato de diagnóstico) o en `protocol_suggested`? Mi recomendación: el reporte, porque es un valor de composición del diagnóstico y los motores lo leen como parte del `bis`.
