import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policy contextual (regla 3): quien puede COMPLETAR O CORREGIR los datos del representante legal de un
// paciente menor.
//
// ── POR QUE SE PUEDE, SI LA FICHA NO DEJA CORREGIR NI EL NOMBRE NI EL DOCUMENTO DEL PACIENTE ─────
//
// Porque no es lo mismo. Corregir el nombre, el documento o la fecha de nacimiento DEL PACIENTE toca la
// resolucion de identidad (el documento es la llave con la que Atlas decide inicial vs seguimiento) y
// toca el consentimiento, que se firmo sobre una identidad concreta. Por eso sigue cerrado.
//
// EL REPRESENTANTE NO ES NADA DE ESO. No entra en la resolucion de identidad del paciente, no decide
// inicial vs seguimiento, y no cambia el acto de autorizar: lo que se corrige es la IDENTIFICACION de
// quien ya autorizo. Lo que decide es a nombre de quien sale la FACTURA (contabilidad, C1).
//
// ── Y SIN ESTA PUERTA EL FRENO NO TENDRIA SALIDA ─────────────────────────────────────────────────
//
// Hay menores que firmaron sin representante, y todos los que ya tienen representante lo tienen SIN TIPO
// de documento, porque esa columna nacio el 2026-11-19. Sin una via para completarlos, su venta quedaria
// pendiente de facturar para siempre y la unica salida seria volver a firmar el consentimiento entero.
// Un freno sin salida no es un guard: detiene a una persona.
//
// ── QUIEN ────────────────────────────────────────────────────────────────────────────────────────
//
// El profesional y el admin, igual que corregir el contacto y por el mismo motivo: no se afirma nada
// clinico sobre nadie. El alcance fino lo pone la RLS (el profesional solo alcanza a los suyos) y la
// action lo verifica LEYENDO el paciente bajo RLS antes de escribir.
//
// Y queda el valor ANTERIOR en la auditoria, que aqui pesa mas que en el contacto: de este dato sale un
// documento tributario que va a la DIAN.
export function canEditLegalRepresentative(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
