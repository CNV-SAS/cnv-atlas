import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (regla 3): quien puede corregir los DATOS DE CONTACTO de un paciente.
//
// ── POR QUE SOLO EL CONTACTO, Y NO LA FICHA ENTERA ─────────────────────────────────────────────────
//
// "Corregir los datos personales del paciente" esta en el backlog (punto 2 del cotejo) diferido a
// proposito, y la razon sigue en pie: corregir NOMBRE, DOCUMENTO o FECHA DE NACIMIENTO toca la resolucion
// de identidad (el documento es la llave con la que Atlas decide inicial vs seguimiento), toca la
// auditoria clinica y, si cambia el documento, toca el CONSENTIMIENTO FIRMADO, que se firmo sobre una
// identidad concreta. Eso es un bloque con su propia decision, no un formulario.
//
// EL CORREO Y EL TELEFONO NO SON NADA DE ESO. No identifican al paciente, no entran en la resolucion de
// identidad y no aparecen en el consentimiento. Son el CANAL por el que se le manda lo suyo, y hoy un
// paciente sin correo no puede recibir su reporte ni su historia clinica, sin via para arreglarlo (caso
// real del smoke del 2026-09-19: un paciente que empeoro, sin correo, con la entrega frenada).
//
// ── QUIEN ──────────────────────────────────────────────────────────────────────────────────────────
//
// El profesional y el admin, igual que archivar y por el mismo motivo: no se afirma nada clinico sobre la
// persona, se corrige un dato de contacto. El alcance fino lo pone la RLS (el profesional solo alcanza a
// los suyos), y la action lo verifica LEYENDO el paciente bajo RLS antes de escribir.
//
// ── Y QUEDA REGISTRADO EL VALOR ANTERIOR ───────────────────────────────────────────────────────────
//
// Es la segunda pregunta que dejaba abierta el backlog ("que queda del valor anterior"), y para el
// contacto la respuesta es barata: el evento de auditoria guarda lo que habia. Un correo que cambia sin
// rastro convierte "no le llego" en una discusion sin datos.
export function canEditPatientContact(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
