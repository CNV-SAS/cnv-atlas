// EL MENSAJE DEL DOCUMENTO AJENO, en su propio modulo por dos razones y ninguna es de organizacion.
//
// PRIMERA: es el unico texto de esta pieza que tiene que medir cada palabra. Dice que el documento existe
// (cosa que el error del unique YA revelaba, peor redactada), dice que no esta a su cargo, dice
// EXPLICITAMENTE que no hay mas que decir, y da la salida real. No nombra al paciente, ni al profesional,
// ni la fecha, ni el estado.
//
// SEGUNDA: para que un candado pueda leerlo ARMADO. Dentro de la action vivia partido en tres literales
// concatenados, y una asercion sobre el codigo fuente no puede ver la frase completa: buscar "No podemos
// darte mas detalles" fallaba porque el corte de linea caia en medio. El candado leia otra cosa que la que
// el profesional ve.
//
// Y LA SALIDA NO ES UN BOTON: la reasignacion exige consentimiento FRESCO del paciente hacia el
// profesional entrante y traspaso formal de custodia (DATA_GOVERNANCE), asi que no es algo que esta
// pantalla pueda resolver por su cuenta.
export const DOCUMENTO_AJENO =
  "Ese documento ya está registrado en la organización y no está bajo tu cuidado. No podemos darte más detalles. Si el paciente viene a tu consulta, escribe a soporte para tramitar el cambio de profesional: requiere una autorización nueva del paciente.";

// LO QUE SE RETIRO AQUI (2026-09-09): habia un segundo texto, para el momento de FIRMAR en la pantalla
// del profesional. Murio con la modalidad 1: ya no hay una firma que ocurra en esa pantalla. El de la
// BUSQUEDA se queda, porque el chequeo del documento es del camino compartido y lo usan las dos vias.

// EL CODIGO, PEGADO AL MENSAJE. Cada audiencia lo recibe con su motivo:
//
//   · AL PROFESIONAL se le dice PARA QUE sirve. Sin el motivo, "menciona el codigo" se lee como
//     burocracia y se ignora; con el, se entiende que evita mandar una cedula por correo.
//   · AL PACIENTE no se le explica nada: el no va a escribir a soporte. Es un numero de referencia que le
//     enseña al profesional que tiene delante, y sobrecargarlo de explicacion solo lo alarma.
export function documentoAjenoParaProfesional(codigo: string): string {
  return `${DOCUMENTO_AJENO} Si escribes a soporte, menciona el código ${codigo}: con eso encuentran el caso sin que tengas que enviarles el documento.`;
}

export function enlaceQueNoCorrespondeParaPaciente(base: string, codigo: string): string {
  return `${base} Código de referencia: ${codigo}.`;
}
