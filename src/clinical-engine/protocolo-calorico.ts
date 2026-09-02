// Cadena aritmetica del protocolo calorico (T2 A3). TRANSCRIPCION de ATLAS.html:14124-14137,
// no ciencia congelada: su fuente es inline dentro del render (no un artefacto independiente),
// asi que NO va a frozen/ (regla 5 exige clinical-engine, no frozen/). Cada linea lleva su
// linea de origen. El orden de redondeo es IDENTICO al de la fuente (cada Math.round en su
// paso, en su orden). Su paridad con los bytes de Gildardo la prueba GOLDEN 1 contra el harness
// Via C (que corre el slice verbatim); si GOLDEN 1 falla, es hallazgo, va a GILDARDO_QUERIES y
// se para, no se reconcilia.
//
// peso_efectivo = adj_peso_meta ?? pesoCalculo lo resuelve el CALLER y entra como `pesoN` a
// PRECISION COMPLETA (no se redondea; el 73.6 de la pantalla es solo render). pesoN entra a
// TODA la cadena donde el HTML usa pesoN: la rama Mifflin del GEB y protG.

import { ATLAS_GEB_HB } from "./frozen/atlas-geb.js";

export type ProtocoloCaloricoInput = {
  /**
   * Masa libre de grasa. SE CONSERVA EN LA ENTRADA pero YA NO DECIDE LA FORMULA (2026-09-02): sostenia la
   * rama del `500 + 22 x FFM`, que el declaro mal rotulada. Sigue aqui porque el snapshot sellado la trae
   * y quitarla del tipo rompería la lectura de todo lo ya sellado.
   */
  ffm: number;
  pesoN: number; // peso_efectivo = adj_peso_meta ?? pesoCalculo, resuelto por el caller (:14122)
  talla: number; // :14120 tallaP
  edad: number; // :14119 edadN
  sexoM: boolean; // :14118 sexoM_pn
  deficit: number; // pr.estrategia.deficit (del motorProtocolo congelado)
  protMin: number; // pr.protMin (del motorProtocolo congelado)
  // NO HAY `gebMedido` AQUI, y es deliberado: el gasto que mide el equipo corresponde al peso ACTUAL,
  // asi que sirve para mostrar el basal de hoy, no para fijar la ingesta que lleva a la meta. Es la frase
  // que Gildardo dejo pegada a `_mtn.geb` en su archivo. Lo verifica `geb-una-sola-fuente`.
  // Overrides del profesional (formulaEditPN / protocAprobado). undefined = usar el sugerido.
  geb?: number; // formulaEditPN.geb
  pal?: number; // formulaEditPN.pal
  kcalObj?: number; // protocAprobado.kcal_obj
  protGkg?: number; // protocAprobado.prot_gkg
  fatPct?: number; // protocAprobado.fat_pct
};

export type ProtocoloCaloricoOutput = {
  /**
   * DE DONDE SALIO EL GASTO BASAL, y va a pantalla: el profesional tiene que saber si mira una MEDICION o
   * una ESTIMACION. Es su propia condicion al entregar `ATLAS_GEB`.
   *
   * "Cunningham" desaparece de los valores nuevos, pero se conserva en el tipo porque los snapshots
   * SELLADOS antes del 2026-09-02 lo llevan escrito y siguen leyendose.
   */
  formula: "equipo" | "Harris-Benedict" | "Cunningham" | "Mifflin";
  gebAuto: number;
  geb: number;
  pal: number; // factor de actividad usado (1.375 por default; ver encabezado de atlas-protocolo.js)
  get: number;
  kcalObj: number;
  protGKg: number;
  protG: number;
  protKcal: number;
  fatPct: number;
  fatG: number;
  fatKcal: number;
  choKcal: number;
  choG: number;
  choPct: number;
};

