import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ LA DECISIÓN VIEJA SOBRE LOS NUTRACÉUTICOS SE RETIRÓ ENTERA (Santiago, 2026-10-10) ═══
//
// ── QUÉ HABÍA EN ESTE ARCHIVO ────────────────────────────────────────────────────────────────────
//
// El candado del schema de `saveNutraDecision`: la pregunta "¿el paciente adquiere los nutracéuticos?" con sus
// tres respuestas y sus seis razones. Validaba reglas que hacían que el dato SIRVIERA (un "no" sin razón no
// sirve a nadie, "pendiente" es una respuesta válida y no un vacío).
//
// ── POR QUÉ YA NO HAY SCHEMA QUE PROBAR ─────────────────────────────────────────────────────────
//
// La pregunta se retiró el 2026-09-26, su último botón el 2026-10-10 con la migración 0214, y ese mismo día la
// acción entera. El hecho que medía (si el PACIENTE adquiere) lo responden las VENTAS: Dirección cuenta
// "comprado en N consultas" desde las transacciones. Lo reemplaza "No prescribo nutracéuticos", que registra
// otra cosa, el criterio clínico del profesional, y tiene su propio candado
// (`no-prescribo-nutraceuticos.test.ts`).
//
// ── Y POR QUÉ EL ARCHIVO NO SE BORRA ────────────────────────────────────────────────────────────
//
// Porque lo que hay que vigilar ahora es que la vertical no VUELVA. La acción se quedó un día declarada sin
// pantalla (su writer era el único que insertaba en `patient_contraindications`), y Santiago decidió retirarla:
// *esa tabla lleva vacía desde siempre y mejor sin escritor que con uno que nadie puede alcanzar*. Una acción
// viva sin pantalla es una puerta que sigue abriendo, y esta podía reescribir el motivo de una consulta cerrada.
//
// ASÍ QUE SE BARRE EL ÁRBOL: ninguna capa puede volver a tener la pieza. Si alguien la reintroduce creyendo que
// falta, este candado se lo dice y el comentario le explica qué construir en su lugar.

const RAIZ = process.cwd();

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) {
      if (p.endsWith("/tests")) continue;
      out.push(...archivos(p));
    } else if (/\.tsx?$/.test(d.name) && d.name !== "database.generated.ts") {
      out.push(p);
    }
  }
  return out;
}
const FUENTES = archivos("src");

describe("la vertical de la decisión vieja no existe en ninguna capa", () => {
  it("hay fuentes que barrer (si esto falla, el barrido no mira nada)", () => {
    expect(FUENTES.length).toBeGreaterThan(200);
  });

  it.each([
    ["saveNutraDecisionAction", "la acción"],
    ["saveNutraDecisionSchema", "el schema"],
    ["SaveNutraDecisionInput", "el tipo de entrada"],
    ["SaveNutraDecisionWrite", "el tipo del writer"],
    ["NUTRA_DECISION_REASONS", "las seis razones"],
  ])("no vuelve %s (%s)", (simbolo) => {
    const culpables = FUENTES.filter((f) =>
      sinComentarios(readFileSync(join(RAIZ, f), "utf8")).includes(simbolo),
    );
    expect(
      culpables,
      `volvió "${simbolo}" en: ${culpables.join(", ")}. La decisión vieja medía si el PACIENTE adquiere, y eso ` +
        "lo responden las ventas. Si lo que hace falta es registrar una contraindicación del paciente, su sitio " +
        "es un origen propio (`observacion_clinica`), no la prescripción.",
    ).toEqual([]);
  });

  it("y nadie volvió a escribir en patient_contraindications sin pantalla", () => {
    // La tabla se queda (vacía) y su aviso también, para que el día que exista el registro no haya que rehacer
    // la pantalla. Lo que no puede volver es un escritor al que no llega ningún botón.
    const escritores = FUENTES.filter((f) => {
      const src = sinComentarios(readFileSync(join(RAIZ, f), "utf8"));
      return /insert\(\s*patientContraindications\s*\)/.test(src);
    });
    expect(
      escritores,
      `hay un escritor de patient_contraindications en: ${escritores.join(", ")}. Si es deliberado, tiene que ` +
        "tener una pantalla que lo invoque (lo exige `check:cables`) y este caso se actualiza con su razón.",
    ).toEqual([]);
  });
});

describe("lo que SÍ se queda de la decisión vieja", () => {
  it("la lectura de la columna congelada", () => {
    // Hay consultas cerradas con ese registro y es su historia clínica. Lo escrito antes no se reinterpreta.
    const lector = readFileSync(join(RAIZ, "src/modules/treatment/data/treatment-reader.ts"), "utf8");
    expect(lector).toContain("nutraceutical_decision");
  });

  it("y el aviso de contraindicaciones del paciente", () => {
    const seccion = readFileSync(
      join(RAIZ, "src/modules/treatment/components/nutraceuticals-section.tsx"),
      "utf8",
    );
    expect(seccion).toContain("ContraindicacionesAviso");
  });
});
