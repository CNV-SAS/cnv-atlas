import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { accionDeEvaluacion, pendienteDelPaciente } from "@/modules/patients/pendientes";

// LA COLUMNA DICE LA ACCION, NO EL ESTADO (Santiago, 2026-09-10).
//
// La diferencia no es de redaccion: "in_progress" obliga a traducir mentalmente que toca hacer, y esa
// traduccion es justo el trabajo que la columna existe para ahorrar.
//
// SEIS ACCIONES DISTINTAS SALEN, y solo UNA aplica por evaluacion, porque son los pasos de una secuencia.
// Por eso caben en una columna: no es una lista de casillas, es un puntero al escalon donde esta parada.

const base = {
  evaluationId: "e-1",
  status: "in_progress",
  tieneBis: true,
  tieneDiagnostico: true,
  reporte: "sent",
};

describe("cada evaluación tiene UN paso siguiente, el de su escalón", () => {
  it("sin BIS, lo que falta es montarlo", () => {
    expect(accionDeEvaluacion({ ...base, tieneBis: false, tieneDiagnostico: false })?.texto).toBe(
      "Montar BIS",
    );
  });

  it("con BIS y sin diagnóstico, generarlo", () => {
    expect(accionDeEvaluacion({ ...base, tieneDiagnostico: false })?.texto).toBe(
      "Generar diagnóstico",
    );
  });

  it("con diagnóstico y el reporte en borrador, aprobarlo y enviarlo", () => {
    expect(accionDeEvaluacion({ ...base, reporte: "draft" })?.texto).toContain("reporte");
  });

  it("y sin reporte todavía, lo mismo: el reporte es el siguiente paso", () => {
    // `null` no es un escalón distinto de `draft`: en los dos casos lo que falta es el reporte.
    expect(accionDeEvaluacion({ ...base, reporte: null })?.texto).toContain("reporte");
  });

  it("con todo hecho, cerrar la consulta", () => {
    expect(accionDeEvaluacion(base)?.texto).toBe("Cerrar la consulta");
  });

  it("y cerrada no pide nada", () => {
    // CONTROL: sin esto, "devuelve siempre una acción" también pasaría verde y la columna nunca estaría
    // vacía, que es la forma de que se aprenda a ignorarla.
    expect(accionDeEvaluacion({ ...base, status: "completed" })).toBeNull();
  });

  it("la abandonada tampoco: se abandonó a propósito", () => {
    expect(accionDeEvaluacion({ ...base, status: "abandoned" })).toBeNull();
  });
});

describe("lo que espera al PACIENTE no se le atribuye al profesional", () => {
  it("una encuesta sin responder dice que se espera al paciente", () => {
    // Escribir "Responder encuesta" en imperativo le atribuiría al profesional un trabajo que no es suyo:
    // el paciente firmó y todavía no respondió, y no hay nada que el profesional pueda pulsar. En
    // producción son 12 evaluaciones, así que no es un caso de borde.
    const a = accionDeEvaluacion({
      evaluationId: "e-1",
      status: "awaiting_survey",
      tieneBis: false,
      tieneDiagnostico: false,
      reporte: null,
    });
    expect(a?.de).toBe("paciente");
    expect(a?.texto).toBe("Esperando al paciente");
  });
});

describe("un paciente con varias evaluaciones paradas", () => {
  const sinBis = { ...base, evaluationId: "e-vieja", tieneBis: false, tieneDiagnostico: false };
  const sinCerrar = base;

  it("manda la MÁS ATRASADA, no la más reciente", () => {
    // Si una consulta se quedó sin BIS hace tres semanas y la de ayer espera el reporte, lo que hay que
    // atender primero es la vieja. El orden de la secuencia YA es el de urgencia.
    const r = pendienteDelPaciente([sinCerrar, sinBis], false);
    expect(r.principal?.texto).toBe("Montar BIS");
  });

  it("y lleva a ESA evaluación, no a la ficha: el pendiente vive en una consulta concreta", () => {
    // Sin el id, la celda puede decir "Montar BIS" y no saber a cuál de las tres consultas llevar.
    expect(pendienteDelPaciente([sinCerrar, sinBis], false).evaluationId).toBe("e-vieja");
  });

  it("pero la autorización NO lleva a una evaluación: es del paciente", () => {
    // Llevar a una consulta concreta desde ahí mandaría al sitio donde NO se arregla.
    expect(pendienteDelPaciente([sinBis], true).evaluationId).toBeNull();
  });

  it("y cuenta las demás, para que no se escondan detrás de la primera", () => {
    expect(pendienteDelPaciente([sinCerrar, sinBis], false).otras).toBe(1);
  });

  it("con una sola, no hay nada que contar", () => {
    // Un "+0" es ruido, y por eso la vista solo lo pinta cuando es mayor que cero.
    expect(pendienteDelPaciente([sinBis], false).otras).toBe(0);
  });

  it("sin nada pendiente, la celda queda vacía", () => {
    expect(pendienteDelPaciente([{ ...base, status: "completed" }], false).principal).toBeNull();
  });

  it("pero SIN NINGUNA evaluación no está al día: no ha empezado", () => {
    // EL HUECO QUE ESTO CIERRA (2026-09-10): la primera versión derivaba la acción de las evaluaciones, así
    // que un paciente registrado y nunca evaluado salía con la celda vacía. La única fila que de verdad no
    // tiene nada empezado se leía como si estuviera al día, y es la más fácil de perder: no aparece en
    // ninguna cola, porque no tiene evaluación parada en ningún escalón.
    expect(pendienteDelPaciente([], false).principal?.texto).toBe("Iniciar la primera evaluación");
  });

  it("y ahí la autorización sigue mandando: sin ella no se puede ni empezar", () => {
    expect(pendienteDelPaciente([], true).principal?.texto).toBe("Renovar autorización");
  });
});

describe("la autorización manda sobre todo, pero solo si hay algo que hacer", () => {
  it("sin autorización vigente, eso es lo primero", () => {
    // Regla dura 15: sin ella no se puede ni empezar, así que ofrecer cualquier otra acción sería un
    // callejón.
    const r = pendienteDelPaciente([{ ...base, tieneBis: false }], true);
    expect(r.principal?.texto).toBe("Renovar autorización");
  });

  it("pero a un paciente al día no se le pide renovar nada", () => {
    // No hay nada que seguir, así que no hay nada que autorizar. Sin esta guarda, media lista pediría
    // renovar autorizaciones que nadie va a usar.
    const r = pendienteDelPaciente([{ ...base, status: "completed" }], true);
    expect(r.principal).toBeNull();
  });
});

describe("la columna sale del mismo sitio que la regla", () => {
  it("la vista no recalcula: pinta lo que el lector le da", () => {
    // Dos fuentes del mismo dato sin nada que las compare es como la lista acaba diciendo una cosa y la
    // ficha otra.
    const VISTA = readFileSync("src/modules/patients/components/lista-pacientes.tsx", "utf8");
    expect(VISTA).toContain("p.pendiente.principal");
    expect(VISTA, "la vista empezó a decidir qué falta").not.toContain("tieneBis");
  });

  it("y el lector lo trae en la MISMA consulta, sin una por paciente", () => {
    // Una consulta por fila sobre 73 pacientes es como una lista deja de abrirse.
    const READER = readFileSync("src/modules/patients/data/patients-list-reader.ts", "utf8");
    expect(READER).toContain("diagnoses(id), reports(status)");
  });
});
