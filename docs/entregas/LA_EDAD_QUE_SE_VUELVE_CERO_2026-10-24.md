# La edad que se vuelve cero: el cambio propuesto, qué toca y qué pasa con las tres selladas

**Fecha:** 2026-10-24 · **Para:** Santiago · **Estado:** PROPUESTA, NO CONSTRUIDA.
**Viene de:** el informe de la EB-BIS del 22 de octubre, §4.1, donde quedó solo reportado.

---

## 0 · Lo que medí hoy, y es peor de lo que dije el 22

El 22 lo reporté así: *"tres filas con una edad inválida, y su IAE es ficción"*. Es cierto, pero me quedé
corto, porque no había mirado **dónde entra la edad en el motor**. Lo hice ahora, y entra en cuatro sitios,
no en uno:

| dónde | qué decide | qué pasa con edad **0** | qué pasa con edad **231** |
|---|---|---|---|
| `computeIAE` | El IAE | `IAE = EB - 0 = EB`. **Un número de aceleración del envejecimiento que es invención** | `IAE = EB - 231` (los **-208,1** que vimos) |
| `capRef` (capacitancia) | La clasificación de capacitancia contra el percentil por sexo y década | Devuelve `null`: **la clasificación se pierde**, sale "Sin referencia (falta sexo o edad)" | Cae en la banda de 70+ como "fuera de rango", marcado |
| `atlas-tratamiento-nutri.js:97` | Un GEB de Mifflin sobre el peso meta, dentro de la cadena calórica | **`Number(e.edad)||30`: la edad 0 se vuelve 30.** Para una paciente de 46 son 80 kcal de más | `-5 x 231` da un GEB absurdo |
| `atlas-asesoria-macro.js:101` | El aviso de resistencia anabólica de los 65+ | `||0`: el aviso **nunca sale** | Sale aunque no corresponda |

**Lo único que se salvó, y por suerte, no por diseño:** `ATLAS_GEB_HB` (Harris-Benedict) **sí** tiene guarda
(`if (!(p > 0 && t > 0 && e > 0)) return null`), y además `ATLAS_GEB` prefiere el GEB **medido por el
equipo** cuando viene. Verifiqué las tres mediciones: **las tres traen el GEB del equipo** (1366, 1369 y
1926 kcal), así que Harris-Benedict nunca corrió y el gasto basal del diagnóstico quedó bien.

### Y la asimetría que hay que llevarle a Gildardo

**Tres archivos del motor congelado tratan la edad ausente de tres maneras distintas:** uno la vuelve **0**
(`asesoria-macro`), otro la vuelve **30** (`tratamiento-nutri`), y el tercero **se niega a calcular** y
devuelve `null` (`atlas-geb`). El tercero es el que está bien. Los otros dos inventan un número.

**Eso NO lo tocamos**: es su matemática, y la Regla 0 dice que se reporta, no se corrige. Pero conviene que
lo sepa, porque es el mismo defecto que la EB-BIS en pequeño: una ausencia convertida en un valor plausible.

---

## 1 · El cambio propuesto: toca SOLO nuestra capa

**La respuesta corta a su pregunta: solo nuestra capa.** `computeAge` vive en
`src/modules/clinical-pipeline/services/build-engine-input.ts`, que es un módulo de la aplicación, **no**
`src/clinical-engine/`. No se toca un decimal del motor congelado.

Y no hay que inventar el diseño, porque **ya existe veinte líneas más abajo, en el mismo archivo**. El sexo
tuvo exactamente este problema y se resolvió en dos piezas:

1. **`normalizeSex` LANZA.** No adivina: ante cualquier cosa que no sea F o M falla en voz alta, diciendo
   qué valor llegó. Su comentario: *"un sexo mal asignado corrompe el diagnóstico ENTERO"*.
2. **`sexoParaDiagnosticar` es la PUERTA**, y se mira antes, en `run-pipeline.ts` (la "quinta puerta") y en
   `correct-evaluation.ts`. Convierte lo que sería un 500 con la pantalla caída en una frase que dice qué
   falta. Y distingue dos casos con dos mensajes distintos: el que **se arregla en la ficha** (lleva una
   bandera para que la pantalla ofrezca el enlace) y el que no (*"avísale a quien administra Atlas"*).

**La propuesta es la misma estructura, con la fecha de nacimiento.** Dos piezas:

### Pieza 1 · `computeAge` deja de devolver 0

```ts
// Edad en anos cumplidos desde birthDate hasta now (UTC, determinista). NO ADIVINA: una fecha ausente o
// ilegible FALLA EN VOZ ALTA, igual que normalizeSex veinte lineas mas abajo y por la misma razon. Antes
// devolvia 0, y ese 0 no se quedaba quieto: el IAE salia igual a la EB-BIS entera (+28,1 anos de
// "aceleracion del envejecimiento", un numero que se lee perfectamente plausible), la clasificacion de
// capacitancia se perdia, y el GEB de la cadena calorica trataba al paciente como si tuviera 30.
export function computeAge(birthDate: string | null, now: Date): number {
  const edad = edadSiSePuede(birthDate, now);
  if (edad === null) {
    throw new Error(`computeAge: fecha de nacimiento invalida, llego: ${JSON.stringify(birthDate)}`);
  }
  return edad;
}
```

### Pieza 2 · la puerta, con sus dos mensajes

