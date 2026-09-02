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
    expect(CODIGO).toContain('className="imprimible');
    expect(CSS).toContain(".imprimible,");
    expect(CSS).not.toContain("hc-print");
  });

  it("y el aviso para el profesional NO sale en papel", () => {
    // Un documento clínico con una nota interna impresa encima se ve como una captura de pantalla.
    expect(CODIGO).toContain('className="no-print');
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