export function computeProtocoloCalorico(i: ProtocoloCaloricoInput): ProtocoloCaloricoOutput {
  // `ffm` ya NO se desestructura: sostenia la rama del "Cunningham" que se retiro. Se conserva en la
  // ENTRADA (el snapshot sellado la trae) pero aqui no decide nada.
  const { pesoN, talla, edad, sexoM, deficit, protMin } = i;

  // EL GASTO BASAL SALE DEL EQUIPO, Y SI NO VINO, DE HARRIS-BENEDICT (su §9.6, 2026-09-02).
  //
  // Y AL PORTARLO APARECIO DE DONDE VENIA NUESTRA FORMULA, que es peor que el cambio en si: el
  // `ffm > 0 ? 500 + 22 x FFM : Mifflin` que vivia aqui NO se copio de su cadena del nutricionista. Se
  // copio del bloque de la FORMULA SINTETICA DEL MEDICO, que en su archivo esta DESACTIVADO
  // (`false && hasBis`, marcado "OLD MEDICO IIFE REMOVED"). Su cadena del plan nutricional NO calcula
  // el GEB desde al menos el 19 de agosto: lo LEE de `motorTratNutri` (`var gebAuto = _mtn.geb`).
  //
  // O sea que llevabamos semanas calculando el gasto con una formula de un bloque muerto, mientras la
  // suya leia la del motor. Es la divergencia que el midio en hasta 205 kcal sobre el mismo paciente.
  //
  // LO QUE ESTO REPRODUCE, y por eso no es una formula nuestra: `_mtn.geb` ES `ATLAS_GEB_HB(pesoMeta,
  // talla, edad, sexoM)`. Aqui se llama a la MISMA funcion congelada con el mismo peso efectivo, asi que
  // da la misma cifra por construccion. No se puede llamar al motor entero desde aqui porque necesita la
  // encuesta, y esta cadena corre sobre el snapshot SELLADO; el candado `geb-una-sola-fuente` comprueba
  // que las dos den lo mismo, que es lo que impide que vuelvan a separarse.
  //
  // LO QUE ESTO RETIRA: aqui vivia `ffm > 0 ? 500 + 22 x FFM : Mifflin`, con la primera rama rotulada
  // "Cunningham". El acaba de declarar que ESA FORMULA NO ES CUNNINGHAM (que es 370 + 21,6 x FFM), y que
  // entre ella y la Mifflin del otro motor habia hasta 205 kcal de diferencia sobre el mismo paciente.
  // Su frase: "esa diferencia no era de criterio clinico, era de no haber usado el dato que ya estaba".
  //
  // Y EL PESO CON EL QUE SE CALCULA SIGUE SIENDO EL META, no el actual, que es la otra mitad de su
  // decision (§9.6 punto 3, confirmando lo del 26-ago): "el gasto medido es el de hoy, sobre el peso
  // actual; la ingesta que lleva a la meta se calcula sobre la meta". Son dos preguntas distintas con la
  // misma formula, y `pesoN` ya es el peso efectivo que resuelve el caller.
  // EL GASTO MEDIDO POR EL EQUIPO NO ENTRA AQUI, y esto es lo contrario de lo que parece decir su
  // §9.6 punto 1 leido solo. Lo aclara el comentario que el mismo dejo pegado a `_mtn.geb`:
  //
  //   "El gasto MEDIDO por el equipo corresponde al peso actual, asi que sirve para mostrar el basal de
  //    hoy -eso hace ATLAS_GEB- pero no para fijar la ingesta que lleva a la meta. Son dos preguntas
  //    distintas con la misma formula."
  //
  // O sea: `ATLAS_GEB` (medido primero) es para MOSTRAR el basal de hoy, en otro sitio de su archivo;
  // `ATLAS_GEB_HB(pesoMeta, ...)` es lo que fija la INGESTA, y es lo unico que su cadena lee. Su propia
  // pantalla lo confirma sin querer: la nota del campo GEB mira `_mtn.gebOrigen`, que motorTratNutri
  // NUNCA define, asi que en el panel de prescripcion siempre dice "Harris-Benedict".
  //
  // POR QUE IMPORTA: para un paciente que baja de peso, la meta es MENOR que el peso actual, asi que el
  // basal medido (que es el de hoy) es MAYOR. Usarlo aqui prescribiria mas calorias justo en la
  // direccion que aleja de la meta. Sobre un hombre de 90 kg con meta 80 son ~190 kcal/dia de mas.
  const gebAuto = ATLAS_GEB_HB(pesoN, talla, edad, sexoM) ?? 0;
  const formula: ProtocoloCaloricoOutput["formula"] = "Harris-Benedict";
  // :14125 gebN = override ?? gebAuto
  const gebN = i.geb !== undefined ? Number(i.geb) : gebAuto;
  // :14126 palN = override ?? 1.375 (PAL es ENTRADA, ver encabezado de frozen/atlas-protocolo.js)
  const palN = i.pal !== undefined ? Number(i.pal) : 1.375;
  // :14127 getN = round(gebN * palN)
  const getN = Math.round(gebN * palN);
  // :14128 kcalObj = override ?? max(1000, round(getN - deficit))
  const kcalObj =
    i.kcalObj !== undefined ? Number(i.kcalObj) : Math.max(1000, Math.round(getN - deficit));
  // :14129 protGKg = override ?? protMin
  const protGKg = i.protGkg !== undefined ? Number(i.protGkg) : protMin;
  // :14130 fatPct = override ?? 30
  const fatPct = i.fatPct !== undefined ? Number(i.fatPct) : 30;
  // :14131 protG = round(protGKg * pesoN)  (pesoN a precision completa)
  const protG = Math.round(protGKg * pesoN);
  // :14132 protKcal = round(protG * 4)
  const protKcal = Math.round(protG * 4);
  // :14133 fatKcal = round(kcalObj * fatPct / 100)
  const fatKcal = Math.round((kcalObj * fatPct) / 100);
  // :14134 fatG = round(fatKcal / 9)
  const fatG = Math.round(fatKcal / 9);
  // :14135 choKcal = max(0, kcalObj - protKcal - fatKcal)  (resta de redondeados, sin round)
  const choKcal = Math.max(0, kcalObj - protKcal - fatKcal);
  // :14136 choG = round(choKcal / 4)
  const choG = Math.round(choKcal / 4);
  // :14137 choPct = kcalObj>0 ? round(choKcal / kcalObj * 100) : 0
  const choPct = kcalObj > 0 ? Math.round((choKcal / kcalObj) * 100) : 0;

  return {
    formula,
    gebAuto,
    geb: gebN,
    pal: palN,
    get: getN,
    kcalObj,
    protGKg,
    protG,
    protKcal,
    fatPct,
    fatG,
    fatKcal,
    choKcal,
    choG,
    choPct,
  };
}
