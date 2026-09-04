import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// CANDADO DEL PLAN QUE RECIBE EL PACIENTE (Gildardo §7.1, 2026-08-26).
//
// SU LISTA, literal: "el paciente recibe el plan completo, no solo el informe de composición: el
// diagnóstico, la meta y los objetivos, el plan dietético, el ejemplo de menú, la distribución por
// porciones, las recomendaciones automáticas según el caso, y la lista de intercambio -no la lista
// completa, sino los alimentos principales por región o ciudad-".
//
// SON SIETE BLOQUES Y VAN LOS SIETE (desde el 2026-09-03). El séptimo, la lista recortada por región,
// estuvo meses fuera: su `INTER_TABLA_B` es nacional y faltaba el mapa de qué alimentos corresponden a
// cada región. Llegó en su entrega del 3-sep (§2). Este candado los cuenta para que nadie los dé por
// completos, y desde entonces también vigila que el séptimo esté cableado a las dos superficies.

const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
const READER = readFileSync("src/modules/reports/data/plan-paciente-reader.ts", "utf8");
const SEND = readFileSync("src/modules/reports/services/send-report.ts", "utf8");
const RENDER = readFileSync("src/modules/reports/services/render-report.tsx", "utf8");
const RUTA = readFileSync("src/app/(app)/reportes/[id]/pdf/route.ts", "utf8");
const DOC_PLAN = readFileSync("src/modules/reports/components/plan-imprimible.tsx", "utf8");

describe("los bloques del documento", () => {
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

describe("el séptimo bloque ya está: la lista de intercambio recortada por región", () => {
  // ESTE CANDADO CAMBIO DE ASERCION EL 2026-09-03, y el motivo es que se cumplio lo que vigilaba. Decia
  // "el séptimo bloque falta, y está dicho dónde", y afirmaba que el reader explicara la ausencia citando
  // la pregunta P2 de la ronda del 31. Gildardo respondio (su §2 del 3-sep: el mapa existia desde el 2,
  // pero llego SUELTO en la carpeta, fuera del HTML donde su documento dijo que estaba), asi que la
  // ausencia dejo de existir y con ella el motivo del candado.
  //
  // La asercion no se relaja, se DA VUELTA: lo que se vigila ahora es que el bloque este cableado a las
  // DOS superficies. Una pieza portada y no renderizada es el defecto que ya nos costo tres veces.
  it("el reader lo arma y ya no habla de una ausencia", () => {
    expect(READER).toContain("armarListaIntercambio");
    expect(READER).toContain("LOS SIETE SE ARMAN AQUI");
    expect(READER, "quedo texto describiendo el bloque como pendiente").not.toContain(
      "El septimo, la lista recortada por region, NO",
    );
  });

  it("y sale en las dos caras: la pantalla imprimible y el PDF", () => {
    // Las dos leen el MISMO `plan.listaIntercambio`, que es la unica forma de que no puedan discrepar.
    for (const [que, texto] of [
      ["el plan imprimible", DOC_PLAN],
      ["el PDF", DOC],
    ] as const) {
      expect(texto, `${que} no pinta la lista`).toContain("Tu lista de intercambio");
      expect(texto, `${que} no lee el bloque del plan`).toContain("plan.listaIntercambio");
    }
  });

  it("los dos cortes suyos viajan: ocho alimentos por subgrupo y el resto como «entre otros»", () => {
    expect(READER).toContain("foods.slice(0, 8)");
    expect(READER).toContain("foods.length > 8");
    expect(DOC).toContain("entre otros");
    expect(DOC_PLAN).toContain("entre otros");
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

  it("se compone de los lectores que ya existen, con UNA consulta propia declarada", () => {
    // Dos formas de armar el mismo insumo es como el motor de nutrición terminó viendo cero
    // comorbilidades. Aquí solo se DA FORMA a lo que esos lectores devuelven.
    expect(READER).toContain("getTreatmentProtocol(evaluationId)");
    expect(READER).toContain("getPrescripcionNutricional(");
  });

  it("y esa consulta propia es UNA sola: la ciudad, que ningún lector devuelve", () => {
    // EL TITULO DE ARRIBA DECIA "no consulta por su cuenta" HASTA EL 2026-09-03, y dejó de ser cierto al
    // entrar el séptimo bloque: la lista por región necesita la ciudad del paciente, y ninguno de los
    // lectores existentes la trae. Traerse `getHcHeaderForEvaluation` entero por una columna acoplaría el
    // plan a la historia clínica, así que la excepción se toma y se DECLARA, que es la diferencia entre
    // una decisión y una erosión.
    //
    // Lo que este caso vigila es que siga siendo UNA. En cuanto aparezca una segunda, el patrón dejó de
    // ser una excepción y hay que volver a componer.
    // Se cuenta la LLAMADA, no el import: el import aparece una vez pase lo que pase, así que contarlo
    // haría que una segunda consulta no moviera el número y el candado no viera nada.
    expect((READER.match(/await createSupabaseServerClient()/g) ?? []).length).toBe(1);
    expect(READER).toContain("async function getCiudadPaciente(");
    // Y con el hint del embed, que es la regla que ya nos rompió tres consultas en runtime sin que tsc
    // dijera nada (CLAUDE.md, sección Supabase).
    expect(READER).toContain("patients!inner(patient_profiles!inner(city))");
  });
});

describe("lo que NO viaja al paciente, y es deliberado", () => {
  it("la referencia bibliográfica de la prescripción se queda", () => {
    // Al paciente le sirve el número, no de qué guía sale. Eso es del documento del profesional.
    //
    // SE AFIRMA LA GARANTIA, NO LA FORMA (corregido el 2026-09-03). Este caso comparaba la expresion
    // literal `({ nombre: f.nombre, valor: f.valor })`, y se puso rojo al reescribir el mapeo para que la
    // proteina saliera de la cadena efectiva: la garantia seguia intacta y el candado decia que no. Un
    // candado atado a como esta escrito algo se rompe cada vez que se reescribe sin cambiar lo que
    // garantiza, y ahi se acaba editando la asercion, que es como los candados dejan de leerse.
    expect(READER).toContain("nombre: f.nombre");
    expect(READER).toContain("valor: f.valor");
    // Lo que de verdad se prohibe: que la referencia viaje.
    expect(READER).not.toContain("ref: f.ref");
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
