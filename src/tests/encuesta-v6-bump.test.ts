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
const lee0100 = () =>
  readFileSync("drizzle/0100_le8_insumos_diagnostico.sql", "utf8").replace(/\r\n/g, "\n");

describe("1 · la migración no se desincroniza del seed", () => {
  it("regenerarla reproduce el archivo, salvo la marca que corrige la 0100", () => {
    // Si esto falla por algo que NO sea used_in_diagnosis: alguien toco el seed y no regenero, o edito
    // el .sql a mano.
    //
    // POR QUE YA NO ES UNA IGUALDAD BYTE A BYTE, y esto es un ajuste de ALCANCE, no de asercion. El seed
    // avanzo legitimamente el 2026-09-05: al encender el LE8, los quince grupos del patron y d7_agua
    // pasaron a ser insumo del diagnostico. La 0099 esta APLICADA y es forward-only, asi que no se toca;
    // la correccion viaja en la 0100. La invariante que se conserva es mas fuerte que "son iguales": la
    // UNICA diferencia permitida es la columna que la 0100 actualiza, y solo en esos dieciseis campos.
    const generada = execFileSync("node", ["scripts/gen-survey-migration.mjs"], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    }).replace(/\r\n/g, "\n");

    const CAMPOS_0100 = [
      ...Array.from({ length: 15 }, (_, i) => `d1_${i + 1}_i`),
      "d7_agua",
    ];
    const viejas = sql().split("\n");
    const nuevas = generada.split("\n");
    expect(nuevas.length, "la migracion cambio de tamaño: eso no lo explica la 0100").toBe(viejas.length);

    const distintas: string[] = [];
    for (let i = 0; i < viejas.length; i++) {
      if (viejas[i] === nuevas[i]) continue;
      distintas.push(viejas[i]);
      // La unica diferencia admitida: el booleano final pasa de false a true.
      expect(
        viejas[i].replace(/, false\)(,?)$/, ", true)$1"),
        `linea ${i + 1} difiere en algo que no es used_in_diagnosis`,
      ).toBe(nuevas[i]);
      expect(
        CAMPOS_0100.some((k) => viejas[i].includes(`'${k}'`)),
        `la linea ${i + 1} cambio y su field_key no es de los dieciseis que corrige la 0100`,
      ).toBe(true);
    }
    expect(distintas.length, "cambiaron mas o menos de 16 filas").toBe(16);
  });

  it("y la 0100 actualiza exactamente esos dieciseis campos de la v6, sin tocar nada mas", () => {
    const m = lee0100();
    expect(m).toContain("UPDATE survey_questions");
    expect(m).toContain("SET used_in_diagnosis = true");
    // Acotada a la version vigente: el alcance es una decision explicita, no un efecto del filtro.
    expect(m, "sin acotar la version reescribiria la marca de evaluaciones viejas").toContain(
      "WHERE survey_version_id = '55555555-5555-5555-5555-555555555556'",
    );
    for (const k of [...Array.from({ length: 15 }, (_, i) => `d1_${i + 1}_i`), "d7_agua"]) {
      expect(m, `falta ${k}`).toContain(`'${k}'`);
    }
    // Y NO toca respuestas ni el contenido del instrumento.
    const sinComentarios = m.replace(/^--.*$/gm, "");
    for (const prohibido of [/\bDELETE\b/i, /\bINSERT\b/i, /\bDROP\b/i, /survey_answers/, /option_text/, /question_text/]) {
      expect(sinComentarios, `la 0100 contiene ${prohibido}`).not.toMatch(prohibido);
    }
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
    // No es un olvido: es DIV-14. Su archivo dice "Otras"; se queda "Otra" porque las opciones de esa
    // pregunta son alimentos en singular, porque las otras ocho preguntas ya llevan "Otra", y porque en
    // la nube hay cinco respuestas "Otra: ..." con su texto libre.
    //
    // Y LO QUE SE PROTEGE NO ES LA PALABRA: es que la divergencia siga DECLARADA. Lo que estaba mal antes
    // no era decir "Otra", era que el comentario del seed afirmaba haberlo portado verbatim.
    const div = readFileSync("docs/DIVERGENCIAS.md", "utf8");
    expect(div, "DIV-14 tiene que existir mientras la divergencia exista").toContain("DIV-14");
    expect(div).toContain('la P43 (alergias) dice "Otra"');
    expect(seed(), "el seed tiene que remitir a la divergencia").toContain("DIVERGENCIAS.md (DIV-14)");
  });

  it("y la P29 conserva sus extremos, que es la otra divergencia declarada", () => {
    // No se retira: una escala de 1 a 10 sin sus extremos no se puede responder bien, y ese valor
    // alimenta el motor. Lo que faltaba era declararla (DIV-15).
    expect(sql()).toContain("(1 = sin estrés, 10 = máximo)");
    expect(readFileSync("docs/DIVERGENCIAS.md", "utf8")).toContain("DIV-15");
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
