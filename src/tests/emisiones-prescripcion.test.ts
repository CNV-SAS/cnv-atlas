import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LAS EMISIONES DE LA PRESCRIPCION (Santiago, 2026-09-09).
//
// LO QUE ESTA PIEZA EXISTE PARA CONSEGUIR, en una frase: que se pueda decir QUE RECIBIO EL PACIENTE sin
// bloquear la prescripcion. Hasta hoy eso se conseguia congelando (aprobar sellaba Y cerraba), y el precio
// eran tres cosas que el profesional sufre: un boton que parece un tramite, una prescripcion bloqueada y
// una reapertura con motivo para corregir una coma.
//
// EL HALLAZGO QUE LO HACE NECESARIO Y NO SOLO COMODO: el plan impreso, el plan del correo y la HISTORIA
// CLINICA se arman los tres del protocolo VIVO (`protocol_suggested` + los `adj_*` de hoy, recomputados al
// leer). Ninguno lee `protocol_approved`. O sea que esos documentos son estables SOLO porque el trigger
// 0026 congela los ajustes al aprobar; sin ese congelado, una historia clinica de agosto diria lo que los
// ajustes digan hoy. Un documento clinico que cambia retroactivamente.
//
// POR ESO EL CANDADO MIRA LA COPIA, no el candado viejo: lo que hay que preservar es que la emision
// GUARDE lo que salio, no que algo quede bloqueado.

const SQL = readFileSync("drizzle/0115_emisiones_de_la_prescripcion.sql", "utf8");
const ESQUEMA = readFileSync("src/db/schema/treatments.ts", "utf8");
const WRITER = readFileSync("src/modules/treatment/data/emisiones-writer.ts", "utf8");
const READER = readFileSync("src/modules/treatment/data/emisiones-reader.ts", "utf8");

describe("la emision guarda una COPIA, no una referencia", () => {
  it("la tabla guarda la prescripcion, la cadena efectiva, la via y el autor", () => {
    // Cada columna esta por una pregunta que alguien va a hacer: que se le entrego, de cuantas calorias,
    // por donde salio, quien lo hizo y cuando. Si una desaparece, la tabla deja de contestarla.
    for (const columna of [
      "prescripcion jsonb not null",
      "kcal_objetivo integer",
      "proteina_g integer",
      "via text not null",
      "emitted_by uuid",
      "emitted_at timestamptz not null",
    ]) {
      expect(SQL, `falta la columna: ${columna}`).toContain(columna);
    }
  });

  it("el writer copia la prescripcion, NO guarda un puntero al tratamiento vivo", () => {
    // LA ASERCION QUE IMPORTA. Si algun dia alguien "ahorra espacio" guardando solo el treatment_id y
    // recomputando al leer, la tabla vuelve a depender del estado vivo y no prueba nada. El writer recibe
    // la prescripcion ya armada y la escribe tal cual.
    const codigo = sinComentarios(WRITER);
    expect(codigo).toContain("prescripcion: input.prescripcion");
    expect(codigo).toContain("kcalObjetivo: input.kcalObjetivo");
  });

  it("y NO toca el estado del tratamiento: emitir no cierra nada", () => {
    // EL CORAZON DE LA SEPARACION. `writeApproveProtocol` ponia `status: "approved"` y a partir de ahi el
    // trigger congelaba la prescripcion entera. Este writer no puede hacer eso: si vuelve a aparecer,
    // vuelve el bloqueo que Santiago pidio quitar, y con el la reapertura con motivo.
    const codigo = sinComentarios(WRITER);
    expect(codigo, "la emision volvio a cambiar el estado del tratamiento").not.toContain(
      '"approved"',
    );
    expect(codigo, "la emision volvio a actualizar treatments").not.toContain("update(treatments)");
  });
});

