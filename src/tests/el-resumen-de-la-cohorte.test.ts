import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

import type { CohorteDeInvestigacion } from "@/modules/obbia/data/cohorte-reader";
import {
  alcanceDelResumen,
  nombreDelResumen,
  resumenDeLaCohorteACsv,
} from "@/modules/obbia/services/exportar-la-cohorte";
import {
  CIFRAS_DEL_PANEL,
  EXPORT_FILA_A_FILA_DE_LA_VISTA,
  nivelDeAnonimizacion,
} from "@/modules/obbia/services/nivel-de-anonimizacion";

// ═══ CANDADO DE LA EXPORTACION REGISTRADA DE /obbia (Santiago, 2026-10-30) ═══
//
// LO QUE PROTEGE, y son dos cosas distintas:
//
//   1 · QUE LO QUE SALE SEAN CIFRAS Y NO FILAS. El panel ya dice (y CALCULA) que un dataset fila a fila
//       de esta cohorte seria SEUDONIMIZADO, o sea dato personal, y que la verificacion de k-anonimato
//       que `DATA_GOVERNANCE.md` exige no esta construida. Si esta exportacion empezara a llevar filas,
//       seria una puerta de datos personales alrededor de ese control.
//   2 · QUE CADA ARCHIVO DEJE RASTRO. `research_datasets` existia con cero filas porque nadie las
//       escribia, y la pantalla decia "no se ha entregado ningun dataset" por falta de camino, no de
//       entregas. Un archivo de investigacion sin registro es justo lo que esa tabla existe para impedir.

const COHORTE: CohorteDeInvestigacion = {
  vigentes: 513,
  conAutorizacion: 316,
  sinAutorizacion: 197,
  fueraPorHuellaRepetida: { consultas: 13, grupos: 10, pacientes: 14 },
  pacientesAutorizados: 349,
  conDiagnostico: 212,
  importadas: 8,
  importadasVigentes: 150,
  sinAutorizacionPorRazon: [
    { razon: "Nunca firmó en Atlas", consultas: 150, pacientes: 120 },
    { razon: 'Dijo "no" a investigación', consultas: 47, pacientes: 53 },
  ],
  porVersionDelMotor: [
    { version: "1.0.0", evaluaciones: 190 },
    { version: "anibise-1.4.0", evaluaciones: 22 },
  ],
  porFamiliaDelMotor: [{ mayor: "1", evaluaciones: 212, grafias: ["1.0.0", "anibise-1.4.0"] }],
  mezclaFamilias: false,
  porMes: [
    { mes: "2026-08", evaluaciones: 40 },
    { mes: "2026-09", evaluaciones: 120 },
  ],
};

const CSV = resumenDeLaCohorteACsv(COHORTE, {
  generadoEl: "30/10/2026",
  generadoPor: "Quien Sea",
});

