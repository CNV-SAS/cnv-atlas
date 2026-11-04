import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN SOLO DOCUMENTO DE DUDAS  ·  2026-11-03
//
// ═══ POR QUE ESTO ES UN CANDADO Y NO UNA NOTA EN UN DOC ═══
//
// La cola de preguntas abiertas a Gildardo se ha partido en dos DOS VECES, y las dos veces el sintoma fue
// el mismo: una pregunta que estaba en una cola no entraba en el mensaje que el recibia.
//
//   · 2026-09-06: `GILDARDO_QUERIES.md` se retira y lo vivo se muda a `PENDIENTES_CIENTIFICOS.md`.
//   · 2026-10-30: nace `entregas/DUDAS_PARA_GILDARDO_EBBIS_V7_Y_V12_2026-10-30.md`, y vuelven a ser dos.
//   · 2026-11-03: Santiago pide otra vez UNO SOLO. Se refunden en `PENDIENTES_CIENTIFICOS.md`.
//
// Una nota dentro de un documento no impidio la segunda vez, porque quien abre un documento nuevo no lee
// el viejo. Asi que lo que se verifica aqui es lo unico que de verdad sostiene la regla: que los dos
// archivos RETIRADOS digan que estan retirados y APUNTEN al vivo. Si alguien vuelve a abrir una cola
// paralela, el candado no lo impide (nada puede), pero el dia que retire este archivo tiene que pasar por
// aqui, y aqui esta escrito por que.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const VIVO = "docs/PENDIENTES_CIENTIFICOS.md";
const RETIRADOS = [
  "docs/GILDARDO_QUERIES.md",
  "docs/entregas/DUDAS_PARA_GILDARDO_EBBIS_V7_Y_V12_2026-10-30.md",
];

function leer(p: string): string {
  return readFileSync(p, "utf8");
}

describe("la cola de dudas de Gildardo es UNA, y las retiradas apuntan a ella", () => {
  it.each(RETIRADOS)("%s dice que esta retirado y apunta al documento vivo", (p) => {
    const t = leer(p);
    expect(t).toMatch(/RETIRAD|LO VIVO SE MUD/);
    expect(t).toContain("PENDIENTES_CIENTIFICOS.md");
  });

  it("el documento vivo dice que es el unico y cruza la numeracion de los anteriores", () => {
    const t = leer(VIVO);
    // Que se declare unico es lo que hace que el siguiente lector no abra otro.
    // Se acepta cualquier forma de decirlo, no una frase exacta: lo que importa es que lo DIGA.
    expect(t).toMatch(/el único documento|documento único|este archivo es el único/i);
    // Y la tabla de procedencia: sin ella, unir dos documentos PIERDE las respuestas a medio escribir.
    expect(t).toContain("DE DÓNDE SALE CADA PREGUNTA");
  });

  it("el BACKLOG apunta al vivo como la ruta exacta del documento de dudas", () => {
    const b = leer("docs/BACKLOG.md");
    const fila = b.split("\n").find((l) => l.includes("**El documento de dudas**"));
    expect(fila).toBeDefined();
    expect(fila).toContain("docs/PENDIENTES_CIENTIFICOS.md");
  });
});
