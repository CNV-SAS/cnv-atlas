import * as core from "./frozen/engine.core.derived.js";

// Abordaje por profesion (6ª card del estado EFR). Usa efrProf, expuesto por el mecanismo de archivo
// derivado (no editamos el frozen).
//
// CRITERIO "se SELLA vs se COMPUTA" (el que separa contenido de orientacion; escrito tambien en
// ARCHITECTURE para no decidir por analogia con lo ultimo):
//   - Lo que se SELLA en el snapshot es PRESCRIPCION: lo que se le prescribio a ESE paciente ESE dia
//     (rutas, remisiones, objetivos, frecuencia de seguimiento). Se le entrega al paciente, es acto
//     clinico, y no puede cambiar retroactivamente (por eso las rutas se congelan, T1).
//   - El abordaje por profesion es ORIENTACION para el PROFESIONAL sobre como abordar el estado. NO se
//     entrega al paciente. Por eso NO se sella: se computa en tiempo de vista desde la clave EFR
//     (que si esta sellada) + la profesion de QUIEN mira. El propio efrProf es "del rol logueado"
//     (comentario de Gildardo): dos profesionales ven textos distintos del mismo diagnostico, asi que
//     no existe un unico valor que sellar, y sellar los cuatro no cubriria los diagnosticos ya
//     inmutables.
//
// CONSECUENCIA ACEPTADA CONSCIENTEMENTE: si Gildardo entrega un efrProf nuevo, los diagnosticos VIEJOS
// mostraran el texto NUEVO, no el que vio el profesional ese dia. Es aceptable porque es ORIENTACION,
// no prescripcion; queda dicho aqui para que no se descubra despues como sorpresa.

// efrKey: "IFC_IRC_FFMI_FMI" (letras A/N/B), sellada en el snapshot (EngineOutput.efrPhenotype.key).
// profession: valor del enum (medico/psicologo/deportologo/nutricionista); efrProf resuelve el rol por
// substring. Devuelve null si la clave viene malformada (no exactamente 4 partes no vacias): no se
// computa un abordaje sobre una clave incompleta (efrProf no truena, pero daria un default enganoso).
export function abordajeProfesional(efrKey: string, profession: string): string | null {
  const parts = efrKey.split("_");
  if (parts.length !== 4 || parts.some((p) => p === "")) return null;
  const [i, r, f, m] = parts;
  return core.efrProf(profession, i, r, f, m);
}
