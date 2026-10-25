import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { reasignacionEnLoteSchema } from "@/modules/patients/validations";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO: LA PASADA EN LOTE ES LA MISMA PIEZA, Y UNA SOLA TRANSACCION ═══
//
// ── DE DONDE SALE ──────────────────────────────────────────────────────────────────────────────────
//
// 25 pacientes del 13 de octubre con el mismo destino y el mismo motivo (Santiago, 2026-10-24: "Mueve los
// 25 en una sola pasada con la pieza"). La tentacion evidente es un script que recorra la lista; lo que
// este candado defiende es que NO lo sea:
//
//   1. UNA SOLA ESCRITURA DE LA REGLA. El lote llama al MISMO cuerpo que un paciente solo. Si manana
//      alguien duplica el `update` de las relaciones o el de las evaluaciones para "optimizar el lote",
//      hay dos definiciones de quien puede abrir una historia clinica, y la prueba de BD que demuestra
//      que el acceso se mueve (`la-reasignacion-mueve-el-acceso-db`) solo cubriria una de las dos.
//   2. TODO O NADA. Los movimientos van en UNA transaccion. Un lote a medias deja a unos pacientes con el
//      acceso movido y a otros no, y nadie sabe cuales: es el mismo defecto que la transaccion de un solo
//      paciente existe para evitar, un nivel mas arriba.
//   3. LAS CASILLAS NO ANIDAN UN FORMULARIO (hazard 7) Y SU EXIGENCIA NO ES UNA BANDERA INERTE (hazard 8).
//      Eso solo se ve en un navegador real, o aqui.
//
// El cuerpo en si (que `is_patient_of` deja de dar acceso, que la fila vieja se queda) se prueba contra la
// base en `la-reasignacion-mueve-el-acceso-db.test.ts`. Esa prueba vale para el lote PRECISAMENTE porque
// el punto 1 se cumple; por eso esta aqui y no como un comentario.

const WRITER = "src/modules/patients/data/reasignacion-writer.ts";
const ACCIONES = "src/modules/patients/actions.ts";
const PANTALLA = "src/modules/patients/components/pacientes-del-integrante.tsx";

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

/** El cuerpo de una funcion exportada, desde su firma hasta el final del archivo o la siguiente. */
function bloque(src: string, desde: string): string {
  const i = src.indexOf(desde);
  expect(i, `no encontre ${desde}`).toBeGreaterThan(-1);
  const resto = src.slice(i + desde.length);
  const fin = resto.search(/\nexport (async )?function |\nclass /);
  return fin === -1 ? resto : resto.slice(0, fin);
}

