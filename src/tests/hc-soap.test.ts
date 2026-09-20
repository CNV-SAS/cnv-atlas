import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  preguntaComoEtiqueta,
  redactarDominio,
  redactarEncuesta,
} from "@/modules/reports/services/encuesta-redactada";
import { soapATexto } from "@/modules/reports/services/soap-a-texto";
import type { HistoriaClinicaSoap } from "@/modules/reports/data/reports-view-types";
import type { SurveyDomain } from "@/modules/evaluations/data/survey-answers-types";

// ═══ LA HISTORIA CLINICA EN SOAP (plan aprobado, 2026-09-20) ═══
//
// LO QUE ESTE CANDADO PROTEGE es lo que hizo elegir la forma B frente a una narrativa escrita por nosotros
// o por una IA: **cada frase del documento es trazable a una respuesta concreta del paciente**. Si el
// redactor empezara a interpretar, resumir o rellenar, esa propiedad se pierde en silencio y el documento
// dejaría de ser lo que se aprobó.

type PreguntaDePrueba = Partial<Omit<SurveyDomain["questions"][number], "answerValue">> & {
  answerValue?: unknown;
};

const dominio = (preguntas: PreguntaDePrueba[]): SurveyDomain =>
  ({
    section: "D4 · Conductas alimentarias",
    questions: preguntas.map((q, i) => ({
      number: i + 1,
      questionId: `q${i}`,
      questionText: "¿Cuántas comidas consume al día?",
      hint: null,
      questionType: "contador",
      fieldKey: `d4_${i}`,
      usedInDiagnosis: true,
      answerValue: null,
      options: [],
      ...q,
    })),
  }) as unknown as SurveyDomain;

describe("la encuesta redactada", () => {
  it("cada frase lleva SU pregunta y SU respuesta", () => {
    // Es la propiedad que sostiene toda la decisión: "3" no dice nada y no se puede auditar; "cuántas
    // comidas consume al día: 3" sí, y deja ver de dónde salió.
    const { texto } = redactarDominio(
      dominio([{ questionText: "¿Cuántas comidas consume al día?", answerValue: 3 }]),
    );
    expect(texto).toContain("cuántas comidas consume al día: 3");
  });

  it("no inventa nada: lo que no se respondió se DICE, con su número", () => {
    // En un documento probatorio una ausencia silenciosa se lee como que no se preguntó.
    const { texto, sinResponder } = redactarDominio(
      dominio([
        { questionText: "¿Fuma?", answerValue: "No" },
        { questionText: "¿Consume alcohol?", answerValue: null },
      ]),
    );
    expect(sinResponder).toBe(1);
    expect(texto).toContain("Quedó sin responder la pregunta 2");
  });

  it('"Otra" pelada es un hueco, no una respuesta', () => {
    // Mismo criterio que el gate de completitud, que ya tuvo cuatro sitios contando distinto.
    const { sinResponder } = redactarDominio(dominio([{ answerValue: "Otra" }]));
    expect(sinResponder).toBe(1);
  });

  it("una respuesta múltiple se enhebra sin perder ninguna", () => {
    const { texto } = redactarDominio(
      dominio([{ questionText: "¿Qué frutas consume?", answerValue: ["Manzana", "Banano"] }]),
    );
    expect(texto).toContain("Manzana, Banano");
  });

  it("la pregunta entra como etiqueta, sin reescribirla", () => {
    // Se le quitan los signos y baja la inicial para que encaje en la oración. El TEXTO no se toca: es
    // contenido de la encuesta, y cambiarlo aquí sería decir que se preguntó otra cosa.
    expect(preguntaComoEtiqueta("¿Cuántas comidas consume al día?")).toBe(
      "cuántas comidas consume al día",
    );
    expect(preguntaComoEtiqueta("Peso habitual")).toBe("peso habitual");
  });

  it("un dominio sin nada que contar no ensucia el documento", () => {
    expect(redactarEncuesta([dominio([])])).toEqual([]);
  });
});

