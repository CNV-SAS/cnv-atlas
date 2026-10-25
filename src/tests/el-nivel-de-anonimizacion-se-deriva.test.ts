import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CIFRAS_DEL_PANEL,
  EXPORT_FILA_A_FILA_DE_LA_VISTA,
  K_MINIMO_PARA_ANONIMIZAR,
  NIVELES_DE_ANONIMIZACION,
  nivelDeAnonimizacion,
  sigueSiendoDatoPersonal,
  type FormaDelExport,
} from "@/modules/obbia/services/nivel-de-anonimizacion";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EL NIVEL DE ANONIMIZACION SALE DE LA FORMA DEL EXPORT, NO DE UNA DECISION
//
// ── DE DONDE SALE ───────────────────────────────────────────────────────────────────────────────
//
// Gildardo, 2026-10-24: *"Abre el vocabulario a pseudonymized, cerrado con CHECK o enum, y que el nivel
// se derive de lo que el export quita. La tabla esta vacia: hoy es gratis."*
//
// ── QUE DEFIENDE ────────────────────────────────────────────────────────────────────────────────
//
//   1. QUE EL ERROR CAIGA DEL LADO SEGURO. Si quien genera un dataset omite un cuasi-identificador o no
//      verifica el k, el nivel que sale es el MAS identificable, nunca el menos. Al contrario, un
//      dataset quedaria rotulado anonimo por omision, y un rotulo `anonymized` afirma que eso ya no es
//      dato personal: que CNV puede ser propietaria de sus derivados y que no hace falta consentimiento.
//   2. QUE `anonymized` NO SEA ALCANZABLE SIN LA VERIFICACION. Quitar el nombre no anonimiza: es la
//      advertencia textual de DATA_GOVERNANCE.md, y la columna llevaba dos anos aceptando cualquier
//      texto sin ninguna restriccion.
//   3. QUE EL VOCABULARIO DE TypeScript Y EL DE LA BASE NO DIVERJAN. Si uno crece y el otro no, la base
//      rechaza en runtime un nivel que el codigo cree valido, y eso se descubre al generar el dataset.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const MIGRACION = "drizzle/0227_el_nivel_de_anonimizacion_es_un_vocabulario.sql";
const SCHEMA = "src/db/schema/research.ts";

/** Una forma completa a partir de los cambios que interesan, para no repetir las cuatro claves. */
const forma = (parcial: Partial<FormaDelExport>): FormaDelExport => ({
  filaPorPaciente: true,
  llaveQueRelaciona: false,
  cuasiIdentificadoresSinGeneralizar: [],
  kVerificado: null,
  ...parcial,
});

