import { BIODY_COLUMNS, ENGINE_REQUIRED } from "@/clinical-engine";
import { normalizeHeader } from "@/modules/bis/services/header-map";

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

// ═══ LA CINTURA Y LA CADERA, TAMBIEN EN EL DIAGNOSTICO (smoke de Santiago, 2026-09-22) ═══
//
// Las exige el import del XLSX como regla de negocio (estandar de la medicion y de la investigacion), pero esa
// guarda vive en el boton, y una medicion que llega por otro camino no pasa por el: un paciente importado del
// HTML sin cadera genero diagnostico. Es el mismo hueco que tenian las condiciones, y se cierra igual: la
// regla se repite en el sitio que ningun camino puede saltarse.
export function circunferenciasParaDiagnosticar(
  medidas: { cintura: number | null; cadera: number | null },
  // EL REMEDIO NO ES EL MISMO EN LOS DOS CAMINOS (Santiago, 2026-09-22): con el paciente delante se vuelve a
  // medir; en una consulta importada del HTML el tamizaje fue hace meses y no se puede repetir, asi que se
  // teclean en Antropometria.
  importada = false,
): { allowed: true } | { allowed: false; message: string } {
  const faltan = [
    medidas.cintura == null || medidas.cintura <= 0 ? "la cintura" : null,
    medidas.cadera == null || medidas.cadera <= 0 ? "la cadera" : null,
  ].filter((x): x is string => x != null);
  if (faltan.length === 0) return { allowed: true };
  return {
    allowed: false,
    message: importada
      ? `Para generar el diagnóstico falta ${faltan.join(" y ")} de la medición. Escríbela en Antropometría: esta consulta se importó del HTML y su toma no se puede repetir.`
      : `Para generar el diagnóstico falta ${faltan.join(" y ")} de la medición. Vuelve a tomar la medida en Biody Manager con esos datos y re-importa el XLSX.`,
  };
}

// ═══ LOS INSUMOS DEL MOTOR, EN LA PUERTA Y NO EN LA EXCEPCION (2026-09-23) ═══
//
// El lector de la fila del Biody LANZA cuando le falta un insumo requerido, y hace bien: un import incompleto
// no debe producir un diagnostico plausible pero falso. Pero ese grito estaba pensado para un ARCHIVO, y al
// profesional que genera el diagnostico de una medicion importada del HTML le llegaba como "Algo salió mal",
// con el detalle hablando de "columnas del Excel" para una medicion que no tiene Excel.
//
// Asi que la falta se mira ANTES, con el mismo criterio, y se dice en el idioma del caso. El grito del lector
// se queda donde esta: es la red por si alguna via no pasa por aqui.
export function insumosDelMotorParaDiagnosticar(
  /** Los `variable_name` que la medicion tiene guardados (headers normalizados). */
  guardados: string[],
  importada = false,
): { allowed: true } | { allowed: false; message: string } {
  const presentes = new Set(guardados);
  const faltan = ENGINE_REQUIRED.filter(
    (campo) => !presentes.has(normalizeHeader(BIODY_COLUMNS[campo].header)),
  );
  if (faltan.length === 0) return { allowed: true };
  const lista = faltan.join(", ");
  return {
    allowed: false,
    message: importada
      ? `Esta medición importada del HTML no trae datos que el motor necesita (${lista}), así que no se puede generar el diagnóstico. No se pueden escribir a mano: son resultados del equipo, no medidas de cinta. Si el paciente tiene el archivo del Biody de esa toma, se monta la medición con él; si no, esta consulta queda sin diagnóstico.`
      : `La medición no trae datos que el motor necesita (${lista}). Vuelve a exportar desde Biody Manager y re-importa el XLSX.`,
  };
}

// ═══ Y EL DIAGNOSTICO LAS EXIGE TAMBIEN (2026-09-22) ═══
// Mismo criterio que el boton, para la medicion que no paso por el (el paciente importado del HTML). La
// encuesta completa ya la exige el propio pipeline, con su mensaje por dominio.
export function condicionesParaDiagnosticar(
  condiciones: { contraindicated: boolean; registradas?: boolean } | null,
): { allowed: true } | { allowed: false; message: string } {
  // LAS REGISTRO ALGUIEN, no basta con que la fila exista (0170). Desde que la importacion del HTML trae la
  // fuerza prensil y el peso meta, una fila puede existir sin que nadie haya respondido las condiciones.
  if (!condiciones || condiciones.registradas === false) {
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
