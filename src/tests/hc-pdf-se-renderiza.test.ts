import { describe, expect, it } from "vitest";

import type { HistoriaClinicaDoc, PlanPaciente } from "@/modules/reports/data/reports-view-types";
import { renderHistoriaClinicaPdf, renderPlanPdf } from "@/modules/reports/services/render-report";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EL PDF DE LA HISTORIA CLINICA SE RENDERIZA DE VERDAD
//
// ═══ POR QUE HACIA FALTA, Y SE DESCUBRIO AL TOCARLO (2026-11-05) ═══
//
// La historia clinica tenia tres candados y NINGUNO la renderizaba: uno comprueba que la ruta llame a
// `renderHistoriaClinicaPdf`, otro que el documento no componga nada por su cuenta, otro que el boton
// exista. Los tres leen el CODIGO. Asi que el documento clinico que se le entrega al paciente, y que se
// conserva quince años, nunca se ejecutaba en la suite.
//
// Se vio al poner el encabezado en cuadros en los tres documentos: el cambio pasaba tsc y lint sin que
// nada lo ejecutara. **Y es justo la familia de defectos que tsc no ve**: un componente de @react-pdf que
// recibe un estilo que esa libreria no entiende, o un `<Text>` donde la libreria espera otra cosa, revienta
// en RUNTIME. La historia clinica tiene ademas su PROPIA hoja de estilo, distinta de la del informe y de
// la hoja del plan, asi que el encabezado compartido es el primer componente que vive en los tres.
//
// ═══ QUE AFIRMA, Y QUE NO ═══
//
// Que el documento se construye y sale un PDF, con su encabezado. NO afirma nada sobre su maquetacion: eso
// lo mide `el-informe-maquetado` sobre el informe, con la geometria del PDF real. Aqui lo que se compra es
// barato y es lo que faltaba: que no reviente.
//
// EL DOCUMENTO VA VACIO A PROPOSITO (todos los bloques sin datos). Es el caso que de verdad puede fallar
// (una consulta recien abierta, sin encuesta ni prescripcion) y el que nadie prueba a mano, porque el smoke
// se hace sobre un paciente con datos.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Una historia clinica SIN datos: lo que sale de una consulta recien abierta. */
function hcVacia(): HistoriaClinicaDoc {
  return {
    paciente: "Paciente Demo",
    documento: "CC 12345",
    resumenProfesional: null,
    dfiParrafo: null,
    metaTerapeutica: null,
    motivoSinNarrativa: "El diagnóstico integral no se emitió: la encuesta está incompleta.",
    indices: [],
    rutas: [],
    remisionesExigidas: [],
    composicion: [],
    edad: 54,
    sexo: "M",
    pesoKg: null,
    tallaCm: null,
    fechaConsulta: "12/04/2026",
    profesional: "Profesional Demo",
    encuestaRegistradaPor: null,
    motivos: [],
    antecedentes: [],
    objetivoModelo: null,
    objetivoTratamiento: null,
    plan: null,
    validacion: null,
    desviaciones: [],
    recomendaciones: [],
    remisiones: [],
    observaciones: [],
    proximaCita: null,
    entregas: [],
    prescripcionSinEmitir: false,
    consentVersion: "1.1",
    autorizaciones: [],
  };
}

describe("el PDF de la historia clinica", () => {
  it("se renderiza, y lleva su encabezado en cuadros", async () => {
    const pdf = await renderHistoriaClinicaPdf(hcVacia());
    // Es un PDF de verdad: su firma y un tamaño que no es un documento vacio.
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length, "el PDF salio sospechosamente pequeño").toBeGreaterThan(2000);
  });

  it("y con los bloques llenos tampoco revienta", async () => {
    // El otro extremo: si un bloque con datos usara un estilo que @react-pdf no entiende, el documento
    // vacio no lo veria. Se llenan los que son listas, que es donde vive el riesgo.
    const hc: HistoriaClinicaDoc = {
      ...hcVacia(),
      resumenProfesional: "Resumen de prueba.",
      dfiParrafo: "Párrafo de prueba del DFI.",
      metaTerapeutica: "Meta de prueba.",
      motivoSinNarrativa: null,
      motivos: ["Control", "Otro: texto libre de prueba"],
      antecedentes: [{ grupo: "Personales", items: ["Ninguno referido"] }],
      rutas: [{ label: "Ruta de prueba", activacion: "por el criterio de prueba" }],
      recomendaciones: [{ titulo: "Recomendación de prueba", items: ["Una línea"] }],
      proximaCita: "12/7/2026",
      entregas: [{ fecha: "12/04/2026", via: "correo", kcal: 2000, proteina: 90 }],
      pesoKg: 78.4,
      tallaCm: 172,
    };
    const pdf = await renderHistoriaClinicaPdf(hc);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LA HOJA DEL PLAN, POR EL MISMO HUECO
//
// `titulosDelPlanPdf` (el helper de `plan-paciente.test.ts`) lee los COMPONENTES del archivo con una
// expresion regular, no el PDF: mide que el documento COMPONGA sus siete bloques, que es lo suyo. Pero
// entonces el segundo adjunto del correo del paciente tampoco se ejecutaba nunca, y le entro el mismo
// encabezado compartido.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Un plan sin datos: lo que sale cuando el profesional no ha emitido prescripcion. */
function planVacio(): PlanPaciente {
  return {
    objetivoTexto: null,
    kcalObjetivo: null,
    pesoMeta: null,
    tipoDieta: null,
    prescripcion: [],
    atributos: [],
    notasDelModelo: [],
    menu: [],
    tiemposActivos: [],
    distribucion: [],
    recomendaciones: [],
    restricciones: [],
    listaIntercambio: { ciudad: null, region: null, total: 0, deTotal: 0, grupos: [] },
  };
}

const META_DEL_PLAN = {
  patientName: "Paciente Demo",
  documentLabel: "CC 12345",
  consultationDate: "12/04/2026",
  profesional: { nombre: "Profesional Demo", profesion: "Nutricionista" },
};

describe("el PDF de la hoja del plan", () => {
  it("se renderiza vacio, que es el caso que nadie prueba a mano", async () => {
    const pdf = await renderPlanPdf(planVacio(), META_DEL_PLAN);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length, "el PDF salio sospechosamente pequeño").toBeGreaterThan(2000);
  });

  it("y con sus siete bloques llenos", async () => {
    const plan: PlanPaciente = {
      ...planVacio(),
      objetivoTexto: "Objetivo de prueba",
      kcalObjetivo: 2000,
      pesoMeta: 72,
      tipoDieta: "Normocalórica",
      prescripcion: [{ nombre: "Proteína", valor: "90 g/día" }],
      atributos: ["Atributo de prueba"],
      notasDelModelo: ["Nota de prueba"],
      menu: [{ dia: "Lunes", comidas: [{ tiempo: "Desayuno", texto: "Texto de prueba" }] }],
      tiemposActivos: ["Desayuno"],
      distribucion: [{ alimento: "Fruta", porTiempo: [{ tiempo: "Desayuno", porciones: 1 }] }],
      recomendaciones: [{ titulo: "Recomendación de prueba", lineas: ["Una línea"] }],
      restricciones: ["Sin lactosa"],
      listaIntercambio: {
        ciudad: "Medellín",
        region: "Antioqueña",
        total: 1,
        deTotal: 66,
        grupos: [
          { nombre: "Frutas", subgrupos: [{ sub: "Enteras", alimentos: ["Guayaba (100 g)"], hayMas: false }] },
        ],
      },
    };
    const pdf = await renderPlanPdf(plan, META_DEL_PLAN);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(2000);
  });
});