describe("el texto que se copia dice lo mismo que la pantalla", () => {
  const soap: HistoriaClinicaSoap = {
    paciente: "Ana Pérez",
    edad: 41,
    sexo: "Femenino",
    fechaConsulta: "2026-09-20T12:00:00Z",
    profesional: "Profesional Demo",
    subjetivo: {
      motivos: ["Control de peso"],
      antecedentes: [{ grupo: "Personales", items: ["Hipertensión"] }],
      encuesta: [{ dominio: "D4 · Conductas alimentarias", texto: "Refiere 3 comidas al día.", sinResponder: 0 }],
    },
    objetivo: { pesoKg: 70, tallaCm: 165, composicion: [], indices: [] },
    analisis: {
      resumenProfesional: "Paciente estable.",
      dfiParrafo: null,
      metaTerapeutica: null,
      motivoSinNarrativa: null,
      rutas: [],
    },
    plan: {
      objetivoModelo: "Dieta normocalórica de 1800 kcal/día",
      objetivoTratamiento: null,
      nutricional: null,
      recomendaciones: [],
      remisionesExigidas: [],
      remisiones: [],
      observaciones: [],
      proximaCita: "2026-12-01",
    },
    prescripcionSinEmitir: true,
  };

  const texto = soapATexto(soap, "20/09/2026");

  it("lleva los cuatro apartados, rotulados", () => {
    for (const apartado of ["S · SUBJETIVO", "O · OBJETIVO", "A · ANÁLISIS", "P · PLAN"]) {
      expect(texto).toContain(apartado);
    }
  });

  it("y la cabecera: de quién es, quién firma y de cuándo", () => {
    // Lo copiado se pega FUERA de Atlas, donde no hay pantalla que lo diga.
    expect(texto).toContain("Ana Pérez");
    expect(texto).toContain("Profesional Demo");
    expect(texto).toContain("20/09/2026");
  });

  it("el aviso de las cifras vivas viaja con lo copiado", () => {
    // En la pantalla es un recuadro; al pegarlo en otro sistema, el recuadro no va. La advertencia sí.
    expect(texto).toContain("todavía no tiene una emisión registrada");
  });
});

describe("el SOAP no es una segunda construcción de la historia clínica", () => {
  const LECTOR = readFileSync("src/modules/reports/data/hc-soap-reader.ts", "utf8");

  it("compone desde el documento de la HC, no consultando por su cuenta", () => {
    // Dos formas de armar el mismo insumo es como se termina con dos verdades sobre la misma consulta.
    expect(LECTOR).toContain("getHistoriaClinicaDoc(");
    expect(LECTOR, "el SOAP no puede consultar la base por su cuenta").not.toContain(
      "createSupabaseServerClient",
    );
  });

  it("y NO lleva alertas ni semáforo: esa mitad espera a Gildardo", () => {
    for (const prohibido of ["alerta", "semaforo", "semáforo"]) {
      expect(LECTOR.toLowerCase()).not.toContain(`${prohibido}s(`);
    }
    const COMPONENTE = readFileSync("src/modules/reports/components/hc-soap.tsx", "utf8");
    expect(COMPONENTE).not.toContain("Alertas");
  });
});


