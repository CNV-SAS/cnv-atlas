// Version interna del motor clinico. En B11 se porto el motor REAL de Gildardo (ciencia
// congelada verbatim + adaptador), reemplazando el stub, con golden tests que prueban
// paridad con ATLAS_v7.html (regla 6). Ya no lleva el prefijo "stub-": las salidas son
// clinicas. Todo registro clinico persiste este valor en engine_version (regla 7).
export const ENGINE_VERSION = "anibise-1.0.0";

// Version del CONJUNTO DE PROTOCOLO (motorProtocolo + cadena calorica + clasificador de fenotipo).
// Versiona aparte de ENGINE_VERSION porque es un conjunto de artefactos distinto. Se sella en cada
// protocol_suggested (regla 7); el resto de la constelacion se hereda via diagnosis_id.
export const PROTOCOL_ENGINE_VERSION = "anibise-protocolo-1.0.0";

// Candado de version: SHA-256 POR ARCHIVO de los artefactos que producen el protocolo. Un test
// (protocol-version-lock.test.ts) recomputa y compara; si alguno cambia, FALLA y NOMBRA cual, para
// que la decision de subir PROTOCOL_ENGINE_VERSION se tome con informacion, no por olvido. Por
// defecto un cambio sube la version. NO editar estos hashes a mano sin leer el mensaje del test.
//
// EXENCION DE ARRANQUE, valida SOLO hasta el primer sellado. Mientras NINGUN protocol_suggested
// exista en la base con esta version, actualizar el SHA sin subir la version es aceptable: no hay
// registro que quede ambiguo. A PARTIR DEL PRIMER PROTOCOLO SELLADO, cualquier cambio en los cuatro
// artefactos exige subir PROTOCOL_ENGINE_VERSION, SIN EXCEPCION: dos protocolos sellados con la
// misma version tienen que haber sido producidos por el mismo codigo. Esta exencion no se
// reinterpreta ni se reutiliza; se cierra cuando el pipeline selle el primer protocolo.
export const PROTOCOL_ARTIFACTS_SHA: Record<string, string> = {
  "frozen/atlas-protocolo.js": "396d7d9ccf50f48f26d953b50ca6048af08234ce417b42648703e6765082a12e",
  // SHA actualizado (2026-07-29) bajo la EXENCION DE ARRANQUE de arriba (1.0.0 aun sin sellar): se
  // expuso `pal` (palN ya computado) en la salida para sellarlo en el snapshot. Es un cambio de
  // FORMA de la salida (no meramente cosmetico), pero valido porque ningun registro afirma todavia
  // nada con 1.0.0. Tras el primer sellado esto ya NO seria aceptable sin subir la version.
  "protocolo-calorico.ts": "c5c0229c47626f756bdc3dfdad75e173a8723a20999bc116ff80387a76ab6b4a",
  "protocolo-fenotipo.ts": "74269b5726f661e8a52c6e696b389eeb69eaaecf5597fc86b16d823fea549318",
  "fenotipos-mccb.ts": "78b30afed8b0554c611b5e329ca0a46b3bb8fb300b860c49eaf0c812944f217a",
};
