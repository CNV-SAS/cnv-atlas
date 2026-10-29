import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CAMBIO_MINIMO_KG,
  cambioDesdeLaAnterior,
} from "@/modules/reports/cambio-desde-la-anterior";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LO QUE SE LE AÑADIO AL INFORME DEL PACIENTE PARA QUE LO PUEDA LEER
//
// ── DE DONDE SALE (una nutricionista, via Santiago, 2026-10-28) ─────────────────────────────────
//
// *"Algo que faltaría (si ya no está): Nombre del profesional, junto a una pequeña explicación del
// resumen del diagnóstico. Algo simple que el paciente pueda entender. Si el paciente va para
// seguimiento, animarlo comparando el seguimiento con la consulta anterior."*
//
// Lo que SALIO del informe con la misma entrega (los cuatro bloques de la prescripcion) lo vigila
// `plan-paciente.test.ts`, que es donde vive la §7.1 de Gildardo. Aqui va lo que ENTRO.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const DOC = readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8");
const REPO = readFileSync("src/modules/reports/data/reports-repository.ts", "utf8");
const SEND = readFileSync("src/modules/reports/services/send-report.ts", "utf8");
const RUTA = readFileSync("src/app/(app)/reportes/[id]/pdf/route.ts", "utf8");

const punto = (fecha: string, pesoKg: number | null, grasaKg: number | null, magraKg: number | null) => ({
  fecha,
  pesoKg,
  grasaKg,
  magraKg,
});