describe("el nivel sale de lo que el archivo lleva", () => {
  it("solo cifras por cohorte: agregado", () => {
    expect(nivelDeAnonimizacion(forma({ filaPorPaciente: false })).nivel).toBe("aggregate");
    expect(nivelDeAnonimizacion(CIFRAS_DEL_PANEL).nivel).toBe("aggregate");
  });

  it("fila por paciente con llave que relaciona: seudonimizado, sin discusion", () => {
    // Es la definicion del documento: la capacidad de volver a unir los registros de alguien es lo que
    // lo mantiene como dato personal, aunque no haya nombre en ninguna columna.
    const r = nivelDeAnonimizacion(forma({ llaveQueRelaciona: true }));
    expect(r.nivel).toBe("pseudonymized");
    expect(r.porQue).toMatch(/llave estable/);
  });

  it("la llave manda sobre todo lo demas: ni con k de sobra se vuelve anonimo", () => {
    const r = nivelDeAnonimizacion(forma({ llaveQueRelaciona: true, kVerificado: 500 }));
    expect(r.nivel).toBe("pseudonymized");
  });

  it("sin llave pero con cuasi-identificadores sin generalizar: seudonimizado, y los nombra", () => {
    const r = nivelDeAnonimizacion(
      forma({ cuasiIdentificadoresSinGeneralizar: ["ciudad", "etnia"], kVerificado: 40 }),
    );
    expect(r.nivel).toBe("pseudonymized");
    expect(r.porQue, "quien lo lea tiene que saber QUE columna lo impide").toMatch(/ciudad, etnia/);
  });

  it("sin k verificado NO es anonimo: no verificado es 'no se sabe', no es cero ni es OK", () => {
    const r = nivelDeAnonimizacion(forma({ kVerificado: null }));
    expect(r.nivel).toBe("pseudonymized");
    expect(r.porQue).toMatch(/no se verificó|No se verificó/);
  });

  it("k por debajo del minimo: seudonimizado, y dice el minimo y su fuente", () => {
    const r = nivelDeAnonimizacion(forma({ kVerificado: K_MINIMO_PARA_ANONIMIZAR - 1 }));
    expect(r.nivel).toBe("pseudonymized");
    expect(r.porQue).toContain(String(K_MINIMO_PARA_ANONIMIZAR));
    expect(r.porQue).toMatch(/DATA_GOVERNANCE/);
  });

  it("con todo cumplido SI es anonimo, y arrastra el pendiente juridico", () => {
    const r = nivelDeAnonimizacion(forma({ kVerificado: K_MINIMO_PARA_ANONIMIZAR }));
    expect(r.nivel).toBe("anonymized");
    expect(
      r.pendienteJuridico,
      "el umbral k >= 5 esta PENDIENTE JURIDICO en el documento: emitir un anonimo antes de la " +
        "ratificacion es una afirmacion legal que nadie firmo",
    ).toBe(true);
  });

  it("el k minimo es el del documento, no una cifra nuestra", () => {
    // La regla del repositorio: ningun umbral que decida sobre un dato se escribe sin su fuente al lado.
    const src = readFileSync("src/modules/obbia/services/nivel-de-anonimizacion.ts", "utf8");
    expect(K_MINIMO_PARA_ANONIMIZAR).toBe(5);
    expect(src).toMatch(/DATA_GOVERNANCE\.md/);
    expect(src).toMatch(/PENDIENTE JURIDICO|PENDIENTE JURÍDICO/);
  });

  it("el export de la vista de hoy es SEUDONIMIZADO, porque lleva patient_id", () => {
    // Esta es la respuesta que hay que saber antes de prometer un dataset, y por eso vive en una
    // constante y no en un texto de la pantalla: si la vista deja de llevar la llave, cambia sola.
    expect(nivelDeAnonimizacion(EXPORT_FILA_A_FILA_DE_LA_VISTA).nivel).toBe("pseudonymized");
    expect(EXPORT_FILA_A_FILA_DE_LA_VISTA.llaveQueRelaciona).toBe(true);
  });
});

