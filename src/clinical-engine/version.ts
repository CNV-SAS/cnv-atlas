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
// defecto un cambio sube la version; actualizar solo el SHA exige justificar que fue cosmetico.
// NO editar estos hashes a mano sin leer el mensaje del test.
export const PROTOCOL_ARTIFACTS_SHA: Record<string, string> = {
  "frozen/atlas-protocolo.js": "396d7d9ccf50f48f26d953b50ca6048af08234ce417b42648703e6765082a12e",
  "protocolo-calorico.ts": "7e97a3e998c22a01f1726640cdf530285364f2479038f80df058b929960978c5",
  "protocolo-fenotipo.ts": "74269b5726f661e8a52c6e696b389eeb69eaaecf5597fc86b16d823fea549318",
  "fenotipos-mccb.ts": "78b30afed8b0554c611b5e329ca0a46b3bb8fb300b860c49eaf0c812944f217a",
};