describe("la anamnesis del profesional (apartado S)", () => {
  const WRITER = readFileSync("src/modules/reports/data/soap-notas-writer.ts", "utf8");
  const COMPONENTE = readFileSync("src/modules/reports/components/hc-soap.tsx", "utf8");
  const MIGRACION = readFileSync("drizzle/0150_nota_subjetiva_soap.sql", "utf8");

  it("lo escrito a mano NO se mezcla con lo generado", () => {
    // Es la condición con la que se aprobó redactar la encuesta: cada frase generada es trazable a una
    // respuesta, y si el texto libre se intercalara, esa propiedad se perdería.
    expect(COMPONENTE).toContain("Anamnesis del profesional");
    expect(COMPONENTE).toContain("<NotasSubjetivas");
  });

  it("y lo generado NO se puede editar", () => {
    // En otros sistemas editar la narrativa autogenerada es lo normal, porque allí es una TRANSCRIPCIÓN.
    // Aquí cada frase sale de una respuesta que el paciente marcó: editarla sería cambiar lo que
    // respondió. Si el profesional no está de acuerdo, lo dice en su bloque.
    expect(COMPONENTE, "apareció una vía para editar el texto generado").not.toContain("editarEncuesta");
    expect(COMPONENTE).not.toContain("defaultValue={p.texto}");
  });

  it("es append-only, y lo impone la BASE, no el código", () => {
    expect(MIGRACION).toContain("prevent_soap_note_mutation");
    expect(MIGRACION).toContain("before update or delete");
  });

  it("la anamnesis ABRE el apartado S, antes del motivo y de la encuesta", () => {
    // La razón la dio quien la escribe: la integrante redacta "paciente viene a consulta presencial...",
    // que abre el relato. Debajo de la encuesta, ese arranque queda donde no se lee.
    const s = COMPONENTE.slice(COMPONENTE.indexOf('<Apartado letra="S"'));
    const anamnesis = s.indexOf("<NotasSubjetivas");
    const motivo = s.indexOf("soap.subjetivo.motivos.length");
    const encuesta = s.indexOf("soap.subjetivo.encuesta.map");
    expect(anamnesis).toBeGreaterThan(-1);
    expect(anamnesis, "la anamnesis quedó después del motivo").toBeLessThan(motivo);
    expect(anamnesis, "la anamnesis quedó después de la encuesta").toBeLessThan(encuesta);
  });

  it("solo la VIGENTE va en el documento; las anteriores quedan plegadas", () => {
    // Dos versiones de lo mismo en un documento clínico dicen que el profesional sostiene las dos.
    expect(COMPONENTE).toContain("const vigente = notas.length > 0 ? notas[notas.length - 1] : null;");
    expect(COMPONENTE).toContain("Reemplaza a");
    expect(COMPONENTE).toContain("<details");
  });

  it("y lo COPIADO la incluye: copiar y el documento no pueden decir cosas distintas", () => {
    // Fue un defecto real del smoke: el botón copiaba un SOAP sin la anamnesis recién escrita.
    expect(COMPONENTE).toContain("soapATexto(soap, fecha, vigenteParaCopiar)");
    const TEXTO = readFileSync("src/modules/reports/services/soap-a-texto.ts", "utf8");
    expect(TEXTO).toContain("anamnesis");
    expect(TEXTO).toContain("Anamnesis (");
  });

  it("cada nota dice quién y cuándo, con la profesión sellada en el acto", () => {
    expect(WRITER).toContain("authorProfession: input.profesion");
    expect(COMPONENTE).toContain("{n.autor}");
  });

  it("el rastro va inline y SIN el texto de la nota", () => {
    // El contenido clínico ya vive en su tabla, que el profesional sí puede leer; duplicarlo en el audit
    // (admin-only) multiplicaría copias de PHI sin ganar nada.
    expect(WRITER).toContain('event: "soap.subjective_note_added"');
    expect(WRITER).toContain("recordAudit(tx");
    expect(WRITER, "el texto de la nota no va al audit").not.toContain("nota: input.nota");
  });

  it("vive en su propia tabla: la historia clínica no tiene que filtrar por clase de nota", () => {
    // Con una columna en treatment_notes, un filtro que faltara dejaría notas de un apartado saliendo en
    // el bloque del otro, que en un documento clínico es un error de atribución.
    expect(MIGRACION).toContain("create table if not exists soap_subjective_notes");
    // La migración NOMBRA treatment_notes en su comentario (explica por qué no se usó); lo que no puede
    // es TOCARLA. Se mira el SQL, no la prosa: el detector que cazó su propia documentación ya nos pasó.
    const sqlSolo = MIGRACION.split("\n")
      .filter((l) => !l.trimStart().startsWith("--"))
      .join(" ");
    // Se miran las SENTENCIAS y no la palabra: la migracion NOMBRA treatment_notes para explicar por
    // que no se uso, y un detector que cazara la prosa cazaria su propia documentacion (ya nos paso).
    for (const toque of ["alter table treatment_notes", "update treatment_notes", "drop table treatment_notes"]) {
      expect(sqlSolo.toLowerCase(), "la migracion no puede tocar treatment_notes: " + toque).not.toContain(toque);
    }
  });
});