describe("el CSV del resumen lleva cifras, no filas de paciente", () => {
  it("trae las cifras del panel, con su nota", () => {
    expect(CSV).toContain("Consultas vigentes,513");
    expect(CSV).toContain("Consultas autorizadas para investigación,316");
    expect(CSV).toContain('"De ellas, con diagnóstico sellado",212');
    // Y LOS DESGLOSES, cada uno con su encabezado: es lo que hace citable el archivo.
    expect(CSV).toContain("Por qué queda fuera,Consultas,Pacientes");
    expect(CSV).toContain("Mes de la medición,Consultas autorizadas");
    expect(CSV).toContain("2026-09,120");
  });

  it("y DICE su nivel dentro del archivo", () => {
    // El nivel viaja en el archivo y no solo en el registro: un CSV reenviado por correo pierde el
    // contexto de la pantalla, y quien lo reciba tiene que poder leer que es agregado.
    expect(CSV).toContain("Nivel de anonimización,aggregate");
    // Y ES EL QUE LA FUNCION DERIVA, no un texto escrito: si el export cambiara de forma, el candado cae.
    expect(nivelDeAnonimizacion(CIFRAS_DEL_PANEL).nivel).toBe("aggregate");
  });

  it("la procedencia va DENTRO del archivo", () => {
    expect(CSV).toContain("Generado el,30/10/2026");
    expect(CSV).toContain("Generado por,Quien Sea");
  });

  it("y los campos con coma van entre comillas", () => {
    // EL DEFECTO CLASICO DEL CSV A MANO: una sola coma en una nota parte la fila y corre las columnas del
    // resto del archivo. Las notas de este resumen llevan comas en casi todas las filas.
    expect(CSV).toContain('"de pacientes reales, no reemplazadas por una corrección y no retiradas (migración 0224)"');
  });

  it("y abre con BOM, para que Excel en español no parta los acentos", () => {
    expect(CSV.startsWith("﻿")).toBe(true);
  });

  it("el alcance registrado se DERIVA de las cifras, no es un texto fijo", () => {
    // El registro tiene que contestar QUE se entrego sin tener el archivo delante.
    const alcance = alcanceDelResumen(COHORTE, "2026-10-30");
    expect(alcance).toContain("316 consultas autorizadas");
    expect(alcance).toContain("349 pacientes");
    expect(alcance).toContain("212 con diagnóstico sellado");
    expect(alcance).toContain("Sin filas de paciente");
  });

  it("y el nombre del archivo lleva la fecha", () => {
    expect(nombreDelResumen("2026-10-30")).toBe("atlas-cohorte-investigacion-2026-10-30.csv");
  });

  it("el modulo del CSV no puede ver una fila de paciente ni queriendo", () => {
    // ES LA GARANTIA ESTRUCTURAL, no una promesa del comentario: recibe el RESUMEN agregado y nada mas,
    // asi que no tiene de donde sacar un `patient_id`. Es el mismo argumento por el que el nivel se
    // deriva de la forma del export y no se teclea.
    const SRC = sinComentarios(
      readFileSync("src/modules/obbia/services/exportar-la-cohorte.ts", "utf8"),
    );
    expect(SRC).not.toContain("patient_id");
    expect(SRC).not.toContain("patientId");
    expect(SRC, "el exportador empezó a leer la base").not.toContain("@/db");
    // Y el fila a fila sigue siendo lo que el panel dice que es.
    expect(nivelDeAnonimizacion(EXPORT_FILA_A_FILA_DE_LA_VISTA).nivel).toBe("pseudonymized");
  });
});

describe("la descarga queda registrada antes de salir", () => {
  const RUTA = sinComentarios(readFileSync("src/app/(app)/obbia/cohorte/csv/route.ts", "utf8"));
  const WRITER = sinComentarios(
    readFileSync("src/modules/obbia/data/registro-de-la-entrega-writer.ts", "utf8"),
  );

  it("la ruta exige la MISMA policy que la pantalla", () => {
    expect(RUTA).toContain("canViewObbia(user)");
    expect(RUTA).toContain('return new NextResponse("No autorizado", { status: 403 })');
  });

  it("y registra ANTES de devolver el archivo", () => {
    // Al reves, un archivo podria salir sin rastro si el registro fallara.
    expect(RUTA.indexOf("registrarLaEntregaDelResumen(")).toBeLessThan(
      RUTA.indexOf("Content-Disposition"),
    );
  });

  it("el registro escribe la fila Y el asiento, en la MISMA transacción", () => {
    // Regla dura 8: inline, nunca por el bus. Si la fila se revierte, el asiento también; al revés
    // quedaría registrada una entrega que no ocurrió.
    expect(WRITER).toContain("db.transaction(");
    expect(WRITER).toContain("insert(researchDatasets)");
    expect(WRITER).toContain("recordAudit(tx, {");
    expect(WRITER).toContain('event: "investigacion.resumen_exportado"');
    expect(WRITER, "el asiento salió de la transacción").not.toContain("recordAudit(db");
  });

  it("y el nivel registrado se DERIVA, no se teclea", () => {
    // Gildardo, 2026-10-24: *"que el nivel se derive de lo que el export quita"*. Si alguien teclea el
    // nivel, el rótulo acaba diciendo lo que conviene y nadie puede distinguir después.
    expect(WRITER).toContain("nivelDeAnonimizacion(CIFRAS_DEL_PANEL)");
    expect(WRITER, "el nivel volvió a escribirse a mano").not.toContain('anonymizationLevel: "');
  });

  it("y la entrega NO queda en «pendiente», que diría que espera aprobación", () => {
    expect(WRITER).toContain('status: "entregado"');
  });
});

