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
  conCeldasSuprimidas,
  cumpleElUmbral,
  K_ANONIMATO,
  ROTULO_SUPRIMIDO,
} from "@/modules/obbia/services/supresion-de-celdas";
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
  fueraPorSerMenor: { consultas: 1, pacientes: 1 },
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
  mezclaMarginal: false,
  cohorteBajoElUmbral: false,
  porMes: [
    { mes: "2026-08", evaluaciones: 40 },
    { mes: "2026-09", evaluaciones: 120 },
  ],
  // LOS CONSOLIDADOS DE SU CNVResearch (2026-11-03). Van en el fixture aunque el CSV no los lleve: el
  // candado del export comprueba justamente que NO se cuelen en el archivo, y un fixture sin ellos haria
  // que ese caso pasara por ausencia en vez de por decision.
  estratos: [
    { eje: "pais", filas: [{ grupo: "Colombia", consultas: 300, pacientes: 240, conBis: 300, conEspectro: 190, edadMedia: 41.2 }], suprimidas: 0, noPublicable: false },
    { eje: "ciudad", filas: [{ grupo: "Medellín", consultas: 280, pacientes: 225, conBis: 280, conEspectro: 180, edadMedia: 41.0 }], suprimidas: 0, noPublicable: false },
    { eje: "sexo", filas: [{ grupo: "Femenino", consultas: 210, pacientes: 170, conBis: 210, conEspectro: 140, edadMedia: 40.1 }], suprimidas: 0, noPublicable: false },
    { eje: "profesional", filas: [{ grupo: "Profesional Demo", consultas: 90, pacientes: 70, conBis: 90, conEspectro: 60, edadMedia: 39.8 }], suprimidas: 0, noPublicable: false },
  ],
  cifrasDeLaCohorte: {
    conEspectro: 190,
    conEncuestaCompleta: 240,
    conPlanNutricional: 180,
    edadMedia: 41.2,
    edadMinima: 18,
    edadMaxima: 79,
    edadImposible: 0,
  },
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

  it("y su proporción NO depende de cuántas barras haya", () => {
    // EL DEFECTO (Santiago, 2026-11-03): *"esas gráficas tan inmensas se ven muy extrañas."*
    //
    // El `viewBox` se calculaba del NÚMERO DE BARRAS, así que con cinco meses medía 230 × 150. Y el SVG
    // lleva `w-full`: un SVG con viewBox escala EL DIBUJO ENTERO para llenar el ancho que se le da, así
    // que en un panel ancho esas 230 unidades se estiraban casi cinco veces y el alto se iba con ellas.
    // El ancho lógico y el ancho real eran dos cosas distintas y nadie las ataba.
    //
    // SE AFIRMA LO CONTRARIO DE LO QUE HABÍA: el viewBox es una constante, y lo que se reparte dentro son
    // las barras. Si alguien vuelve a derivarlo de los datos, el alto vuelve a depender de la cohorte.
    expect(GRAFICA, "el viewBox volvió a depender de los datos").toContain(
      "viewBox={`0 0 ${ANCHO} ${ALTO}`}",
    );
    expect(GRAFICA).toContain("const ANCHO = 600;");
    expect(GRAFICA, "las barras dejaron de repartirse el ancho").toContain(
      "const paso = ANCHO / barras.length;",
    );
    // Y UN TOPE DE GROSOR: dos barras repartiéndose 600 unidades serían dos bloques, no una serie.
    expect(GRAFICA).toContain("GROSOR_MAXIMO");
    // La otra mitad es de la maqueta: un dibujo 4:1 a todo el ancho de un panel sigue siendo alto.
    expect(PAGINA, "la gráfica volvió a ocupar todo el ancho del panel").toContain(
      '<div className="max-w-3xl">',
    );
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

  // ═══ EL LIMITE ES LO SEUDONIMIZADO, NO LO ANONIMIZADO (consulta legal, 2026-11-03) ═══
  //
  // La primera version de este candado exigia la frase "agregadas o anonimizadas", que era correcta pero
  // se quedaba corta del lado que importa: deja creer que lo anonimizado es una concesion del mismo rango
  // que lo agregado. La consulta legal lo fijo al reves: lo ANONIMIZADO es libre (su finalidad (c) cubre
  // el acto de anonimizar y lo anonimizado deja de ser dato personal), y lo que su consentimiento NO
  // cubre es lo SEUDONIMIZADO. Asi que lo que se vigila es que la pantalla nombre esa frontera, que es la
  // que decide si una venta es licita.
  it("la pantalla dice que el limite es lo SEUDONIMIZADO, no lo anonimizado", () => {
    expect(PAGINA).toContain("agregado y en lo anonimizado");
    expect(PAGINA).toContain("<strong>seudonimizado</strong>");
    expect(PAGINA).toContain("el consentimiento del HTML no tenía casilla de investigación");
    // Y que la condicion es UNICA para todos, sin filtro por origen: es la mitad que evita construir una
    // regla distinta para los 150 del HTML.
    expect(PAGINA).toContain("k-anonimato con k >= 5");
    expect(PAGINA).toContain("no hay una regla para los del HTML y otra para los de Atlas");
  });

  it("y NO los da por perdidos: dice la salida", () => {
    // "No dijeron que no, nadie les preguntó" y la regularización que ya existe. Un dato que se presenta
    // como perdido no se recupera; uno que se presenta como pendiente, sí.
    expect(PAGINA).toContain("nadie les preguntó");
    expect(PAGINA).toContain("Si\n            firman el de Atlas, entran solas");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: NINGUNA CELDA DEL ARCHIVO DESCRIBE A MENOS DE CINCO PERSONAS  ·  k >= 5 (2026-11-03)
//
// ═══ DE DONDE SALE ═══
//
// Santiago, mirando el CSV: *"hoy trae celdas de 1 paciente (Maracaibo, 51 años). Eso no se puede
// descargar así."* Una fila que dice "Maracaibo · 1 consulta · 1 paciente · edad media 51,0" no es una
// cifra agregada: es UNA PERSONA descrita por su ciudad y su edad.
//
// Y desde el 2026-11-03 la condición jurídica lo exige para TODA salida comercializable, antes de la
// primera venta: k >= 5 y supresión de celdas pequeñas, aplicados técnicamente.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("ninguna celda del archivo describe a menos de cinco personas", () => {
  const conCeldasPequenas: CohorteDeInvestigacion = {
    ...COHORTE,
    estratos: [
      {
        eje: "ciudad",
        filas: [
          { grupo: "Medellín", consultas: 280, pacientes: 225, conBis: 280, conEspectro: 180, edadMedia: 41 },
          // Las tres que Santiago vio: una persona cada una.
          { grupo: "Maracaibo", consultas: 1, pacientes: 1, conBis: 0, conEspectro: 0, edadMedia: 51 },
          { grupo: "Yarumal", consultas: 1, pacientes: 1, conBis: 0, conEspectro: 0, edadMedia: 42 },
          { grupo: "Bello", consultas: 1, pacientes: 1, conBis: 1, conEspectro: 1, edadMedia: 65 },
        ],
        // EL FIXTURE LLEGA SIN SUPRIMIR A PROPOSITO: este candado prueba el CINTURON del CSV, o sea
        // que el archivo no deja salir una celda pequeña ni cuando le llega una. Lo normal hoy es que el
        // lector ya las haya suprimido, pero un cinturon se prueba con lo que no deberia llegarle.
        suprimidas: 0,
        noPublicable: false,
      },
    ],
  };
  const CSV_PEQUENAS = resumenDeLaCohorteACsv(conCeldasPequenas, {
    generadoEl: "03/11/2026",
    generadoPor: "Quien Sea",
  });

  it("las celdas de una persona no salen con su nombre de categoría", () => {
    expect(CSV_PEQUENAS, "una ciudad con un solo paciente identifica a esa persona").not.toContain(
      "Maracaibo",
    );
    expect(CSV_PEQUENAS).not.toContain("Yarumal");
    expect(CSV_PEQUENAS).not.toContain("Bello");
    // Y la que sí supera el umbral se queda: suprimir de más también estropea la tabla.
    expect(CSV_PEQUENAS).toContain("Medellín");
  });

  it("pero sus cifras SÍ, reunidas, para que las columnas sigan sumando", () => {
    // Borrarlas rompe la propiedad que hace útil una tabla de caracterización: que sume el total. Un
    // revisor que no cuadra una tabla no sabe si falta una categoría o si el dato está mal.
    expect(CSV_PEQUENAS).toContain(ROTULO_SUPRIMIDO);
    // SE BUSCA LA LINEA QUE EMPIEZA POR EL ROTULO, no una que lo contenga: la cabecera que dice cuántas
    // se suprimieron lo CITA en su nota, y buscar por contenido se cazaba con ella.
    const linea = CSV_PEQUENAS.split("\r\n").find((l) => l.startsWith(ROTULO_SUPRIMIDO));
    expect(linea, "las tres de una persona suman 3 consultas y 3 pacientes").toContain(",3,3");
  });

  it("y el archivo DICE cuántas suprimió, en vez de callarlo", () => {
    // Un archivo que calla lo que le falta se lee como completo. Es la misma regla que el diccionario de
    // su CNVResearch ("dice qué se retiró, no solo qué queda").
    expect(CSV_PEQUENAS).toContain("Celdas suprimidas por k-anonimato");
    expect(CSV_PEQUENAS).toContain(`k >= ${K_ANONIMATO}`);
  });

  it("el umbral se mide sobre PACIENTES, no sobre consultas", () => {
    // Una persona con cinco consultas es UNA persona: contar cinco la daría por protegida cuando está
    // sola en su celda. El k-anonimato habla de individuos.
    const { visibles, suprimida } = conCeldasSuprimidas([
      { grupo: "uno con muchas visitas", consultas: 9, pacientes: 1 },
      { grupo: "cinco personas", consultas: 5, pacientes: 5 },
    ]);
    expect(visibles.map((f) => f.grupo)).toEqual(["cinco personas"]);
    expect(suprimida?.pacientes).toBe(1);
  });

  it("y la fila reunida cuenta como cualquier otra para el umbral", () => {
    // Si al juntar tres celdas de uno quedan tres personas, sigue por debajo del umbral.
    const { suprimida } = conCeldasSuprimidas([
      { grupo: "a", consultas: 1, pacientes: 1 },
      { grupo: "b", consultas: 1, pacientes: 1 },
      { grupo: "c", consultas: 1, pacientes: 1 },
    ]);
    expect(cumpleElUmbral(suprimida ? [suprimida] : []), "tres personas siguen siendo menos de cinco").toBe(
      false,
    );
  });

  it("los rótulos de los ejes del CSV son los MISMOS de la pantalla", () => {
    // El CSV es un módulo PURO y la pantalla un Server Component, así que el mapa está escrito dos veces
    // a propósito. Lo que no puede es divergir: un archivo que llama "Por ciudad" a lo que la pantalla
    // llama de otra forma obliga a adivinar si son la misma tabla.
    const PAGINA = readFileSync("src/app/(app)/obbia/page.tsx", "utf8");
    const EXPORT = readFileSync("src/modules/obbia/services/exportar-la-cohorte.ts", "utf8");
    for (const rotulo of ["Por país", "Por ciudad", "Por sexo", "Por profesional"]) {
      expect(PAGINA, `la pantalla dejó de rotular ${rotulo}`).toContain(`"${rotulo}"`);
      expect(EXPORT, `el CSV dejó de rotular ${rotulo}`).toContain(`"${rotulo}"`);
    }
  });
});
