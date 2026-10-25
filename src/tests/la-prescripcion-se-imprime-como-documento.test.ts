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
const PANEL = "src/modules/treatment/components/treatment-panel.tsx";

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

describe("lo que se imprime es un documento", () => {
  it("la hoja existe SOLO en papel, y el taller SOLO en pantalla", () => {
    expect(leer(HOJA)).toContain("solo-impresion");
    const seccion = leer(SECCION);
    expect(seccion).toContain("imprimible flex flex-col gap-6");
    expect(
      /no-print flex flex-col gap-6/.test(seccion),
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

describe("el boton no deja imprimir un borrador", () => {
  const panel = leer(PANEL);

  it("esta apagado mientras haya cambios sin guardar", () => {
    expect(/disabled=\{haySinGuardar\}/.test(panel)).toBe(true);
  });

  it("y DICE por que esta apagado (hazard 8)", () => {
    expect(readFileSync(PANEL, "utf8")).toContain("Guarda los cambios para imprimir");
  });

  it("no se ofrece si la pagina no monto la hoja alrededor", () => {
    // Sin `.imprimible`, `imprimirHoja` cae a `window.print()` y sale la pagina entera.
    expect(panel).toContain("sePuedeImprimir ? (");
    expect(leer(SECCION)).toContain("sePuedeImprimir={encabezado != null}");
  });

  it("el boton no sale en el papel", () => {
    expect(/className="no-print"[\s\S]{0,200}imprimirHoja/.test(panel)).toBe(true);
  });

  it("imprime SU hoja, no todas las montadas", () => {
    // El plan del paciente es otra `.imprimible` en la misma pagina: sin la marca de hoja activa salen
    // las dos, el plan pegado detras de la prescripcion (el defecto que arreglo `imprimir-hoja`).
    expect(panel).toContain("imprimirHoja(e.currentTarget)");
  });
});
