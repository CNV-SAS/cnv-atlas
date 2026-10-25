import { readdirSync, readFileSync } from "node:fs";

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
// ═══ LA LISTA SE BARRE, NO SE ESCRIBE (2026-10-25) ═══
//
// ERAN TRES RUTAS A MANO, y el dia que el boton paso a estar en todas las subpestañas (Gildardo) la lista
// quedo corta sola: una ruta nueva con su propio `window.print()` habria pasado verde. Un candado que
// enumera los sitios donde la regla aplica deja de cubrir el cuarto, y nadie se acuerda de sumarlo.
//
// Ahora se buscan TODOS los archivos que mencionan imprimir y se exige que ninguno llame a
// `window.print()` por su cuenta. El helper queda excluido a proposito: es el unico que debe llamarlo.
const HELPER_RUTA = "src/components/shared/imprimir-hoja.ts";

function archivosQueImprimen(dir = "src", out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const ruta = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === "tests") continue;
      archivosQueImprimen(ruta, out);
    } else if (/.tsx?$/.test(e.name) && ruta !== HELPER_RUTA) {
      // SIN COMENTARIOS: hay archivos que MENCIONAN window.print() para explicar lo que no se puede
      // saber de una impresion. Un candado que caza una explicacion es ruido, y el ruido mata candados.
      const codigo = sinComentarios(readFileSync(ruta, "utf8"));
      if (/window.print|imprimirHoja/.test(codigo)) out.push(ruta);
    }
  }
  return out;
}

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
    const rutas = archivosQueImprimen();
    // CONTROL: si el barrido encuentra cero archivos, el detector esta roto y "cero infractores" seria un
    // verde falso. Es la misma red que lleva `check-cables`.
    expect(
      rutas.length,
      "el barrido no encontro sitios que impriman; revisa el detector antes de confiar en el verde",
    ).toBeGreaterThan(2);
    for (const ruta of rutas) {
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

  it("RUTAS DE ATENCIÓN es una hoja, como en el archivo de Gildardo", () => {
    // SE FIJA EL HECHO, no la linea: el 2026-10-25 la etiqueta paso a varias lineas al sumarle `queSale`
    // (con ocho botones iguales, lo unico que distingue uno de otro es decir que imprime), y el candado
    // anclado a la linea exacta se cayo sin que nada estuviera mal.
    const i = PAGE.indexOf("<HojaImprimible");
    expect(i, "la hoja de rutas desaparecio").toBeGreaterThan(0);
    expect(PAGE.slice(i, i + 400)).toContain('titulo="Rutas de atención"');
  });

  it("y el DIAGNÓSTICO FUNCIONAL dejo de imprimir la pantalla: ahora compone su documento", () => {
    // ═══ EL CAMBIO (Santiago, 2026-09-19) ═══
    //
    // La pestaña se envolvia entera en `HojaImprimible`, asi que el papel salia con la pantalla de
    // trabajo dentro (y con sus botones, hasta que se taparon). Su lectura: "una cosa es imprimir la
    // pagina tal cual y otra imprimir algo que le sirva al paciente".
    //
    // Ahora la pestaña es para TRABAJAR y el documento del paciente es `HojaDiagnosticoFuncional`, que
    // compone el diagnostico en SU lenguaje desde la misma fuente que el informe del correo.
    expect(DIAGNOSTICO, "la pestaña volvio a envolverse entera").not.toContain(
      '<HojaImprimible titulo="Diagnóstico funcional"',
    );
    expect(DIAGNOSTICO).toContain("<HojaDiagnosticoFuncional");

    const HOJA = readFileSync("src/modules/diagnoses/components/hoja-diagnostico-funcional.tsx", "utf8");
    // El documento vive en el DOM y solo aparece al imprimir, como el del plan.
    expect(HOJA).toContain("solo-impresion");
    // Y EL `.imprimible` ESTA EN EL CONTENEDOR, no en el documento (corregido el 2026-10-25). Con la hoja
    // marcada solo en el documento, el boton quedaba FUERA de ella: `imprimirHoja` no encontraba hoja, no
    // marcaba nada, y salian todas las montadas (este diagnostico con la prescripcion pegada detras). El
    // candado fija la relacion que importa: el boton tiene que estar DENTRO de la hoja que marca.
    const iHoja = HOJA.indexOf('className="imprimible');
    const iBarra = HOJA.indexOf("<BarraDeImpresion");
    expect(iHoja, "la hoja dejo de estar en el contenedor").toBeGreaterThan(0);
    expect(iBarra, "el boton volvio a quedar fuera de su hoja").toBeGreaterThan(iHoja);
    // Y no lleva NADA del modelo: es el DFI ya traducido, el mismo que el informe.
    for (const idx of ["IFC", "IRC", "PABU", "stateNumber", "efrPhenotype"]) {
      expect(HOJA, idx + " no puede salir en la hoja del paciente").not.toContain(idx);
    }
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
