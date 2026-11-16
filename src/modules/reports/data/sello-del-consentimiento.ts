// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA FRASE DEL SELLO DE CONSENTIMIENTO, EN UN SOLO SITIO  ·  2026-11-16
//
// POR QUE EXISTE: la escriben DOS superficies (la historia clinica en pantalla y el PDF), y hasta aqui
// cada una la armaba por su cuenta con el mismo `?? "no registrada"`. Dos copias de la misma frase en un
// documento probatorio es como el mismo hecho acaba contandose de dos maneras.
//
// ═══ QUE REPORTO SANTIAGO (2026-11-16) ═══
//
// *"Consulta capturada bajo el consentimiento versión no registrada", con las tres autorizaciones
// vigentes en 1.0. Di si es esperado en las consultas de agosto o si falta un dato.*
//
// ES ESPERADO, y por DOS razones que no son la misma. Medido en la nube: de 778 consultas, 170 no tienen
// version, y se reparten asi:
//
//   · 166 vienen del archivo IMPORTADO de Gildardo. Su consentimiento no se recogio en Atlas, asi que no
//     hay version que sellar aqui; lo que el paciente SI firmo despues se lista en la tabla de abajo.
//   · 4 nacieron en Atlas ANTES del 2026-08-21, que es cuando entro `evaluations.consent_version`
//     (migracion 0072, del dictamen legal del 20 de agosto). De las 608 consultas nacidas en Atlas desde
//     entonces, CERO se quedaron sin version.
//
// Y LA FRASE TIENE QUE DECIRLO, porque una ausencia sin explicar en un documento probatorio se lee como
// un dato que falta. Es la misma regla que ya gobierna el bloque vacio de autorizaciones y los bloques
// ausentes del diagnostico: se dice por que no esta, no se omite.
//
// LO QUE NO SE HACE: fabricar la version. No se deduce de `patient_consents` ni de la fecha. La columna
// es un puntero a lo que se sello EN la consulta; si no se sello, lo honesto es decir que no se sello y
// por que.
//
// MODULO NEUTRO Y PURO: lo leen la pantalla (cliente) y el PDF (servidor).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export type SelloDelConsentimiento = {
  /** Version sellada en la consulta, o null. */
  version: string | null;
  /** La consulta viene del archivo importado (`evaluations.import_batch_id`). */
  importada: boolean;
};

/**
 * La frase del sello, completa y con su razon cuando no hay version.
 *
 * Se devuelve ARMADA y no en piezas para que las dos superficies no puedan componerla distinto.
 */
export function fraseDelSelloDeConsentimiento({ version, importada }: SelloDelConsentimiento): string {
  if (version) return `Consulta capturada bajo el consentimiento versión ${version}.`;
  if (importada) {
    return (
      "Esta consulta proviene del archivo clínico importado: su consentimiento no se recogió en Atlas, " +
      "así que no hay una versión sellada en la consulta. Las autorizaciones que el paciente firmó en " +
      "Atlas se listan abajo."
    );
  }
  return (
    "Esta consulta se registró antes de que Atlas sellara la versión del consentimiento en la consulta " +
    "(21 de agosto de 2026), así que no hay una versión sellada. Las autorizaciones vigentes del " +
    "paciente se listan abajo."
  );
}
