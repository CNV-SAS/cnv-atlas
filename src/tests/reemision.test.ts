import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { EngineOutput } from "@/clinical-engine";
import { avisarAlPaciente, veredictoDeReemision } from "@/modules/clinical-pipeline/reemision";

// CANDADO DE LA REEMISION OBLIGATORIA (§12b/§12c, 2026-08-28).
//
// Su regla, textual: "Reemision obligatoria cuando el cambio es de calibracion poblacional y el paciente
// CAMBIA DE BANDA. Si el numero se mueve pero la clasificacion no, se marca en la historia y no se
// reemite. EL CRITERIO ES EL RESULTADO, NO EL TIPO DE CAMBIO".
//
// El caso que mas importa de todos es el TERCERO de aqui abajo: el numero se mueve y la banda no. Es el
// que separa su regla de la que uno escribiria por instinto (reemitir siempre que cambie la ciencia), y
// es el que evita alarmar a un paciente por un decimal.

const base = (over: Partial<EngineOutput> = {}): EngineOutput =>
  ({
    sexo: "M",
    indicators: { ifc: 4.1, irc: 1.9 },
    classifications: { IFC: { label: "Bajo" }, IRC: { label: "Normal" } },
    dfi: {
      complete: true,
      riesgo: { nivel: "moderado", score: 50, descripcion: "" },
      domains: [
        { id: "d1", nombre: "Celular-Eléctrico", sev: 2, clasif: "", lectura: "", items: [] },
        { id: "d2", nombre: "Metabólico-Estructural", sev: 1, clasif: "", lectura: "", items: [] },
      ],
    },
    ...over,
  }) as unknown as EngineOutput;

describe("§12b · la reemisión es obligatoria solo si cambia la BANDA", () => {
  it("sin desfase de versión, no hay nada que decidir", () => {
    expect(veredictoDeReemision(base(), base(), false)).toEqual({ kind: "al-dia" });
  });

  it("cambia una clasificación de indicador: OBLIGATORIA, y dice cuál", () => {
    const hoy = base({
      classifications: { IFC: { label: "Normal" }, IRC: { label: "Normal" } },
    });
    const v = veredictoDeReemision(base(), hoy, true);
    expect(v.kind).toBe("reemision-obligatoria");
    if (v.kind !== "reemision-obligatoria") return;
    expect(v.cambios).toEqual([{ que: "IFC", antes: "Bajo", ahora: "Normal" }]);
  });

  it("EL CASO QUE SEPARA SU REGLA: el número se mueve y la banda no, solo se marca", () => {
    // "Si el numero se mueve pero la clasificacion no, se marca en la historia y no se reemite." Sin este
    // caso, cualquier recalibracion obligaria a reemitir a todo el mundo, que es justo lo que el excluye.
    const hoy = base({ indicators: { ifc: 4.13, irc: 1.94 } as unknown as EngineOutput["indicators"] });
    expect(veredictoDeReemision(base(), hoy, true)).toEqual({ kind: "solo-marcar" });
  });

  it("cambia el riesgo integrado del DFI: OBLIGATORIA", () => {
    const hoy = base({
      dfi: { ...base().dfi, riesgo: { nivel: "alto", score: 80, descripcion: "" } },
    } as Partial<EngineOutput>);
    const v = veredictoDeReemision(base(), hoy, true);
    expect(v.kind).toBe("reemision-obligatoria");
    if (v.kind !== "reemision-obligatoria") return;
    expect(v.cambios[0]).toEqual({
      que: "Riesgo integrado (DFI)",
      antes: "moderado",
      ahora: "alto",
    });
  });

  it("cambia la severidad de un dominio: OBLIGATORIA, con el nombre del dominio", () => {
    // El radar es lo primero que mira el profesional: un dominio que pasa de Leve a Moderado cambia la
    // figura, no solo una cifra de una tabla.
    const d = base().dfi.domains;
    const hoy = base({
      dfi: { ...base().dfi, domains: [d[0], { ...d[1], sev: 2 }] },
    } as Partial<EngineOutput>);
    const v = veredictoDeReemision(base(), hoy, true);
    expect(v.kind).toBe("reemision-obligatoria");
    if (v.kind !== "reemision-obligatoria") return;
    expect(v.cambios).toEqual([
      { que: "Metabólico-Estructural", antes: "Leve", ahora: "Moderado" },
    ]);
  });

  it("un indicador que DEJA de emitirse también es cambio de banda", () => {
    // Lo aprendimos con el ISCM (su punto 4): dejar de emitir un índice cambia lo que el profesional lee,
    // así que no puede pasar por "solo un número que se movió".
    const hoy = base({ classifications: { IRC: { label: "Normal" } } });
    const v = veredictoDeReemision(base(), hoy, true);
    expect(v.kind).toBe("reemision-obligatoria");
    if (v.kind !== "reemision-obligatoria") return;
    expect(v.cambios).toEqual([{ que: "IFC", antes: "Bajo", ahora: "sin dato" }]);
  });

  it("sin recomputar NO se afirma que esté al día: cae a marcar", () => {
    // Afirmar "al día" sin haber comparado sería inventar el dato que estas reglas existen para evitar.
    expect(veredictoDeReemision(base(), null, true)).toEqual({ kind: "solo-marcar" });
  });
});

