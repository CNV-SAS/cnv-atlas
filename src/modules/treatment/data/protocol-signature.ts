import type { TreatmentProtocol } from "./treatment-reader";

// Firma estable de los campos que EDITA el ProtocolForm: objetivos (kcal, proteina), restricciones,
// prescripcion de nutraceuticos (id + dosis + dias) y guias dietarias. Sirve de `key` del formulario.
//
// El defecto que arregla NO es solo de la lista de nutraceuticos: TODO el estado editable del panel es
// useState inicializado UNA sola vez desde el prop (kcal, proteina, restricciones, nutraceuticos, guias),
// asi que si el servidor cambia cualquiera de esos campos despues del montaje, el panel se queda pegado en
// lo viejo sin forma de notarlo (los nutraceuticos se delataron porque hay una segunda seccion (la entrega)
// que muestra el dato real; kcal/proteina no tienen quien los contradiga).
//
// Con la firma como `key`: cuando el servidor cambia uno de estos campos (un guardado, una correccion), la
// firma cambia y React REMONTA el form, que re-deriva el estado desde el protocolo autoritativo. Cuando una
// revalidacion NO tocó estos campos (registrar una entrega, generar un menu, agregar una nota), la firma es
// IDENTICA, el form no se remonta, y una edicion en curso se preserva. La firma sale del `protocol` del
// servidor, no del estado local, asi que teclear un valor sin guardar no la mueve.
//
// Deliberadamente EXCLUYE notas, menus, catalogo, recomendacion y diagnostico: no son estado editable del
// form, y meterlos remontaria (perdiendo una edicion en curso) ante una nota o un menu nuevos.
export function protocolSignature(p: TreatmentProtocol): string {
  const nutras = p.nutraceuticals
    .map((n) => `${n.nutraceuticalId}:${n.dosage ?? ""}:${n.durationDays ?? ""}`)
    .sort()
    .join("|");
  const guides = p.guidelines.map((g) => g.text).join("|");
  const restr = p.restricciones.join("|");
  // treatmentId incluido: un tratamiento distinto (p. ej. tras una correccion) siempre remonta.
  return [p.treatmentId, p.kcalObjetivo ?? "", p.proteinaGramos ?? "", restr, nutras, guides].join("§");
}
