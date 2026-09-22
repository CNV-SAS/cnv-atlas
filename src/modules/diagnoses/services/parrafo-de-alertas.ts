import { preguntaComoEtiqueta } from "@/modules/reports/services/encuesta-redactada";

import type { AlertaDelPrompt, RespuestaEnRojoDelPrompt } from "../ai/prompts/criterion.v2";

// ═══ EL SEGUNDO PARRAFO DEL RESUMEN LO ESCRIBE ATLAS, NO EL MODELO (2026-09-21) ═══
//
// POR QUE. Gildardo pidio que el resumen de IA nombre las alertas en el parrafo inmediato a la presentacion.
// Se le pidio al modelo en tres versiones del prompt (v5, v6, v7) y en las tres pruebas de Santiago fallo
// algo distinto: omitio los siete sintomas digestivos, metio como rojo lo que no lo era (antihipertensivos,
// sal, carnes rojas) y, en las dos ultimas, SE COMIO LA ALERTA CRITICA DE TCA. Un parrafo que tiene que
// decir EXACTAMENTE una lista (todas y solo esas) no lo puede garantizar un modelo: un prompt baja la
// frecuencia con que se equivoca, no la lleva a cero. Es la misma leccion del filtro de marcadores.
//
// ASI QUE LA LISTA LA COMPONE ATLAS, con los MISMOS datos que ya van en el prompt (que salen de
// `alertasDeLaConsulta`, la fuente del SOAP), y se inserta despues de la apertura que escribio el modelo. El
// modelo sigue escribiendo todo lo demas, y sigue viendo las alertas para integrarlas en su dominio.
//
// MISMA REGLA QUE EL SOAP: nivel y titulo de cada alerta, nunca el texto de la regla (trae la conducta
// dentro). Y las respuestas tal cual las dio el paciente.

const ORDEN_DE_NIVEL: Record<string, number> = { crítico: 0, alto: 1, moderado: 2, positivo: 3 };

/** "D6 · Salud Digestiva" -> "Salud digestiva": encabeza su renglon, sin el codigo. */
const enRenglon = (dominio: string): string => {
  const sin = dominio.replace(/^D\d\s*·\s*/, "").toLocaleLowerCase("es-CO");
  return sin.charAt(0).toLocaleUpperCase("es-CO") + sin.slice(1);
};

const conMayuscula = (s: string): string => s.charAt(0).toLocaleUpperCase("es-CO") + s.slice(1);

// UNA LISTA LIMPIA, NO PROSA ENCADENADA (Santiago, 2026-09-22): "Y en hábitos de vida... Y en patrón
// horario... Y en determinantes..." era una lista disfrazada de prosa. Las respuestas en rojo son pares
// pregunta-respuesta y no se vuelven prosa sin reescribir lo que el paciente dijo, asi que van como lista:
// un renglon por dominio, igual que en la A del SOAP.

/** El parrafo de alertas, o null si la consulta no tiene ninguna (y entonces no se inserta nada). */
export function parrafoDeAlertas(
  alertas: AlertaDelPrompt[],
  respuestasEnRojo: RespuestaEnRojoDelPrompt[],
  sexo: string,
): string | null {
  if (!alertas.length && !respuestasEnRojo.length) return null;
  const delSujeto = /^f/i.test(sexo) ? "de la paciente" : "del paciente";

  const bloques: string[] = [];
  if (alertas.length) {
    const ordenadas = [...alertas].sort((a, b) => (ORDEN_DE_NIVEL[a.nivel] ?? 9) - (ORDEN_DE_NIVEL[b.nivel] ?? 9));
    bloques.push(
      `En la encuesta se registran estas alertas clínicas: ${ordenadas.map((a) => `${a.titulo} (${a.nivel})`).join("; ")}.`,
    );
  }
  if (respuestasEnRojo.length) {
    // Agrupadas por dominio, en el orden en que llegan (el de la encuesta).
    const grupos: { dominio: string; items: string[] }[] = [];
    for (const r of respuestasEnRojo) {
      const item = `${preguntaComoEtiqueta(r.pregunta)}: ${r.respuesta}`;
      const g = grupos.find((x) => x.dominio === r.dominio);
      if (g) g.items.push(item);
      else grupos.push({ dominio: r.dominio, items: [item] });
    }
    bloques.push(
      [
        `Respuestas ${delSujeto} marcadas en rojo por el clasificador de la encuesta:`,
        ...grupos.map((g) => `${enRenglon(g.dominio)}. ${conMayuscula(g.items.join("; "))}.`),
      ].join("\n"),
    );
  }
  return bloques.join("\n");
}

/**
 * Inserta el parrafo de alertas despues del PRIMER parrafo (la apertura). Si el texto no trae parrafos
 * separados, va detras de todo el texto: nunca se pierde.
 */
export function insertarParrafoDeAlertas(texto: string, parrafo: string | null): string {
  if (!parrafo) return texto;
  const parrafos = texto.split(/\n\s*\n/).filter((p) => p.trim() !== "");
  if (parrafos.length === 0) return parrafo;
  return [parrafos[0], parrafo, ...parrafos.slice(1)].join("\n\n");
}
