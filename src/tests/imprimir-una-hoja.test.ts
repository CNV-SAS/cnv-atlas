import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ SE IMPRIME UNA HOJA, NO TODAS LAS QUE ESTEN MONTADAS (2026-09-18) ═══
//
// EL DEFECTO, encontrado al ir a añadir la tercera hoja: la regla de impresion deja salir todo lo que sea
// `.imprimible`. Con una hoja es exacto; pero las etapas visitadas NO se desmontan (se hizo asi para no perder
// el borrador del tratamiento), asi que quien pasa por Tratamiento y luego imprime desde Reporte/HC tiene DOS
// hojas montadas y salen las dos: el plan del paciente pegado a su historia clinica.
//
// Esto se prueba leyendo el fuente a proposito: el defecto vive en la relacion entre el CSS y los botones, y
// jsdom no pagina ni imprime. Lo que hay que sostener es el contrato entre las dos piezas.

const CSS = sinComentarios(readFileSync("src/app/globals.css", "utf8"));
const HELPER = sinComentarios(readFileSync("src/components/shared/imprimir-hoja.ts", "utf8"));
const BOTONES = [
  "src/modules/reports/components/hc-imprimir.tsx",
  "src/modules/reports/components/plan-imprimir-boton.tsx",
  "src/components/shared/hoja-imprimible.tsx",
];

describe("imprimir una sola hoja", () => {
  it("el CSS esconde las OTRAS hojas mientras una esta marcada", () => {
    expect(CSS).toContain("body:has([data-hoja-activa]) .imprimible:not([data-hoja-activa])");
  });

  it("la marca se QUITA al terminar o al cancelar: si se queda puesta, la siguiente hoja sale vacia", () => {
    expect(HELPER).toContain("afterprint");
    expect(HELPER, "sin respaldo, un navegador que no dispare afterprint deja la marca puesta").toContain(
      "setTimeout",
    );
  });

  it("NINGUN boton de imprimir llama a window.print() por su cuenta: todos pasan por el helper", () => {
    for (const ruta of BOTONES) {
      const codigo = sinComentarios(readFileSync(ruta, "utf8"));
      expect(codigo, `${ruta} imprime sin pasar por el helper`).not.toMatch(/window\.print\(\)/);
      expect(codigo, `${ruta} no usa imprimirHoja`).toContain("imprimirHoja");
    }
  });

  it("CONTROL: el helper SI llama a window.print(), que es donde tiene que estar", () => {
    expect(HELPER.match(/window\.print\(\)/g)?.length, "una vez sin hoja y otra con la hoja marcada").toBe(2);
  });
});

describe("las pantallas que se imprimen", () => {
  const PAGE = sinComentarios(readFileSync("src/app/(app)/ani-bis-e/[id]/page.tsx", "utf8"));
  const DIAGNOSTICO = sinComentarios(
    readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8"),
  );

  it("RUTAS DE ATENCIÓN y DIAGNÓSTICO FUNCIONAL son hojas, como en el archivo de Gildardo", () => {
    expect(PAGE).toContain('<HojaImprimible titulo="Rutas de atención"');
    expect(DIAGNOSTICO).toContain('<HojaImprimible titulo="Diagnóstico funcional"');
  });

  it("toda hoja dice QUIEN la firma y DE QUIEN es: si no, es un volante", () => {
    const hoja = sinComentarios(readFileSync("src/components/shared/hoja-imprimible.tsx", "utf8"));
    for (const dato of ["encabezado.profesional", "encabezado.profesion", "encabezado.paciente", "encabezado.documento"]) {
      expect(hoja, `falta ${dato} en el encabezado impreso`).toContain(dato);
    }
    // El encabezado NO se ve en pantalla: ahi ya esta arriba, en la cabecera de la pagina.
    expect(hoja).toContain("solo-impresion");
  });
});
