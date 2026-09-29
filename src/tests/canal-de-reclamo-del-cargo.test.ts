import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CANAL_ADMIN } from "@/lib/constants/canales";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL CANAL DE RECLAMO (Santiago, 2026-09-28).
//
// LO QUE PIDIO, textual: "EL CANAL: admin@cnvsystem.com. Ponlo textual en las dos superficies. Un correo
// concreto se usa; 'un administrador' no se sabe a donde va."
//
// LO QUE ESTE CANDADO SOSTIENE, y por que son tres cosas y no una:
//
// 1. QUE EL CORREO SALGA EN LAS DOS SUPERFICIES. El integrante ve el cargo en dos sitios distintos (el
//    detalle de su faltante y su liquidacion) y puede llegar por cualquiera de los dos. Un canal que sale
//    en uno solo deja la mitad de los caminos sin salida.
//
// 2. QUE SALGA DE UN SOLO ORIGEN. Dos literales iguales no fallan el dia que se escriben: fallan el dia que
//    se cambia uno. Es el mismo patron de "dos partes que leen fuentes distintas" de CLAUDE.md, aplicado a
//    un dato en vez de a un estado.
//
// 3. QUE NO SE PIERDA EL "un administrador". Se prohibe la frase vieja, porque un texto que dice a quien
//    escribirle sin decir donde es el defecto que Santiago nombro, y volveria solo al reescribir la linea.
//
// Se lee el FUENTE (sin comentarios) y no se renderiza, porque lo que se protege es de donde sale el dato,
// y eso un render no lo distingue: pintaria igual un literal pegado a mano.

const SUPERFICIES = {
  "el detalle del faltante del integrante": "src/modules/nutraceuticals/components/mis-faltantes-section.tsx",
  "la liquidacion": "src/modules/payments/components/liquidaciones.tsx",
} as const;

describe("el canal para reclamar un cargo de faltante", () => {
  it("es un correo concreto, no una figura anonima", () => {
    expect(CANAL_ADMIN).toBe("admin@cnvsystem.com");
  });

  for (const [nombre, ruta] of Object.entries(SUPERFICIES)) {
    describe(nombre, () => {
      const src = sinComentarios(readFileSync(ruta, "utf8"));

      it("nombra el canal", () => {
        expect(src).toContain("CANAL_ADMIN");
        expect(src).toContain('from "@/lib/constants/canales"');
      });

      it("no lo pega a mano", () => {
        expect(src).not.toContain("admin@cnvsystem.com");
      });

      it("no vuelve a decir 'un administrador'", () => {
        expect(src).not.toMatch(/un administrador/);
      });
    });
  }
});