```ts
export function edadParaDiagnosticar(birthDate: string | null): PuertaDeLaEdad {
  if (!birthDate) {
    return {
      allowed: false,
      enLaFicha: true,
      message:
        "Falta la fecha de nacimiento del paciente, y sin ella no se puede generar el diagnóstico: " +
        "la edad entra en el índice de aceleración del envejecimiento y en la clasificación de " +
        "capacitancia. Complétala en la ficha del paciente y vuelve a intentarlo.",
    };
  }
  // ... fecha ilegible, o una edad fuera de lo humanamente posible -> mismo camino, otro mensaje
}
```

Y se mira en los **dos** sitios donde ya se mira el sexo: `run-pipeline.ts` (junto a la quinta puerta) y
`correct-evaluation.ts`. En un solo sitio no sirve: el flujo de corrección entra por el otro.

### El corte de "fuera de lo humanamente posible"

Aquí hay un punto de la Regla 0 que hay que respetar: **ningún umbral que decida sobre un dato clínico se
escribe sin su fuente al lado**, y si no hay fuente, el valor va tan ancho que solo atrape lo **imposible**.
Así que propongo **0 a 130 años**, que no es un criterio clínico: es el rango de lo que puede ser una
persona viva. Atrapa los tres casos reales (una edad 231 de un año 1795, y dos ceros de años de cinco
dígitos) y no toca a nadie más. No propongo un corte por "paciente muy joven" ni nada parecido: eso sí sería
una cifra nuestra decidiendo sobre un paciente.

---

## 2 · Lo que el cambio frena, y es poco

Medí el impacto antes de proponerlo. De las **366** evaluaciones diagnosticadas de la cohorte real:

| | |
|---|---|
| Con edad derivable de la fecha de nacimiento de hoy | **352** |
| Sin fecha de nacimiento legible hoy | **14** |
| **Diagnósticos ya sellados que el aviso de edad marca como no confiables** | **3** |

Los 14 sin fecha **ya están diagnosticados**: el cambio no les quita nada, porque solo actúa al generar un
diagnóstico nuevo o al corregir uno. Lo que haría es que, el día que alguien les genere un seguimiento, la
pantalla diga *"falta la fecha de nacimiento, complétala en la ficha"* en vez de calcular un IAE inventado.
**Eso es exactamente lo que queremos.**

> **El riesgo real, y hay que decirlo:** este cambio **frena un diagnóstico** que hoy sale. Si una integrante
> está con el paciente al frente y la fecha está mal, no va a poder diagnosticar hasta arreglarla. Es el
> mismo costo que ya aceptamos con el sexo, y por la misma razón: **un diagnóstico que sale con un número
> inventado es peor que uno que no sale**, porque nadie se entera. Y a diferencia del sexo, este sí se
> arregla desde la ficha en diez segundos, por eso la bandera `enLaFicha`.

---

## 3 · Las tres selladas: van por el camino de corrección, y están limpias

Usted dijo que deberían ir por el camino de corrección versionada. **Es el camino correcto, y además están
las tres en condiciones de tomarlo.** Lo verifiqué una por una en producción:

| | evaluación 1 | evaluación 2 | evaluación 3 |
|---|---|---|---|
| Fecha de nacimiento **hoy** | 1980-04-19 | 1975-02-21 | 1977-05-28 |
| ¿Legible? | **sí** | **sí** | **sí** |
| Edad que usó el motor | **0** | **231** | **0** |
| Versión de encuesta | **la activa** | **la activa** | **la activa** |
| Reporte | borrador | borrador | borrador |
| ¿Enviado al paciente? | **no** | **no** | **no** |
| Tratamiento | ninguno | ninguno | ninguno |
| ¿Reemplazada o retirada? | no | no | no |

**Las fechas ya están corregidas** (las arregló el script del 9 de octubre, que advirtió en su momento que
el diagnóstico sellado no se rehacía). Así que al correr la corrección, el motor lee la fecha buena y
recalcula con la edad de verdad.

**Las tres pasan las tres compuertas del flujo de corrección:** ninguna está reemplazada, las tres están en
la versión activa de la encuesta, y el rechazo de "no cambió nada" no se dispara, porque el IAE y la
clasificación de capacitancia **sí** cambian.

**Y lo más importante: no hay nada entregado que reparar.** Los tres reportes están en borrador y ninguno se
envió; ninguna tiene tratamiento, así que el GEB con edad 30 nunca llegó a una prescripción. La corrección
deja la versión vieja legible como reemplazada y emite la nueva, sin que ningún paciente tenga en la mano un
documento que contradiga al nuevo.

**La única fricción es de permisos:** corregir es del profesional asignado, no de admin. Así que o lo hace
cada profesional desde la pantalla (son tres clics), o se corre un script con service role dejando constancia
en `clinical_audit_log`. Recomiendo lo primero: es el camino normal y queda atribuido a quien corresponde.

---

## 4 · Lo que propongo hacer, en orden

1. **El cambio de `computeAge` + la puerta**, con su test (misma forma que el del sexo: que lance, que la
   puerta lo atrape antes, y que la atrape en los **dos** sitios).
2. **La suite de BD completa**, porque toca el pipeline del diagnóstico.
3. **Avisarle a los tres profesionales** para que corrijan las tres evaluaciones desde su pantalla.
4. **Reportarle a Gildardo la asimetría de los tres archivos** (0, 30 y `null` para la misma ausencia). Es
   suya, no la tocamos.

**Usted dijo que si es solo nuestra capa se inclina por hacerlo. Lo es.** Espero su visto bueno para
construirlo, porque frena un diagnóstico que hoy sale, y esa decisión no es mía.
