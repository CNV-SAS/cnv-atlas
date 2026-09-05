import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// CANDADO DEL BUMP DE ENCUESTA A v6 (2026-09-04).
//
// EL DEFECTO QUE CIERRA, y es de los que no dan error: un bump tiene DOS CANALES. El seed siembra local y
// la migracion siembra la nube. Si los dos se escriben por separado, divergen, y la divergencia es
// SILENCIOSA: cada canal queda coherente consigo mismo, local muestra un instrumento y la nube otro. Ya
// nos paso con los dos canales del plan del paciente, donde habian divergido en SEIS cosas antes de que
// un candado lo viera.
//
// Por eso la migracion se GENERA desde el seed y esto verifica que sigan sincronizados. No es una
// comparacion de copias: es que una de las dos es DERIVADA, y lo unico que hay que probar es que nadie
// edito la derivada a mano ni cambio la fuente sin regenerar.

const MIGRACION = "drizzle/0099_encuesta_v6.sql";
const sql = () => readFileSync(MIGRACION, "utf8").replace(/\r\n/g, "\n");
const seed = () => readFileSync("supabase/seed.ts", "utf8").replace(/\r\n/g, "\n");

describe("1 · la migración no se desincroniza del seed", () => {
  it("regenerarla produce EXACTAMENTE el archivo committeado", () => {
    // Si esto falla: alguien toco el seed y no regenero, o edito el .sql a mano. Se arregla corriendo
    //   node scripts/gen-survey-migration.mjs > drizzle/0099_encuesta_v6.sql
    const generada = execFileSync("node", ["scripts/gen-survey-migration.mjs"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }).replace(/\r\n/g, "\n");
    expect(generada).toBe(sql());
  });

  it("y el seed apunta a la v6, no a la v5", () => {
    // La constante y el numero se mueven JUNTOS: si uno se queda atras, el log del seed miente sobre lo
    // que sembro (ya paso con el bump a v4, que decia "v3" a mano).
    expect(seed()).toContain('const SURVEY_VERSION_ID = "55555555-5555-5555-5555-555555555556";');
    expect(seed()).toContain("const SURVEY_VERSION_NUMBER = 6;");
    expect(sql()).toContain("'55555555-5555-5555-5555-555555555556'");
  });
});

describe("2 · la migración es ADITIVA: no puede tocar una respuesta", () => {
  it("no borra, no actualiza, y no menciona las tablas de respuestas", () => {
    // ESTA ES LA ASERCION QUE PROTEGE DATOS DE PACIENTES. El seed borra y re-inserta las respuestas de la
    // version vigente; contra la nube eso se lleva datos reales, y por eso el bump va por migracion. Si
    // algun dia esta migracion (o su generador) aprende a borrar, sale por aqui.
    const s = sql().replace(/^--.*$/gm, ""); // los comentarios SI nombran esas tablas, al explicar por que no las tocan
    for (const prohibido of [/\bDELETE\b/i, /\bUPDATE\b/i, /\bTRUNCATE\b/i, /\bDROP\b/i]) {
      expect(s, `la migración contiene ${prohibido}`).not.toMatch(prohibido);
    }
    expect(s).not.toMatch(/survey_answers/);
    expect(s).not.toMatch(/survey_responses/);
  });

  it("y es idempotente: las tres inserciones toleran correrse dos veces", () => {
    expect(sql().match(/ON CONFLICT \(id\) DO NOTHING;/g)).toHaveLength(3);
  });
});