describe("el cambio desde la consulta anterior, en palabras", () => {
  it("compara las DOS ULTIMAS, no la primera contra la ultima", () => {
    // Ella pidio comparar "con la consulta anterior". El recorrido completo ya esta en la grafica, que si
    // lleva todos los puntos: si esto comparara contra la primera, las dos piezas dirian cifras distintas
    // del mismo bloque y la del texto parece la buena.
    const cambios = cambioDesdeLaAnterior([
      punto("2026-01-01", 90, 30, 60),
      punto("2026-05-01", 85, 26, 59),
      punto("2026-10-01", 84, 25, 59),
    ]);
    const peso = cambios.find((c) => c.medida === "Peso");
    expect(peso?.texto).toContain("84 kg");
    expect(peso?.texto, "comparo contra la primera consulta, no contra la anterior").toContain("1 kg menos");
  });

  it("dice lo que EMPEORO con la misma frialdad que lo que mejoro", () => {
    // Un informe que solo cuenta lo que mejoro deja de ser un informe. Y sin adjetivos en ninguno de los
    // dos sentidos: el veredicto lo da la banda de trayectoria, con texto de Gildardo.
    const cambios = cambioDesdeLaAnterior([punto("2026-05-01", 80, 20, 60), punto("2026-10-01", 83, 24, 59)]);
    const peso = cambios.find((c) => c.medida === "Peso")?.texto ?? "";
    expect(peso).toContain("3 kg más");
    for (const juicio of ["mejor", "peor", "bien", "mal", "sigue así", "felicitaciones", "cuidado"]) {
      for (const c of cambios) {
        expect(c.texto.toLowerCase(), `apareció un juicio ("${juicio}") en el cambio`).not.toContain(juicio);
      }
    }
  });

  it("SOLO las tres medidas que el paciente reconoce: ningun indice del modelo", () => {
    // §7.1 de Gildardo, literal: "ningun indice del modelo va al paciente". Si alguien añade el angulo de
    // fase, la capacitancia, el IFC o la EB-BIS "porque tambien cambio", esto falla.
    const medidas = cambioDesdeLaAnterior([
      punto("2026-05-01", 80, 20, 60),
      punto("2026-10-01", 78, 19, 59),
    ]).map((c) => c.medida);
    expect(medidas).toEqual(["Peso", "Masa grasa", "Masa muscular"]);
    const fuente = sinComentarios(readFileSync("src/modules/reports/cambio-desde-la-anterior.ts", "utf8"));
    for (const indice of ["ifc", "irc", "pabu", "angulo", "capacitancia", "ebBis", "iae", "fase"]) {
      expect(fuente.toLowerCase(), `entró un índice del modelo (${indice})`).not.toContain(indice);
    }
  });

  it("un cambio por debajo del piso NO se anuncia: estaria animando con algo que no ocurrio", () => {
    // Santiago, 2026-10-28: *"un cambio de 0,1 kg esta dentro del error de medicion, y decirle 'bajaste
    // 0,1 kg de grasa' lo anima con algo que no ocurrio."*
    const chico = cambioDesdeLaAnterior([
      punto("2026-05-01", 80, 20, 60),
      punto("2026-10-01", 79.9, 19.9, 60.1),
    ]);
    expect(chico).toHaveLength(3);
    for (const c of chico) {
      expect(c.texto, "se anunció un cambio por debajo del piso").not.toMatch(/menos|más/);
      expect(c.texto).toContain("sin cambio respecto de tu consulta anterior");
    }
  });

  it("y el piso NO dice 'se mantuvo estable', porque eso afirma mas de lo que tenemos", () => {
    // Es la respuesta que ya le dimos a Gildardo en §9.1 de la ronda del 2026-08-24, literal: un valor que
    // no cambia puede ser estabilidad real O un cambio mas pequeño de lo que la medicion distingue, y sin
    // poder distinguirlas "se mantuvo estable" afirma la primera. Santiago pidio esa redaccion; se usa la
    // que ya esta comprometida con la Direccion Cientifica.
    const chico = cambioDesdeLaAnterior([punto("2026-05-01", 80, 20, 60), punto("2026-10-01", 80.1, 20, 60)]);
    for (const c of chico) {
      expect(c.texto.toLowerCase(), "volvió el 'estable' que afirma estabilidad").not.toContain("estable");
    }
  });

  it("el piso esta declarado como PROVISIONAL y cita la pregunta que lo reemplaza", () => {
    // La regla del 2026-10-02: ningun umbral que decida sobre un dato clinico se escribe sin su fuente al
    // lado. Este no tiene fuente todavia, asi que lo que va al lado es la pregunta abierta y de quien es el
    // numero mientras tanto. Si alguien cambia la cifra sin tocar esto, el candado lo para.
    expect(CAMBIO_MINIMO_KG).toBe(0.5);
    const fuente = readFileSync("src/modules/reports/cambio-desde-la-anterior.ts", "utf8");
    expect(fuente).toContain("PROVISIONAL");
    expect(fuente, "el piso dejó de citar la pregunta que lo reemplaza").toContain("§9.1");
    expect(fuente).toContain("cambio minimo detectable");
  });

  it("y el piso es SIMETRICO: lo que empeoro por encima del piso se sigue diciendo", () => {
    // Santiago: "lo que empeoro se sigue diciendo". Un piso que callara solo las subidas convertiria el
    // bloque en un resumen de buenas noticias.
    const peor = cambioDesdeLaAnterior([punto("2026-05-01", 80, 20, 60), punto("2026-10-01", 82, 22, 59)]);
    expect(peor.find((c) => c.medida === "Peso")?.texto).toContain("2 kg más");
    expect(peor.find((c) => c.medida === "Masa grasa")?.texto).toContain("2 kg más");
    expect(peor.find((c) => c.medida === "Masa muscular")?.texto).toContain("1 kg menos");
  });

  it("sin dos mediciones no hay bloque, y una medida que falta no se rellena con cero", () => {
    expect(cambioDesdeLaAnterior([])).toEqual([]);
    expect(cambioDesdeLaAnterior([punto("2026-10-01", 80, 20, 60)])).toEqual([]);
    // Una medida que no se tomo NO es una medida que no cambio: decir "prácticamente igual" sobre un hueco
    // es afirmar un hecho que nadie midio.
    const conHueco = cambioDesdeLaAnterior([
      punto("2026-05-01", 80, null, 60),
      punto("2026-10-01", 78, 19, 59),
    ]);
    expect(conHueco.map((c) => c.medida)).toEqual(["Peso", "Masa muscular"]);
  });

  it("va DESPUES de la grafica, dentro del mismo bloque de seguimiento", () => {
    // La figura es el recorrido completo; esto es el ultimo tramo. Al reves, se lee el tramo y la figura
    // queda de adorno.
    const doc = sinComentarios(DOC);
    const grafica = doc.indexOf("<GraficaTrayectoria");
    const frases = doc.indexOf("Desde tu consulta anterior");
    expect(grafica).toBeGreaterThan(0);
    expect(frases, "las frases del cambio desaparecieron del informe").toBeGreaterThan(0);
    expect(frases, "las frases quedaron antes de la gráfica").toBeGreaterThan(grafica);
  });
});

