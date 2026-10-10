import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ "NO PRESCRIBO NUTRACÉUTICOS" ES OTRO HECHO, NO OTRO NOMBRE (Santiago, 2026-10-10. Migración 0214) ═══
//
// ── DE DÓNDE SALE ────────────────────────────────────────────────────────────────────────────────
//
// De su reunión con la integrante que más vende. Textual suyo: *"una cosa es prescribir un producto, que
// básicamente eso lo hacen los integrantes, y otra cosa es que el paciente quiera comprar o no quiera comprar
// algún producto"*, y la mitad que decide: *"no me parece correcto registrar por qué un paciente no se lleva un
// producto cuando puede ser por precio y muchas razones"*.
//
// ── QUÉ PROTEGE ESTE CANDADO, Y POR QUÉ CADA COSA ───────────────────────────────────────────────
//
// 1. QUE LOS DOS HECHOS NO SE FUNDAN. El campo viejo (`nutraceutical_decision`) preguntaba si el PACIENTE
//    adquiere; el nuevo registra el criterio del PROFESIONAL. Santiago eligió la opción (a), campo nuevo con
//    el viejo congelado, y su razón es la que hay que sostener: *"lo que se registra aquí entra en la
//    investigación, así que reinterpretar el histórico ensucia justo lo que el campo existe para medir."*
//    El día que alguien "simplifique" reusando el viejo, el histórico pasa a leerse como criterio clínico.
//
// 2. QUE EL HISTÓRICO SE SIGA VIENDO. Hay consultas cerradas con el registro viejo, y es su historia clínica.
//    Se retiró la forma de ESCRIBIRLO, no la de leerlo.
//
// 3. LOS HAZARDS DE FORMULARIO. El bloque vive DENTRO del formulario de la prescripción, y ahí el hazard 7 de
//    CLAUDE.md ya nos costó un bloqueo real (un `<form>` dentro de otro: el navegador descarta el interno, y
//    pulsar "Registrar" guardaba la prescripción). Los campos van sin `name` por lo mismo: con `name`
//    viajarían en el envío de afuera, que es la mitad del defecto que no se ve.
//
// 4. QUE LA LISTA DE PENDIENTES CONOZCA LA VÍA NUEVA. Eso lo prueba `cierre-consulta.test.ts`; aquí se vigila
//    que el detalle del pendiente no vuelva a nombrar el botón retirado.
const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");
/**
 * El archivo SIN COMENTARIOS. Hace falta porque estos comentarios NOMBRAN lo que prohiben (un <form> dentro
 * de otro, un `name`), y buscarlo sobre el texto crudo se acusa a si mismo: el candado daria rojo por su
 * propia explicacion. Es el mismo cuidado del candado de los backticks en SQL, que empezo acusando a seis
 * archivos correctos.
 */
const soloCodigo = (rel: string) =>
  leer(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");

const NUEVO = "src/modules/treatment/components/sin-prescripcion-form.tsx";
const VIEJO = "src/modules/treatment/components/no-los-adquiere-form.tsx";
const SECCION = "src/modules/treatment/components/nutraceuticals-section.tsx";
const WRITER = "src/modules/treatment/data/treatment-writer.ts";
const VALIDACIONES = "src/modules/treatment/validations.ts";
const MIGRACION = "drizzle/0214_no_prescribo_nutraceuticos.sql";

describe("el criterio clínico se registra en su propio campo", () => {
  it("escribe las tres columnas nuevas y NO toca la congelada", () => {
    const src = leer(WRITER);
    const bloque = src.slice(
      src.indexOf("export async function registrarSinPrescripcion"),
      src.indexOf("export type SaveTiemposActivosWrite"),
    );
    expect(bloque).toContain("sinPrescripcionMotivo: input.motivo");
    expect(bloque).toContain("sinPrescripcionAt:");
    expect(bloque).toContain("sinPrescripcionBy: input.actorId");
    // SI ESTO FALLA, el histórico del campo viejo pasa a leerse como criterio clínico, que es justo lo que la
    // opción (a) se eligió para evitar.
    expect(bloque, "el camino nuevo no escribe el campo congelado").not.toContain("nutraceuticalDecision");
  });

  it("no deja registrarlo si ya hay prescripción, y lo comprueba en la transacción", () => {
    const src = leer(WRITER);
    const bloque = src.slice(
      src.indexOf("export async function registrarSinPrescripcion"),
      src.indexOf("export type SaveTiemposActivosWrite"),
    );
    // Decir las dos cosas sobre la misma consulta deja a quien la lea después sin saber cuál creer, y es la
    // historia clínica. La pantalla ya no lo ofrece, pero una guarda que solo vive en la pantalla se salta
    // invocando la acción.
    expect(bloque).toContain("treatmentNutraceuticals.treatmentId");
    expect(bloque).toContain("TreatmentStateError");
  });

  it("el motivo es obligatorio, con el mismo mínimo que el CHECK de la base", () => {
    expect(leer(VALIDACIONES)).toContain("registrarSinPrescripcionSchema");
    expect(leer(VALIDACIONES)).toMatch(/\.min\(5,/);
    expect(leer(MIGRACION)).toContain('length(btrim("sin_prescripcion_motivo")) >= 5');
  });

  it("y la migración congela el campo viejo en vez de borrarlo", () => {
    const sql = leer(MIGRACION);
    expect(sql).toContain('COMMENT ON COLUMN "treatments"."nutraceutical_decision"');
    expect(sql).toContain("CONGELADO");
    expect(sql, "un campo con historico clinico no se borra").not.toMatch(/DROP COLUMN[^;]*nutraceutical_decision/);
  });
});

describe("la pantalla ofrece la vía nueva y solo LEE la vieja", () => {
  it("el botón va junto a Guardar prescripción", () => {
    const src = leer(SECCION);
    expect(src).toContain("<SinPrescripcionForm");
    const fila = src.slice(src.indexOf('{pending ? "Guardando..." : "Guardar prescripción"}'));
    expect(
      fila.slice(0, 1200),
      "las dos salidas van juntas: es el momento en que el profesional cierra",
    ).toContain("<SinPrescripcionForm");
  });

  it("el bloque viejo ya no puede escribir: ni acción, ni campos, ni botón", () => {
    const src = leer(VIEJO);
    expect(src).not.toContain("saveNutraDecisionAction");
    expect(src).not.toContain("ejecutarAccion");
    expect(src).not.toContain("<Input");
    // Y sigue mostrando lo registrado, que es a lo que se queda reducido.
    expect(src).toContain("no los adquiere");
  });

  it("pero la lectura del histórico sigue montada", () => {
    const src = leer(SECCION);
    expect(src).toContain("<NoLosAdquiereForm");
    expect(src).toContain('protocol.nutraceuticalDecision?.decision === "no"');
  });

  it("el bloque nuevo no anida un <form> (hazard 7) ni pone name a sus campos (hazard 4)", () => {
    const src = soloCodigo(NUEVO);
    expect(src, "un <form> dentro de otro lo descarta el navegador").not.toContain("<form");
    expect(src, "con name, el campo viajaría en el envío de la prescripción").not.toMatch(/\bname="/);
    expect(src).toContain("ejecutarAccion");
    // Los dos botones, de tipo button: un submit aquí enviaría el formulario de afuera.
    expect(src.match(/type="button"/g)?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("y el aviso de 'falta cerrar' nombra la salida que existe hoy", () => {
    const src = leer(SECCION);
    expect(src).toContain("<strong>No prescribo nutracéuticos</strong>");
    expect(src, "nombraba un botón retirado").not.toContain("<strong>el paciente no los adquiere por ahora</strong>");
  });
});
