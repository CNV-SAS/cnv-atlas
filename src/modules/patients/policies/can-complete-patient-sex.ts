import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (regla 3): quien puede COMPLETAR el sexo de un paciente al que le falta.
//
// ── POR QUE ESTO NO ES "CORREGIR LOS DATOS PERSONALES" ─────────────────────────────────────────────
//
// Ese bloque sigue diferido, y con razon: ver `can-edit-patient-contact`. Corregir NOMBRE, DOCUMENTO o
// FECHA DE NACIMIENTO toca la resolucion de identidad (el documento es la llave con que Atlas decide
// inicial vs seguimiento) y, si cambia el documento, toca el CONSENTIMIENTO FIRMADO.
//
// EL SEXO NO ES NADA DE ESO. No identifica al paciente, no entra en la resolucion de identidad y no
// aparece en el consentimiento. Es un INSUMO DEL MOTOR, y hoy un paciente sin sexo no puede diagnosticarse
// (todas las clasificaciones son sexo-especificas), sin via para arreglarlo: el caso real del 2026-10-10,
// una integrante con la paciente delante y la pestaña Diagnostico caida con un 500.
//
// ── Y LA LINEA QUE SI SE RESPETA: RELLENAR UN HUECO, NUNCA PISAR UN VALOR ─────────────────────────
//
// La policy habilita la pantalla; lo que impide pisar un sexo ya registrado es el WRITER, que escribe con
// un `where` sobre el valor vacio y no actualiza ninguna fila si ya habia uno. Y esa frontera no es
// burocracia: cambiar el sexo de un paciente CON diagnostico sellado invalidaria el sellado, y un sellado
// no se recalcula (ver `normalize-patient-sex.mjs`). Eso es otra decision, no este formulario.
//
// ── QUIEN ──────────────────────────────────────────────────────────────────────────────────────────
//
// El profesional y el admin, igual que corregir el contacto y por el mismo motivo: no se reinterpreta nada
// clinico, se registra un dato que el paciente ya tiene y que el intake habria pedido. El alcance fino lo
// pone la RLS (el profesional solo alcanza a los suyos) y la action lo verifica LEYENDO el paciente bajo
// RLS antes de escribir.
export function canCompletePatientSex(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
