import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EL PANEL DEL NUTRICIONISTA SE IMPRIME COMO DOCUMENTO, NO COMO CAPTURA
//
// ── DE DONDE SALE ───────────────────────────────────────────────────────────────────────────────
//
// Santiago, 2026-10-24: *"el boton si, panel por panel, empezando por la subpestana de Nutricionista"*.
// Y el aviso que iba con la dimension (V11-3): *"la regla de impresion NO quita los controles: si una
// pestaña de trabajo se marca imprimible tal cual, en el papel salen los desplegables, los campos de
// texto y los botones, vacios y sin borde"*.
//
// ── LAS TRES COSAS QUE DEFIENDE ─────────────────────────────────────────────────────────────────
//
//   1. EL TALLER NO SE IMPRIME. Son 3.500 lineas de campos en vivo. El dia que alguien quite el
//      `no-print` "para que salga todo", el papel vuelve a ser una captura de pantalla.
//   2. NO SE IMPRIME CON CAMBIOS SIN GUARDAR. La hoja se arma en el servidor con lo GUARDADO; imprimir
//      con un borrador en pantalla pondria en un documento clinico una cifra que no consta en la base.
//      Es el hazard 4 (dos partes leyendo fuentes distintas) en papel y firmado.
//   3. SIN ENCABEZADO NO SE OFRECE EL BOTON, y por dos razones: una hoja que no dice de quien es ni
//      quien la firma no es un documento clinico, y sin `.imprimible` alrededor `imprimirHoja` caeria a
//      imprimir la pagina entera.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const HOJA = "src/modules/treatment/components/hoja-del-protocolo.tsx";
const SECCION = "src/modules/treatment/components/profession-treatment-section.tsx";
// EL ENVOLTORIO, que es donde vive la barra de impresion desde el 2026-10-25. El boton salio de la
// cabecera de la tarjeta del panel porque ahi no se encontraba (Gildardo: "debajo del menu de
// subpestañas, igual en todas"), y con el se movieron sus tres garantias. El candado sigue a la garantia.
const ENVOLTORIO = "src/modules/treatment/components/subpestana-del-profesional.tsx";
const BARRA = "src/components/shared/barra-de-impresion.tsx";

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

describe("lo que se imprime es un documento", () => {
  it("la hoja existe SOLO en papel, y el taller SOLO en pantalla", () => {
    expect(leer(HOJA)).toContain("solo-impresion");
    const envoltorio = leer(ENVOLTORIO);
    expect(envoltorio).toContain('"imprimible flex flex-col gap-6"');
    expect(
      /no-print flex flex-col gap-6/.test(envoltorio),
      "el taller entero va no-print: taparle los controles uno por uno sigue dando una captura",
    ).toBe(true);
  });

  it("la hoja lleva encabezado: quien firma, de quien es y de cuando", () => {
    const hoja = leer(HOJA);
    expect(hoja).toContain("EncabezadoImpreso");
    expect(hoja).toContain('titulo="Prescripción nutricional"');
  });

  it("la hoja dice las cifras que un documento clinico tiene que decir", () => {
    const hoja = readFileSync(HOJA, "utf8");
    for (const dato of [
      "Peso de cálculo",
      "Peso meta",
      "Energía objetivo",
      "Proteína",
      "Restricciones del profesional",
      "Entregas registradas",
    ]) {
      expect(hoja, `la hoja tiene que decir ${dato}`).toContain(dato);
    }
  });

  it("distingue lo que fijo el PROFESIONAL de lo que calculo el modelo", () => {
    // En un documento clinico importa quien decidio cada cifra. Sin esa separacion, un ajuste a mano se
    // lee como salida del motor.
    expect(readFileSync(HOJA, "utf8")).toContain("Fijado por el profesional");
  });

  it("y dice que refleja lo GUARDADO, no lo que hay en pantalla", () => {
    expect(readFileSync(HOJA, "utf8")).toMatch(/Refleja la prescripción guardada/);
  });
});

describe("el boton no deja imprimir un borrador, y esta donde se busca", () => {
  const envoltorio = leer(ENVOLTORIO);
  const barra = leer(BARRA);

  it("esta apagado mientras haya cambios sin guardar", () => {
    expect(envoltorio).toContain("const haySinGuardar = seccionesSucias(publicado).length > 0");
    expect(/motivoApagado=\{haySinGuardar \?/.test(envoltorio)).toBe(true);
    expect(barra, "la barra tiene que apagar el boton con ese motivo").toContain("disabled={apagado}");
  });

  it("y DICE por que esta apagado (hazard 8)", () => {
    expect(readFileSync(ENVOLTORIO, "utf8")).toContain("Guarda los cambios para imprimir");
    expect(barra, "el motivo va EN EL ROTULO del boton, no en un aviso aparte").toContain(
      "{apagado ? motivoApagado : etiqueta}",
    );
  });

  it("LA GUARDA LEE EL MISMO ALMACEN QUE EL PANEL, no un estado paralelo", () => {
    // Si la barra tuviera su propia copia del estado, seria la que se queda vieja: diria "guardado"
    // mientras el panel tiene cambios, y entonces el papel saldria con una cifra que no consta en la base.
    // El almacen lo crea el envoltorio y el panel lo HEREDA: dos suscriptores, una sola verdad.
    expect(envoltorio).toContain("crearAlmacenBorrador()");
    expect(envoltorio).toContain("BorradorContexto.Provider");
    const panel = leer("src/modules/treatment/components/treatment-panel.tsx");
    expect(panel, "el panel volvio a crear su propio almacen sin heredar").toContain(
      "const almacen = heredado?.almacen ?? propio",
    );
  });

  it("no se ofrece si no hay encabezado: sin el, la hoja no es un documento", () => {
    // Y ademas sin `.imprimible` alrededor, `imprimirHoja` caeria a imprimir la pagina entera.
    expect(envoltorio).toContain("hoja ? (");
    expect(leer(SECCION)).toContain("encabezado ? (");
  });

  it("el boton no sale en el papel", () => {
    expect(/no-print[\s\S]{0,500}imprimirHoja/.test(barra)).toBe(true);
  });

  it("imprime SU hoja, no todas las montadas", () => {
    // El plan del paciente es otra `.imprimible` en la misma pagina: sin la marca de hoja activa salen
    // las dos, el plan pegado detras de la prescripcion (el defecto que arreglo `imprimir-hoja`).
    expect(barra).toContain("imprimirHoja(e.currentTarget)");
  });

  it("y la barra va ARRIBA, que es toda la peticion: primer hijo de la hoja", () => {
    // SE FIJA EL ORDEN: barra, documento, taller. El defecto que esto cierra no era que faltara el boton,
    // era que estaba en la cabecera de una tarjeta, detras del estado del paciente, de la barra de
    // subpestañas y del titulo. Si el documento o el taller se colaran antes, volveria a quedar donde
    // nadie lo encuentra, y un control que no se encuentra se reporta como que no existe.
    const i = envoltorio.indexOf("<BarraDeImpresion");
    const j = envoltorio.indexOf("{hoja}");
    const k = envoltorio.indexOf("{taller}");
    expect(i).toBeGreaterThan(0);
    expect(j, "el documento va despues de la barra").toBeGreaterThan(i);
    expect(k, "el taller va al final").toBeGreaterThan(j);
  });

  it("y el panel ya no tiene su propio boton: uno solo, en un sitio", () => {
    const panel = leer("src/modules/treatment/components/treatment-panel.tsx");
    expect(panel, "volvio a aparecer un boton de imprimir dentro del panel").not.toMatch(
      /imprimirHoja|window\.print/,
    );
  });
});