describe("el vocabulario esta cerrado, y es el MISMO en los tres sitios", () => {
  it("son exactamente tres niveles", () => {
    expect([...NIVELES_DE_ANONIMIZACION]).toEqual(["aggregate", "pseudonymized", "anonymized"]);
  });

  it("el CHECK de la base lista los mismos", () => {
    const sql = readFileSync(MIGRACION, "utf8");
    const m = /CHECK \("anonymization_level" IN \(([^)]*)\)\)/.exec(sql);
    expect(m, "no encontre el CHECK de la 0227").not.toBeNull();
    const enLaBase = [...m![1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]);
    expect(
      enLaBase.sort(),
      "si una lista crece y la otra no, la base rechaza en runtime un nivel que el codigo cree valido",
    ).toEqual([...NIVELES_DE_ANONIMIZACION].sort());
  });

  it("el schema de Drizzle los declara, asi que un nivel inventado no compila", () => {
    const schema = readFileSync(SCHEMA, "utf8");
    for (const nivel of NIVELES_DE_ANONIMIZACION) {
      expect(schema, `el schema tiene que declarar ${nivel}`).toContain(`"${nivel}"`);
    }
    expect(
      /anonymization_level"\)\.notNull\(\),? \/\/ aggregate, anonymized/.test(schema),
      "el comentario viejo era el unico sitio donde constaba el vocabulario, y un comentario no es un control",
    ).toBe(false);
  });

  it("la migracion dice que el nivel se DERIVA, y donde", () => {
    const sql = readFileSync(MIGRACION, "utf8");
    expect(sql).toMatch(/nivel-de-anonimizacion/);
    expect(/DROP TYPE|DROP COLUMN/.test(sql), "forward-only").toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LAS DOS FRASES DE LA PANTALLA NO PUEDEN CONTRADECIRSE (Gildardo, 2026-10-25)
//
// El encabezado decia *"Solo data agregada o anonimizada; nunca datos personales del paciente"* mientras
// el bloque de abajo, calculado, decia que un dataset de esa cohorte seria SEUDONIMIZADO y que eso sigue
// siendo dato personal. Las dos hablaban de lo mismo. La escrita a mano era la que estaba mal, y el
// arreglo no es elegir una: es que las dos salgan de `nivelDeAnonimizacion`.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("el encabezado del panel no se escribe a mano", () => {
  const PANTALLA = "src/app/(app)/obbia/page.tsx";
  // SIN LOS COMENTARIOS: el comentario que EXPLICA el arreglo cita la frase vieja, asi que buscarla en el
  // archivo crudo hace fallar al archivo por documentarse bien. Ya paso una vez hoy, en otro candado.
  const pantalla = () =>
    readFileSync(PANTALLA, "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/\/\/.*$/gm, "");

  it("la promesa vieja, que afirmaba de mas, no puede volver", () => {
    expect(
      /nunca datos personales/.test(pantalla()),
      "afirmaba sobre el DATASET lo que solo era cierto de la PANTALLA",
    ).toBe(false);
  });

  it("el encabezado deriva su nivel de la misma funcion que el bloque de abajo", () => {
    const src = pantalla();
    expect(/nivelDeAnonimizacion\(CIFRAS_DEL_PANEL\)/.test(src)).toBe(true);
    expect(/nivelDeAnonimizacion\(EXPORT_FILA_A_FILA_DE_LA_VISTA\)/.test(src)).toBe(true);
    expect(
      /sigueSiendoDatoPersonal\(nivelDelExport\.nivel\)/.test(src),
      "y si sigue siendo dato personal tambien se deriva, no se afirma",
    ).toBe(true);
  });

  it("sigueSiendoDatoPersonal solo exime al anonimizado", () => {
    // La definicion es de DATA_GOVERNANCE, no nuestra: un seudonimizado sigue siendo dato personal porque
    // la llave existe en otra parte. Si algun dia esto devolviera false para pseudonymized, el panel
    // prometeria algo que la ley no concede.
    expect(sigueSiendoDatoPersonal("anonymized")).toBe(false);
    expect(sigueSiendoDatoPersonal("pseudonymized")).toBe(true);
    expect(sigueSiendoDatoPersonal("aggregate")).toBe(true);
  });

  it("el aviso de versiones solo salta con dos FAMILIAS, no con dos grafias", () => {
    // `1.0.0` y `anibise-1.4.0` son el mismo motor: el renombre del 2026-09-09 no movio una cifra, y lo
    // ya emitido conserva su grafia a proposito. El aviso viejo decia "no son comparables" sobre cifras
    // que si lo son, y eso hace desconfiar de la cohorte entera.
    const src = pantalla();
    expect(/cohorte\.mezclaFamilias/.test(src)).toBe(true);
    expect(
      /cohorte\.porVersionDelMotor\.length > 1 \? \(\s*<p[^>]*clinical-warning/.test(src),
      "la alarma no puede volver a colgarse del numero de grafias",
    ).toBe(false);
  });

  it("y el desglose de los excluidos esta en la pantalla, no solo en un mensaje", () => {
    const src = pantalla();
    expect(/sinAutorizacionPorRazon/.test(src)).toBe(true);
    expect(/importadasVigentes/.test(src), "el total al lado del 8, o el 8 parece un defecto").toBe(true);
  });
});
