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
//  · 1.3.0 (2026-09-05): SE ENCIENDE EL LE8 (`LE8_MAPEO_CORREGIDO`, CA-8a/CA-8b). Instruccion de
//    Direccion Cientifica del 5 de septiembre, decision suya del 2: "el ICEC se activa tal cual se
//    envio". Hasta aqui DOS de los ocho dominios del LE8 leian campos que solo existen en el objeto DEMO
//    de su prototipo (d1_9/d1_10 y d1_16), asi que corrian CLAVADOS para todo paciente real:
//    Alimentacion en 30 e Hidratacion en 20, midiera lo que midiera la persona. Ahora Alimentacion sale
//    de `calcPatron` sobre los quince grupos de frecuencia e Hidratacion de `d7_agua`.
//    LAS CIFRAS QUE SE MUEVEN, y por eso NO se folda: el ICEC, y con el la EB-BIS, el IAE, los dominios
//    3 y 5 del DFI con su severidad, el riesgo integrado y las rutas R4/R5. Medido antes de aplicarlo
//    sobre la base local, aislando el efecto del interruptor: en los pacientes cuyos dos dominios se
//    apartan de las constantes viejas, la EB-BIS BAJA entre 0,6 y 5,4 anos (media 1,46), siempre hacia
//    abajo, dentro del rango que el anuncio ("entre 1 y 8"). Ver PLAN_LE8_ENCENDIDO.md §3.
//    Y SUBE PARA QUE LA COMPARACION DE BANDAS DE SU §12b PUEDA DISPARARSE: sin desfase de version,
//    `veredictoDeReemision` no corre y el cambio pasaria invisible en los diagnosticos ya emitidos.
//    Incluye la migracion 0100: los quince grupos y `d7_agua` pasan a `used_in_diagnosis = true`, porque
//    dejaron de ser display/tratamiento y son insumo del diagnostico. Sin eso, `dfi.complete` diria que
//    los insumos estan completos sobre respuestas que el paciente no dio.
//  · 1.3.1 (2026-09-05): PATCH, sin ciencia. El chip del PABU del Dominio 1 del DFI decia la
//    desviacion de φ CON SIGNO, y la fila ICA-BIS de la tabla la dice en MAGNITUD: la misma pantalla
//    con dos signos para el mismo concepto. La causa era una omision nuestra, no su matematica:
//    `computeDFIFromData` hace `num("ICA_BIS","icaBis") || (pabu - 1.618)` y la fila que le pasabamos
//    no traia el campo, asi que caia a la reserva con signo. Su aplicacion si lo llena (con el valor
//    absoluto) y por eso su pantalla dice "+0,42" donde la nuestra decia "-0,42".
//    SE LE ENTREGA EL INSUMO, no se le cambia la formula, y es el MISMO valor que el motor ya sella
//    (|PABU - phi|, ATLAS_v7 L5721), coherente con la referencia de la fila ("0.00-0.15 Zona φ", un
//    rango que empieza en cero solo tiene sentido para una magnitud) y con su cPABU (`Math.abs(raw)`).
//    QUE SE MUEVE: un TEXTO sellado en `dfi.domains[0].items`, solo en pacientes por DEBAJO de φ.
//    NINGUNA cifra, severidad, riesgo integrado ni ruta: `icaBis` se usa en UN sitio del DFI, ese
//    texto (engine.dfi.js:146). Por eso es patch y no minor. El golden no lo vio porque su donante
//    tiene PABU 1,9925, por encima de φ, donde los dos calculos coinciden; el candado nuevo
//    (`ica-bis-signo-del-chip.test.ts`) cubre justo el caso que al golden le falta.
//  · 1.4.0 (2026-09-06): MINOR. LA GUARDA DEL LE8 PASA DE SEIS INSUMOS A OCHO, que es lo que su propia
//    nota pedia y nadie hizo. El texto decia: "si algun dia se activa el mapeo, calcLE8 pasa a leer
//    d1_N_i (calcPatron) y d7_agua: esta lista debe revisarse ahi". El mapeo se activo con 1.3.0 y la
//    lista se quedo en seis, asi que el motor leia ocho campos y la guarda exigia seis.
//    LO QUE HACIA CON LOS DOS QUE NO EXIGIA: sin `d7_agua`, hidratacion puntuaba CERO (el peor valor
//    posible: un paciente que no contesto quedaba registrado como uno que no bebe agua); sin la matriz
//    de frecuencia, alimentacion caia a la base de 10, y con la matriz a medias bajaba en silencio
//    proporcional a cuantos grupos faltaran. Un dato ausente entrando al calculo como una respuesta,
//    que es justo lo que la guarda de 2026-08-13 vino a impedir para los otros seis.
//    QUE EXIGE AHORA: los seis de siempre, mas `d7_agua` y la matriz `d1_1_i..d1_15_i` COMPLETA (entera
//    y no en parte: `calcPatron` suma y resta por grupo, asi que un grupo ausente no da error, baja el
//    score). Y frena el LE8 ENTERO, no el dominio: el total es un compuesto y emitirlo con un dominio
//    en su default sesgaria el ICEC y con el la EB-BIS.
//    POR QUE MINOR Y NO PATCH: no se mueve ninguna cifra de lo ya emitido (medido abajo), pero cambia
//    lo que el motor PUEDE devolver: ahora se niega a emitir donde antes contestaba. Eso es
//    comportamiento sellado, no un texto.
//    MEDIDO ANTES DE APLICARLO, sobre la nube en solo lectura: de 120 respuestas, ONCE pasan los seis
//    de hoy y LAS ONCE pasan tambien los ocho. CERO evaluaciones cambian de comportamiento. El gate de
//    completitud de la encuesta es lo que lo hace improbable; la guarda cierra el hueco que se abriria
//    el dia que alguien conteste los seis y se salte el agua.
//    Y AL REGENERAR se corrigieron solos los TRES comentarios que describian el interruptor como
//    apagado: viven dentro del `newSlice`, asi que se rehacen cuando cambia el codigo que corre. Antes
//    no se tocaron a proposito, porque moverlos solos habria cambiado el SHA sin cambiar una cifra.
// ═══ 1.0.0: LA PRIMERA VERSION OFICIAL (2026-09-09) ═══
//
// QUE ES ESTE CAMBIO Y QUE NO ES. Es un RENOMBRE de frontera, no un cambio de ciencia: no se movio una
// sola cifra al hacerlo. Lo que hasta hoy se llamo `anibise-1.4.0` se llama `1.0.0` de aqui en adelante.
// El historial de arriba NO se borra: cada bump que trajo el motor hasta aqui sigue escrito, y la
// correspondencia entre los nombres viejos y este vive en `docs/VERSIONES.md`.
//
// POR QUE AHORA: la junta se salto el Hito 2 y hay pacientes reales en produccion. Gildardo pidio que
// todo quedara en la primera version oficial.
//
// LO QUE NO SE PUEDE HACER, y por eso esto es un renombre HACIA ADELANTE y no una reescritura: el sello
// dice CON QUE SE CALCULO. Los diagnosticos ya emitidos conservan `anibise-1.4.0` en su snapshot, y tiene
// que ser asi: reetiquetarlos haria que un diagnostico de agosto afirme que salio del motor de hoy.
//
// EL FORMATO, y por que se retira el prefijo: el campo ya se llama `engine_version`, asi que `anibise-`
// dentro del VALOR solo obligaba a parsear para comparar. Tres numeros (no dos ni cuatro): con dos no se
// puede corregir un decimal sin anunciar cambio de ciencia. Y nunca fechas: `2026-09-04` no ordena contra
// `1.4.0` y no dice si el cambio fue de fondo o de forma.
export const ENGINE_VERSION = "1.0.0";

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
// Bump 2026-09-04 (2026-09-03 -> 2026-09-04): se porta su entrega del 3 de septiembre, confirmada en su
// respuesta del 4. Cambia LA CADENA ENTERA, no un detalle:
//   · GASTO BASAL: Mifflin-St Jeor sobre el peso meta. Es la TERCERA formula en cuatro dias
//     (500+22xFFM mal rotulado Cunningham -> Harris-Benedict -> Mifflin), y mueve el objetivo de TODOS
//     entre 55 y 104 kcal hacia abajo.
//   · PROTEINA: 0,8 g/kg plano y editable. Salen las cinco cifras por rama (1,5 desnutricion / 1,25
//     cancer / 1,3-1,4 obesidad / 1,4 sarcopenia / 0,7 ERC).
//   · GRASA: 30 % para todos; la dislipidemia ya no la baja a 25.
//   · OBJETIVO: una sola via (gasto menos restriccion). Sale la formula por patologia (27,5 x peso
//     actual) y el piso pasa a aplicar a todos.
//   · DESNUTRICION y SARCOPENIA separadas, por FFMI y ASMI en vez de por IMC y un OR.
// Todo el contenido sellado en protocol_suggested cambia; por eso sube.
// 1.0.0 (2026-09-09): el MISMO renombre de frontera que `ENGINE_VERSION` (ver alli el porque completo).
// Lo que hasta hoy se llamo `anibise-protocolo-2026-09-04` se llama `1.0.0`. NO cambia ningun artefacto:
// los SHA de abajo son los mismos, y el candado de version lo comprueba. Aqui el cambio de formato tiene
// ademas una razon propia: la fecha no ordena, asi que "esta version es posterior a aquella" no se podia
// responder comparando las dos cadenas.
export const PROTOCOL_ENGINE_VERSION = "1.0.0";

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
  "frozen/atlas-protocolo.authorized.js": "c832aab5fc7b1ed53c4f644c9425b24d3b9ab51d4ce0996a4d5c0245a1c78eb1",
  // SHA de la primera modificacion autorizada (CA-1/D-012, retirar telomeros). Antes se hasheaba el
  // original bajo la EXENCION DE ARRANQUE (cerrada); ahora se hashea el generado (el que se sella).
  // SHA actualizado (2026-09-02b) CON subida de version, y la razon vale la pena dejarla escrita: el
  // porte del GEB de esta manana (version 2026-09-02) dejaba que el GASTO MEDIDO por el equipo ganara
  // sobre el Harris-Benedict DENTRO de la cadena que fija la ingesta. Su motor dice lo contrario en el
  // comentario pegado a `_mtn.geb`: el medido es el basal de HOY (peso actual) y sirve para mostrarlo,
  // no para fijar la ingesta que lleva a la META. Era un defecto LATENTE (ningun caller pasaba el
  // medido) y por eso la version de la manana no sello cifras equivocadas; se sube igual porque la
  // cadena cambio y esta version es la que se sella de aqui en adelante.
  // SHA actualizado (2026-09-03) CON subida de version: LA PROTEINA LA PRESCRIBE EL MOTOR (su §9.6 punto
  // 4). La cadena deja de leer el `protMin` de motorProtocolo, que es un MINIMO poblacional (base 0,8), y
  // pasa a leer el `protKg` de motorTratNutri, que es una PRESCRIPCION (base 1,0; cancer 1,25,
  // desnutricion 1,5, obesidad 1,3, con sarcopenia 1,4, ERC 0,7). Medido antes de aplicarlo: de los 60
  // tratamientos de la base, 56 lo verian y NINGUNO esta aprobado, asi que ninguna prescripcion sellada
  // se mueve. El valor se SELLA en protocol_suggested.mtn; los snapshots anteriores lo reciben del caller
  // (cascada con `protFuente`), que es lo que impide que el defecto siga vivo justo en los que existen.
  "protocolo-calorico.ts": "70818fb92b219fe1006893af1e05192bf19991c8cccb4b13803d4687aa0fd28f",
  // SHA actualizado (2026-08-02) CON subida de versión: re-sync de los 3 cortes inferiores al vigente.
  // SHA actualizado (2026-08-19b): gate de sarcopenia del fenotipo, mujer 24 -> 22 (Gildardo §1 del 19).
  // SHA actualizado (2026-08-31) CON subida de version: la dinamometria entra al motor (§6 del 30). Lo que
  // cambia en ESTE archivo es la brecha declarada en su encabezado, que dejo de ser cierta; el efecto
  // clinico viene de que sus llamadores ya le pasan la fuerza.
  "protocolo-fenotipo.ts": "644af070a8b10014078781300663c0806d938d467617c0818b733a31d60498d1",
  "fenotipos-mccb.ts": "78b30afed8b0554c611b5e329ca0a46b3bb8fb300b860c49eaf0c812944f217a",
};
