import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO DE LA REPARACION DE LAS CAPAS CONGELADAS  ·  2026-11-07
//
// ═══ QUE SE REPARA, Y POR QUE ESTO NECESITA UN CANDADO MAS ESTRICTO QUE LO NORMAL ═══
//
// La reemision del 7 de noviembre escribio 424 informes sin `rutasContent`, `efrContent` ni
// `validityCaveats`, y cinco superficies quedaron vacias sin que nada fallara. Esto los completa.
//
// ES UN `update` SOBRE `reports`, QUE ES LA TABLA QUE ESTE PROYECTO TRATA COMO INMUTABLE. Lo que hace
// aceptable la excepcion no es el argumento, son tres condiciones verificables en la propia fila, y este
// candado existe para que ninguna se pueda relajar sin que se vea:
//
//   1. SOLO AÑADE. El parche viaja con `||` de jsonb y solo lleva las claves AUSENTES: ninguna cifra
//      sellada puede moverse.
//   2. SOLO LAS 3.x. Un snapshot de otra era tampoco trae estas capas, y esos no se tocan: nacieron
//      cuando no existian, y reescribir el pasado es lo que la regla 7 prohibe.
//   3. SOLO EL VIGENTE. Una version anterior no es lo que la pantalla lee.
//
// Si alguien convierte esto en una herramienta general de "arreglar snapshots", el candado se pone rojo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const SERVICIO = sinComentarios(
  readFileSync("src/modules/clinical-pipeline/services/completar-capas-congeladas.ts", "utf8"),
);
const LECTOR = sinComentarios(
  readFileSync("src/modules/clinical-pipeline/data/capas-congeladas-reader.ts", "utf8"),
);
const ACTION = sinComentarios(
  readFileSync("src/modules/clinical-pipeline/recalibracion-actions.ts", "utf8"),
);
const PANEL = sinComentarios(
  readFileSync("src/app/(app)/admin/recalibracion/panel-de-recalibracion.tsx", "utf8"),
);

describe("la reparacion solo puede AÑADIR lo que falta", () => {
  it("el parche va con `||` de jsonb, que añade y no reemplaza", () => {
    expect(SERVICIO).toContain("|| ${JSON.stringify(parche)}::jsonb");
  });

  it("y cada capa se calcula SOLO si falta", () => {
    for (const guarda of ["if (!fila.tiene_rutas)", "if (!fila.tiene_efr)", "if (!fila.tiene_caveats)"]) {
      expect(SERVICIO, `se dejo de comprobar la ausencia: ${guarda}`).toContain(guarda);
    }
  });

  it("CONTROL: no escribe el snapshot entero, que es la forma de perder una cifra", () => {
    // Un `set({ snapshot: ... })` con un objeto armado a mano reemplazaria el documento completo.
    expect(SERVICIO).not.toMatch(/set\(\{\s*snapshot:\s*\{/);
  });
});

describe("y solo puede tocar las filas que la reemision escribio hoy", () => {
  it("exige motor 3.x, tanto al listar como al escribir", () => {
    expect(LECTOR).toContain("motor like '3.%'");
    expect(SERVICIO).toContain('startsWith("3.")');
  });

  it("exige que sea el informe VIGENTE de su consulta", () => {
    expect(SERVICIO).toContain("es_vigente");
    expect(LECTOR, "el lector dejo de tomar una sola fila por consulta").toContain(
      "distinct on (r.evaluation_id)",
    );
  });

  it("y se niega si ya estan las tres, para que la tanda sea repetible sin ruido", () => {
    expect(SERVICIO).toContain("no hay nada que completar");
    expect(ACTION).toContain('yaEstaba ? "saltada" : "fallo"');
  });
});

describe("las capas se resuelven con las mismas funciones del pipeline, y desde esa fila", () => {
  it("las rutas, de los ids que ESA fila ya tiene sellados", () => {
    expect(SERVICIO).toContain("resolveRutasContent(ids)");
    expect(SERVICIO).toContain("r.snapshot->'dfi'->'rutas' as rutas");
  });

  it("el estado EFR, con el model_version_id de SU diagnostico y no con el modelo activo de hoy", () => {
    // Si usara el modelo activo, la capa escrita seria la de hoy y no la que le correspondia a ese
    // documento. Es la misma razon por la que el contenido se congela.
    expect(SERVICIO).toContain("readEfrContent(dx.modelVersionId, bands)");
    expect(SERVICIO).toContain("modelVersionId: diagnoses.modelVersionId");
  });

  it("y los caveats, de su propia fuente sellada y no del intake vivo", () => {
    expect(SERVICIO).toContain("getSealedValidityCaveats(fila.evaluation_id)");
  });

  it("si el registry no tiene el estado EFR, NO escribe nada a medias", () => {
    // Un snapshot incompleto es exactamente lo que causo esto.
    expect(SERVICIO).toContain("El registry no tiene el contenido del estado EFR de ese diagnóstico.");
  });
});

describe("el acto queda autorizado, acotado y con rastro", () => {
  it("la policy es la misma de la recalibracion (regla dura 3)", () => {
    expect(ACTION).toContain("canReemitDiagnosis(user)");
  });

  it("con Zod, tope de 50 por tanda y confirmacion explicita", () => {
    expect(ACTION).toContain("reportIds: z.array(z.guid()).min(1).max(50)");
    expect(ACTION).toContain("confirmado: z.literal(true)");
  });

  it("y el rastro va INLINE en la transaccion, nunca por el bus (regla dura 8)", () => {
    expect(SERVICIO).toContain("recordAudit(tx, {");
    expect(SERVICIO).toContain('event: "report.frozen_layers_completed"');
    // El payload dice que no se movio ninguna cifra: dentro de un año, la ausencia no lo distingue.
    expect(SERVICIO).toContain("cifras_modificadas");
  });
});

describe("y tiene superficie: un guard sin pantalla hace creer que se aplico", () => {
  it("el panel pinta el bloque y llama a la action", () => {
    expect(PANEL).toContain("sinCapas.length === 0 ? null");
    expect(PANEL).toContain("completarCapasCongeladasAction({");
  });

  it("el bloque NO se esconde cuando ya no quedan desfasadas", () => {
    // El retorno temprano de "no hay desfasados" habria escondido una reparacion pendiente justo el dia
    // en que todo lo demas esta al dia.
    expect(PANEL).toContain("{bloqueDeCapas}");
    expect(PANEL.indexOf("const bloqueDeCapas")).toBeLessThan(
      PANEL.indexOf("if (desfasadas.length === 0)"),
    );
  });

  it("y el bloque dice que no cambia ninguna cifra, que es lo que decide si se pulsa", () => {
    const fuente = readFileSync(
      "src/app/(app)/admin/recalibracion/panel-de-recalibracion.tsx",
      "utf8",
    );
    expect(fuente).toContain("no cambia ninguna cifra");
    expect(fuente).toContain("0 rutas activas");
  });
});
