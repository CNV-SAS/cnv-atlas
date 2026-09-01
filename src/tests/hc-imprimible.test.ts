import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// CANDADO DE LA HISTORIA CLINICA IMPRIMIBLE (2026-09-01).
//
// POR QUE EXISTE ESTA PIEZA: el paciente tiene derecho a su historia clinica completa (Resolucion 1995,
// Ley 1581) y quien se la entrega es su profesional, no CNV (Anexo 3, clausula 13). Para poder entregarla
// hay que poder sacarla, y hasta hoy la historia existia solo como pantalla: no se podia imprimir ni
// archivar. El criterio clinico de Gildardo (§7.1: la historia es el documento del profesional y no va al
// paciente por defecto) se respeta entero: esto no la envia, la hace imprimible.
//
// Y AQUI SI VAN LOS INDICES, al reves que en el reporte del paciente. Es el documento tecnico: la tabla de
// Wang, los indices ANI BIS-E, el DFI con sus severidades. Los dos candados dicen cosas opuestas sobre los
// mismos datos, y esa oposicion es el punto: `report-render` prohibe lo que este exige.

const GLOBALS = readFileSync("src/app/globals.css", "utf8");
const PAGE = readFileSync("src/app/(app)/evaluaciones/[id]/page.tsx", "utf8");
const SELLO = readFileSync("src/modules/reports/components/hc-consentimiento.tsx", "utf8");
const BOTON = readFileSync("src/modules/reports/components/hc-imprimir.tsx", "utf8");

describe("se imprime lo que se ve, sin una segunda construcción del documento", () => {
  it("el botón imprime la pantalla, no genera un documento aparte", () => {
    // La decision de fondo. Generar la historia otra vez en el servidor exigiria una SEGUNDA construccion
    // del mismo documento (con @react-pdf, que no entiende este HTML), y dos construcciones del mismo
    // insumo es el defecto que llevamos una semana cerrando: la segunda hereda los huecos de la primera y
    // se desincronizan sin que nada avise. Con `print()` lo impreso ES lo que se ve, por construccion.
    expect(BOTON).toContain("window.print()");
  });

  it("la historia lleva la marca de impresión, y el botón no sale en el papel", () => {
    expect(PAGE).toContain('<div className="hc-print flex flex-col gap-4">');
    expect(BOTON).toContain("no-print");
  });

  it("al imprimir se oculta por `visibility`, nunca por `display`", () => {
    // `display:none` sobre un ancestro esconde tambien a sus descendientes y no hay forma de volver a
    // mostrar uno solo. `visibility` si se revierte hijo por hijo, que es lo que hace falta cuando el
    // bloque a imprimir vive dentro de la pagina entera. Con `display` la historia saldria en blanco.
    const i = GLOBALS.indexOf("@media print");
    expect(i, "se perdió el bloque @media print").toBeGreaterThan(-1);
    const impresion = GLOBALS.slice(i);
    expect(impresion).toContain("visibility: hidden");
    expect(impresion).toContain(".hc-print,");
    expect(impresion).toContain("visibility: visible");
    expect(impresion, "ocultar por display dejaría la historia en blanco").not.toContain("display: none");
  });

  it("el color se fuerza: en esta pantalla el color ES información clínica", () => {
    // Los veredictos usan color como significado (el naranja de Moderado sale de sus clasificadores). Un
    // navegador que los quite por ahorrar tinta estaria borrando informacion, no decoracion.
    expect(GLOBALS).toContain("print-color-adjust: exact");
  });
});

describe("el sello de consentimiento: bajo qué autorizaciones se recogió", () => {
  it("dice la versión de ESTA consulta, no la vigente hoy", () => {
    // `evaluations.consent_version` sella con que version se capturo la consulta, que puede no ser la de
    // hoy. "Hubo permiso" sin decir de que texto no es constancia de nada: las autorizaciones cambian de
    // redaccion y lo que se pacto fue el texto de SU version.
    const header = readFileSync("src/modules/reports/data/hc-header-reader.ts", "utf8");
    expect(header).toContain("consent_version");
    expect(header).toContain("consentVersion");
    expect(PAGE).toContain("versionDeLaConsulta={hcHeader.consentVersion}");
  });

  it("distingue REVOCADA de NUNCA OTORGADA", () => {
    // En un documento probatorio la diferencia es la que importa: una dice que el permiso existio y se
    // retiro, la otra que nunca lo hubo. Un solo "no" las confundiria.
    expect(SELLO).toContain('"Revocada"');
    expect(SELLO).toContain('"No otorgada"');
    expect(SELLO).toContain('"No vigente"');
  });

  it("lee las autorizaciones del MISMO reader que la ficha del paciente", () => {
    // Dos lecturas del mismo dato es como se crean las discrepancias, y este documento es probatorio.
    expect(PAGE).toContain("getPatientConsents(protocol.patientId)");
    expect(PAGE).toContain("CONSENT_TYPE_LABELS");
  });

  it("y no dice 'sin autorizaciones' a secas cuando no hay ninguna", () => {
    // Un bloque vacio sin explicar, en un documento probatorio, se lee como "no se pidio permiso".
    expect(SELLO).toContain("No hay autorizaciones registradas para este paciente.");
  });
});

describe("la historia clínica SÍ lleva lo técnico (al revés que el reporte del paciente)", () => {
  it("lleva los índices ANI BIS-E y la tabla de indicadores alterados", () => {
    // CONTROL de que este candado y el del reporte del paciente no se confundan: lo que alli esta
    // prohibido, aqui es obligatorio. Si algun dia alguien "limpiara" la historia con el criterio del
    // reporte, este test lo dice.
    expect(PAGE).toContain("<HcIndicesAniBise");
    expect(PAGE).toContain("<HcResumenDiagnostico");
    expect(PAGE).toContain("<HcPlanNutricional");
    expect(PAGE).toContain("<HcObservaciones");
  });

  it("y el sello va ANTES de la firma, que es donde cierra el documento", () => {
    const sello = PAGE.indexOf("<HcConsentimiento");
    const firma = PAGE.indexOf("<HcFirmaYFecha");
    expect(sello).toBeGreaterThan(-1);
    expect(firma).toBeGreaterThan(-1);
    expect(sello, "el sello quedó después de la firma").toBeLessThan(firma);
  });
});
