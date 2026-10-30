import { hasAnyRole, type CurrentUser } from "@/modules/auth/roles";

// Policies contextuales (regla 3): quien PIDE retirar a un paciente y quien lo EJECUTA.
//
// ── SON DOS Y NO UNA, Y ESO ES EL DISENO ───────────────────────────────────────────────────────────
//
// v12 §1.2 pide que "eliminar perfil" exista con politica, *"solo para el profesional dueno del paciente
// y para la direccion cientifica"*. La 0180 ya habia fijado la forma de esa clase de acto: el profesional
// PROPONE y quien no se beneficia CONFIRMA, porque marcar a alguien de prueba lo saca de las cifras y
// *"quien se beneficia de la exclusion no puede autorizarla"*. Ahi quedo escrito que es *"la misma
// asimetria que Santiago pidio para el borrado"*.
//
// Retirar a un paciente hace lo mismo y mas: sale de la lista, de las cifras y de la cohorte de
// investigacion. Asi que el acto se parte en dos y cada mitad tiene su policy.
//
// ── QUIEN EJECUTA: `admin`, Y NO `direccion`, AUNQUE SU FRASE DIGA "DIRECCION CIENTIFICA" ─────────
//
// Esto hay que explicarlo, porque se aparta de su letra. En Atlas, `direccion` NO ACCEDE A DATOS DE
// PACIENTE, y no es un descuido: esta escrito en la navegacion desde el principio (*"Direccion y obbia no
// acceden a datos de paciente: sus tableros son agregados"*) y su tablero se construyo sin PII a
// proposito. Para que el rol `direccion` pudiera ejecutar esto habria que darle acceso a nombres y
// documentos, que es un cambio de alcance MUCHO mayor que este item y que nadie pidio.
//
// La autoridad que su frase busca es "alguien que no sea quien se beneficia", y en Atlas ese es `admin`:
// es el rol que ya resuelve las propuestas de la 0180, el que ya ve PII, y el que hoy tiene Santiago.
//
// VA AL DOCUMENTO DE DUDAS, porque es una traduccion nuestra de su palabra y puede querer otra cosa: si
// quiere que sea literalmente la direccion cientifica, lo que hay que decidir primero es si ese rol pasa a
// ver datos de paciente. Lo que NO entra en ningun caso es `soporte`, que ve pacientes para acompanar y no
// decide sobre ellos.
//
// Y NO ENTRA `admin` EN LA PETICION por via de "depurar el roster": para eso esta ARCHIVAR, que es
// reversible de un clic y no afirma nada sobre la persona. Pedir que se elimine un perfil afirma algo (que
// este paciente no debio existir), y eso lo dice quien lo atendio.

/** Quien puede PEDIR que se elimine un perfil. El alcance fino (que sea suyo) lo pone la RLS al verlo. */
export function canProposePatientDeletion(user: CurrentUser): boolean {
  return hasAnyRole(user, ["professional", "admin"]);
}

/** Quien puede EJECUTAR la eliminacion, negarla o restituir. Nunca el profesional solo. */
export function canConfirmPatientDeletion(user: CurrentUser): boolean {
  return hasAnyRole(user, ["admin"]);
}
