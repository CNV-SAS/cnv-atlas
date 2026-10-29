import { readFileSync } from "node:fs";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS TITULOS DEL PLAN, POR SUPERFICIE  ·  AYUDANTE DE CANDADOS
//
// ═══ POR QUE EXISTE (2026-10-28) ═══
//
// El plan del paciente sale por TRES superficies desde que el correo adjunta su hoja: la que se imprime
// desde pantalla, el PDF del plan y el informe (que solo se queda con tres bloques). Los candados que
// comparan superficies (`plan-paciente`, `plan-imprimible`) buscaban los titulos con `indexOf` sobre el
// archivo del informe, y eso dejo de funcionar cuando el JSX de los bloques se movio a un modulo
// compartido: los titulos ya no estan en el documento, estan en el bloque que el documento COMPONE.
//
// ASI QUE EL MAPA DE COMPONENTE A TITULO SE DERIVA DEL CODIGO, no se escribe a mano. Un mapa escrito a mano
// envejece el dia que alguien cambie un titulo, y el candado seguiria comparando ordenes de titulos que ya
// no existen, verde y sin vigilar nada.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const BLOQUES = readFileSync("src/modules/reports/pdf/bloques-del-plan.tsx", "utf8");
const HOJA = readFileSync("src/modules/reports/components/plan-imprimible.tsx", "utf8");
const PLAN_PDF = readFileSync("src/modules/reports/pdf/plan-document.tsx", "utf8");
const INFORME = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");

/** Componente del bloque -> el titulo que pinta, leido del modulo compartido. */
export const TITULO_DEL_BLOQUE: Record<string, string> = (() => {
  const mapa: Record<string, string> = {};
  for (const m of BLOQUES.matchAll(/export function (Bloque\w+)\(/g)) {
    const desde = m.index ?? 0;
    const titulo = /<Text style=\{styles\.sectionTitle\}>([^<]+)</.exec(BLOQUES.slice(desde));
    if (titulo) mapa[m[1]] = titulo[1].trim();
  }
  return mapa;
})();

/** Los titulos que un documento COMPONE, en el orden en que los compone. */
const compuestos = (fuente: string): string[] =>
  [...fuente.matchAll(/<(Bloque\w+)\s/g)]
    .map((m) => TITULO_DEL_BLOQUE[m[1]])
    .filter((t): t is string => t != null);

/** La hoja que se imprime desde pantalla: sus bloques llevan el titulo inline. */
export const titulosDeLaHoja = (): string[] =>
  [...HOJA.matchAll(/<Bloque titulo="([^"]+)"/g)].map((m) => m[1]);

/** El PDF del plan, que es el adjunto del correo: compone los SIETE. */
export const titulosDelPlanPdf = (): string[] => compuestos(PLAN_PDF);

/**
 * El informe: sus propias secciones MAS los bloques del plan que compone, en orden.
 *
 * Se mezclan las dos formas porque en el informe conviven: "Cómo estás" lo pinta el documento y "Lo que
 * debes evitar" lo compone. Un candado que mirara solo una de las dos no veria la mitad del orden.
 */
export const titulosDelInforme = (): string[] => {
  const marcas: { i: number; titulo: string }[] = [];
  for (const m of INFORME.matchAll(/styles\.sectionTitle\}>([^<{][^<]*)</g)) {
    marcas.push({ i: m.index ?? 0, titulo: m[1].trim() });
  }
  for (const m of INFORME.matchAll(/<(Bloque\w+)\s/g)) {
    const titulo = TITULO_DEL_BLOQUE[m[1]];
    if (titulo) marcas.push({ i: m.index ?? 0, titulo });
  }
  return marcas.sort((a, b) => a.i - b.i).map((x) => x.titulo);
};
