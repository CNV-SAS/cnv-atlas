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
| Motor clínico | **semver de tres** | `3.2.0` | `ENGINE_VERSION` (`src/clinical-engine/version.ts`) |
| Conjunto de protocolo | **semver de tres** | `1.0.0` | `PROTOCOL_ENGINE_VERSION` (mismo archivo) |
| Modelo | **semver de tres** | `1.0.0` | fila de `model_versions` (`version_name`) |
| Reglas | **semver de tres** | `1.0.0` | fila de `model_versions` (`rules_version`) |
| Encuesta | **entero** | `6` | fila de `survey_versions` (`version_number`) |
| Prompt del resumen de IA | **entero** | `14` | fila de `ai_prompts` (`criterio.generate`, `version`) y su JSON en `src/modules/diagnoses/ai/prompts/` |

**El motor subió a 3.2.0 el 2026-11-07: el borde exacto de ±5 del IAE se cierra, en los cuatro sitios.**
Lo destapó la simulación del recálculo: dos consultas con el IAE en **+5,0 exacto** no se destrababan, y la
causa era Atlas contradiciéndose consigo mismo en el borde. El texto que lee el paciente usaba el corte
cerrado (`>= 5`), el clasificador del profesional el abierto (`<= 5`), y las rutas R1 y R4 el abierto
también. Así que con un IAE de +5,0 el informe decía *"envejecimiento acelerado estimado"*, la tabla decía
*"Acorde con sus pares"*, y el tratamiento no traía la ruta que trata el envejecimiento.

El corte cerrado es **suyo** (su `cIAE` del v16, línea 4568, y sus condiciones de R1 y R4). Las tres piezas
se re-portaron byte a byte. Es **menor** porque la cifra de la EB-BIS y del IAE no se mueve: solo en qué
banda cae el valor exacto del borde. Sube también `emission_versions.classification` a `cXXX-2026-11-07`,
porque una etiqueta sellada sí se movió. Son **cuatro consultas** en la cohorte.

**Y una regla que salió de hacerlo dos veces en dos días:** mientras el recálculo esté sin aprobar, **cada
cambio de ciencia que se escriba después de un push necesita su propia versión**, porque la nube ya puede
estar sellando con la anterior. Pasó con la 3.0.0 y volvió a pasar con la 3.1.0.

**El motor subió a 3.0.0 el 2026-11-06, y es el segundo MAYOR.** La 2.0.0 trajo la EB-BIS v7 a la
pantalla y al informe, pero `analizarDFI` siguió calculando por dentro la **v5** y con ella resolvía el
dominio de envejecimiento, el riesgo integrado y la ruta R4. O sea que la casa quedó a medias: el mismo
documento llevaba dos lecturas del mismo hecho. Medido sobre las 422 consultas selladas con la v7, **70 se
contradecían**, y el freno de la contradicción (migración 0229) no las deja entregar: hay profesionales que
hoy no pueden enviar un informe.

Es MAYOR porque cambian las **severidades por dominio**, el **riesgo integrado** y las **rutas activas**: lo
emitido antes no es comparable con lo nuevo, que es la definición de este documento. En el caso de
referencia el dominio 3 sube de 0 a 1 y el riesgo de 25 a 30. Y hay una recuperación además del cambio: la
v5 necesitaba el ICEC, así que una consulta con la encuesta a medias se quedaba **sin** dominio de
envejecimiento; la v7 no lo necesita. El detalle está en `version.ts` y la autorización en
`CAMBIOS_AUTORIZADOS.md` **CA-3**.

**El motor subió a 3.1.0 el mismo 2026-11-06: el puntaje de alimentación del ICEC** (su v16 §4.2). Una
nutricionista reportó que la encuesta presentaba las carnes rojas y los embutidos como protectoras;
Gildardo lo verificó en su archivo y en Atlas, y lo corrigió. `calcPatron` se re-portó de su `ATLAS_v16.html`
del 4 de noviembre: entran los siete grupos protectores (los huevos no puntuaban), los embutidos se
penalizan al doble, las carnes rojas dejan de sumar por comerlas a menudo, y con embutidos de 3 a 4 días o
más el puntaje se topa en 54. Los valores esperados son los siete casos de su §5, no nuestros.

**Se escribió primero como "la segunda mitad de la 3.0.0", y se separó por un hecho:** la 3.0.0 **ya se
había empujado** (21:00 del mismo día), así que la nube puede estar sellando consultas con `3.0.0` y el
cálculo anterior. Dejar el re-porte dentro de la 3.0.0 haría que **una misma versión cubriera dos
matemáticas**, que es justo lo que la constelación de versiones existe para impedir. Un bump cuesta una
línea; averiguar después cuál de los dos cálculos selló un snapshot no se puede.

**Y es MENOR, no mayor, y eso se sostiene con la medición:** el ICEC se mueve un punto (−1 exacto en las 62
consultas del grupo del mayor 2), el dominio 5 no se movió en ninguna de esas 62, y lo que la
comparabilidad protege de verdad es la resta de dos EB-BIS, que esta versión **no toca**, porque en la v7 el
ICEC ya no entra al cálculo.

**El recálculo de lo ya emitido va aparte, con su simulación previa.**

**El motor subió a 2.0.0 el 2026-10-28, y fue el primer MAYOR.** Entró la EB-BIS v7 (parámetros 7.1.0,
entrega de Gildardo del 26 de octubre) y la v5 se retiró del motor. Cumple la definición de mayor de este
documento, y la segunda mitad es la que obliga: `sonComparables` (`followups/eb-trajectory`) se niega a
restar dos EB-BIS de mayores distintos, y esa resta es la que el paciente ve como "mejoró" o "empeoró".
Con un bump menor, la banda habría restado una EB v7 contra una v5 sellada y le habría mostrado el salto
de escala como si fuera su cambio. El detalle de qué se mueve está en `version.ts`.

**Los prompts NO se renumeran a v1 (pregunta de Santiago, 2026-09-21).** Es la misma razon que el sello del
motor: cada resumen de IA guarda con que version se genero (`ai_criterion_suggestions.prompt_version`), y en
la nube ya hay **11 diagnosticos** con resumen (1 con la v1, 5 con la v3, 5 con la v4). Renumerar haria que
esos registros apuntaran a un texto que no es el que los genero. Ademas `ai_prompts` no admite dos filas con
la misma clave y version: la v1 nueva chocaria con la v1 vieja, y la unica forma de meterla seria borrar la
historia. **Lo mas barato es no hacer nada**: la version vigente es la que sale a produccion (hoy la v7, que corrige
lo que las pruebas de Santiago encontraron en la v5 y la v6), y si se quiere un nombre oficial basta con una linea aqui:
*la version vigente de `criterio.generate` al salir a produccion es la primera oficial*.

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
