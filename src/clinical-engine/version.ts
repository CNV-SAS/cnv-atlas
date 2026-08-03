// Version interna del motor clinico. En B11 se porto el motor REAL de Gildardo (ciencia
// congelada verbatim + adaptador), reemplazando el stub, con golden tests que prueban
// paridad con ATLAS_v7.html (regla 6). Ya no lleva el prefijo "stub-": las salidas son
// clinicas. Todo registro clinico persiste este valor en engine_version (regla 7).
export const ENGINE_VERSION = "anibise-1.0.0";

// Version del CONJUNTO DE PROTOCOLO (motorProtocolo + cadena calorica + clasificador de fenotipo).
// Versiona aparte de ENGINE_VERSION porque es un conjunto de artefactos distinto. Se sella en cada
// protocol_suggested (regla 7); el resto de la constelacion se hereda via diagnosis_id.
// Bump 2026-08-02 (1.0.0 -> 2026-07-30, fechada al vigente): re-sync de la frontera de desnutrición
// del clasificador de fenotipo (protocolo-fenotipo.ts) contra el vigente. El fenotipo alimenta el
// protocolo (obesidadSarcopenica -> estrategia/proteína), así que el protocol_suggested puede moverse
// para pacientes en las franjas; por eso sube esta versión, además de emission_versions.structural_mccb.
// Bump 2026-08-03 (2026-07-30 -> 2026-08-03): primera MODIFICACION AUTORIZADA del frozen (CA-1/D-012,
// retirar el examen de telomeros del listado sugerido). El listado de examenes se sella en
// protocol_suggested, asi que el contenido sellado cambia para los protocolos con IAE>5; por eso sube
// la version. El que corre pasa a ser atlas-protocolo.authorized.js (generado = original + manifiesto).
export const PROTOCOL_ENGINE_VERSION = "anibise-protocolo-2026-08-03";

// Candado de version: SHA-256 POR ARCHIVO de los artefactos que producen el protocolo. Un test
// (protocol-version-lock.test.ts) recomputa y compara; si alguno cambia, FALLA y NOMBRA cual, para
// que la decision de subir PROTOCOL_ENGINE_VERSION se tome con informacion, no por olvido. Por
// defecto un cambio sube la version. NO editar estos hashes a mano sin leer el mensaje del test.
//
// EXENCION DE ARRANQUE: CERRADA (2026-07-29, con el sellado del protocolo en el pipeline).
// El pipeline ya sella protocol_suggested (pipeline-writer), asi que a partir de aqui YA NO aplica:
// cualquier cambio en los cuatro artefactos exige subir PROTOCOL_ENGINE_VERSION, SIN EXCEPCION (dos
// protocolos sellados con la misma version tienen que haber sido producidos por el mismo codigo).
// Se conserva el registro de la exencion para que nadie la reinterprete: era valida SOLO mientras
// ningun protocol_suggested existiera en la base con 1.0.0; se uso una vez (exponer `pal`, ver el
// SHA de protocolo-calorico.ts abajo) y se cerro. No se reutiliza.
export const PROTOCOL_ARTIFACTS_SHA: Record<string, string> = {
  // El que CORRE y se sella es el GENERADO (original + manifiesto de modificaciones autorizadas), no
  // el original. Se hashea el generado, no el manifiesto: el generado solo cambia cuando cambia el
  // CODIGO que corre (la prosa del manifiesto puede cambiar sin afectar la ciencia; el generado no).
  // El original (atlas-protocolo.js) queda como referencia byte-identica a Gildardo, guardada por su
  // DIFF-vs-fuente (frozen-protocolo-diff), no por este candado.
  "frozen/atlas-protocolo.authorized.js": "6bfdaa2957676f04dc2c31e09b9b68f32b57f72a235bf6a8689ee64e14e4e4f4",
  // SHA de la primera modificacion autorizada (CA-1/D-012, retirar telomeros). Antes se hasheaba el
  // original bajo la EXENCION DE ARRANQUE (cerrada); ahora se hashea el generado (el que se sella).
  "protocolo-calorico.ts": "c5c0229c47626f756bdc3dfdad75e173a8723a20999bc116ff80387a76ab6b4a",
  // SHA actualizado (2026-08-02) CON subida de versión: re-sync de los 3 cortes inferiores al vigente.
  "protocolo-fenotipo.ts": "3df943df89e2edc22a4a6b1d644c07b7461264765a326d99dd0feb59fd7488ad",
  "fenotipos-mccb.ts": "78b30afed8b0554c611b5e329ca0a46b3bb8fb300b860c49eaf0c812944f217a",
};
