import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  type EstadoConsulta,
  imposiblesDeLaConsulta,
  pendientesDeLaConsulta,
} from "@/modules/reports/data/cierre-pendientes";

// CANDADO DEL CIERRE DE LA CONSULTA (2026-08-24). Lo que se blinda son las TRES categorias, porque una
// lista que mezcla lo accionable con lo que no se puede hacer todavia obliga al profesional a averiguar
// cual es cual, y entonces no la lee. Y el TONO: la lista informa, no reprocha.

const completa: EstadoConsulta = {
  encuestaCompleta: true,
  diagnosticoConfirmado: true,
  protocoloComputado: true,
  protocoloAprobado: true,
  reporteEstado: "sent",
  nutraceuticosDecision: "si",
  proximaCita: "2026-11-22",
  remisionesSinRetorno: 0,
};
const con = (o: Partial<EstadoConsulta>) => pendientesDeLaConsulta({ ...completa, ...o });
const ids = (o: Partial<EstadoConsulta>) => con(o).map((p) => p.id);

describe("pendientes del cierre", () => {
  it("una consulta completa no deja nada pendiente", () => {
    expect(pendientesDeLaConsulta(completa)).toEqual([]);
  });

  it("ACCIONABLE: va en la lista con su etapa para ir a resolverlo", () => {
    const p = con({ diagnosticoConfirmado: false }).find((x) => x.id === "diagnostico");
    expect(p?.etapa).toBe("diagnostico");
    expect(p?.bloqueadoPor).toBeNull();
  });

  it("BLOQUEADO POR OTRA COSA: va en la lista, SIN enlace, diciendo qué lo desbloquea", () => {
    // El tratamiento sin aprobar con el diagnostico sin confirmar: no se puede hacer hoy, pero va a poder.
    const p = con({ diagnosticoConfirmado: false, protocoloAprobado: false }).find((x) => x.id === "protocolo");
    expect(p?.etapa).toBeNull();
    expect(p?.bloqueadoPor).toBe("confirmar el diagnóstico");
  });

  it("el MISMO pendiente pasa a accionable cuando se desbloquea", () => {
    const p = con({ protocoloAprobado: false }).find((x) => x.id === "protocolo");
    expect(p?.etapa).toBe("tratamiento");
    expect(p?.bloqueadoPor).toBeNull();
  });

  it("NO ACCIONABLE NUNCA: un protocolo que jamás se computó NO aparece", () => {
    // Misma condicion con la que el sistema ya rechaza el acto ("No se puede aprobar un protocolo que
    // nunca se computo"). Listarlo seria pedir algo que el propio sistema prohibe, para siempre.
    expect(ids({ protocoloComputado: false, protocoloAprobado: false })).not.toContain("protocolo");
    expect(imposiblesDeLaConsulta({ ...completa, protocoloComputado: false })).toContain("protocolo");
  });

  it("NO ACCIONABLE NUNCA: una evaluación sin reporte tampoco lo pide", () => {
    expect(ids({ reporteEstado: null })).not.toContain("reporte");
  });

  it("la remisión sin retorno se marca como ajena a esta consulta", () => {
    const p = con({ remisionesSinRetorno: 2 }).find((x) => x.id === "remisiones");
    expect(p?.titulo).toContain("2 remisiones");
    expect(p?.bloqueadoPor).toBe("que el paciente vuelva de la remisión");
  });

  it("'pendiente' de nutracéuticos se lee como decisión válida, no como olvido", () => {
    const p = con({ nutraceuticosDecision: "pendiente" }).find((x) => x.id === "nutraceuticos");
    expect(p?.detalle).toContain("Es una respuesta válida");
  });

  it("NINGÚN texto de la lista regaña: sin 'falta', sin 'debes', sin 'no hiciste'", () => {
    // El profesional puede cerrar con pendientes a proposito; la lista es informacion, no reproche.
    const todos = pendientesDeLaConsulta({
      encuestaCompleta: false,
      diagnosticoConfirmado: false,
      protocoloComputado: true,
      protocoloAprobado: false,
      reporteEstado: "draft",
      nutraceuticosDecision: null,
      proximaCita: null,
      remisionesSinRetorno: 1,
    });
    expect(todos.length).toBeGreaterThan(4);
    for (const p of todos) {
      const texto = `${p.titulo} ${p.detalle}`.toLowerCase();
      for (const palabra of ["debes", "deberías", "no hiciste", "olvidaste", "error"]) {
        expect(texto, `"${p.titulo}" usa "${palabra}"`).not.toContain(palabra);
      }
    }
  });
});

const WRITER = readFileSync("src/modules/evaluations/data/evaluations-writer.ts", "utf8");
const UI = readFileSync("src/modules/reports/components/cierre-consulta.tsx", "utf8");

describe("el acto de cerrar", () => {
  it("registra QUIEN y CUANDO, como cualquier acto clínico", () => {
    const fn = WRITER.slice(WRITER.indexOf("export async function closeEvaluation"));
    expect(fn).toContain("closedAt");
    expect(fn).toContain("closedBy: input.actorId");
    expect(fn).toContain('event: "evaluation.closed"');
  });

  it("es REVERSIBLE: cerrar no puede ser una puerta que se traba", () => {
    // in_progress es lo que habilita importar un BIS, correr el pipeline y editar la encuesta.
    const fn = WRITER.slice(WRITER.indexOf("export async function reopenEvaluation"));
    expect(fn).toContain('status: "in_progress"');
    expect(fn).toContain('event: "evaluation.reopened"');
  });

  it("reabrir NO deshace ningún sello clínico", () => {
    const fn = WRITER.slice(WRITER.indexOf("export async function reopenEvaluation"));
    for (const sello of ["diagnos", "protocol", "report"]) {
      expect(fn.toLowerCase(), `reopenEvaluation no debe tocar ${sello}`).not.toContain(sello);
    }
  });

  it("el botón de cerrar NO se deshabilita por tener pendientes", () => {
    // Cerrar con pendientes es una decision legitima del profesional.
    expect(UI).toContain("disabled={closing}");
    expect(UI).not.toMatch(/disabled=\{[^}]*pendientes[^}]*\}/);
  });
});
