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
export const PROTOCOL_ENGINE_VERSION = "anibise-protocolo-2026-07-30";

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
  "frozen/atlas-protocolo.js": "396d7d9ccf50f48f26d953b50ca6048af08234ce417b42648703e6765082a12e",
  // SHA actualizado (2026-07-29) bajo la EXENCION DE ARRANQUE de arriba (1.0.0 aun sin sellar): se
  // expuso `pal` (palN ya computado) en la salida para sellarlo en el snapshot. Es un cambio de
  // FORMA de la salida (no meramente cosmetico), pero valido porque ningun registro afirma todavia
  // nada con 1.0.0. Tras el primer sellado esto ya NO seria aceptable sin subir la version.
  "protocolo-calorico.ts": "c5c0229c47626f756bdc3dfdad75e173a8723a20999bc116ff80387a76ab6b4a",
  // SHA actualizado (2026-08-02) CON subida de versión: re-sync de los 3 cortes inferiores al vigente.
  "protocolo-fenotipo.ts": "3df943df89e2edc22a4a6b1d644c07b7461264765a326d99dd0feb59fd7488ad",
  "fenotipos-mccb.ts": "78b30afed8b0554c611b5e329ca0a46b3bb8fb300b860c49eaf0c812944f217a",
};
