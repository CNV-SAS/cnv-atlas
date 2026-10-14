// LOS DOS CORTES DE EDAD VIENEN DEL MODULO DE CONSENTIMIENTO, no se reescriben aqui: son los mismos que
// gobiernan la rama de edad del camino remoto, y dos definiciones del mismo corte es como el camino
// remoto y el presencial acaban diciendo cosas distintas del mismo menor.
import { ADULT_MIN_AGE as ADULTO_DESDE, ASSENT_MIN_AGE as ASENTIMIENTO_DESDE } from "../validations";

// LA DECLARACION DEL PROFESIONAL, en el consentimiento presencial.
//
// QUE ES. En las modalidades presenciales, el profesional afirma sobre el acto que acaba de ocurrir
// delante de el. No sustituye al consentimiento del paciente: lo ACOMPAÑA, diciendo como se obtuvo.
//
// SE VERSIONA COMO EL TEXTO DEL CONSENTIMIENTO, y por el mismo motivo: es una afirmacion con
// consecuencias. Si mañana cambia su redaccion, lo declarado antes tiene que seguir diciendo lo que
// decia, y la fila guarda la version para poder citarlo. Un booleano dejaria constancia de que
// "declaro algo" sin poder decir QUE.
//
// LOS TEXTOS SON DEL DICTAMEN LEGAL, verbatim. No se reescriben "para que suene mejor": lo que da valor
// probatorio es exactamente lo que el profesional afirma, y cambiarlo sin abogado cambia el alcance de la
// afirmacion.
//
// ═══ LA CONDICION QUE SOSTIENE TODO ESTE DISEÑO (legal, 2026-10-12) ═══
//
// Textual: *"una version, un texto, para siempre. Cualquier cambio de redaccion, por minimo que sea, es
// una version nueva."* Y su razon: *"si alguien edita el texto de la 1.1-b el mes entrante sin crear una
// 1.2, todas las declaraciones anteriores pasan a apuntar a un texto distinto del que se mostro, y ahi si
// el registro deja de probar lo que dice probar."*
//
// POR QUE ESTO SUSTITUYE AL HASH, y es lo que decidio no construirlo: con textos congelados y elegidos
// por fecha de nacimiento, EL NUMERO DE VERSION YA IDENTIFICA EL TEXTO EXACTO de forma inequivoca. No hay
// composicion en caliente, no hay variantes, no hay ambiguedad sobre que leyo el profesional. Guardar el
// hash de un texto que solo puede ser uno de tres valores conocidos seria redundancia sin uso.
//
// Y LA CONDICION ES CANDADO, no una nota: `declaracion-presencial-congelada.test.ts` guarda el SHA-256 de
// cada texto. Editar uno sin crear una version nueva pone el candado rojo, que es el unico momento en que
// alguien se iba a enterar.
//
// ── POR QUE TRES TEXTOS CONGELADOS Y NO UNA COMPOSICION POR EDAD ──
//
// El abogado ofrecio las dos y pidio que lo que se guarde sea *"el texto exacto que el profesional vio y
// acepto"*. Esa frase decide: con tres textos, la version guardada YA es el texto; componiendo, el
// artefacto guardado dependeria del codigo que lo armo ese dia, y para poder citarlo habria que guardar la
// cadena entera. Su "salida provisional" es, por eso, la mejor.

/**
 * 1.0 · PACIENTE MAYOR DE EDAD. NO SE TOCA: *"sigue vigente para pacientes mayores de edad. Son dos
 * textos coexistentes, no una sustitucion."*
 */
export const DECLARACION_PRESENCIAL_VERSION = "1.0";

export const DECLARACION_PRESENCIAL =
  "Declaro que presenté el consentimiento al paciente, que tuvo oportunidad de leerlo, que fue él quien " +
  "marcó las autorizaciones, y que verifiqué su identidad contra su documento.";

// ═══ 1.1 · PACIENTE MENOR DE EDAD, AUTORIZA EL REPRESENTANTE LEGAL (legal, 2026-10-12) ═══
//
// LA ULTIMA FRASE ES CONDICIONAL Y EL SISTEMA LA TRATA COMO TAL. Textual: *"para un menor de 14 años esa
// frase no debe aparecer en el texto declarado, porque el profesional estaria declarando algo que no
// ocurrio"*. Atlas tiene la fecha de nacimiento, asi que elige por edad.
//
// ── LA UNICA DECISION DE REDACCION QUE HUBO QUE TOMAR, y queda dicha aqui ──
//
// Quitar la ultima clausula deja la anterior terminada en punto y coma y sin la conjuncion que cerraba la
// enumeracion. Asi que en la 1.1-a la clausula de la identidad pasa a ser la ultima: *"; y que verifiqué
// su identidad..."* con punto final. NO SE CAMBIA NI UNA PALABRA del contenido de ninguna clausula: lo
// unico que se mueve es la "y" que une la ultima, que en la 1.1-b esta en la clausula del asentimiento.

