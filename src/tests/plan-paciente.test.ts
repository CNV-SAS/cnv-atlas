import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// CANDADO DEL PLAN QUE RECIBE EL PACIENTE (Gildardo §7.1, 2026-08-26).
//
// SU LISTA, literal: "el paciente recibe el plan completo, no solo el informe de composición: el
// diagnóstico, la meta y los objetivos, el plan dietético, el ejemplo de menú, la distribución por
// porciones, las recomendaciones automáticas según el caso, y la lista de intercambio -no la lista
// completa, sino los alimentos principales por región o ciudad-".
//
// SON SIETE BLOQUES Y VAN SEIS. El séptimo (la lista recortada por región) no se puede construir: su
// `INTER_TABLA_B` es nacional y no existe el mapa de qué alimentos corresponden a cada región. Preguntado
// como P2. Este candado cuenta los seis para que nadie los dé por completos.

const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
const READER = readFileSync("src/modules/reports/data/plan-paciente-reader.ts", "utf8");
const SEND = readFileSync("src/modules/reports/services/send-report.ts", "utf8");
const RENDER = readFileSync("src/modules/reports/services/render-report.tsx", "utf8");
const RUTA = readFileSync("src/app/(app)/reportes/[id]/pdf/route.ts", "utf8");

describe("los seis bloques que sí se pueden construir están en el documento", () => {
  it.each([
    ["la meta", "Tu meta"],
    ["el plan dietético", "Tu plan de alimentación"],
    ["el ejemplo de menú", "Ejemplo de menú para una semana"],
    ["la distribución por porciones", "Cómo repartir tus porciones en el día"],
  ])("%s", (_n, titulo) => {
    expect(DOC).toContain(titulo);
  });

  it("el diagnóstico, que va PRIMERO", () => {
    // Su §7.1 lo pone primero en la lista, y la razón es la que dio Santiago: primero se le explica al
    // paciente qué tiene, y después la solución. Va traducido a su lenguaje (`dfiParaPaciente`).
    expect(DOC).toContain("Cómo estás");
    const diagnostico = DOC.indexOf("Cómo estás");
    const meta = DOC.indexOf("Tu meta");
    expect(diagnostico).toBeGreaterThan(-1);
    expect(meta).toBeGreaterThan(-1);
    expect(diagnostico, "el diagnóstico quedó después de la meta").toBeLessThan(meta);
  });

  it("y las recomendaciones, solo las que aplican a su caso", () => {
    expect(DOC).toContain("plan.recomendaciones.map");
    // Los bloques PENDIENTES son avisos PARA EL PROFESIONAL ("esto se emitirá cuando..."). En el
    // documento del paciente serían ruido sobre algo que no puede resolver.
    expect(READER).toContain(".filter((r) => !r.pendiente)");
  });
});

describe("lo que el paciente NO puede comer va en el plan, y antes del menú", () => {
  it("el bloque existe", () => {
    // Su §7.1 no lo nombra, y va igual, declarado (punto 10.6 de la ronda): el paciente recibe un menú, y
    // un menú sin las restricciones al lado es un plan que no puede seguir. Peor: puede contradecirlas.
    expect(DOC).toContain("Lo que debes evitar");
    expect(READER).toContain("restricciones: protocol.restricciones");
  });

  it("y va ANTES del menú, no después", () => {
    // Se lee el menú para saber qué comer, así que hay que llegar sabiendo qué evitar.
    const evitar = DOC.indexOf("Lo que debes evitar");
    const menu = DOC.indexOf("Ejemplo de menú para una semana");
    expect(evitar).toBeGreaterThan(-1);
    expect(evitar, "las restricciones quedaron después del menú").toBeLessThan(menu);
  });

  it("no repite las del MODELO, que ya salen con su cifra", () => {
    // El sodio y los atributos del patrón salen arriba, en el plan dietético, con su número. Repetirlos
    // aquí sin el número sería decir dos veces lo mismo y peor la segunda.
    expect(READER).not.toContain("...(prescripcion?.atributos ?? []),");
  });
});

describe("el séptimo bloque falta, y está dicho dónde", () => {
  it("el reader deja escrito por qué la lista recortada no está", () => {
    // Sin esta nota, el día que alguien compare el documento contra su §7.1 va a leer un olvido donde hay
    // una pregunta abierta.
    expect(READER).toContain("la lista recortada por region");
    expect(READER).toContain("P2");
  });
});

describe("el plan llega a los TRES sitios que renderizan el documento", () => {
  it("al envío, al reenvío y al preview", () => {
    // EL CANDADO VA SOBRE LOS SITIOS DE LLAMADA, que es donde ya se nos quedó dos veces una pieza sin su
    // último cable. Y el PREVIEW es el que más importa de los tres: el profesional APRUEBA mirando eso,
    // así que un preview sin el plan le haría aprobar un documento distinto del que se envía.
    expect((SEND.match(/getPlanPaciente\(/g) ?? []).length, "falta el plan en envío o reenvío").toBe(2);
    expect((SEND.match(/^\s+plan,$/gm) ?? []).length, "el plan no viaja a los dos renders").toBe(2);
    expect(RUTA, "el preview no lleva el plan").toContain("plan: await getPlanPaciente(");
  });

  it("y el renderizador lo acepta como parámetro propio", () => {
    expect(RENDER).toContain("plan={options.plan}");
  });
});

describe("el plan sale de los MISMOS números que ve el nutricionista", () => {
  it("usa la cadena efectiva, no un recálculo con otros criterios", () => {
    // El paciente no puede recibir un objetivo distinto del que su profesional prescribió. Se computa con
    // `computeProtocoloEfectivo` sobre los ajustes guardados, igual que el panel.
    expect(READER).toContain("computeProtocoloEfectivo(snap, {");
    expect(READER).toContain("deficit: protocol.adjDeficit");
    expect(READER).toContain("pesoMeta: protocol.pesoMetaFijado");
  });

  it("y las porciones guardadas PISAN a las calculadas, como en su pantalla", () => {
    expect(READER).toContain("protocol.intercambioPorciones?.porciones[a.sub] ?? a.porciones");
    expect(READER).toContain("protocol.tiempos?.celdas?.[alimento]?.[t.id]");
  });

  it("se compone de los lectores que ya existen, no consulta por su cuenta", () => {
    // Dos formas de armar el mismo insumo es como el motor de nutrición terminó viendo cero
    // comorbilidades. Aquí solo se DA FORMA a lo que esos lectores devuelven.
    expect(READER).toContain("getTreatmentProtocol(evaluationId)");
    expect(READER).toContain("getPrescripcionNutricional(");
  });
});

describe("lo que NO viaja al paciente, y es deliberado", () => {
  it("la referencia bibliográfica de la prescripción se queda", () => {
    // Al paciente le sirve el número, no de qué guía sale. Eso es del documento del profesional.
    expect(READER).toContain("({ nombre: f.nombre, valor: f.valor })");
  });

  it("el menú son SIETE días, no los veintiuno del ciclo", () => {
    // Su §7.1 dice "ejemplo de menú". Veintiún días de comidas en un PDF es un documento que nadie lee.
    expect(READER).toContain("DIAS_MENU_PACIENTE = 7");
    expect(READER).toContain("Array.from({ length: 7 }");
  });

  it("y el plan entero se omite si no hay protocolo, en vez de salir a medias", () => {
    expect(READER).toContain("if (!protocol || !snap) return null;");
    expect(DOC).toContain("{showAtlas && plan ? (");
  });
});
