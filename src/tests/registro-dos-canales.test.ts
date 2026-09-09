import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildRegistryData } from "@/clinical-engine/registry-data";

// CANDADO DE LOS DOS CANALES DEL REGISTRO DERIVADO DEL MOTOR (2026-09-09).
//
// EL DEFECTO, y es la CUARTA vez con esta forma: los cuatro catalogos del registro
// (`indicator_definitions`, `phenotypes`, `fr_sectors`, `efr_states`) se generan corriendo el motor
// congelado, y los escribia SOLO `supabase/seed.ts`, cuyo atajo lleva `--env-file=.env.local` dentro. No
// habia canal a la nube en absoluto, asi que cada porte del motor se quedaba en local.
//
// LO QUE COSTO: la nube tenia 17 estados sin mecanismo y 20 sin biomarcadores mientras local tenia los 81
// completos, y ese texto es lo que el profesional LEE como diagnostico. Peor: se SELLA en el snapshot al
// diagnosticar, asi que cada diagnostico NUEVO heredaba el hueco. Y `fr_sectors` tenia 6 de 9 nombres
// distintos, con el `1_1` diciendo lo CONTRARIO que el motor.
//
// ESTE CANDADO AFIRMA DOS COSAS, y la segunda es la que de verdad cierra el hueco:
//   1. Que el `.sql` commiteado es EXACTAMENTE lo que el generador produce hoy (como el de condiciones
//      BIS). Si alguien re-porta el motor y no regenera, esto se pone rojo.
//   2. Que el contenido del `.sql` coincide con `buildRegistryData()`, que es la funcion que usa el SEED.
//      Sin esto, el candado solo probaria que el generador coincide consigo mismo: los dos canales
//      podrian estar de acuerdo entre ellos y en desacuerdo con el motor.

// LA ULTIMA, no la primera (2026-09-09). Cuando llego la segunda (`0114`, el renombre a 1.0.0), `find`
// devolvia la `0113` y el candado comparaba una migracion YA APLICADA contra el generador de hoy: rojo
// garantizado, y por el sitio equivocado. Las migraciones son forward-only, asi que la aplicada es
// historia inmutable; lo que tiene que coincidir con el generador es la ULTIMA.
const ARCHIVO = readdirSync("drizzle")
  .filter((f) => /^\d+_registro_del_motor\.sql$/.test(f))
  .sort()
  .pop();
const RUTA = `drizzle/${ARCHIVO ?? "(no-existe)"}`;
const NUMERO = (ARCHIVO ?? "").split("_")[0];