/** 1.1-a · MENOR DE 14 AÑOS. Sin la clausula del asentimiento, porque el asentimiento no ocurrio. */
export const DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO_VERSION = "1.1-a";

export const DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO =
  "Declaro bajo mi responsabilidad que presenté el consentimiento informado de ATLAS al representante " +
  "legal del paciente menor de edad, en su presencia y en el marco de esta consulta; que el representante " +
  "legal tuvo oportunidad de leerlo íntegramente y de formular preguntas antes de otorgarlo; que fue el " +
  "representante legal, y no otra persona, quien marcó las autorizaciones registradas; y que verifiqué su " +
  "identidad contra su documento de identificación y su calidad de representante legal del menor.";

/** 1.1-b · MENOR DE 14 A 17 AÑOS. Con la clausula del asentimiento, porque el asentimiento si ocurrio. */
export const DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO_VERSION = "1.1-b";

export const DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO =
  "Declaro bajo mi responsabilidad que presenté el consentimiento informado de ATLAS al representante " +
  "legal del paciente menor de edad, en su presencia y en el marco de esta consulta; que el representante " +
  "legal tuvo oportunidad de leerlo íntegramente y de formular preguntas antes de otorgarlo; que fue el " +
  "representante legal, y no otra persona, quien marcó las autorizaciones registradas; que verifiqué su " +
  "identidad contra su documento de identificación y su calidad de representante legal del menor; y que, " +
  "tratándose de un menor entre catorce (14) y diecisiete (17) años, el menor otorgó su asentimiento en " +
  "mi presencia.";

/**
 * EL REGISTRO COMPLETO, por version. Es lo que permite citar una declaracion vieja: la fila guarda la
 * version y aqui esta su texto, inmutable.
 *
 * UNA VERSION RETIRADA NO SE BORRA DE AQUI. El dia que exista una 1.2, la 1.1-b se queda: hay
 * declaraciones firmadas que la citan, y sin su texto esa fila deja de probar lo que dice probar.
 */
export const DECLARACIONES_PRESENCIALES: Readonly<Record<string, string>> = Object.freeze({
  [DECLARACION_PRESENCIAL_VERSION]: DECLARACION_PRESENCIAL,
  [DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO_VERSION]:
    DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO,
  [DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO_VERSION]:
    DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO,
});

/** El texto de una version guardada. null si la version no existe (una fila corrupta, o de otra rama). */
export function textoDeLaDeclaracion(version: string): string | null {
  return DECLARACIONES_PRESENCIALES[version] ?? null;
}

/**
 * QUE DECLARACION LE TOCA, por la edad del paciente.
 *
 * ── SE DECIDE POR LA EDAD, QUE ES EL HECHO, y no por una rama que alguien eligio ──
 *
 * Es la misma disciplina del guard del escritor: *"mirar la rama declarada seria creerle al formulario
 * justo en lo que el formulario se equivoco"*.
 *
 * SIN EDAD NO HAY DECLARACION QUE ELEGIR, y devuelve null en vez de caer a la 1.0. La 1.0 afirma que fue
 * EL PACIENTE quien marco; servirla por defecto cuando no se sabe la edad es como se firma la declaracion
 * equivocada sobre un menor, que es exactamente el estado imposible que esta pieza existe para cerrar.
 */
export function declaracionPorEdad(
  edadEnAnios: number | null,
): { version: string; texto: string } | null {
  if (edadEnAnios === null || edadEnAnios < 0) return null;
  if (edadEnAnios >= ADULTO_DESDE) {
    return { version: DECLARACION_PRESENCIAL_VERSION, texto: DECLARACION_PRESENCIAL };
  }
  if (edadEnAnios >= ASENTIMIENTO_DESDE) {
    return {
      version: DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO_VERSION,
      texto: DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO,
    };
  }
  return {
    version: DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO_VERSION,
    texto: DECLARACION_PRESENCIAL_MENOR_SIN_ASENTIMIENTO,
  };
}

/** ¿Esa version es de la rama de menor? Lo usan las superficies para saber si piden representante. */
export const esDeclaracionDeMenor = (version: string): boolean => version.startsWith("1.1");

/** ¿Esa version afirma el asentimiento? Solo la 1.1-b, y solo ahi se puede guardar el asentimiento. */
export const declaracionAfirmaAsentimiento = (version: string): boolean =>
  version === DECLARACION_PRESENCIAL_MENOR_CON_ASENTIMIENTO_VERSION;

// LO QUE SE RETIRO AQUI (2026-09-09): dos frases que decian quien marca las casillas y quien digita el
// codigo. Eran de la MODALIDAD 1, donde el paciente actuaba en el dispositivo del profesional. Esa
// modalidad se retiro porque no aportaba nada sobre el enlace del consultorio, y con ella se van sus
// frases: en la modalidad 2 el paciente usa SU telefono, asi que no hay dispositivo que pasar.
//
// LA DECLARACION DE ARRIBA SE QUEDA: la usan la modalidad 2 (QR) y la 3 (papel), que es donde de verdad
// carga peso, porque ahi no hay OTP.

