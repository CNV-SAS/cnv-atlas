// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN TRATAMIENTO APOYADO EN UN DIAGNOSTICO QUE YA NO ES EL VIGENTE  ·  MODULO NEUTRO
//
// ═══ LA PREGUNTA QUE RESPONDE (Santiago, 2026-10-29) ═══
//
// *"¿Algo del tratamiento depende de la EB-BIS o del IAE? Si si, ese tratamiento queda apoyado en una
// cifra que ya no es la vigente: dime cuales y como se marca, SIN REHACERLO."*
//
// ═══ LO QUE SE MIDIO, CASO POR CASO ═══
//
// SI DEPENDE de la EB-BIS / el IAE:
//   1. Las rutas R1 y R4. `R1` exige `iae > 5` junto con IFC bajo e IRC alto; `R4` (Desaceleracion del
//      Envejecimiento) se activa con `iae > 5`, o por FFMI bajo, o por obesidad sarcopenica
//      (`engine.indices.js`). Van selladas en el diagnostico.
//   2. El dominio 3 del DFI (Envejecimiento): su severidad sale de `iaeCl` y del valor del IAE, y con
//      ella se mueve el RIESGO INTEGRADO, que es la lectura de conjunto.
//   3. El nutraceutico Coenzima Q10, que `atlas-protocolo` sugiere cuando `iae > 5`, con el texto
//      "Envejecimiento acelerado IAE +X,X". Queda sellado en `protocol_suggested`.
//   4. Las metas de nutricion y de ejercicio que citan "reduccion del IAE" (`dfi-narrative`).
//
// NO DEPENDE, y es lo que hace viable no rehacer nada: las kcal, la proteina, la grasa, la distribucion
// por tiempos, el menu y la lista de intercambio. Los CUATRO motores de tratamiento (`atlas-geb`,
// `atlas-tratamiento`, `atlas-tratamiento-nutri`, `atlas-asesoria-macro`) no leen el IAE: se verifico por
// busqueda directa, no por suposicion. Asi que la prescripcion del profesional no se apoya en la cifra
// vieja y no hay nada que recalcular en ella.
//
// ═══ COMO SE MARCA: DERIVADO, SIN COLUMNA ═══
//
// `treatments.diagnosis_id` apunta al diagnostico sobre el que se construyo. Si ese ya no es el
// diagnostico VIGENTE de su evaluacion (porque hubo una reemision), el tratamiento esta apoyado en una
// cifra anterior. Eso es todo: no hay bandera que poner ni que acordarse de quitar, y si algun dia ese
// tratamiento se rehace sobre el diagnostico nuevo, la marca se apaga sola.
//
// Es la misma leccion del aviso de medicion repetida: *"una marca de 'ya lo revise' habria que acordarse
// de quitarla, y entonces el aviso sobreviviria al arreglo o moriria antes"*.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Lo que de un tratamiento se apoya en la EB-BIS o el IAE. Para decirselo al profesional. */
export const LO_QUE_DEPENDE_DE_LA_EB_BIS = [
  "las rutas de atención R1 y R4",
  "el dominio de Envejecimiento del diagnóstico integrado y, con él, el riesgo integrado",
  "la sugerencia de Coenzima Q10",
  "las metas que mencionan reducir el IAE",
] as const;

/** Lo que NO se apoya en ella, y por eso no hace falta rehacer el tratamiento. */
export const LO_QUE_NO_DEPENDE_DE_LA_EB_BIS = [
  "las calorías, la proteína y la grasa",
  "la distribución por tiempos de comida",
  "el menú de ejemplo y la lista de intercambio",
] as const;

export type ApoyoDelTratamiento = {
  /** El diagnostico sobre el que se construyo el tratamiento. */
  diagnosisIdDelTratamiento: string;
  /** El diagnostico VIGENTE de la evaluacion hoy. */
  diagnosisIdVigente: string;
};

/**
 * `true` cuando el tratamiento se apoya en un diagnostico que ya fue reemitido.
 *
 * NO es un error ni algo que haya que arreglar: es un hecho que el profesional tiene que poder ver. Su
 * §6 ordena recalcular el diagnostico y NO tocar el tratamiento, asi que esta situacion es la consecuencia
 * esperada de cumplir la instruccion, no una inconsistencia.
 */
export function seApoyaEnUnDiagnosticoAnterior(a: ApoyoDelTratamiento): boolean {
  return a.diagnosisIdDelTratamiento !== a.diagnosisIdVigente;
}

/**
 * El aviso para el profesional: que se movio, que no, y que NO hay que rehacer nada.
 *
 * LA TERCERA FRASE ES LA QUE IMPORTA. Un aviso que solo dice "esto se apoya en una cifra anterior" se lee
 * como "rehazlo", y rehacerlo es exactamente lo que no se debe hacer: reemplazaria la prescripcion del
 * profesional por la del motor. Decir que no hay que hacer nada es parte del aviso, no una cortesia.
 */
export function avisoDeApoyoAnterior(): string {
  return (
    "El diagnóstico de esta consulta se volvió a emitir con la versión nueva del modelo. " +
    `Esta prescripción se construyó con la anterior, así que ${LO_QUE_DEPENDE_DE_LA_EB_BIS.join(", ")} ` +
    `pueden haber cambiado; ${LO_QUE_NO_DEPENDE_DE_LA_EB_BIS.join(", ")} no dependen de esa cifra. ` +
    "No tienes que rehacer nada: la prescripción que indicaste se conserva tal cual. " +
    "Si quieres que refleje el diagnóstico nuevo, ajústala tú."
  );
}
