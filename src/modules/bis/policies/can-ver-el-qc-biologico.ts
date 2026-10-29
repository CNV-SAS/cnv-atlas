import { type CurrentUser, hasAnyRole } from "@/modules/auth/roles";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// QUIEN PUEDE DAR EL VISTO BUENO AL CONTROL DE CALIDAD BIOLOGICO  ·  POLICY (regla dura 3)
//
// ═══ QUIEN, Y POR QUE NO ES "CUALQUIERA QUE VEA LA PANTALLA" ═══
//
// Su regla: *"la decision de continuar es del profesional y queda registrada"*. Asi que es un acto
// CLINICO: lo firma quien atiende, no quien administra.
//
// EL PROFESIONAL DE LA CONSULTA, y eso NO se comprueba aqui: lo impone la RLS, igual que en el resto del
// pipeline. Esta policy solo decide el ROL; que la evaluacion sea de su paciente lo decide la base, que es
// la unica que no se puede olvidar de preguntarlo.
//
// DIRECCION Y ADMIN TAMBIEN, por una razon operativa que conviene dejar escrita: hay 400 mediciones
// anteriores a este control, dos de ellas con un hallazgo, y de esas dos puede que el profesional que
// atendio ya no este. Sin dirección, esas dos consultas quedarian bloqueadas sin nadie que pueda
// desbloquearlas, y un freno sin salida no es un guard: detiene a una persona.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

export function canDarVistoBuenoAlQc(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "direccion", "admin"]);
}
