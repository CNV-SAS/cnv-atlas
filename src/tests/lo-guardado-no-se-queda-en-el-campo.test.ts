import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LO GUARDADO NO SE QUEDA EN EL CAMPO  ·  el barrido del patron (Santiago, 2026-11-09)
//
// ═══ DE DONDE VIENE ═══
//
// El 8 de noviembre: *"al pulsar «Agregar observacion» hay que esperar unos cinco segundos, o recargar,
// para que el campo se limpie y aparezca la vigente"*. La causa no era el guardado, que es inmediato: la
// pantalla esperaba al `router.refresh()`, que recompone la pagina entera.
//
// LO QUE PASA EN ESA VENTANA es el defecto: la accion ya termino, el boton vuelve a estar habilitado y el
// campo sigue lleno con lo que se acaba de guardar. Si la accion CREA una fila, la segunda pulsacion no
// corrige: DUPLICA. Santiago pidio barrer donde mas pasa esto en Atlas.
//
// ═══ EL RESULTADO DEL BARRIDO ═══
//
// 47 componentes cliente mandan un formulario con un campo de texto; 22 no limpiaban nada; de esos, TRES
// pueden duplicar, y los tres mueven inventario o dinero (declarar una remesa, declarar una devolucion y
// registrar el conteo). El resto no puede, y por razones que viven escritas en `limpiar-al-guardar` para
// que nadie "arregle" lo que ya esta bien: resuelven un pendiente (el writer rechaza la segunda), son
// creadores con guarda, o reescriben el mismo dato de una consulta.
//
// ESTE CANDADO VIGILA LAS DOS MITADES: que los tres sigan limpiando, y que el mecanismo compartido no
// empiece a limpiar cuando NO debe (con un error, perdiendo lo escrito justo cuando hay que corregirlo).
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const HELPER = readFileSync("src/components/shared/limpiar-al-guardar.ts", "utf8");

const LOS_TRES = [
  "src/modules/nutraceuticals/components/declarar-remesa-form.tsx",
  "src/modules/nutraceuticals/components/declarar-devolucion-form.tsx",
  "src/modules/nutraceuticals/components/mi-conteo-form.tsx",
];

describe("el mecanismo compartido", () => {
  it("cuenta los EXITOS, no las vueltas de la accion", () => {
    const limpia = sinComentarios(HELPER);
    expect(limpia).toContain("if (state.success)");
    // Lo que NO puede hacer: limpiar porque la accion volvio, sin mirar como volvio. Es la leccion del
    // hazard 2 (el auto-reset de React 19 borrando lo que el paciente lleno).
    expect(limpia, "limpia tambien cuando hay error").not.toMatch(/if \(state\.error\)[\s\S]{0,80}setExitos/);
  });

  it("y no lo hace con un efecto, que deja un instante con el campo lleno y el boton vivo", () => {
    expect(sinComentarios(HELPER)).not.toContain("useEffect");
  });
});

describe("los tres formularios que podian duplicar", () => {
  it.each(LOS_TRES)("%s limpia al guardar", (archivo) => {
    const fuente = readFileSync(archivo, "utf8");
    expect(fuente, `${archivo} dejo de limpiar: una segunda pulsacion vuelve a crear la fila`).toContain(
      "useLimpiarAlGuardar(",
    );
  });

  it("el conteo repone sus cifras, que son estado controlado", () => {
    // Un `key` no basta aqui: las cantidades viven en el estado del padre y sobrevivirian al remonte.
    const CONTEO = readFileSync("src/modules/nutraceuticals/components/mi-conteo-form.tsx", "utf8");
    expect(CONTEO).toContain("useLimpiarAlGuardar(state, () => setRows({}))");
  });

  it("y la devolucion suelta el lote, con lo que la cantidad y el motivo se desmontan", () => {
    const DEV = readFileSync(
      "src/modules/nutraceuticals/components/declarar-devolucion-form.tsx",
      "utf8",
    );
    expect(DEV).toContain('useLimpiarAlGuardar(state, () => setLotId(""))');
  });
});

describe("y la pantalla de observaciones conserva SU mecanismo, que es mejor donde la fila se lista", () => {
  it("pinta la fila que la accion devuelve, y la deduplica por id", () => {
    // Donde la fila recien guardada se LISTA en la misma pantalla, limpiar el campo no basta: hay que
    // ensenar lo guardado sin esperar al refresco. Se deduplica por `id`, que es lo unico que no depende
    // de que las dos copias se vean iguales.
    const OBS = readFileSync("src/modules/followups/components/observaciones-consulta.tsx", "utf8");
    expect(OBS).toContain("state.nota");
    expect(OBS).toContain("notasDelServidor.some((n) => n.id === state.nota?.id)");
  });
});
