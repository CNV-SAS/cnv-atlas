import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { claseDeEvaluacion, repartirEvaluaciones } from "@/modules/patients/clasificar-evaluaciones";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ LO QUE ESTORBA SE PLIEGA; LO PENDIENTE, NUNCA (observación L, 2026-09-20) ═══
//
// EL PEDIDO ERA "eliminar las evaluaciones ya cerradas". Borrar no es una opción: una evaluación arrastra
// diagnóstico sellado, tratamiento, reporte y auditoría, y borrarla rompe la trazabilidad de la regla 8.
//
// LO QUE DESTRABA EL PEDIDO es que **no todas las que estorban son iguales**, y esta es la parte que este
// candado protege: una evaluación ABIERTA (respondida sin medir, o medida sin diagnóstico, o un cascarón
// que el paciente todavía puede responder) **no se oculta nunca**. Esconder trabajo pendiente es perderlo,
// y es el único daño real que este cambio podría causar.

describe("cada evaluación en su clase", () => {
  it("una cerrada se retira del historial", () => {
    expect(claseDeEvaluacion({ status: "abandoned", superseded: false })).toBe("retirada");
  });

  it("una completada y una reemplazada son historia", () => {
    expect(claseDeEvaluacion({ status: "completed", superseded: false })).toBe("terminada");
    // Una reemplazada terminó su recorrido: lo vigente es la versión que la sucede.
    expect(claseDeEvaluacion({ status: "in_progress", superseded: true })).toBe("terminada");
  });

  it("y TODO lo demás está abierto: borrador, en progreso y el cascarón que espera la encuesta", () => {
    // El `awaiting_survey` cuenta como abierto A PROPÓSITO: el paciente todavía puede responder, y el
    // profesional tiene que poder verlo para perseguirlo o cerrarlo. Se vuelve retirada cuando ALGUIEN lo
    // cierra, que es un acto, no el paso del tiempo.
    for (const status of ["draft", "in_progress", "awaiting_survey"]) {
      expect(claseDeEvaluacion({ status, superseded: false }), `${status} no puede plegarse`).toBe(
        "abierta",
      );
    }
  });
});

describe("el reparto", () => {
  const evaluaciones = [
    { id: "1", status: "in_progress", superseded: false },
    { id: "2", status: "completed", superseded: false },
    { id: "3", status: "awaiting_survey", superseded: false },
    { id: "4", status: "abandoned", superseded: false },
  ];

  it("deja fuera de lo plegado todo lo que está abierto", () => {
    const { abiertas, plegadas } = repartirEvaluaciones(evaluaciones);
    expect(abiertas.map((e) => e.id)).toEqual(["1", "3"]);
    // La "2" es la UNICA completada, asi que es la ultima y se queda a la vista (regla del 2026-09-21,
    // abajo). Lo que no cambia es lo que este test protege: nada abierto termina plegado.
    expect(plegadas.map((e) => e.id)).toEqual(["4"]);
  });

  it("y conserva el orden en que venían: la cronología no se reordena al clasificar", () => {
    const { abiertas } = repartirEvaluaciones(evaluaciones);
    expect(abiertas[0].id).toBe("1");
  });
});

describe("la pantalla dice que nada se borra", () => {
  const COMPONENTE = readFileSync(
    "src/modules/patients/components/historial-evaluaciones.tsx",
    "utf8",
  );

  it("el interruptor lo explica: un ocultar sin explicar se lee como un borrar", () => {
    expect(COMPONENTE).toContain("No se borran");
  });

  it("y si TODAS son historia, no deja la tabla vacía", () => {
    // Una tabla vacía se leería como "este paciente no tiene evaluaciones" cuando tiene, y cerradas.
    expect(COMPONENTE).toContain("No hay evaluaciones en curso");
  });

  it("la clasificación no se decide en la pantalla", () => {
    // Si la pantalla decidiera qué es historia, otra superficie podría decidir distinto sobre lo mismo.
    expect(COMPONENTE).toContain("repartirEvaluaciones(evaluaciones)");
  });
});

// ═══ LA ULTIMA COMPLETADA SE QUEDA A LA VISTA (Santiago, 2026-09-21) ═══
//
// Es el punto de partida de la siguiente consulta: plegarla obligaria a abrir el interruptor en cada
// seguimiento. Las anteriores si se pliegan, y una reemplazada o una retirada nunca es la referencia.
describe("la última completada no se pliega", () => {
  const evaluaciones = [
    { id: "vieja", status: "completed", superseded: false, measurementDate: "2026-03-01" },
    { id: "abierta", status: "in_progress", superseded: false, measurementDate: "2026-09-20" },
    { id: "ultima", status: "completed", superseded: false, measurementDate: "2026-07-13" },
    { id: "reemplazada", status: "completed", superseded: true, measurementDate: "2026-08-30" },
    { id: "retirada", status: "abandoned", superseded: false, measurementDate: "2026-09-01" },
  ];

  it("a la vista: lo abierto y la completada más reciente", () => {
    const { visibles } = repartirEvaluaciones(evaluaciones);
    expect(visibles.map((e) => e.id)).toEqual(["abierta", "ultima"]);
  });

  it("las completadas anteriores, la reemplazada y la retirada se pliegan", () => {
    const { plegadas } = repartirEvaluaciones(evaluaciones);
    expect(plegadas.map((e) => e.id)).toEqual(["vieja", "reemplazada", "retirada"]);
  });

  it("una reemplazada no es la referencia aunque sea la más reciente", () => {
    // La del 30/08 es posterior a la del 13/07, pero fue reemplazada por una corrección: lo vigente es otra.
    const { visibles } = repartirEvaluaciones(evaluaciones);
    expect(visibles.map((e) => e.id)).not.toContain("reemplazada");
  });

  it("y `abiertas` sigue siendo solo el trabajo pendiente", () => {
    // La completada se ve, pero no es trabajo pendiente: quien cuente pendientes no la puede contar.
    expect(repartirEvaluaciones(evaluaciones).abiertas.map((e) => e.id)).toEqual(["abierta"]);
  });
});

describe("el chip de estado no habla el idioma del semáforo clínico", () => {
  // Verde, ámbar y rojo dicen cómo está el PACIENTE. Un estado de trabajo no dice nada de él: pintar
  // "Completada" en verde o "Abandonada" en rojo haría leer un veredicto donde hay un trámite.
  // Sin comentarios: la cabecera del componente NOMBRA los colores prohibidos para explicar por que.
  const CHIP = sinComentarios(readFileSync("src/modules/patients/components/chip-estado-evaluacion.tsx", "utf8"));

  it("no usa la escala clínica ni colores de semáforo", () => {
    expect(CHIP).not.toMatch(/clinical-|green-|emerald-|red-|rose-|amber-|yellow-|attention/);
  });

  it("y el historial lo usa en la columna de estado", () => {
    const COMPONENTE = readFileSync("src/modules/patients/components/historial-evaluaciones.tsx", "utf8");
    expect(COMPONENTE).toContain("<ChipEstadoEvaluacion status={e.status} />");
  });
});
