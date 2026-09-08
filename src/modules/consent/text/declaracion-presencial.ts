// LA DECLARACION DEL PROFESIONAL, en el consentimiento presencial.
//
// QUE ES. En las tres modalidades presenciales, el profesional afirma cuatro cosas sobre el acto que
// acaba de ocurrir delante de el. No sustituye al consentimiento del paciente: lo ACOMPAÑA, diciendo
// como se obtuvo.
//
// SE VERSIONA COMO EL TEXTO DEL CONSENTIMIENTO, y por el mismo motivo: es una afirmacion con
// consecuencias. Si mañana cambia su redaccion, lo declarado antes tiene que seguir diciendo lo que
// decia, y la fila guarda la version para poder citarlo. Un booleano dejaria constancia de que
// "declaro algo" sin poder decir QUE.
//
// EL TEXTO ES DEL DICTAMEN LEGAL (2026-09-08), verbatim. No se reescribe "para que suene mejor": lo que
// da valor probatorio es exactamente lo que el profesional afirma, y cambiarlo sin abogado cambia el
// alcance de la afirmacion.

export const DECLARACION_PRESENCIAL_VERSION = "1.0";

export const DECLARACION_PRESENCIAL =
  "Declaro que presenté el consentimiento al paciente, que tuvo oportunidad de leerlo, que fue él quien " +
  "marcó las autorizaciones, y que verifiqué su identidad contra su documento.";

// LO QUE SE RETIRO AQUI (2026-09-09): dos frases que decian quien marca las casillas y quien digita el
// codigo. Eran de la MODALIDAD 1, donde el paciente actuaba en el dispositivo del profesional. Esa
// modalidad se retiro porque no aportaba nada sobre el enlace del consultorio, y con ella se van sus
// frases: en la modalidad 2 el paciente usa SU telefono, asi que no hay dispositivo que pasar.
//
// LA DECLARACION DE ARRIBA SE QUEDA: la usan la modalidad 2 (QR) y la 3 (papel), que es donde de verdad
// carga peso, porque ahi no hay OTP.
