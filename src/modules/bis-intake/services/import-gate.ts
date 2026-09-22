import type { BisIntakeRecord } from "../types";

// Gate de ORDEN + seguridad del import BIS (ST-B3). El sistema impone el orden: las condiciones de la
// toma deben guardarse ANTES del import. Si el profesional pudiera importar primero y marcar marcapasos
// despues, la medicion ya se habria hecho y la compuerta llegaria tarde. Pura y testeable: el action la
// aplica (defensa server, autoritativa). Desde el 2026-09-22 es tambien la UNICA: la pantalla ya no
// deshabilita el formulario.

// ═══ EL BOTON "IMPORTAR MEDICION BIS" ES EL GUARDIAN (Santiago, 2026-09-22) ═══
//
// Antes el bloque de Medicion BIS se deshabilitaba hasta guardar las condiciones, con un aviso amarillo que
// mandaba a la otra subpestaña. Ahora el bloque siempre esta disponible y la verificacion vive en UN solo
// sitio: el boton que importa. Si falta algo, lo dice todo junto y no deja pasar:
//   · las condiciones de la toma guardadas (y sin contraindicacion, que sigue bloqueando aparte);
//   · la encuesta al 100 %, con el MISMO predicado y el mismo conteo por dominio que el diagnostico;
//   · y el archivo valido (cintura, cadera y los datos del motor), que ya lo revisa la validacion del XLSX.
// El orden de seguridad se conserva: nada se guarda sin las condiciones.
export type RequisitosDelImport =
  | { allowed: true }
  | { allowed: false; reason: "contraindicated" | "faltan_requisitos"; message: string };

/**
 * `surveyGaps`: los huecos por dominio de la encuesta (vacio = completa), o null si el paciente no tiene
 * encuesta respondida.
 */
export function evaluarRequisitosDelImport(
  intake: BisIntakeRecord | null,
  surveyGaps: { section: string; missing: number }[] | null,
): RequisitosDelImport {
  if (intake?.contraindicated) {
    return {
      allowed: false,
      reason: "contraindicated",
      message: "No se puede importar: hay una contraindicación (marcapasos). La bioimpedancia no se realiza.",
    };
  }
  const faltan: string[] = [];
  if (!intake) faltan.push("guardar las condiciones de la toma BIS (subpestaña Encuesta)");
  if (surveyGaps == null) {
    faltan.push("que el paciente responda la encuesta");
  } else if (surveyGaps.length > 0) {
    const total = surveyGaps.reduce((s, g) => s + g.missing, 0);
    const porDominio = surveyGaps.map((g) => `${g.section} (${g.missing})`).join(", ");
    faltan.push(
      `completar la encuesta: ${total === 1 ? "falta 1 respuesta" : `faltan ${total} respuestas`} (${porDominio})`,
    );
  }
  if (faltan.length === 0) return { allowed: true };
  return {
    allowed: false,
    reason: "faltan_requisitos",
    message: `Para importar la medición falta ${faltan.join(" y ")}.`,
  };
}

// ═══ Y EL DIAGNOSTICO LAS EXIGE TAMBIEN (2026-09-22) ═══
// Mismo criterio que el boton, para la medicion que no paso por el (el paciente importado del HTML). La
// encuesta completa ya la exige el propio pipeline, con su mensaje por dominio.
export function condicionesParaDiagnosticar(
  condiciones: { contraindicated: boolean } | null,
): { allowed: true } | { allowed: false; message: string } {
  if (!condiciones) {
    return {
      allowed: false,
      message: "Para generar el diagnóstico falta guardar las condiciones de la toma BIS (subpestaña Encuesta).",
    };
  }
  if (condiciones.contraindicated) {
    return {
      allowed: false,
      message: "No se puede generar el diagnóstico: las condiciones de la toma registran una contraindicación (marcapasos).",
    };
  }
  return { allowed: true };
}
