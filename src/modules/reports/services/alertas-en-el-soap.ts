import { rojasPorDominio, type AlertasDeLaConsulta } from "@/clinical-engine/alertas-de-la-consulta";

import type { AlertasDelSoap } from "../data/reports-view-types";
import { preguntaComoEtiqueta } from "./encuesta-redactada";

// ═══ LAS ALERTAS EN EL SOAP: LO PRIMERO DE LA A (observación g, 2026-09-21) ═══
//
// EN LA A Y NO EN LA S, y es lo que evita que se repitan: la S es lo que el paciente RESPONDIO (su encuesta
// redactada, que ya dice "duerme menos de 5 horas"); la alerta es la INTERPRETACION de esa respuesta, que es
// materia del analisis. La S dice la respuesta; la A dice por que importa.
//
// LA MISMA FUENTE QUE LA IA (`alertasDeLaConsulta`) y la MISMA REGLA: nivel y titulo de cada alerta, nunca
// su texto, que trae la conducta dentro ("Derivacion urgente a psicologia"). Esa decision es del
// profesional, y en un documento que firma no puede aparecer como si la hubiera tomado el sistema.
//
// AGRUPADAS POR DOMINIO (Santiago, 2026-09-21): en una sola linea eran casi quince respuestas seguidas, que
// se copiaban bien y no se leian. La estructura se compone AQUI, una vez: la pantalla la pinta como lista y
// el texto copiado la escribe linea por linea, y las dos salen de lo mismo.

const ORDEN_DE_NIVEL: Record<string, number> = { crítico: 0, alto: 1, moderado: 2, positivo: 3 };

// LO QUE EL PARRAFO DE DIETA YA DICE NO SE REPITE EN LA LISTA ROJA (2026-09-21). La A lleva tambien su parrafo
// del patron alimentario ("come fuera de casa todos los dias; rara vez o nunca desayuna; con acceso
// generalmente dificil..."), y esas mismas respuestas salian otra vez en rojo dos lineas mas arriba. Son los
// campos que su `_resumenNutriParrafo` lee: el contexto (P59-P62), los liquidos (agua, gaseosas,
// energeticas) y el desayuno, que el parrafo toma de D1 y la lista de la P33 (el mismo hecho, dos preguntas).
// Solo cuando el parrafo esta: si no se emitio, la lista es la unica que lo dice y se queda entero.
export const CAMPOS_DEL_PARRAFO_DE_DIETA: ReadonlySet<string> = new Set([
  "d8_59", "d8_60", "d8_61", "d8_62", "d7_agua", "d7_55", "d7_56", "d4_33",
]);

/** Lo que la A muestra de las alertas, o null si la consulta no tiene ninguna. */
export function alertasParaElSoap(
  consulta: AlertasDeLaConsulta,
  /** Campos cuyo hecho ya dice otro parrafo de la A: no se repiten en la lista roja. */
  yaDichos: ReadonlySet<string> = new Set(),
): AlertasDelSoap | null {
  const reglas = [...consulta.reglas]
    .sort((a, b) => (ORDEN_DE_NIVEL[a.niv] ?? 9) - (ORDEN_DE_NIVEL[b.niv] ?? 9))
    .map((a) => `${a.t} (${a.niv})`);
  // La respuesta va TAL CUAL la dio el paciente; lo que se ajusta es la pregunta, para que se lea como
  // rotulo, igual que en la S.
  const rojas = rojasPorDominio(consulta.respuestasEnRojo.filter((r) => !yaDichos.has(r.fieldKey))).map((g) => ({
    dominio: g.dominio,
    respuestas: g.respuestas.map((r) => `${preguntaComoEtiqueta(r.pregunta)}: ${r.respuesta}`),
  }));
  if (!reglas.length && !rojas.length) return null;
  return { reglas: reglas.length ? reglas.join("; ") : null, rojas };
}
