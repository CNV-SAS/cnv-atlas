import { randomBytes } from "node:crypto";

// CODIGO DE REFERENCIA DEL INTENTO BLOQUEADO. Lo que hace que soporte pueda encontrar el registro sin que
// el documento del paciente salga de la aplicacion.
//
// EL ARGUMENTO ES DE PII, no de comodidad: sin codigo, lo primero que soporte pide es la cedula, y
// entonces el documento viaja por correo o por chat, que es justo lo que la pantalla acaba de evitar.
//
// ALEATORIO, NUNCA DERIVADO, y esto es lo que decide el diseño: una cedula colombiana son ocho a diez
// digitos. Si el codigo fuera un hash del documento, aunque recortado, cualquiera que lo tenga puede
// probar los mil millones de cedulas posibles SIN CONEXION y ver cual lo produce. Un espacio de busqueda
// pequeño vuelve reversible cualquier derivacion, por buena que sea la funcion.
//
// Y UNO NUEVO POR INTENTO, no uno estable por documento: con uno estable, dos personas comparando codigos
// descubririan que apuntaron al mismo documento. Ese es el segundo canal de fuga, el que se escapa si solo
// se piensa en "que no se pueda revertir".
//
// DONDE VIVE: en el payload del evento de auditoria del intento. `clinical_audit_log` es admin-only para
// SELECT (policy `clinical_audit_log_select`), asi que quien lo busca es un admin. El rol `soporte` NO
// puede leerlo; si algun dia tiene que resolverlo solo, eso es un cambio de policy y se decide aparte.

// SIN PARECIDOS: nada de O/0 ni de 1/I/L. Alguien va a dictar esto por telefono, y un codigo que se
// escucha mal cuesta otra vuelta de soporte. Quedan 31 simbolos: 31^6 = 887 millones, de sobra para
// buscar, y una colision no importa porque la hora desambigua.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LARGO = 6;

export function generarCodigoSoporte(): string {
  // rejection sampling: 256 no es multiplo de 31, y usar el modulo directo sesgaria hacia los primeros
  // simbolos. Se descartan los bytes del sobrante en vez de repartir mal.
  const limite = Math.floor(256 / ALFABETO.length) * ALFABETO.length;
  let salida = "";
  while (salida.length < LARGO) {
    for (const b of randomBytes(LARGO * 2)) {
      if (b >= limite) continue;
      salida += ALFABETO[b % ALFABETO.length];
      if (salida.length === LARGO) break;
    }
  }
  return salida;
}