describe("append-only de verdad: lo impone la base, no la convencion", () => {
  it("hay trigger que rechaza UPDATE y DELETE", () => {
    expect(SQL).toContain("before update or delete on prescription_emissions");
    expect(SQL).toMatch(/raise exception 'Una emision no se borra/);
    expect(SQL).toMatch(/raise exception 'Una emision no se modifica/);
  });

  it("y RLS con la misma visibilidad que el paciente", () => {
    // La tabla existe para que el PROFESIONAL pueda mostrar que entrego. Si solo la viera un admin, seria
    // otra vez el defecto del audit log: un registro que se escribe y no se ve nunca.
    expect(SQL).toContain("alter table prescription_emissions enable row level security");
    expect(SQL).toContain("is_patient_professional");
  });

  it("el audit va INLINE en la transaccion, nunca por el bus (regla dura 8)", () => {
    const codigo = sinComentarios(WRITER);
    const i = codigo.indexOf("db.transaction");
    const j = codigo.indexOf("recordAudit(tx");
    expect(i, "el writer dejo de ser transaccional").toBeGreaterThan(-1);
    expect(j, "el audit dejo de escribirse con la transaccion").toBeGreaterThan(i);
  });
});

describe("el backfill migra lo que ya estaba aprobado (cuidado b de Santiago)", () => {
  it("migra las DOS fuentes: lo aprobado vigente y las aprobaciones anteriores", () => {
    // Las de `treatment_approvals` tambien salieron hacia alguien. Dejarlas fuera borraria del sistema el
    // papel que esa persona tiene en la mano, que es justo el daño que Gildardo nombra en su §6c.
    expect(SQL).toContain("from treatments t");
    expect(SQL).toContain("from treatment_approvals ta");
  });

  it("la via se LEE del sello, y lo que no consta queda como 'anterior'", () => {
    // NO SE INVENTA UNA VIA. `aprobadoVia` existe desde el 2026-09-09; antes de esa fecha no habia campo,
    // y esas filas no pueden afirmar por donde salieron. La tabla se lee justamente para contestar eso.
    expect(SQL).toContain("protocol_approved->>'aprobadoVia'");
    expect(SQL).toContain("when 'envio' then 'correo'");
    expect(SQL).toContain("when 'entrega_en_consulta' then 'impresa'");
    expect(SQL).toContain("else 'anterior'");
  });

  it("y es idempotente: correrla dos veces no duplica emisiones", () => {
    // Santiago la aplica a mano, y una migracion que duplica al reintentarla es una que no se puede
    // reintentar. Se hace con `not exists` y no con un indice unico, para no dejar una restriccion
    // permanente sobre las emisiones REALES por una necesidad que es solo del backfill.
    const inserts = SQL.split("insert into prescription_emissions").slice(1);
    expect(inserts.length, "cambio el numero de inserciones del backfill").toBe(2);
    for (const bloque of inserts) {
      expect(bloque, "una insercion del backfill dejo de ser idempotente").toContain("not exists (");
    }
  });

  it("y deja ver ANTES y DESPUES, porque se aplica a mano", () => {
    expect(SQL).toContain("raise notice 'ANTES:");
    expect(SQL).toContain("raise notice 'DESPUES:");
  });
});

describe("el lector distingue 'no se emitio' de 'no se sabe' (cuidado c)", () => {
  it("`getUltimaEmision` devuelve null explicito y lo dice", () => {
    // EL null ES UNA RESPUESTA. La historia clinica de una consulta sin documento entregado tiene que
    // DECIRLO, no quedarse vacia ni caer al estado vivo por descuido. Quien lo consuma tiene que
    // distinguir los dos casos a proposito, y por eso el contrato lo declara.
    expect(sinComentarios(READER)).toContain("return todas[0] ?? null;");
    expect(READER, "se perdio la advertencia de que el null hay que tratarlo").toContain("cuidado (c)");
  });

  it("y se lee bajo RLS, no con service role", () => {
    // La policy ya dice quien puede ver esto. Un lector con service role tendria que reimplementar ese
    // alcance a mano, y es donde se cuelan las fugas.
    expect(READER).toContain("createSupabaseServerClient");
    expect(READER, "el lector de emisiones no puede usar el cliente owner").not.toContain(
      'from "@/db"',
    );
  });
});

describe("el esquema de Drizzle y el SQL hablan de la misma tabla", () => {
  it("las columnas del esquema estan en la migracion", () => {
    // NO PRUEBA CORRECCION, y se dice para que nadie lo lea como que si: son dos copias NUESTRAS. Lo que
    // atrapa es la divergencia, que es un fallo de runtime invisible a tsc (la consulta pide una columna
    // que no existe). El que prueba correccion es el smoke contra la base.
    const bloque = ESQUEMA.slice(ESQUEMA.indexOf('pgTable("prescription_emissions"'));
    for (const [ts, sql] of [
      ["treatment_id", "treatment_id"],
      ["evaluation_id", "evaluation_id"],
      ["prescripcion", "prescripcion"],
      ["kcal_objetivo", "kcal_objetivo"],
      ["proteina_g", "proteina_g"],
      ["via", "via"],
      ["emitted_by", "emitted_by"],
      ["emitted_by_email", "emitted_by_email"],
      ["emitted_at", "emitted_at"],
    ] as const) {
      expect(bloque, `el esquema no declara ${ts}`).toContain(`"${ts}"`);
      expect(SQL, `la migracion no declara ${sql}`).toContain(sql);
    }
  });
});