describe("3 · los cuatro cambios de contenido, que son SUYOS", () => {
  // Se afirma el CONTENIDO, no el conteo: un conteo se satisface con cualquier cosa.
  it("P23: la opción es 'No hago ejercicio' y el enunciado perdió el (≥30 min)", () => {
    expect(sql()).toContain("'No hago ejercicio'");
    expect(sql()).toContain("'¿Cuántos días/semana hace actividad física?'");
    // El control: el enunciado VIEJO ya no está en la v6.
    expect(sql()).not.toContain("(≥30 min)");
  });

  it("P24: entra '0 minutos a la semana', y va PRIMERA", () => {
    // El orden importa: es la opción que corresponde a "no hago ejercicio" de la pregunta anterior, y va
    // donde el paciente la busca. `order_index` 1.
    const m = /'0 minutos a la semana', null, 1\)/.exec(sql());
    expect(m, "la opción no está o no es la primera").toBeTruthy();
  });

  it("P44: cada sustancia lleva su alimento al lado", () => {
    for (const t of ["Lactosa (leche y lácteos)", "Gluten (trigo, pan, pasta)", "Fructosa (frutas, miel)"]) {
      expect(sql()).toContain(`'${t}'`);
    }
    // Y NO se fusionó con la P43: siguen siendo dos preguntas distintas, como él pidió el 3-sep.
    expect(sql()).toContain("'¿Alergias alimentarias diagnosticadas?'");
    expect(sql()).toContain("'¿Intolerancias alimentarias?'");
  });

  it("P43: se queda 'Otra' en singular, que es divergencia DECLARADA", () => {
    // No es un olvido: es DIV-11. Su archivo dice "Otras"; se queda "Otra" porque las opciones de esa
    // pregunta son alimentos en singular, porque las otras ocho preguntas ya llevan "Otra", y porque en
    // la nube hay cinco respuestas "Otra: ..." con su texto libre.
    //
    // Y LO QUE SE PROTEGE NO ES LA PALABRA: es que la divergencia siga DECLARADA. Lo que estaba mal antes
    // no era decir "Otra", era que el comentario del seed afirmaba haberlo portado verbatim.
    const div = readFileSync("docs/DIVERGENCIAS.md", "utf8");
    expect(div, "DIV-11 tiene que existir mientras la divergencia exista").toContain("DIV-11");
    expect(div).toContain('la P43 (alergias) dice "Otra"');
    expect(seed(), "el seed tiene que remitir a la divergencia").toContain("DIVERGENCIAS.md (DIV-11)");
  });

  it("y la P29 conserva sus extremos, que es la otra divergencia declarada", () => {
    // No se retira: una escala de 1 a 10 sin sus extremos no se puede responder bien, y ese valor
    // alimenta el motor. Lo que faltaba era declararla (DIV-12).
    expect(sql()).toContain("(1 = sin estrés, 10 = máximo)");
    expect(readFileSync("docs/DIVERGENCIAS.md", "utf8")).toContain("DIV-12");
  });
});

describe("4 · lo que el bump NO puede cambiar", () => {
  it("las 64 preguntas siguen siendo 64, con sus mismos field_key", () => {
    // Un bump de instrumento cambia TEXTO y OPCIONES. Si cambiara el conjunto de `field_key`, el motor
    // dejaria de encontrar sus insumos y el diagnostico se degradaria en silencio.
    // El orden de columnas es (..., question_type, field_key, hint, section, ...), asi que entre la clave
    // y la seccion va el hint, que puede ser null o texto. Se ancla en la SECCION, que es un conjunto
    // cerrado: anclar en la posicion seria lo mismo que contar comas.
    const SECCIONES =
      "Alimentación|Percepción corporal|Hábitos|Conductas alimentarias|Antecedentes y estilo de vida|Alergias y digestión|Hidratación|Contexto social|Otras";
    const re = new RegExp(`'([a-z0-9_]+)', (?:'(?:[^']|'')*'|null), '(?:${SECCIONES})'`, "g");
    const conFieldKey = [...sql().matchAll(re)].map((m) => m[1]);
    expect(conFieldKey.length, "el extractor no encontró ninguna clave").toBeGreaterThan(30);
    // Los 13 del diagnostico, que son los que el candado de acoplamiento vigila.
    for (const k of ["d3_23", "d3_24", "d3_26", "d3_30", "d3_31", "d5_36", "d5_39"]) {
      expect(conFieldKey, `falta el field_key ${k}`).toContain(k);
    }
    expect(sql()).toContain("-- 64 preguntas, 306 opciones.");
  });
});
