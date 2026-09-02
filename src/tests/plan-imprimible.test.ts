import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LA HOJA DEL PLAN (2026-09-02). Cierra la mitad del pedido legal que está del lado del
// profesional: poder ENTREGARLE al paciente su plan en la consulta, sin esperar al correo.
//
// LO QUE MÁS CUIDA, y es la razón de su forma: que no sea una SEGUNDA CONSTRUCCIÓN del plan. Lee
// `PlanPaciente`, el mismo objeto que arma `getPlanPaciente` y que viaja al PDF. Es otra PRESENTACIÓN del
// mismo dato, no otra fuente: si el papel y el correo dijeran cosas distintas, el defecto estaría en el
// lector y lo verían los dos. Recomponer el plan aquí desde el protocolo sería el defecto que llevamos una
// semana cerrando.

const HOJA = readFileSync("src/modules/reports/components/plan-imprimible.tsx", "utf8");
const CODIGO = sinComentarios(HOJA);
const PAGE = sinComentarios(readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8"));
const CSS = readFileSync("src/app/globals.css", "utf8");

describe("la hoja sale del MISMO lector que el PDF", () => {
  it("recibe un `PlanPaciente`, no el protocolo", () => {
    expect(CODIGO).toContain("plan: PlanPaciente");
    // Si algún día compusiera el plan aquí, estas serían las señales.
    expect(CODIGO).not.toContain("computeProtocoloEfectivo");
    expect(CODIGO).not.toContain("getTreatmentProtocol");
  });

  it("y la página lo llena con `getPlanPaciente`, el mismo que alimenta el correo", () => {
    expect(PAGE).toContain("getPlanPaciente(id, results.snapshot)");
    expect(PAGE).toContain("<PlanImprimible");
  });
});

describe("el mecanismo de impresión es UNO para los dos documentos", () => {
  it("la hoja usa la misma clase que la historia clínica", () => {
    // Dos nombres para una sola cosa es como empiezan las dos fuentes. La clase se generalizó de
    // `hc-print` a `imprimible` justo por esto.
    expect(CODIGO).toContain("imprimible");
    expect(CSS).toContain(".imprimible");
    expect(CSS).not.toContain("hc-print");
  });

  it("y lo que es para el PROFESIONAL queda FUERA del documento", () => {
    // ANTES esto comprobaba un `no-print` sobre un aviso dentro de la hoja. Ese aviso ya no existe: al
    // dejar en pantalla solo el botón (2026-09-02), la explicación vive FUERA del bloque imprimible, que
    // es más seguro que confiar en una clase. La garantía es la misma: un documento clínico con una nota
    // interna impresa encima se ve como una captura de pantalla.
    const doc = CODIGO.slice(CODIGO.indexOf("solo-impresion"));
    expect(doc).not.toContain("Imprimir el plan para entregarlo");
    expect(doc).not.toContain("se le envía");
    // Y el botón, que sí está en pantalla, no se imprime.
    const BOTON = readFileSync("src/modules/reports/components/plan-imprimir-boton.tsx", "utf8");
    expect(BOTON).toContain('className="no-print');
  });
});

describe("el contenido es el del paciente, en el orden del PDF", () => {
  it("lleva los bloques de su §7.1", () => {
    for (const t of [
      "Tu meta",
      "Tu plan de alimentación",
      "Cómo repartir tus porciones en el día",
      "Un ejemplo de menú para tu semana",
      "Recomendaciones para tu caso",
    ]) {
      expect(CODIGO, `falta el bloque "${t}"`).toContain(t);
    }
  });

  it("y las restricciones van ANTES del menú, como en el PDF", () => {
    // Mismo orden y misma razón: un menú leído antes que sus restricciones es un menú que el paciente ya
    // empezó a seguir mal. Y dos órdenes distintos del mismo plan se leen como dos planes.
    const restr = CODIGO.indexOf("Lo que debes evitar");
    const menu = CODIGO.indexOf("Un ejemplo de menú");
    expect(restr).toBeGreaterThan(-1);
    expect(menu).toBeGreaterThan(restr);
  });
});

// ── LOS TRES DEFECTOS DEL PDF (smoke de Santiago, 2026-09-02) ───────────────────────────────────────
describe("la hoja sale bien en papel", () => {
  it("se oculta con `display`, no con `visibility`: eran TRECE hojas en blanco", () => {
    // El plan ocupa dos hojas y salían quince. `visibility:hidden` esconde pero DEJA EL ALTO, así que todo
    // el resto de la página seguía paginando vacío. Con la historia clínica no se notó porque es larga y
    // su propio contenido llenaba las hojas: el defecto estaba ahí desde el principio.
    const bloque = CSS.slice(CSS.indexOf("@media print"));
    expect(bloque).not.toContain("visibility: hidden");
    expect(bloque).toContain("display: none !important");
    // `:has()` es lo que permite ocultar con `display` sin romper la cadena de ancestros, que es la razón
    // por la que en su día se eligió `visibility`.
    expect(bloque).toContain(":has(.imprimible)");
  });

  it("y la hoja fluye en la página, que es lo que le devuelve los márgenes", () => {
    // Sacarla del flujo (`position:absolute; top:0; left:0`) la anclaba al área de página y se comía el
    // margen de `@page`: el contenido salía pegado al borde.
    const bloque = CSS.slice(CSS.indexOf("@media print"));
    const hoja = bloque.slice(bloque.indexOf("  .imprimible {"));
    expect(hoja.slice(0, 200)).not.toContain("position: absolute");
    expect(bloque).toContain("margin: 1.6cm 1.8cm");
  });

  it("en PANTALLA solo se ve el botón, no el plan entero", () => {
    // El profesional ya tiene toda esa información arriba en su forma de trabajo; repetirla alarga la
    // pantalla sin aportar nada. Es lo que hace su archivo (`plan-print-only`).
    expect(CODIGO).toContain('className="solo-impresion imprimible');
    expect(CSS).toContain(".solo-impresion {");
  });

  it("y el rótulo dice PARA QUÉ es, que es lo que responde por qué hay dos sitios", () => {
    // Son dos canales del mismo documento, no dos documentos: el reporte se ENVÍA desde Reporte/HC, y esta
    // hoja se IMPRIME para entregarla en la consulta.
    expect(CODIGO).toContain("Imprimir el plan para entregarlo");
    expect(CODIGO).toContain("se le envía");
  });
});