describe("quien lo atendio sale en el informe", () => {
  it("el repositorio lo resuelve con la fuente unica de las etiquetas", () => {
    // Que "nutricionista" se escriba "Nutricionista" de cara al paciente lo decide `PROFESSION_LABELS`, no
    // este documento: es la misma lista que usan el admin y el consentimiento.
    expect(REPO).toContain("etiquetaDeProfesion(");
    // Y con el HINT del embed: `professional_profiles` tiene TRES relaciones hacia `profiles`, y sin
    // desambiguar PostgREST falla en runtime sin que tsc lo vea.
    expect(REPO).toContain("profiles!profile_id(full_name)");
  });

  it("y llega a los TRES sitios que arman el PDF, no solo al que se mira", () => {
    // El preview, el envio y el reenvio arman su propio `meta`. Si uno se queda sin el dato, el documento
    // que el profesional aprueba no es el que el paciente recibe, que es el defecto que ya costo caro.
    for (const [que, texto] of [
      ["el preview de la ruta", RUTA],
      ["el envio y el reenvio", SEND],
    ] as const) {
      expect(texto, `${que} no pasa el profesional al PDF`).toContain("profesional: dispatch.profesional");
    }
    // DOS EN EL ENVIO Y DOS EN EL REENVIO desde que el correo lleva el plan: el informe y el adjunto del
    // plan arman su propio `meta`, y los dos tienen que decir quien atendio. Se exige "al menos cuatro"
    // porque una cifra exacta aqui envejece con cada documento nuevo y falla por otra razon.
    expect(
      (SEND.match(/profesional: dispatch\.profesional/g) ?? []).length,
      "un documento del correo se quedó sin el profesional",
    ).toBeGreaterThanOrEqual(4);
    // Y el PDF del plan lo pinta, no solo lo recibe.
    expect(
      sinComentarios(readFileSync("src/modules/reports/pdf/plan-document.tsx", "utf8")),
    ).toContain("Te atendió");
    expect(sinComentarios(DOC)).toContain("Te atendió");
  });

  it("si no se pudo resolver, la linea NO sale: no se inventa un autor", () => {
    expect(sinComentarios(DOC)).toContain("meta.profesional ? (");
    expect(REPO).toContain('nombreProfesional !== ""');
  });
});

describe("la pequeña explicacion del resumen", () => {
  it("explica el DOCUMENTO, no el diagnostico", () => {
    const doc = sinComentarios(DOC);
    const i = doc.indexOf("Este es el resumen de tu valoración");
    expect(i, "la explicación del resumen desapareció").toBeGreaterThan(0);
    // El espacio se normaliza: el JSX corta la frase por donde cabe la linea, asi que en el archivo lleva
    // saltos y sangria en medio de las palabras que se buscan.
    const frase = doc.slice(i, i + 460).replace(/\s+/g, " ");
    // Dice de donde salen las cifras y como se lee lo que sigue. Lo que significan es lenguaje de
    // Gildardo (`dfiParaPaciente`), y escribirlo nosotros seria inventar contenido clinico (Regla 0).
    expect(frase).toContain("las medidas que te tomamos");
    expect(frase).toContain("pregúntaselo a quien te atendió");
  });

  it("y NO devuelve el 'no constituye diagnostico' que se retiro el 2026-09-01", () => {
    // Ese negaba lo que el bloque afirma: un documento que diagnostica y ademas declara que no diagnostica
    // deja al paciente sin saber que tiene en la mano. Esto orienta la lectura; no niega nada.
    const doc = sinComentarios(DOC);
    for (const negacion of ["no constituye diagnóstico", "no es un diagnóstico", "no reemplaza"]) {
      expect(doc.toLowerCase(), `volvió la negación "${negacion}"`).not.toContain(negacion);
    }
  });

  it("va ANTES del resumen que explica", () => {
    const doc = sinComentarios(DOC);
    const explicacion = doc.indexOf("Este es el resumen de tu valoración");
    const resumen = doc.indexOf("{dfiPac.riesgo}");
    expect(resumen).toBeGreaterThan(0);
    expect(explicacion, "la explicación quedó después de lo que explica").toBeLessThan(resumen);
  });
});
