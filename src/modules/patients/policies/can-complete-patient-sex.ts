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
// La policy habilita la pantalla; lo que separa los dos actos es el WRITER. `completarSexoDelPaciente`
// escribe con un `where` sobre el valor vacio, asi que no puede pisar nada ni por error. Pisar un valor es
// OTRA funcion (`corregirSexoDelPaciente`, abajo su policy), que exige motivo y deja en el rastro de que
// valor a cual se paso.
//
// LO QUE NINGUNA DE LAS DOS HACE es rehacer un diagnostico ya generado: eso solo pasa por el camino de
// correccion (`correctEvaluation`), que crea una version nueva y marca la vieja como reemplazada. Un
// diagnostico sellado no se recalcula por detras.
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

// ── Y QUIEN PUEDE CORREGIR UN SEXO YA REGISTRADO (Santiago, 2026-10-10) ───────────────────────────
//
// MISMOS ROLES, ACTO DISTINTO, y por eso es otra funcion y no un alias. Completar un hueco no puede
// equivocarse contra nada; corregir PISA un insumo del motor, exige motivo y deja en el rastro de que valor
// a cual se paso. Si manana uno de los dos actos cambia de alcance (por ejemplo, que corregir lo haga solo
// admin), un alias obligaria a separarlos en caliente y la separacion es justo lo que hay que poder hacer.
//
// EL CASO QUE LO ABRE es suyo: *"un paciente por ejemplo transexual puede pensar que es el genero, entonces
// el profesional debe poder cambiarlo."* El motor usa el sexo BIOLOGICO, asi que un genero anotado ahi no es
// un dato de identidad mal puesto, es un insumo clinico equivocado. Y quien puede arreglarlo es quien tiene
// al paciente delante: el profesional. Mandarlo a soporte seria el callejon que esto cierra.
export function canCorrectPatientSex(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}
