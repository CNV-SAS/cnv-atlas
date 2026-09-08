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

// LAS DOS FRASES DE LA PANTALLA, y son la MITAD PROBATORIA del flujo, no ayuda al usuario.
//
// El valor legal de la modalidad 1 descansa en dos hechos: que las casillas las marco EL PACIENTE y que
// el codigo lo digito EL PACIENTE. Si cualquiera de los dos lo hace el profesional, la firma electronica
// deja de probar que fue el. Por eso la pantalla lo dice DONDE OCURRE cada uno, y no en un parrafo de
// instrucciones al principio que nadie relee.
//
// Y POR ESO NO SE PUEDEN SALTAR: no son un aviso previo que se cierra. Estan pegadas a la casilla y al
// campo del codigo, y siguen ahi mientras se usan.

/** Va JUNTO a las casillas de autorizacion, no encima del formulario. */
export const AVISO_CASILLAS =
  "Pásale el dispositivo al paciente para que marque él las autorizaciones. Marcarlas por él invalida el " +
  "consentimiento.";

/** Va JUNTO al campo del codigo. */
export const AVISO_CODIGO =
  "El código lo digita el paciente: es lo único que prueba que fue él. Pásale el dispositivo, o que lo " +
  "lea en su teléfono y te lo dicte solo si no puede escribir.";
