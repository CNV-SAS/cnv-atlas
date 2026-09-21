// ═══ LAS ALERTAS DE LA CONSULTA: UNA SOLA FUENTE PARA LA IA Y PARA EL SOAP (observación g, 2026-09-21) ═══
//
// QUE REUNE, y en que orden de autoridad:
//   1. Sus REGLAS (`generarAlertas`), las que hoy pueden correr (`alertasDisponibles`). Traen su nivel
//      (critico, alto, moderado, positivo) y ya viajaban al resumen de IA desde el prompt v4.
//   2. Las RESPUESTAS EN ROJO de su clasificador del ATLAS_v9 (`nivelDeRespuesta` = "atencion"). Es lo que
//      su v9 desbloqueo: la encuesta ya dice, respuesta por respuesta, que merece atencion.
//
// LO QUE NO ENTRA, y cada cosa por una razon:
//   · EL AMBAR. Su color dice "vigilar", no "alerta", y es la mayoria de las respuestas: el parrafo se
//     llenaria y lo importante se perderia entre lo que solo hay que mirar.
//   · LA COMPOSICION CORPORAL. Ya es el contenido del parrafo Metabolico-Estructural, y Gildardo pidio
//     "las alertas rojas de la encuesta" en el segundo parrafo. Meterla repetiria lo mismo dos veces.
//   · LOS DUPLICADOS. Si una respuesta en rojo ya dispara una de sus reglas (laxantes y "TCA activo"),
//     sale UNA vez, como la regla, que es la que trae nivel.
//
// POR QUE UNA SOLA FUENTE: la IA y el SOAP hablan de la misma consulta. Si cada una armara su lista, el
// resumen podria nombrar una alerta que la historia no tiene, o al reves.
//
// PURO: sin app ni BD (regla dura 12). Recibe las respuestas ya leidas.

import { alertasDisponibles, encDesdeRespuestas, type AlertaClinica } from "./alertas-disponibles";
import { nivelDeRespuesta, type ValorEncuesta } from "./encuesta-colores";

/** Una respuesta tal como la leen la IA y el SOAP: su campo, su pregunta y lo que el paciente dijo. */
export type RespuestaConPregunta = { fieldKey: string | null; pregunta: string; valor: string | null };

/** Una respuesta que su clasificador marca en rojo. */
export type RespuestaEnRojo = {
  fieldKey: string;
  /** El dominio de la encuesta (D2..D8), del prefijo del campo. */
  dominio: string;
  pregunta: string;
  /** Lo que el paciente respondio, tal cual (varias opciones, unidas por coma). */
  respuesta: string;
};

export type AlertasDeLaConsulta = {
  reglas: AlertaClinica[];
  respuestasEnRojo: RespuestaEnRojo[];
};

// QUE CAMPOS LEE CADA REGLA SUYA, para no repetir en rojo lo que la regla ya dijo. Sale de su
// `generarAlertas` (frozen/atlas-alertas.js): TCA lee la 21; deshidratacion, el agua y el color de la
// orina; estres y azucares, la 29. Las demas reglas vivas no leen campos que su clasificador juzgue.
const CAMPOS_DE_LA_REGLA: Record<string, string[]> = {
  "TCA activo detectado": ["d2_21"],
  "Deshidratación probable": ["d7_58", "d7_agua"],
  "Estrés alto + azúcares elevados": ["d3_29"],
  "Hidratación adecuada": ["d7_agua"],
};

// La actividad fisica se juzga con DOS preguntas juntas (dias por minutos): si sale en rojo, es un solo
// hallazgo y se nombra una vez, por la pregunta de los dias.
const CAMPOS_FUNDIDOS: Record<string, string> = { d3_24: "d3_23" };

function leerValor(v: string | null): ValorEncuesta {
  if (v == null) return null;
  if (v.startsWith("[")) {
    try {
      const p: unknown = JSON.parse(v);
      if (Array.isArray(p)) return p.map(String);
    } catch {
      // no era JSON: se usa tal cual
    }
  }
  return v;
}

const comoTexto = (v: ValorEncuesta): string => (Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v));

/** Las alertas de una consulta: sus reglas vivas y las respuestas en rojo que no repiten a una regla. */
export function alertasDeLaConsulta(respuestas: RespuestaConPregunta[]): AlertasDeLaConsulta {
  const reglas = alertasDisponibles(
    encDesdeRespuestas(respuestas.map((r) => ({ fieldKey: r.fieldKey, answerValue: r.valor }))),
  );
  const cubiertos = new Set(reglas.flatMap((a) => CAMPOS_DE_LA_REGLA[a.t] ?? []));

  const porCampo: Record<string, ValorEncuesta> = {};
  for (const r of respuestas) if (r.fieldKey) porCampo[r.fieldKey] = leerValor(r.valor);

  const respuestasEnRojo: RespuestaEnRojo[] = [];
  const vistos = new Set<string>();
  for (const r of respuestas) {
    if (!r.fieldKey || !/^d[2-8]_/.test(r.fieldKey)) continue;
    const campo = CAMPOS_FUNDIDOS[r.fieldKey] ?? r.fieldKey;
    if (vistos.has(campo) || cubiertos.has(r.fieldKey) || cubiertos.has(campo)) continue;
    if (nivelDeRespuesta(r.fieldKey, porCampo[r.fieldKey], porCampo) !== "atencion") continue;
    vistos.add(campo);
    const original = respuestas.find((x) => x.fieldKey === campo) ?? r;
    respuestasEnRojo.push({
      fieldKey: campo,
      dominio: campo.slice(0, 2).toUpperCase(),
      pregunta: original.pregunta,
      // En la fundida van las dos respuestas: "3 · 0 minutos a la semana" dice por que es rojo; una sola no.
      respuesta:
        campo === "d3_23"
          ? [comoTexto(porCampo.d3_23), comoTexto(porCampo.d3_24)].filter((t) => t.trim()).join(" · ")
          : comoTexto(porCampo[campo]),
    });
  }
  return { reglas, respuestasEnRojo };
}