describe("§12c · a quién se avisa", () => {
  it("al paciente NO se le avisa si solo se marca", () => {
    // "No se alarma a nadie por un decimal."
    expect(avisarAlPaciente({ kind: "solo-marcar" }, false)).toBe(false);
    expect(avisarAlPaciente({ kind: "al-dia" }, false)).toBe(false);
  });

  it("sí se le avisa si cambió su clasificación", () => {
    expect(
      avisarAlPaciente(
        { kind: "reemision-obligatoria", cambios: [{ que: "IFC", antes: "Bajo", ahora: "Normal" }] },
        false,
      ),
    ).toBe(true);
  });

  it("y SIEMPRE si se reemitió el tratamiento, aunque no cambie ninguna banda", () => {
    // Su razón, y es la que manda sobre el resto de la regla: "porque cambia lo que la persona come".
    expect(avisarAlPaciente({ kind: "solo-marcar" }, true)).toBe(true);
    expect(avisarAlPaciente({ kind: "al-dia" }, true)).toBe(true);
  });
});

// Los assert sobre CODIGO quitan los comentarios primero. Este archivo ya se puso rojo por eso: la
// aserción "no usa clinical-critical" disparaba contra el comentario que DOCUMENTA esa misma regla. Un
// candado que caza su propia documentación es ruido, y el ruido es como mueren los candados.
const soloCodigo = (src: string): string =>
  src
    .split("\n")
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join("\n");

describe("el cableado: el aviso escala, y solo se recomputa si hace falta", () => {
  it("el aviso muestra la reemisión obligatoria con su propio registro visual", () => {
    const AVISO = readFileSync(
      "src/modules/clinical-pipeline/components/aviso-ciencia-anterior.tsx",
      "utf8",
    );
    expect(AVISO).toContain("Reemisión obligatoria");
    // NO usa la capa clínica: el riesgo no es del paciente, es del documento. Va con `attention`, que es
    // el eje OPERATIVO, y esa separación es justo para lo que se creó ese token.
    expect(AVISO).toContain("border-attention");
    expect(soloCodigo(AVISO)).not.toContain("clinical-critical");
  });

  it("y cuando NO cambia de banda lo dice, en vez de dejar la pregunta abierta", () => {
    // Su §12b: "se marca en la historia y no se reemite". Un aviso que informa del desfase sin cerrar la
    // pregunta empuja al profesional a reemitir por las dudas, que es el efecto contrario al que él pide.
    const AVISO = readFileSync("src/modules/clinical-pipeline/components/aviso-ciencia-anterior.tsx", "utf8");
    expect(AVISO).toContain("no cambia");
    expect(AVISO).toContain("no hace falta reemitir");
  });

  it("solo se recomputa cuando hay desfase: al día no gasta el motor", () => {
    const READER = readFileSync("src/modules/diagnoses/data/results-reader.ts", "utf8");
    expect(READER).toContain("vigencia.alDia ? null : await simularConCienciaDeHoy(evaluationId)");
  });

  it("la simulación NO escribe: recalcular en silencio borraría el rastro", () => {
    // Es la otra mitad de su misma instrucción sobre el LE8: "recalcular, y que quede anotado... recalcular
    // en silencio borra el rastro". Esto solo MIRA para poder avisar; reemitir sigue siendo un acto del
    // profesional. Si algún día alguien mete un insert/update aquí, el documento emitido cambiaría solo.
    const SIM = readFileSync(
      "src/modules/clinical-pipeline/data/simular-con-ciencia-de-hoy.ts",
      "utf8",
    );
    for (const escritura of ["insert(", "update(", "delete(", "db.transaction"]) {
      expect(SIM, `la simulación no puede escribir: encontrado ${escritura}`).not.toContain(escritura);
    }
  });
});
