// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS ALERTAS CLINICAS CRITICAS  ·  v17 §2.9  ·  2026-11-12
//
// ═══ ES PIEZA NUEVA EN ATLAS, NO UNA CORRECCION DE CORTES ═══
//
// Su archivo las compone dentro de la funcion grande que arma el objeto `motor` de su panel, y de ahi
// salen a la pantalla de la evaluacion y al texto que le pasa a la IA. Atlas no tenia NINGUNA de las
// seis: las quince alertas de `frozen/atlas-alertas.js` son de ENCUESTA (TCA, riesgo glucemico, sodio) y
// ninguna lee un indicador bioelectrico. Asi que esto se construye, no se ajusta.
//
// ═══ QUE CAMBIA LA v17 Y QUE YA ERA SUYO ═══
//
// Las SEIS son suyas y las seis se portan, con sus cadenas verbatim. Lo que la v17 cambia son tres:
//
//   · el IFC critico pasa del umbral unico `< 2,0` al P10 DE SU SEXO (H 3,49 · M 1,73);
//   · el IRC muy elevado pasa de `> 5,0` al P90 DE SU SEXO (H 2,30 · M 3,13);
//   · el ICA-BIS critico pasa de `> 3,0` a la cola extrema de su Tabla 7.3, leida por `cPABU`.
//
// Y EL ORDEN DE MAGNITUD DICE POR QUE IMPORTABA: un IFC < 2,0 en un hombre casi nunca se disparaba (su
// P10 es 3,49, o sea que el 10 % mas bajo de los hombres queda por encima del umbral viejo), y en una
// mujer se disparaba de mas. El umbral unico no era neutro: era el de un sexo aplicado a los dos.
//
// ═══ DOS DECISIONES DE INGENIERIA, Y LAS DOS TIENEN CONSECUENCIA CLINICA ═══
//
// 1. SE DERIVAN AL MOSTRAR, NO SE SELLAN. Igual que las severidades de los indicadores
//    (`indicatorSeverities`): se calculan desde los valores SELLADOS cada vez que se abre el informe.
//    Asi las alertas aparecen tambien en los diagnosticos ya emitidos, que es el 100 % de los que hay
//    hoy. Sellarlas habria dejado 441 consultas sin ellas para siempre.
//
// 2. EL ICA-BIS NO SE RECALCULA AQUI: se le pregunta a `cPABU`, que es quien tiene su Tabla 7.3. Esta
//    funcion no conoce ningun percentil del ICA-BIS, y eso es deliberado: duplicar esos ocho numeros
//    seria la segunda fuente que su §14 prohibe ("ninguna pantalla ni funcion contiene...").
//
// SIN SEXO NO SE EMITE NINGUNA de las tres por sexo, y sin dato (indicador en 0) tampoco: es su regla,
// y es la que su caso V comprueba.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
import * as core from "./frozen/engine.core.derived.js";
import type { SexoCanonico } from "./edge/normalize";

/** Lo que la alerta necesita del informe sellado. Todo opcional: un informe viejo puede no traerlo. */
export type InsumosDeLasAlertas = {
  sexo: SexoCanonico | null;
  ifc: number | null;
  irc: number | null;
  pabu: number | null;
  iae: number | null;
  ffmi: number | null;
  /** El sector de la Diana. La v17 define la obesidad sarcopenica como el sector S9. */
  sectorId: string | null;
};

const coma = (v: number) => v.toFixed(2).replace(".", ",");
const num = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * Las alertas criticas de esta consulta, en el orden en que su archivo las compone.
 *
 * Devuelve las cadenas TAL CUAL las escribe el, con el simbolo de aviso incluido: son texto clinico y
 * no se reescriben (Regla 0). La pantalla decide como pintarlas, no que dicen.
 */
export function alertasCriticas(i: InsumosDeLasAlertas): string[] {
  const sexo = i.sexo === "M" || i.sexo === "F" ? i.sexo : null;
  const ref = sexo ? core.ALERTA_CRITICA_REF[sexo] : null;
  const texto = sexo === "M" ? "hombres" : "mujeres";
  const ifc = num(i.ifc);
  const irc = num(i.irc);
  const pabu = num(i.pabu);
  const iae = num(i.iae);
  const ffmi = num(i.ffmi);
  // La lectura del ICA-BIS sale de SU clasificador, con su grado y su direccion. `g === 2` es la cola
  // extrema de su Tabla 7.3 (por encima del P90 o por debajo del P10).
  const ica = sexo && pabu ? core.cPABU(pabu, sexo) : null;

  return [
    ref && ifc > 0 && ifc < ref.ifcP10
      ? `⚠ IFC crítico (< ${coma(ref.ifcP10)}, P10 en ${texto}): disfunción celular severa`
      : null,
    ref && irc > 0 && irc > ref.ircP90
      ? `⚠ IRC muy elevado (> ${coma(ref.ircP90)}, P90 en ${texto}): inflamación crónica establecida`
      : null,
    iae && iae > 10 ? "⚠ IAE >10 años — envejecimiento acelerado severo" : null,
    ica && ica.g === 2
      ? ica.dir === "deficit"
        ? `⚠ ICA-BIS crítico (> P90 en ${texto}): alejamiento marcado del punto áureo por déficit`
        : `⚠ ICA-BIS crítico (< P10 en ${texto}): desplazamiento marcado del punto áureo por exceso`
      : null,
    // SUS DOS CORTES DE FFMI CRITICO, que no son los de `cFFMI`: su banda baja empieza en 17/15 y la
    // alerta en 15/13. Son dos cosas distintas y por eso no se unifican: la banda dice "riesgo de
    // desnutricion" y la alerta dice "desnutricion severa".
    (sexo === "M" && ffmi > 0 && ffmi < 15) || (sexo === "F" && ffmi > 0 && ffmi < 13)
      ? "⚠ FFMI crítico — riesgo desnutrición severa"
      : null,
    // v17 §7: *"la obesidad sarcopénica pasa a ser el sector S9 (FFMI bajo con FMI alto del MCCB)"*.
    i.sectorId === "S9" ? "⚠ Obesidad sarcopénica confirmada" : null,
  ].filter((x): x is string => x !== null);
}