function generado(): string {
  return execFileSync("node", ["scripts/gen-registry-migration.mjs", NUMERO], {
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
}

// git puede dejar CRLF en el .sql del disco y el generador emite LF.
const norm = (s: string) => s.replace(/\r\n/g, "\n").trimEnd();
const SQL = () => norm(readFileSync(RUTA, "utf8"));

describe("la migración del registro se DERIVA del motor, no se escribe", () => {
  it("el control: el generador produce SQL con las cuatro tablas", () => {
    // Sin este control, un generador roto que devolviera vacio haria pasar la comparacion de abajo si el
    // fichero tambien lo estuviera.
    const sql = generado();
    for (const tabla of ["indicator_definitions", "phenotypes", "fr_sectors", "efr_states"]) {
      expect(sql, `el SQL generado no toca ${tabla}`).toContain(`INSERT INTO ${tabla}`);
    }
    expect(sql.length).toBeGreaterThan(5000);
  });

  it("el .sql commiteado es EXACTAMENTE lo que el generador produce hoy", () => {
    expect(ARCHIVO, "falta la migración del registro en drizzle/").toBeTruthy();
    expect(
      SQL(),
      `el motor y la migración divergieron: regenera con \`node scripts/gen-registry-migration.mjs ${NUMERO} > ${RUTA}\``,
    ).toBe(norm(generado()));
  });

  it("y está registrada en el journal, o no la aplica nadie", () => {
    // Un .sql en el disco sin su entrada en el journal es un fichero que drizzle-kit ignora: el cambio
    // queda commiteado y no llega a ninguna base. Es la misma clase de hueco que esto cierra.
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    expect(journal.entries.map((e) => e.tag)).toContain(RUTA.replace("drizzle/", "").replace(".sql", ""));
  });
});

describe("y su contenido es el MISMO que siembra el seed", () => {
  const registro = buildRegistryData();

  it("los 81 estados, con sus cinco campos", () => {
    // Se comprueba CAMPO POR CAMPO contra `buildRegistryData()`, que es lo que corre el seed. Es la
    // asercion que impide que los dos canales se pongan de acuerdo entre si y en desacuerdo con el motor.
    const sql = SQL();
    for (const e of registro.efrStates) {
      for (const campo of [e.diagnosisName, e.mechanism, e.biomarkers, e.risks, e.suggestedNutraceuticals]) {
        if (!campo) continue;
        expect(sql, `el estado ${e.stateNumber} no lleva "${campo.slice(0, 40)}"`).toContain(
          campo.replace(/'/g, "''"),
        );
      }
    }
  });

  it("y los nombres de los otros tres catálogos", () => {
    const sql = SQL();
    for (const grupo of [registro.indicators, registro.phenotypes, registro.frSectors]) {
      for (const fila of grupo) {
        expect(sql, `falta "${fila.name}"`).toContain(fila.name.replace(/'/g, "''"));
      }
    }
  });

  it("y no lleva NADA de más: las cuentas cuadran", () => {
    // La otra mitad. Sin esto, un SQL que trajera filas de sobra (una version vieja pegada al lado)
    // pasaria las dos aserciones de arriba.
    const sql = SQL();
    const filas = [...sql.matchAll(/^ {2}\('[0-9a-f-]{36}', /gm)].length;
    // El +1 es la fila de `model_versions`, que no sale de `buildRegistryData` (es la fila de la que los
    // cuatro catalogos CUELGAN). Se suma explicita para que el numero siga derivandose y no se escriba.
    expect(filas, "el número de filas del SQL no es 1 + 12 + 9 + 9 + 81").toBe(
      1 +
        registro.indicators.length +
        registro.phenotypes.length +
        registro.frSectors.length +
        registro.efrStates.length,
    );
  });
});

describe("la migración es segura de aplicar dos veces", () => {
  it("todo es upsert, y no borra nada", () => {
    // IDEMPOTENTE por construccion: los catalogos cuelgan de un `model_version_id` fijo y se corrigen en
    // sitio por su clave natural. Un DELETE aqui seria una operacion destructiva sobre contenido clinico
    // en produccion, y no hace falta.
    const sql = SQL();
    // CINCO desde el 2026-09-09: los cuatro catalogos mas la fila del modelo.
    expect((sql.match(/ON CONFLICT \([a-z_, ]+\) DO UPDATE SET/g) ?? []).length).toBe(5);
    expect(sql, "la migración del registro borra filas").not.toMatch(/\bDELETE\b/);
    expect(sql, "la migración del registro trunca").not.toMatch(/\bTRUNCATE\b/);
  });

  it("y dice el ANTES y el DESPUÉS, que es contenido clínico", () => {
    // Quien la aplica tiene que poder decir que habia y que quedo. Salen como NOTICE porque es lo unico
    // que reporta desde DENTRO de una migracion.
    const sql = SQL();
    expect(sql).toContain("RAISE NOTICE 'ANTES ·");
    expect(sql).toContain("RAISE NOTICE 'DESPUES ·");
    // Y se planta si el registro quedara incompleto, en vez de dejarlo a medias en silencio.
    expect(sql).toContain("RAISE EXCEPTION 'El registro quedo incompleto");
  });
});