describe("el resumen con gráficas", () => {
  const PAGINA = sinComentarios(readFileSync("src/app/(app)/obbia/page.tsx", "utf8"));
  const GRAFICA = sinComentarios(
    readFileSync("src/modules/obbia/components/barras-de-la-cohorte.tsx", "utf8"),
  );

  it("la serie por mes se pinta en barras, y la tabla se queda", () => {
    // La gráfica contesta la forma; la tabla, la cifra exacta, que en un panel de investigación es lo
    // que se cita. Quitar la tabla sería cambiar un dato por un dibujo.
    expect(PAGINA).toContain("<BarrasDeLaCohorte");
    expect(PAGINA).toContain("Mes de la medición");
  });

  it("y la gráfica es SVG de la casa, sin librería", () => {
    expect(GRAFICA).toContain("<svg");
    expect(GRAFICA).toContain("viewBox");
    expect(GRAFICA, "la gráfica se volvió componente de cliente").not.toContain("use client");
  });

  it("con escala desde CERO y su etiqueta accesible", () => {
    // Arrancar el eje en el mínimo exagera las diferencias, y en una serie de conteos eso dice algo
    // falso: una barra el doble de alta tiene que ser el doble de consultas.
    expect(GRAFICA).toContain("(v / maximo) * alturaUtil");
    expect(GRAFICA).toContain('role="img"');
    expect(GRAFICA).toContain("aria-label={ariaLabel}");
    // Y la etiqueta de la página DICE las cifras: es lo único que recibe quien usa lector de pantalla.
    expect(PAGINA).toContain("Consultas autorizadas por mes de la medición");
  });

  it("y el color es el de marca, no el clínico", () => {
    // BRAND.md reserva verde/ámbar/rojo para los veredictos sobre un paciente. Aquí no hay veredicto:
    // son consultas contadas.
    expect(GRAFICA).toContain("fill-primary");
    expect(GRAFICA).not.toContain("clinical-");
  });

  it("y las razones de exclusión llevan su peso, sobre el total de excluidas", () => {
    expect(PAGINA).toContain("<BarraDeProporcion valor={r.consultas} total={cohorte.sinAutorizacion} />");
    // El porcentaje va TAMBIEN en texto: la barra es la ayuda de lectura, no el dato.
    expect(GRAFICA).toContain("{pct}%</span>");
  });
});

describe("los pacientes del HTML: qué se puede hacer con ellos", () => {
  const PAGINA = readFileSync("src/app/(app)/obbia/page.tsx", "utf8");

  it("la pantalla dice que solo se pueden usar agregados o anonimizados", () => {
    // LA CIFRA SOLA NO LO DICE, y la diferencia es jurídica: el consentimiento del HTML no tenía casilla
    // de investigación, así que no hay nada que autorice usar sus datos fila a fila.
    expect(PAGINA).toContain("agregadas o anonimizadas");
    expect(PAGINA).toContain("el consentimiento del HTML no tenía casilla de investigación");
  });

  it("y NO los da por perdidos: dice la salida", () => {
    // "No dijeron que no, nadie les preguntó" y la regularización que ya existe. Un dato que se presenta
    // como perdido no se recupera; uno que se presenta como pendiente, sí.
    expect(PAGINA).toContain("No dijeron que no, nadie les preguntó");
    expect(PAGINA).toContain("Si firman\n            el consentimiento de Atlas, entran solas");
  });
});
