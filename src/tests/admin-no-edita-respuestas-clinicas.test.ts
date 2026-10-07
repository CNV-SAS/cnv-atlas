import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ LA AUSENCIA DELIBERADA: ADMIN NO EDITA RESPUESTAS CLINICAS (2026-10-07) ═══
//
// EL CASO: Santiago, como admin, intento reponer tres textos de la pregunta 35 que un defecto habia borrado,
// y le salio "No estás asignado a este paciente.". El guard es correcto. Lo que fallaba era el mensaje.
//
// ── POR QUE ESTO NECESITA CANDADO Y NO SOLO UN COMENTARIO ──
//
// Porque el mismo dia, en el MISMO lote de trabajo, yo ensanche la policy del boton de retirar justamente
// porque admin no podia usarlo. Es decir: ya hay un precedente de ensanchar un gate para que admin alcance
// una pantalla, y el siguiente que llegue aqui va a tener la tentacion de repetirlo.
//
// LA LINEA ES DISTINTA, Y ES LA QUE ESTE CANDADO FIJA:
//   · RETIRAR una consulta = juicio sobre si el encuentro OCURRIO. Hecho del registro. Admin SI.
//   · EDITAR la encuesta    = escribir CONTENIDO CLINICO en la historia de un paciente, firmado por quien lo
//                             escribe. Solo el profesional que atiende. Admin NO.
//
// Una ausencia sin documento se lee como hueco, y un hueco se tapa. Esto la distingue de un olvido.

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

describe("solo el profesional que atiende edita las respuestas del paciente", () => {
  it("el writer lo comprueba el mismo, porque la RLS no cubre al owner", () => {
    const src = leer("src/modules/evaluations/data/survey-edit-writer.ts");
    expect(src).toContain('reason: "not_assigned"');
    // CONTRA EL professional_id DE LA EVALUACION, no contra un rol: un rol no dice a quien atiende.
    expect(src).toContain("prof.id !== ev.professionalId");
    expect(src, "apareciendo un rol en este guard, el gate dejo de ser 'quien atiende'").not.toMatch(
      /role\s*===\s*["']admin["']/,
    );
  });

  it("y el mensaje dice de quien es el acto, no solo que no se puede", () => {
    const src = leer("src/modules/evaluations/actions.ts");
    // EL MENSAJE VIEJO ("No estás asignado a este paciente.") es verdad y no sirve: a un admin le suena a
    // defecto de permisos, y el siguiente paso de quien lo lee es ensanchar el gate.
    expect(src).toContain("Solo el profesional que atiende a este paciente puede editar sus respuestas");
    expect(src, "sin decir a quien pedirselo, el admin se queda sin salida").toContain(
      "pídeselo a quien lo atendió",
    );
  });

  it("y queda escrito por que admin SI puede retirar y NO puede editar", () => {
    // Las dos decisiones son del mismo dia y en direcciones opuestas: sin la razon al lado, la segunda se
    // lee como un olvido de la primera.
    const src = leer("src/modules/evaluations/actions.ts");
    expect(src).toContain("ADMIN NO EDITA RESPUESTAS CLINICAS, Y ES DELIBERADO");
    expect(src).toContain("canRetirarConsulta");
  });
});
