import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { addNoteSchema } from "@/modules/treatment/validations";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS OBSERVACIONES DE SEGUIMIENTO, DESPUES DEL SMOKE  ·  Santiago, 2026-11-08
//
// ═══ LOS DOS DEFECTOS, EN SUS PALABRAS ═══
//
//   · *"al pulsar «Agregar observación» hay que esperar unos 5 segundos, o recargar, para que el campo
//     se limpie y aparezca la vigente"*;
//   · *"el «Mensaje para el paciente» no se ve en ningún lado después de guardarse; tras recargar el
//     campo sale vacío y la profesional no sabe qué le va a llegar al paciente"*.
//
// El primero no era lentitud del guardado: la pantalla esperaba al `router.refresh()`, que recompone la
// pagina ENTERA de la evaluacion. Y cinco segundos mirando un campo lleno, en consulta, es la ventana en
// la que alguien vuelve a pulsar; esto es append-only, asi que la segunda pulsacion no corrige, DUPLICA.
//
// El segundo es el mas delicado de los dos textos, porque es el unico que SALE DE LA CLINICA: un
// registro que no se puede releer antes de que lo lea su destinatario no se puede corregir.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const PANTALLA = readFileSync(
  "src/modules/followups/components/observaciones-consulta.tsx",
  "utf8",
);
const LIMPIA = sinComentarios(PANTALLA);

describe("lo guardado aparece al instante, no cuando termine el refresco", () => {
  it("la accion devuelve la fila sellada y la pantalla la usa", () => {
    const ACCIONES = sinComentarios(readFileSync("src/modules/treatment/actions.ts", "utf8"));
    expect(ACCIONES, "la accion dejo de devolver la nota guardada").toContain("nota: guardo");
    expect(LIMPIA).toContain("state.nota");
  });

  it("y se deduplica por `id`, no por parecido", () => {
    // El refresco llega detras y trae la misma nota otra vez. Compararlas por contenido fallaria el dia
    // que el servidor formatee algo distinto; el id es lo unico que no depende de eso.
    expect(LIMPIA).toContain("notasDelServidor.some((n) => n.id === state.nota?.id)");
  });

  it("y el campo se vacia con la nota optimista, que es lo que lo hace inmediato", () => {
    // La `key` se deriva del numero de notas; con la nota optimista dentro, cambia al guardar y no al
    // terminar el refresco.
    expect(LIMPIA).toContain("key={`nota-${notas.length}`}");
  });
});

describe("el mensaje para el paciente se ve, y se puede corregir", () => {
  it("la pantalla lo pinta con su fecha", () => {
    expect(LIMPIA).toContain("mensajesPorFecha(notas)");
    expect(PANTALLA).toContain("Mensaje para el paciente · va en su informe");
  });

  it("y el VIGENTE es el de la ultima nota QUE TRAIGA uno, no el de la ultima nota", () => {
    // Es la misma regla que el informe. Si fuera "el de la ultima nota", escribir una nota clinica mas
    // SIN mensaje borraria de la pantalla el mensaje que el informe sigue llevando: la pantalla diria
    // que no hay y el paciente recibiria uno.
    expect(LIMPIA).toContain('.filter((n) => (n.mensajeParaElPaciente ?? "").trim() !== "")');
  });

  it("los anteriores quedan, no se borran", () => {
    expect(PANTALLA).toContain("Ver el mensaje anterior");
  });

  it("y sin mensaje lo DICE, en vez de dejar el hueco", () => {
    expect(PANTALLA).toContain("No le has dejado ningún mensaje");
  });
});

describe("los rotulos dicen el destino de cada texto", () => {
  it("la nota va a la historia clinica y el mensaje al informe", () => {
    expect(PANTALLA).toContain("· va a la historia clínica");
    expect(PANTALLA).toContain("· va en su informe (opcional)");
  });
});

describe("y se puede guardar un mensaje SIN escribir nota", () => {
  it("el esquema acepta solo el mensaje", () => {
    const r = addNoteSchema.safeParse({
      evaluationId: "11111111-1111-4111-8111-111111111111",
      note: "",
      mensajeParaElPaciente: "Sigue con el plan.",
    });
    expect(r.success, "corregir el mensaje obliga a escribir otra nota clinica").toBe(true);
  });

  it("y solo la nota, que es el caso de siempre", () => {
    const r = addNoteSchema.safeParse({
      evaluationId: "11111111-1111-4111-8111-111111111111",
      note: "Observación de la consulta.",
      mensajeParaElPaciente: "",
    });
    expect(r.success).toBe(true);
  });

  it("pero NO los dos vacios: un acto tiene que decir algo", () => {
    const r = addNoteSchema.safeParse({
      evaluationId: "11111111-1111-4111-8111-111111111111",
      note: "   ",
      mensajeParaElPaciente: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      // EL MENSAJE NOMBRA LAS DOS SALIDAS: un "no puede estar vacía" a secas se lee como "escribe la nota".
      expect(r.error.issues[0]?.message).toContain("el mensaje para el paciente");
    }
  });

  it("y el campo de la nota YA NO lleva `required`: la exigencia vive en el boton, con su rotulo", () => {
    // Es el hazard 8 de CLAUDE.md: una bandera obligatoria que ya no aplica engaña mas que su ausencia,
    // asi que se borra y la regla se rehace donde si se cumple, DICIENDOLO.
    expect(LIMPIA, "volvio el `required` incondicional en la nota clinica").not.toMatch(
      /name="note"[\s\S]{0,120}required/,
    );
    expect(LIMPIA).toContain("disabled={pending || !hayAlgoQueGuardar}");
    expect(PANTALLA).toContain("Escribe la nota o el mensaje");
  });
});