// ═══ SI LA FECHA DE NACIMIENTO SE CORRIGE DESPUES, LA RAMA DECLARADA PUEDE QUEDAR MAL ═══
//
// ── EL HALLAZGO ES DEL ABOGADO (2026-10-14), y es correcto ──────────────────────────────────────
//
// Textual suyo: *"lo que determina el texto declarado es la fecha de nacimiento tal como estaba al emitir
// el pase. Si esa fecha esta mal digitada y se corrige despues, el consentimiento ya firmado quedo bajo la
// rama equivocada, y NADA LO VA A DETECTAR."*
//
// Y NO PIDE CAMBIAR EL DISEÑO: elegir la rama UNA VEZ, en la emision, es lo correcto, porque la alternativa
// es que la rama cambie a mitad del acto. Lo que pide es que una correccion de fecha que CRUCE un umbral
// (los 18, o los 14 del asentimiento) marque ese consentimiento para revision. Su criterio es el mismo del
// hallazgo de la fecha vacia: *"un registro que afirma algo que no corresponde al hecho"*.
//
// NO ES HIPOTETICO: en este proyecto ya hubo TRES correcciones de fecha de nacimiento (las de la fecha
// imposible, 2026-10-09).
//
// ── POR QUE ESTO NO NECESITA NINGUNA COLUMNA NUEVA ─────────────────────────────────────────────
//
// Porque la sesion ya CONGELA la fecha que uso (`patient_birth_date`, 0216). O sea que la incoherencia es
// COMPUTABLE con lo que ya hay: se compara la fecha congelada contra la del paciente HOY, y si las dos
// implican ramas distintas, ese registro afirma algo que no corresponde al hecho. Sin esa columna habria
// que adivinar con que fecha se emitio.
//
// LO QUE FALTA, Y NO SE INVENTA AQUI, es la SUPERFICIE que lo muestre y el estado de "pendiente de
// revision": eso es la pieza 2 del consentimiento, que todavia no esta construida, y abrirle un mecanismo
// propio a este caso seria el segundo constructor del mismo insumo. Mientras tanto la deteccion vive en
// `scripts/RAMA_DEL_CONSENTIMIENTO_CONTRA_LA_FECHA_DE_HOY.sql`, que se puede correr despues de cualquier
// correccion de fecha (y que ya se puede correr hoy, sobre lo que haya).

/**
 * SI LA RAMA DECLARADA SIGUE CORRESPONDIENDO A LA EDAD QUE EL PACIENTE TENIA AL FIRMAR.
 *
 * Las dos edades se calculan A LA FECHA DEL ACTO, no a hoy: un menor que cumplio 18 el mes siguiente firmo
 * bien, y comparar contra hoy lo marcaria mal. Lo que se busca es un ERROR DE DIGITACION, no el paso del
 * tiempo.
 *
 * `null` en cualquiera de las dos fechas devuelve `null`: no se puede afirmar ni negar. Una sesion sin fecha
 * congelada es anterior a la 0216, y decir de ella que esta mal seria inventar.
 */
export function ramaSigueCorrespondiendo(e: {
  /** La fecha con la que se emitio el pase, congelada en la sesion. */
  fechaAlEmitir: string | null;
  /** La fecha que el paciente tiene HOY, ya corregida. */
  fechaDeHoy: string | null;
  /** El dia del acto: las dos edades se miden ahi. */
  diaDelActo: string;
}): { coherente: boolean; versionQueCorresponde: string | null; versionQueSeUso: string | null } | null {
  if (!e.fechaAlEmitir || !e.fechaDeHoy) return null;
  const conLaVieja = declaracionPorEdad(edadAlDia(e.fechaAlEmitir, e.diaDelActo));
  const conLaNueva = declaracionPorEdad(edadAlDia(e.fechaDeHoy, e.diaDelActo));
  return {
    coherente: conLaVieja?.version === conLaNueva?.version,
    versionQueCorresponde: conLaNueva?.version ?? null,
    versionQueSeUso: conLaVieja?.version ?? null,
  };
}

/**
 * La edad en años cumplidos a un dia dado. Aritmetica de calendario y no de milisegundos: con
 * milisegundos, un año bisiesto corre la edad un dia, y el dia que corre es justo el del cumpleaños.
 */
function edadAlDia(nacimiento: string, dia: string): number | null {
  const n = nacimiento.slice(0, 10).split("-").map(Number);
  const d = dia.slice(0, 10).split("-").map(Number);
  if (n.length !== 3 || d.length !== 3 || n.some(Number.isNaN) || d.some(Number.isNaN)) return null;
  let edad = d[0] - n[0];
  if (d[1] < n[1] || (d[1] === n[1] && d[2] < n[2])) edad -= 1;
  return edad;
}
