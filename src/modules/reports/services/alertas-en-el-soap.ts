import type { AlertasDeLaConsulta } from "@/clinical-engine/alertas-de-la-consulta";

import { preguntaComoEtiqueta } from "./encuesta-redactada";

// ═══ LAS ALERTAS EN EL SOAP: PRIMERA LINEA DE LA A (observación g, 2026-09-21) ═══
//
// EN LA A Y NO EN LA S, y es lo que evita que se repitan: la S es lo que el paciente RESPONDIO (su encuesta
// redactada, que ya dice "duerme menos de 5 horas"); la alerta es la INTERPRETACION de esa respuesta, que es
// materia del analisis. La S dice la respuesta; la A dice por que importa.
//
// LA MISMA FUENTE QUE LA IA (`alertasDeLaConsulta`) y la MISMA REGLA: nivel y titulo de cada alerta, nunca
// su texto, que trae la conducta dentro ("Derivacion urgente a psicologia"). Esa decision es del
// profesional, y en un documento que firma no puede aparecer como si la hubiera tomado el sistema.
//
// UNA SOLA CADENA, compuesta aqui: la pantalla y el texto que se copia imprimen esta misma linea, y asi no
// pueden decir cosas distintas.

const ORDEN_DE_NIVEL: Record<string, number> = { crítico: 0, alto: 1, moderado: 2, positivo: 3 };

/** La linea de alertas de la A, o null si la consulta no tiene ninguna (y entonces la A no la lleva). */
export function lineaDeAlertas(consulta: AlertasDeLaConsulta): string | null {
  const reglas = [...consulta.reglas]
    .sort((a, b) => (ORDEN_DE_NIVEL[a.niv] ?? 9) - (ORDEN_DE_NIVEL[b.niv] ?? 9))
    .map((a) => `${a.t} (${a.niv})`);
  // La respuesta va TAL CUAL la dio el paciente; lo que se ajusta es la pregunta, para que se lea como
  // rotulo dentro de una frase, igual que en la S.
  const rojas = consulta.respuestasEnRojo.map((r) => `${preguntaComoEtiqueta(r.pregunta)}: ${r.respuesta}`);

  const partes: string[] = [];
  if (reglas.length) partes.push(`Alertas de la consulta: ${reglas.join("; ")}.`);
  if (rojas.length) partes.push(`Respuestas de la encuesta en rojo: ${rojas.join("; ")}.`);
  return partes.length ? partes.join(" ") : null;
}
