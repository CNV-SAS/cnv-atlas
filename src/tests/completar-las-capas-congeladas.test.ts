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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// Y LA PRIMERA VERSION DE ESTA REPARACION ESTABA MAL: HACIA UN `update`  ·  2026-11-07
//
// La base la rechazo en produccion con `prevent_report_snapshot_mutation` (*"reports.snapshot es
// inmutable"*, P0001) y la pantalla se cayo con un 500. Estas 16 pruebas estaban VERDES mientras eso
// pasaba, porque todas miraban la forma del codigo y ninguna podia ver el trigger.
//
// De ahi salen dos cosas: este bloque, que amarra que la reparacion SUCEDA en vez de reescribir, y
// `completar-capas-congeladas-db`, que corre contra el trigger de verdad. Un candado de codigo comprueba
// lo que escribimos; solo la BD comprueba lo que la base acepta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("la reparacion SUCEDE a la fila, no la reescribe", () => {
  it("INSERTA una fila nueva de reports", () => {
    expect(SERVICIO).toContain("tx\n        .insert(reports)");
  });

  it("CONTROL: no hay un update ni un delete de reports en ningun sitio", () => {
    // La forma exacta que la base rechazo. Si alguien la restaura buscando "una reparacion mas simple",
    // esto se pone rojo antes de que lo vea un profesional.
    expect(SERVICIO, "volvio el update que el trigger prohibe").not.toContain("update(reports)");
    expect(SERVICIO).not.toContain("delete(reports)");
    expect(SERVICIO).not.toContain("::jsonb");
  });

  it("el snapshot nuevo es el ANTERIOR copiado entero mas las claves que faltaban", () => {
    // Ninguna cifra se puede mover: el motor no vuelve a correr y el documento viaja completo.
    expect(SERVICIO).toContain("snapshot: { ...fila.snapshot, ...capas }");
    expect(SERVICIO, "la reparacion volvio a correr el motor").not.toContain("runEngine(");
  });

  it("y cada capa se calcula SOLO si falta", () => {
    for (const guarda of ["if (!fila.tiene_rutas)", "if (!fila.tiene_efr)", "if (!fila.tiene_caveats)"]) {
      expect(SERVICIO, `se dejo de comprobar la ausencia: ${guarda}`).toContain(guarda);
    }
  });

  it("NO crea un diagnostico nuevo: esto termina una escritura, no es un acto clinico", () => {
    // Reemitir lleva firma y rastro propios, y la marca de pantalla cuenta filas de `diagnoses`: un
    // diagnostico mas diria "reemitido 2 veces", que seria falso.
    expect(SERVICIO).not.toContain("insert(diagnoses)");
    expect(SERVICIO).toContain("diagnostico_nuevo: false");
  });

  it("y la fila nueva LLEVA lo que una fila nueva pierde si nadie lo copia", () => {
    // La banda sellada de trayectoria y su acuse: sin ellas, el informe nuevo seria la via para saltarse
    // el freno del cambio desfavorable. Y la nota del profesional, que es texto suyo.
    expect(SERVICIO).toContain("trajectory: (fila.trajectory ?? null)");
    expect(SERVICIO).toContain("trajectoryCommunicatedAt:");
    expect(SERVICIO).toContain("professionalNotes: fila.professional_notes");
    // Lo que NO viaja: el PDF y la fecha de envio, que son del documento que SALIO.
    expect(SERVICIO).not.toContain("storagePath");
    expect(SERVICIO).not.toContain("sentAt");
  });

  it("y un fallo de la base NO tumba la pantalla: devuelve el motivo", () => {
    // La primera version dejo un 500 en la cara de Santiago. Una action devuelve Result.
    expect(SERVICIO).toContain("} catch (e) {");
    expect(SERVICIO).toContain("La base no aceptó la fila nueva");
    // Y el motivo real vive en la CAUSA: Drizzle envuelve el error de Postgres.
    expect(SERVICIO).toContain("cause?.message");
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

  it("y el bloque dice que no cambia ninguna cifra ni reemite, que es lo que decide si se pulsa", () => {
    const fuente = readFileSync(
      "src/app/(app)/admin/recalibracion/panel-de-recalibracion.tsx",
      "utf8",
    );
    expect(fuente).toContain("no cambia ninguna cifra y no reemite el diagnóstico");
    // Y la consecuencia de no hacerlo, que es la otra mitad de la decision. (Subcadena corta: el texto
    // viene partido en varias lineas por el formateador, y una frase entera no coincide nunca.)
    expect(fuente).toContain("hoja de rutas del");
    expect(fuente).toContain("sale vacía");
  });

  it("un solo boton hace todas las tandas, y PARA al primer fallo", () => {
    const fuente = sinComentarios(
      readFileSync("src/app/(app)/admin/recalibracion/panel-de-recalibracion.tsx", "utf8"),
    );
    // El bucle va en el cliente: una llamada por tanda, asi que ninguna invocacion se acerca al limite de
    // tiempo de la funcion, y nadie pulsa nueve veces.
    expect(fuente).toContain("for (let i = 0; i < todos.length; i += TOPE_POR_TANDA)");
    expect(fuente).toContain('if (r.error || r.resultados.some((x) => x.estado === "fallo")) break;');
    // Con progreso: 422 filas no pueden ser un boton mudo.
    expect(fuente).toContain("setProgreso(");
  });

  it("y mientras falte la capa, Tratamiento NO dice 0 rutas activas: dice que se estan completando", () => {
    // TRES ESTADOS Y NO DOS. "Sin rutas activas para este estado" es un resultado clinico; la capa sin
    // escribir es un defecto nuestro. Mostrarlos igual puso "0 rutas activas" al lado de un riesgo
    // integrado CRITICO, que es un vacio leido como resultado.
    const seccion = readFileSync("src/modules/diagnoses/components/rutas-section.tsx", "utf8");
    expect(seccion).toContain("Las rutas de esta consulta se están completando.");
    expect(seccion).toContain("No es que no haya rutas");
    const lector = sinComentarios(
      readFileSync("src/modules/diagnoses/data/results-reader.ts", "utf8"),
    );
    // Solo 3.x: en un snapshot de otra era la capa no falta, no existia. Mismo filtro que la reparacion.
    expect(lector).toContain('rutasContent == null && (engineVersion ?? "").startsWith("3.")');
  });
});
