import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  avisoDeApoyoAnterior,
  LO_QUE_DEPENDE_DE_LA_EB_BIS,
  LO_QUE_NO_DEPENDE_DE_LA_EB_BIS,
  seApoyaEnUnDiagnosticoAnterior,
} from "@/modules/treatment/apoyado-en-diagnostico-anterior";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO DE LA REEMISION DEL DIAGNOSTICO (recalibracion_ciencia)
//
// ═══ QUE ES LO QUE DE VERDAD HAY QUE VIGILAR ═══
//
// Este flujo existe porque el OTRO camino hacia daño: `correctEvaluation` crea una evaluacion nueva y le
// corre el pipeline entero, asi que el tratamiento nace otra vez con la sugerencia del MODELO. Correrlo
// sobre las evaluaciones limpias habria reemplazado la prescripcion de 351 pacientes reales.
//
// Asi que lo que este candado defiende NO es que la reemision funcione: es que NO TOQUE lo que no debe.
// Si alguien, buscando "completar" la reemision, le añade el tratamiento o el reenvio del informe, el
// defecto vuelve entero y sin aviso.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const SERVICIO = sinComentarios(
  readFileSync("src/modules/clinical-pipeline/services/reemitir-diagnostico.ts", "utf8"),
);

describe("la reemision NO toca lo que no debe", () => {
  it("no escribe en treatments, ni en protocol_suggested, ni en followups", () => {
    // Es la razon de ser de este flujo. Un `insert(treatments)` aqui reintroduce el daño que se evito.
    for (const prohibido of ["treatments", "protocolSuggested", "followups", "writePipeline"]) {
      expect(SERVICIO, `la reemision escribe en ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("no modifica ni reenvia el informe ENVIADO: solo INSERTA uno nuevo en borrador", () => {
    // Su §6: "los informes ya entregados a pacientes no se modifican; los nuevos informes se emiten con
    // la v7". El enviado es una fila anterior y se queda con su `sent_at` y su PDF.
    expect(SERVICIO).toContain("insert(reports)");
    expect(SERVICIO).toContain('status: "draft"');
    expect(SERVICIO, "la reemision actualiza reportes existentes").not.toMatch(/update\(reports\)/);
    expect(SERVICIO, "la reemision reenvia correos").not.toMatch(/sendReport|sendReportEmail/);
  });

  it("y NO borra ni marca el diagnostico anterior: lo sellado no se toca (regla 7)", () => {
    expect(SERVICIO, "la reemision modifica el diagnostico anterior").not.toMatch(
      /update\(diagnoses\)|delete\(diagnoses\)/,
    );
  });
});

describe("lo vigente se DERIVA de la ultima fila, que es el mecanismo de la casa", () => {
  it("el servicio INSERTA y lee el anterior por created_at desc", () => {
    expect(SERVICIO).toContain("insert(diagnoses)");
    expect(SERVICIO).toContain("desc(diagnoses.createdAt)");
  });

  it("y los dos lectores de la pantalla ya ordenan igual: si uno deja de hacerlo, se ve la v5", () => {
    // ESTE ES EL CANDADO QUE SOSTIENE TODO EL DISEÑO. No hay columna de `superseded`: lo vigente es la
    // ultima fila. Si alguien quita el `order` de cualquiera de los dos lectores, la pantalla puede
    // mostrar el diagnostico viejo sin que nada falle, que es la leccion de "paginar sin order by no
    // define que trae cada pagina".
    const repo = readFileSync("src/modules/reports/data/reports-repository.ts", "utf8");
    const resultados = readFileSync("src/modules/diagnoses/data/results-reader.ts", "utf8");
    for (const [que, fuente] of [
      ["reports-repository", repo],
      ["results-reader", resultados],
    ] as const) {
      expect(fuente, `${que} dejo de ordenar por created_at`).toContain(
        'order("created_at", { ascending: false })',
      );
    }
    expect(resultados, "results-reader dejo de ordenar los diagnosticos").toContain(
      '.from("diagnoses")',
    );
  });
});

describe("el guard: sin desfase de version no hay nada que reemitir", () => {
  it("se exige desfase, no un cambio de insumo", () => {
    // Es el analogo del guard de la correccion en el eje correcto: en una recalibracion los insumos no
    // cambian nunca (eso ES una recalibracion), asi que exigir un cambio de insumo la bloquearia
    // siempre. Sin este guard, cada corrida duplicaria el historial sin mover una cifra.
    expect(SERVICIO).toContain("vigencia.alDia");
    expect(SERVICIO).toContain("no hay nada que reemitir");
  });

  it("y se mide sobre el MISMO sellado que mira la pantalla", () => {
    // Si el guard leyera otra fuente, podria reemitir un documento que la pantalla muestra al dia, o
    // negarse sobre uno que la pantalla marca desfasado: dos partes diciendo cosas opuestas del mismo
    // hecho, que es el hazard 4.
    expect(SERVICIO).toContain("getDiagnosisEmissionVersions(");
    expect(SERVICIO).toContain("vigenciaEmision(");
  });

  it("si no se puede recalcular, NO se sella un diagnostico a medias", () => {
    expect(SERVICIO).toContain("simularConCienciaDeHoy(");
    expect(SERVICIO).toContain("faltan insumos");
  });

  it("reusa la MISMA simulacion que alimenta el aviso en pantalla", () => {
    // Reemitir por otra ruta de calculo dejaria que el preview y lo que se persiste discrepen.
    const resultados = readFileSync("src/modules/diagnoses/data/results-reader.ts", "utf8");
    expect(resultados).toContain("simularConCienciaDeHoy(");
  });
});

describe("el rastro (pregunta (c) de Santiago)", () => {
  it("se audita INLINE, nunca por el bus (regla dura 8)", () => {
    expect(SERVICIO).toContain("recordAudit(tx, {");
    expect(SERVICIO).toContain('event: "diagnosis.reemitted"');
  });

  it("y el payload dice el motivo, las DOS versiones, y QUE NO SE TOCO", () => {
    // Lo que no se toco va dicho EXPLICITAMENTE y no por omision: dentro de un año, "el tratamiento no
    // aparece en el payload" no distingue entre "no se toco" y "nadie lo registro".
    for (const clave of [
      "motivo: input.motivo",
      "engine_version_anterior",
      "engine_version_nueva",
      "tratamiento_no_modificado: true",
      "informe_enviado_no_modificado: true",
      "depende_de_la_eb_bis",
    ]) {
      expect(SERVICIO, `el rastro no registra ${clave}`).toContain(clave);
    }
  });

  it("la constelacion de versiones se sella COMPLETA en el diagnostico nuevo (regla 7)", () => {
    // Un diagnostico reemitido es un registro clinico como cualquier otro: tiene que poder
    // reconstruirse solo, sin mirar al anterior.
    for (const campo of [
      "engineVersion:",
      "modelVersionId:",
      "rulesVersion:",
      "surveyVersionId:",
      "emissionVersions: buildEmissionVersions()",
    ]) {
      expect(SERVICIO, `falta ${campo} en el diagnostico reemitido`).toContain(campo);
    }
  });

  it("la firma es de quien REEMITE, no se hereda del profesional que atendio", () => {
    // Heredarla le atribuiria a un profesional un acto de hoy que no hizo.
    expect(SERVICIO).toContain("confirmedBy: input.actorId");
  });
});

describe("la marca del tratamiento: derivada, sin columna", () => {
  it("se apoya en el anterior cuando su diagnostico no es el vigente", () => {
    expect(
      seApoyaEnUnDiagnosticoAnterior({ diagnosisIdDelTratamiento: "a", diagnosisIdVigente: "b" }),
    ).toBe(true);
    expect(
      seApoyaEnUnDiagnosticoAnterior({ diagnosisIdDelTratamiento: "a", diagnosisIdVigente: "a" }),
    ).toBe(false);
  });

  it("y NO hay columna ni bandera que acordarse de apagar", () => {
    // Misma leccion que el aviso de medicion repetida: una marca de "ya lo revise" habria que acordarse
    // de quitarla, y entonces sobreviviria al arreglo o moriria antes.
    const fuente = sinComentarios(
      readFileSync("src/modules/treatment/apoyado-en-diagnostico-anterior.ts", "utf8"),
    );
    for (const prohibido of ["apoyado_en_anterior", "revisado", "UPDATE", "insert"]) {
      expect(fuente, `aparecio ${prohibido}`).not.toContain(prohibido);
    }
  });

  it("el aviso dice que NO hay que rehacer nada, que es la mitad que importa", () => {
    // Un aviso que solo dice "esto se apoya en una cifra anterior" se lee como "rehazlo", y rehacerlo es
    // exactamente lo que no se debe hacer: reemplazaria la prescripcion del profesional por la del motor.
    const texto = avisoDeApoyoAnterior();
    expect(texto).toContain("No tienes que rehacer nada");
    expect(texto).toContain("se conserva tal cual");
  });

  it("y nombra lo que SI y lo que NO depende de la cifra", () => {
    const texto = avisoDeApoyoAnterior();
    for (const x of LO_QUE_DEPENDE_DE_LA_EB_BIS) expect(texto).toContain(x);
    for (const x of LO_QUE_NO_DEPENDE_DE_LA_EB_BIS) expect(texto).toContain(x);
  });

  it("CONTROL: los cuatro motores de tratamiento siguen SIN leer el IAE", () => {
    // ES LA AFIRMACION QUE SOSTIENE "no hay que rehacer nada". Si alguno empezara a leer el IAE, la
    // prescripcion SI dependeria de la cifra vieja y esta decision habria que revisarla entera.
    for (const motor of [
      "atlas-geb.js",
      "atlas-tratamiento.js",
      "atlas-tratamiento-nutri.js",
      "atlas-asesoria-macro.js",
    ]) {
      const fuente = readFileSync(`src/clinical-engine/frozen/${motor}`, "utf8");
      expect(fuente, `${motor} empezo a leer el IAE: revisar la decision de no rehacer`).not.toMatch(
        /\biae\b/i,
      );
    }
  });
});
