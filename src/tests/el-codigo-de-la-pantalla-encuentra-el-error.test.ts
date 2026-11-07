import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL CODIGO QUE EL PROFESIONAL LEE EN PANTALLA TIENE QUE ENCONTRAR EL ERROR  ·  2026-11-06
//
// ═══ EL CASO ═══
//
// Maria Teresa ve "Esta pestaña no se pudo mostrar" con el codigo 404641578 y el aviso le pide pasarselo a
// soporte. Ese codigo es el `digest` que Next pone al error. Si no viaja a Sentry COMO ETIQUETA, el aviso
// esta pidiendo una accion que no sirve de nada: con el codigo en la mano no se encuentra nada.
//
// ═══ LA MITAD QUE FALTABA ═══
//
// El limite de cliente (`panel-con-red`) ya lo etiquetaba, y su comentario decia por que. El hook del
// SERVIDOR no, y es el que trae la pila de verdad: con el codigo se llegaba al evento del navegador (sin
// causa) y no al del servidor (con la causa).
//
// Por eso este candado exige LOS DOS LADOS, en el mismo caso: una regla que vive en dos sitios y se aplica
// en uno es exactamente como nacio este defecto.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const PANEL = readFileSync("src/modules/diagnoses/components/panel-con-red.tsx", "utf8");
const INSTRUMENTACION = readFileSync("src/instrumentation.ts", "utf8");

describe("el codigo que el profesional lee encuentra el error en Sentry", () => {
  it("el aviso de la pantalla enseña el codigo y pide pasarlo", () => {
    // Si el aviso dejara de enseñarlo, etiquetar no serviria: nadie tendria el codigo que buscar.
    expect(PANEL).toContain("pásale este código a soporte");
    expect(PANEL, "el aviso dejo de leer el digest del error").toContain('"digest" in error');
  });

  it("el limite de CLIENTE lo manda como etiqueta", () => {
    expect(PANEL).toContain('scope.setTag("digest", digest)');
    // Y la etapa, para que los seis paneles no se agrupen en el mismo issue.
    expect(PANEL).toContain('scope.setTag("etapa", etapa)');
  });

  it("y el hook del SERVIDOR tambien, que es el que trae la causa", () => {
    expect(INSTRUMENTACION, "el hook del servidor dejo de etiquetar el digest").toContain(
      'scope.setTag("digest", digest)',
    );
    // ACOTADO A ESTE EVENTO: puesto en el scope global, se pegaria a los eventos siguientes y agruparia
    // fallos que no tienen nada que ver.
    expect(INSTRUMENTACION, "la etiqueta se puso en el scope global").toContain("Sentry.withScope");
    // Y SIN DIGEST SE REPORTA IGUAL: un error sin digest no puede quedarse sin llegar a Sentry por no
    // tener etiqueta. Esa rama es la que lo garantiza.
    expect(INSTRUMENTACION).toContain("if (!digest) {");
    expect(
      (INSTRUMENTACION.match(/Sentry\.captureRequestError\(error, request, context\)/g) ?? []).length,
      "el reporte tiene que seguir saliendo por las DOS ramas",
    ).toBe(2);
  });
});