describe("el lote reasigna con la misma pieza, no con una copia", () => {
  it("llama al cuerpo compartido, no al envoltorio que abre su propia transaccion", () => {
    const lote = bloque(leer(WRITER), "export async function reasignarPacientesEnLote(");
    expect(
      /reasignarPacienteEn\(\s*tx,/.test(lote),
      "el lote tiene que llamar al cuerpo compartido pasandole SU transaccion",
    ).toBe(true);
    expect(
      /\breasignarPaciente\(/.test(lote),
      "llamar al envoltorio abriria una transaccion por paciente: 25 transacciones, y un fallo en la 13 " +
        "deja doce movimientos hechos",
    ).toBe(false);
  });

  it("abre UNA transaccion y el recorrido va dentro", () => {
    const lote = bloque(leer(WRITER), "export async function reasignarPacientesEnLote(");
    expect(lote.match(/db\.transaction\(/g)?.length ?? 0).toBe(1);
    const dentro = lote.slice(lote.indexOf("db.transaction("));
    expect(
      /for \(const patientId of/.test(dentro),
      "el recorrido tiene que estar DENTRO de la transaccion, no fuera",
    ).toBe(true);
  });

  it("el destino invalido LANZA para revertir, no devuelve desde dentro", () => {
    // Dentro de `db.transaction` un `return` no revierte nada: los pacientes ya movidos se quedarian
    // movidos y la respuesta diria que no se movio ninguno. Las dos cosas a la vez, y contradiciendose.
    const lote = bloque(leer(WRITER), "export async function reasignarPacientesEnLote(");
    expect(/throw new DestinoInvalido\(\)/.test(lote)).toBe(true);
  });

  it("la regla sigue escrita UNA vez en todo el writer", () => {
    const src = leer(WRITER);
    const cuenta = (re: RegExp) => src.match(re)?.length ?? 0;
    expect(
      cuenta(/\.update\(patientProfessionalRelationships\)/g),
      "quien puede abrir una historia clinica se escribe en un solo sitio",
    ).toBe(1);
    expect(cuenta(/\.update\(evaluations\)/g), "la atribucion, en un solo sitio").toBe(1);
    expect(
      cuenta(/recordAudit\(/g),
      "un rastro por paciente, escrito una sola vez: el lote no lleva su propio asiento porque la " +
        "pregunta que alguien hara dentro de un ano es sobre UNA historia clinica",
    ).toBe(1);
  });

  it("el mismo paciente marcado dos veces no cuenta dos veces", () => {
    const lote = bloque(leer(WRITER), "export async function reasignarPacientesEnLote(");
    expect(
      /new Set\(patientIds\)/.test(lote),
      "sin colapsar los repetidos, la segunda pasada sobre la misma fila daria 'sin-cambio' y el informe " +
        "de la pantalla mentiria",
    ).toBe(true);
  });
});

describe("la accion del lote pasa por la policy y por el schema", () => {
  const accion = bloque(leer(ACCIONES), "export async function reasignarPacientesEnLoteAction(");

  it("solo admin (regla dura 3: la autorizacion vive en la policy)", () => {
    expect(/canReassignPatient\(user\)/.test(accion)).toBe(true);
  });

  it("valida con Zod antes de tocar la base", () => {
    expect(/reasignacionEnLoteSchema\.safeParse\(/.test(accion)).toBe(true);
    const iParse = accion.indexOf("safeParse(");
    const iEscribe = accion.indexOf("reasignarPacientesEnLote(");
    expect(iParse, "la validacion va ANTES de la escritura").toBeLessThan(iEscribe);
  });

  it("el motivo es obligatorio y la lista no puede venir vacia", () => {
    expect(
      reasignacionEnLoteSchema.safeParse({
        patientIds: [],
        haciaProfesionalId: "11111111-1111-1111-1111-111111111111",
        motivo: "Cobertura de agenda del 13 de octubre",
      }).success,
      "una lista vacia no es una reasignacion de cero pacientes: es un formulario mal armado",
    ).toBe(false);
    expect(
      reasignacionEnLoteSchema.safeParse({
        patientIds: ["11111111-1111-1111-1111-111111111112"],
        haciaProfesionalId: "11111111-1111-1111-1111-111111111111",
        motivo: "  ",
      }).success,
      "un motivo en blanco no explica nada dentro de un ano",
    ).toBe(false);
    expect(
      reasignacionEnLoteSchema.safeParse({
        patientIds: ["no-es-un-uuid"],
        haciaProfesionalId: "11111111-1111-1111-1111-111111111111",
        motivo: "Cobertura de agenda del 13 de octubre",
      }).success,
    ).toBe(false);
    const veinticinco = Array.from(
      { length: 25 },
      (_, i) => `11111111-1111-1111-1111-1111111111${String(10 + i).padStart(2, "0")}`,
    );
    expect(
      reasignacionEnLoteSchema.safeParse({
        patientIds: veinticinco,
        haciaProfesionalId: "11111111-1111-1111-1111-111111111111",
        motivo: "Pacientes atendidos con el enlace de otro profesional por cobertura de agenda",
      }).success,
      "los 25 del caso real tienen que pasar",
    ).toBe(true);
  });
});

describe("las casillas del lote no rompen los formularios de la lista", () => {
  const src = leer(PANTALLA);

  it("ningun formulario envuelve la lista (hazard 7: el navegador descarta el de adentro)", () => {
    // Cada fila YA tiene sus propios formularios (marcar de prueba, reasignar uno). Un formulario que
    // envolviera el <ul> para llevar las casillas los anidaria, y entonces sus campos viajarian en el
    // envio de afuera y su boton ejecutaria la accion equivocada. Dos sintomas raros, un solo defecto.
    const culpables: string[] = [];
    const re = /<form[\s\S]*?<\/form>/g;
    for (const f of src.match(re) ?? []) {
      if (/<ul[\s>]/.test(f)) culpables.push(f.slice(0, 80));
    }
    expect(culpables, "un formulario del lote no puede contener la lista de pacientes").toEqual([]);
  });

  it("la casilla es controlada y SIN name: lo que viaja es el campo oculto", () => {
    const casilla = src.match(/<input\s+type="checkbox"[\s\S]*?\/>/)?.[0] ?? "";
    expect(casilla, "no encontre la casilla").not.toBe("");
    expect(
      /\bname=/.test(casilla),
      "con `name`, la casilla viajaria en el envio del formulario que la contenga, que no es el del lote",
    ).toBe(false);
    expect(/checked=\{/.test(casilla), "controlada por el estado, no por el DOM").toBe(true);
    expect(/<input type="hidden" name="patientIds"/.test(src)).toBe(true);
  });

  it("el boton dice POR QUE esta apagado cuando no hay nada marcado (hazard 8)", () => {
    // Un boton muerto sin explicacion es peor que un error claro: quien mira cree que la pantalla esta
    // rota. Y el obligatorio NO puede ir en la casilla, porque vive fuera del formulario y seria inerte.
    expect(/disabled=\{pending \|\| marcados\.length === 0\}/.test(src)).toBe(true);
    expect(
      /Marca los pacientes que se mueven/.test(src),
      "el rotulo del boton apagado tiene que decir que falta",
    ).toBe(true);
  });

  it("la pantalla avisa de lo que NO se mueve antes de pulsar", () => {
    expect(
      /La firma de un diagnóstico no se mueve/.test(readFileSync(PANTALLA, "utf8")),
      "quien mueve 25 historias clinicas tiene que leer que la firma se queda, no descubrirlo despues",
    ).toBe(true);
  });
});

// ═══ CANDADO: LA PRESELECCION POR DIA (Gildardo, 2026-10-24) ═══
//
// "Elegir 25 de 93 a mano, con un boton 'Marcar los 93' al lado, es como se mueve el paciente equivocado."
//
// Lo que se defiende aqui no es que el desplegable exista, es DE DONDE SALE el grupo: de los dias que la
// base tiene, con su conteo. Un campo de fecha escrito a mano vuelve a poner el error donde estaba, y peor:
// un dia mal teclado marca OTRO grupo, no ninguno, asi que no se nota. Y el dia se decide en hora de
// Colombia; en UTC, una asignacion de las 7 de la noche cae al dia siguiente y el grupo sale con uno de
// menos y otro de mas, que es justo el error que esto evita.
describe("el lote se preselecciona por dia, y el dia lo pone la base", () => {
  const src = leer(PANTALLA);
  const LECTOR = "src/modules/payments/data/integrante-reader.ts";

  it("el dia de asignacion se calcula en hora de Colombia, no en la del servidor", () => {
    const lector = leer(LECTOR);
    expect(
      /\(r\.assigned_at at time zone 'America\/Bogota'\)::date/.test(lector),
      "sin el huso del pais, el grupo de un dia se parte en dos",
    ).toBe(true);
  });

  it("las opciones salen de los dias agrupados, no de un campo de fecha a mano", () => {
    expect(
      /grupos\.map\(/.test(src),
      "el desplegable tiene que listar los dias que existen, con su conteo",
    ).toBe(true);
    expect(
      /<input[^>]*type="date"/.test(src),
      "un dia escrito a mano puede senalar un grupo que no es el que se quiere, y marcar algo igualmente",
    ).toBe(false);
  });

  it("el desplegable del dia es controlado y SIN name: solo mueve la seleccion", () => {
    const sel = src.match(/<select\s+value=""[\s\S]*?<\/select>/)?.[0] ?? "";
    expect(sel, "no encontre el desplegable de la preseleccion").not.toBe("");
    expect(
      /\bname=/.test(sel),
      "vive fuera del formulario del lote: con `name` viajaria en el envio equivocado (hazard 8)",
    ).toBe(false);
  });

  it("marcar un dia deja EXACTAMENTE ese grupo, no lo suma a lo ya marcado", () => {
    // `setMarcados(grupo.ids)` y no `[...previos, ...grupo.ids]`: sumar dejaria una mezcla silenciosa de
    // dos dias, que es el movimiento equivocado con cara de preseleccion.
    expect(/setMarcados\(grupo\.ids\)/.test(src)).toBe(true);
  });

  it("antes de pulsar se lee QUE esta marcado, y si es una mezcla lo dice", () => {
    const crudo = readFileSync(PANTALLA, "utf8");
    expect(
      /exactamente los asignados el/.test(crudo),
      "la frase tiene que confirmar que lo marcado es un dia completo",
    ).toBe(true);
    expect(
      /días de asignación distintos/.test(crudo),
      "y tiene que AVISAR cuando la seleccion mezcla dias: ese es el caso en el que hay que mirar",
    ).toBe(true);
    expect(
      /es decir TODOS sus pacientes/.test(crudo),
      "y decir cuando lo marcado es todo el roster, que es el caso de la regla dura 14",
    ).toBe(true);
  });

  it("la fila dice su fecha de asignacion: la preseleccion se puede comprobar a ojo", () => {
    expect(/asignado el \{formatDateOnlyShort\(p\.asignadoEl\)\}/.test(src)).toBe(true);
  });
});
