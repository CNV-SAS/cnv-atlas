// Version interna del motor clinico. En B11 se porto el motor REAL de Gildardo (ciencia
// congelada verbatim + adaptador), reemplazando el stub, con golden tests que prueban
// paridad con ATLAS_v7.html (regla 6). Ya no lleva el prefijo "stub-": las salidas son
// clinicas. Todo registro clinico persiste este valor en engine_version (regla 7).
//
// HISTORIA DE VERSION (el numero es un contador; su significado vive aqui, asociado al codigo):
//  · 1.0.0: port inicial del motor real (B11), paridad con ATLAS_v7.html.
//  · 1.1.0 (2026-08-19): RE-PORT contra ATLAS_v8.html del 18 (swap de Gildardo). Cambia salidas del
//    motor: cPABU direccional (Q27, era 8 situaciones con rojo), cMMEM unificado EWGSOP2 (dormant),
//    banda cFMI "Alto SS" femenina, y PABU al Dominio 1 del DFI. Los diagnosticos sellados con 1.0.0
//    quedan con esa version (inmutabilidad, regla 7); un seguimiento que cruza 1.0.0 -> 1.1.0 lo avisa.
//    INCLUYE (mismo dia, aprobado por Gildardo el 19, RESPUESTA §1) el residuo del gate de sarcopenia:
//    el _smmwLow del DFI (engine.dfi, alimenta obSarc -> Dominio 2) baja mujer 24 -> 22, junto con el
//    gate del fenotipo (protocolo-fenotipo, que sube PROTOCOL a 2026-08-19b). Se folda en 1.1.0 porque
//    aun no hay despliegue: 1.1.0 = el re-port completo a la ciencia del 19 (18 + los tres residuos).
//  · 1.2.0 (2026-08-31): LA DINAMOMETRIA ENTRA AL MOTOR (Gildardo 2026-08-30 §6). Hasta aqui la fuerza
//    prensil se capturaba y no llegaba a `classifyFenotipo`, asi que `dxSarcopenia` devolvia "Ingrese
//    fuerza prensil" SIEMPRE, incluso con el dato registrado, y el disyunto `sarcoDx.k >= 2` nunca se
//    activaba. CAMBIA SALIDAS para todo paciente con la fuerza registrada: `sarcopenia` y
//    `obesidadSarcopenica` pueden voltear, y con ellas `structL`, la severidad del Dominio 2 del DFI, el
//    riesgo integrado y las rutas. Por eso sube la version y NO se folda: los diagnosticos sellados con
//    1.1.0 quedan marcados como emitidos con ciencia anterior, que es lo que hace que la comparacion de
//    bandas del §12b pueda dispararse y proponer la reemision donde corresponda.
//    Incluye tambien CA-6/CA-7 (el dominio sin dato no puntua; el adaptador deja de clasificar ceros
//    fabricados), que cambian severidades y el riesgo integrado por la misma via.
export const ENGINE_VERSION = "anibise-1.2.0";

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
// Bump 2026-08-19 (2026-08-03 -> 2026-08-19): RE-PORT contra el archivo del 18, punto 6 (objetivo
// calorico a 0). motorProtocolo retira los cinco deficits por fenotipo (deficit 0 + orientacion en
// texto); el contenido sellado en protocol_suggested cambia (deficit/label/perfil), por eso sube.
// Bump 2026-08-19b (mismo dia, 2a): residuo del 19 (RESPUESTA_GILDARDO §1). El gate de sarcopenia del
// fenotipo (protocolo-fenotipo.ts) baja mujer 24 -> 22 (barrido del umbral); el contenido sellado en
// protocol_suggested puede moverse para mujeres con SMM/W 22-24, por eso sube.
// Bump 2026-08-31 (2026-08-19b -> 2026-08-31): la dinamometria entra al motor. `classifyFenotipo` recibe
// `fuerzaPrensil` real, asi que `sarcopenia`/`obesidadSarcopenica` pueden voltear y con ellas la estrategia
// y la proteina del protocolo. El contenido sellado en protocol_suggested cambia para los pacientes con la
// fuerza registrada; por eso sube.
export const PROTOCOL_ENGINE_VERSION = "anibise-protocolo-2026-09-02b";

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
  // SHA actualizado (2026-08-19) CON subida de version: re-port del punto 6 (objetivo calorico a 0).
  "frozen/atlas-protocolo.authorized.js": "670d58f864cd27a9a3481e7473ad0988681ca4a0d20efbe5152c8bf9389e0dde",
  // SHA de la primera modificacion autorizada (CA-1/D-012, retirar telomeros). Antes se hasheaba el
  // original bajo la EXENCION DE ARRANQUE (cerrada); ahora se hashea el generado (el que se sella).
  // SHA actualizado (2026-09-02b) CON subida de version, y la razon vale la pena dejarla escrita: el
  // porte del GEB de esta manana (version 2026-09-02) dejaba que el GASTO MEDIDO por el equipo ganara
  // sobre el Harris-Benedict DENTRO de la cadena que fija la ingesta. Su motor dice lo contrario en el
  // comentario pegado a `_mtn.geb`: el medido es el basal de HOY (peso actual) y sirve para mostrarlo,
  // no para fijar la ingesta que lleva a la META. Era un defecto LATENTE (ningun caller pasaba el
  // medido) y por eso la version de la manana no sello cifras equivocadas; se sube igual porque la
  // cadena cambio y esta version es la que se sella de aqui en adelante.
  "protocolo-calorico.ts": "f49f60d68da84101adb54f6fbd74e3dccaaea52b1c033faa012db003824ecd36",
  // SHA actualizado (2026-08-02) CON subida de versión: re-sync de los 3 cortes inferiores al vigente.
  // SHA actualizado (2026-08-19b): gate de sarcopenia del fenotipo, mujer 24 -> 22 (Gildardo §1 del 19).
  // SHA actualizado (2026-08-31) CON subida de version: la dinamometria entra al motor (§6 del 30). Lo que
  // cambia en ESTE archivo es la brecha declarada en su encabezado, que dejo de ser cierta; el efecto
  // clinico viene de que sus llamadores ya le pasan la fuerza.
  "protocolo-fenotipo.ts": "644af070a8b10014078781300663c0806d938d467617c0818b733a31d60498d1",
  "fenotipos-mccb.ts": "78b30afed8b0554c611b5e329ca0a46b3bb8fb300b860c49eaf0c812944f217a",
};
