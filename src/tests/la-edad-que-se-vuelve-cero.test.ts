import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  computeAge,
  edadParaDiagnosticar,
  edadSiSePuede,
  EDAD_MAXIMA_POSIBLE,
} from "@/modules/clinical-pipeline/services/build-engine-input";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ UNA FECHA ILEGIBLE NO SE VUELVE EDAD CERO ═══
//
// ── EL CASO ──────────────────────────────────────────────────────────────────────────────────────
//
// `computeAge` devolvia 0 ante una fecha ausente o ilegible. Medido en la nube el 2026-10-22: TRES
// evaluaciones selladas lo arrastran, y el IAE que produjeron (+28,1 y +41,5 anos de "aceleracion del
// envejecimiento") sale EXACTAMENTE igual a la EB-BIS entera, porque `computeIAE` resta la edad. Son
// numeros que se leen perfectamente plausibles y nada en pantalla los distingue de uno bueno.
//
// Y al medir DONDE entra la edad resulto peor que el IAE: con edad 0 la clasificacion de capacitancia se
// PIERDE (`capRef` devuelve null) y el GEB de la cadena calorica trata al paciente como si tuviera 30
// (`atlas-tratamiento-nutri.js:97`, `Number(e.edad)||30`). Lo que salvo el gasto basal del diagnostico
// fue suerte: `ATLAS_GEB_HB` si guarda y `ATLAS_GEB` prefiere el GEB medido por el equipo.
//
// Gildardo lo pidio por su lado en la EB-BIS v7 (tabla 1, errores 3 y 4): "exigir fecha de nacimiento
// antes de calcular; sin edad valida el motor devuelve pendiente".
//
// ── QUE VIGILA ESTE CANDADO, Y POR QUE SON CUATRO COSAS ─────────────────────────────────────────
//
//   1. QUE LA PUERTA Y EL FRENO MIREN LO MISMO. Si la puerta admite una fecha que `computeAge` rechaza,
//      vuelve el 500; si rechaza una que el motor aceptaria, se frena a un paciente sano.
//   2. QUE NINGUN CAMINO AL MOTOR SE LA SALTE. Es la leccion del sexo: el 500 no vino de que faltara la
//      regla, vino de que habia DOS llamadores y ninguno la tenia.
//   3. QUE LA EDAD SE MIDA A LA FECHA DE LA MEDICION. Con `new Date()` el mismo registro da una edad
//      distinta segun el dia en que se diagnostique o se corrija.
//   4. QUE EL REMEDIO EXISTA Y SOLO RELLENE HUECOS. Un freno sin salida no es un guard: detiene a una
//      persona. Hay 15 pacientes reales sin fecha.

const RAIZ = process.cwd();
const leer = (f: string) => readFileSync(join(RAIZ, f), "utf8");

function fuentes(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(join(RAIZ, dir), { withFileTypes: true })) {
    const p = `${dir}/${d.name}`;
    if (d.isDirectory()) {
      if (p.endsWith("/tests")) continue;
      out.push(...fuentes(p));
    } else if (/\.tsx?$/.test(d.name) && d.name !== "database.generated.ts") {
      out.push(p);
    }
  }
  return out;
}

const AL_MEDIR = new Date("2026-09-28T00:00:00Z");

describe("la puerta de la edad y el freno del motor no pueden divergir", () => {
  // LO QUE DE VERDAD HAY (o hubo) EN LA BASE: nulos del lote del HTML, el ano de cinco digitos del
  // tecleo, el 1795 que dio edad 231, y una fecha posterior a la medicion.
  const FECHAS: (string | null)[] = [
    "1980-04-19",
    "2010-05-26",
    "1896-01-01",
    null,
    "",
    "   ",
    "41980-04-19",
    "1795-02-21",
    "2030-01-01",
    "no-es-una-fecha",
    "1980-4-19",
  ];

  it.each(FECHAS.map((f) => [JSON.stringify(f)] as const))(
    "para %s, la puerta admite exactamente lo que el motor acepta",
    (crudo) => {
      const f = JSON.parse(crudo) as string | null;
      const puerta = edadParaDiagnosticar(f, AL_MEDIR);
      let motorLoAcepta = true;
      try {
        computeAge(f, AL_MEDIR);
      } catch {
        motorLoAcepta = false;
      }
      expect(
        puerta.allowed,
        `la puerta dice ${puerta.allowed} y el motor ${motorLoAcepta} para ${crudo}. Si divergen, una fecha ` +
          "pasa la puerta y revienta en computeAge, que es el 500 que este candado existe para que no vuelva.",
      ).toBe(motorLoAcepta);
    },
  );

  it("una fecha ausente o ilegible NO se vuelve cero, que es todo el cambio", () => {
    for (const malas of [null, "", "41980-04-19", "no-es-una-fecha"]) {
      expect(edadSiSePuede(malas, AL_MEDIR), `${JSON.stringify(malas)} no es una edad`).toBeNull();
      expect(() => computeAge(malas, AL_MEDIR)).toThrow(/fecha de nacimiento invalida/);
    }
  });

  it("el cinturon atrapa lo IMPOSIBLE y no lo improbable", () => {
    // El 1795 que dio 231 anos, y una fecha posterior a la medicion (edad negativa).
    expect(edadSiSePuede("1795-02-21", AL_MEDIR)).toBeNull();
    expect(edadSiSePuede("2030-01-01", AL_MEDIR)).toBeNull();
    // Y NO atrapa a nadie que pueda estar vivo: ni al mas viejo posible ni a un menor. La EB-BIS v7 no
    // aplica a menores de 16, pero eso deja la EB-BIS "pendiente", no frena el diagnostico entero.
    expect(edadSiSePuede("1906-01-01", new Date("2026-01-01T00:00:00Z"))).toBe(120);
    expect(edadSiSePuede("2010-05-26", AL_MEDIR)).toBe(16);
    expect(edadSiSePuede("2013-07-12", AL_MEDIR)).toBe(13);
    expect(EDAD_MAXIMA_POSIBLE).toBe(130);
  });

  it("trunca los anos cumplidos, no redondea (Gildardo, v7 tabla 1 error 6)", () => {
    // Un dia antes del cumpleanos sigue teniendo la edad anterior, aunque falte casi nada.
    expect(edadSiSePuede("1980-09-29", AL_MEDIR)).toBe(45);
    expect(edadSiSePuede("1980-09-28", AL_MEDIR)).toBe(46);
  });

  it("vacio manda a la ficha; una fecha imposible NO, porque la ficha no la pisa", () => {
    for (const vacio of [null, "", "   "]) {
      const r = edadParaDiagnosticar(vacio, AL_MEDIR);
      expect(r.allowed).toBe(false);
      if (r.allowed) return;
      expect(r.enLaFicha, `${JSON.stringify(vacio)} lo completa el profesional en la ficha`).toBe(true);
    }
    const imposible = edadParaDiagnosticar("1795-02-21", AL_MEDIR);
    expect(imposible.allowed).toBe(false);
    if (imposible.allowed) return;
    expect(imposible.enLaFicha).toBe(false);
  });

  it("el mensaje dice que falta Y donde se pone, sin nombrar un simbolo", () => {
    const r = edadParaDiagnosticar(null, AL_MEDIR);
    expect(r.allowed).toBe(false);
    if (r.allowed) return;
    expect(r.message).toMatch(/fecha de nacimiento/i);
    expect(r.message, "sin esto el profesional queda bloqueado sin saber a donde ir").toMatch(/ficha/i);
    expect(r.message).not.toMatch(/computeAge|null|undefined|500/);
  });
});

describe("la edad se mide a la fecha de la MEDICION, no a la de hoy", () => {
  it("el lector del pipeline trae la fecha de la medicion", () => {
    const src = sinComentarios(leer("src/modules/clinical-pipeline/data/pipeline-reader.ts"));
    expect(
      src,
      "sin la fecha de la medicion, la edad se calcula contra el reloj y el mismo registro da dos edades",
    ).toMatch(/measurementDate: bisMeasurements\.measurementDate/);
    expect(src).toMatch(/measurementDate: measurement\?\.measurementDate/);
  });

  it("y el armador del insumo la prefiere sobre el reloj", () => {
    const src = sinComentarios(
      leer("src/modules/clinical-pipeline/services/build-engine-input.ts"),
    );
    expect(src).toMatch(/computeAge\(raw\.birthDate, raw\.measurementDate \? new Date\(raw\.measurementDate\) : now\)/);
  });

  it("el mismo registro da la MISMA edad se mire cuando se mire", () => {
    // La paciente de la medicion del 28 de septiembre: tenia 46. Mirado un ano despues sigue teniendo 46
    // EN ESA MEDICION, que es lo que el diagnostico sellado afirma.
    const nacimiento = "1980-02-23";
    expect(edadSiSePuede(nacimiento, AL_MEDIR)).toBe(46);
    expect(edadSiSePuede(nacimiento, new Date("2027-09-28T00:00:00Z"))).toBe(47);
    // O sea: si la fecha de la medicion no viajara, el numero cambiaria solo con el calendario.
  });
});

describe("ningun camino al motor se salta la puerta de la edad", () => {
  const SIN_PUERTA_A_PROPOSITO = new Map([
    [
      "src/modules/clinical-pipeline/data/simular-con-ciencia-de-hoy.ts",
      "lectura de apoyo: catch que devuelve null, no sella nada",
    ],
    [
      "src/modules/clinical-pipeline/services/build-engine-input.ts",
      "es donde viven la puerta y el freno",
    ],
  ]);

  const llamadores = fuentes("src").filter((f) =>
    /\bbuildEngineInput\s*\(/.test(sinComentarios(leer(f))),
  );

  it("hay llamadores que vigilar (si esto falla, el barrido no mira nada)", () => {
    expect(llamadores.length).toBeGreaterThanOrEqual(3);
  });

  it.each(llamadores.map((f) => [f] as const))("%s pasa por la puerta", (archivo) => {
    const src = sinComentarios(leer(archivo));
    if (SIN_PUERTA_A_PROPOSITO.has(archivo)) {
      if (archivo.includes("simular-con-ciencia-de-hoy")) {
        expect(src, "la excepcion vale porque se traga el fallo y devuelve null").toMatch(/catch/);
      }
      return;
    }
    // SE BUSCA LA LLAMADA, NO EL NOMBRE: el nombre tambien aparece en la linea del import, antes de todo.
    const iPuerta = src.search(/edadParaDiagnosticar\s*\(/);
    const iMotor = src.search(/\bbuildEngineInput\s*\(/);
    expect(
      iPuerta,
      `${archivo} arma el insumo del motor sin mirar la edad. computeAge LANZA desde el 2026-10-24, y una ` +
        "excepcion que sale de una server action es un 500 con la pantalla caida. Llama a " +
        "edadParaDiagnosticar antes y devuelve su mensaje como error de validacion, o declara la excepcion " +
        "en SIN_PUERTA_A_PROPOSITO con su razon.",
    ).toBeGreaterThanOrEqual(0);
    expect(iPuerta, "la puerta va ANTES de armar el insumo, no despues").toBeLessThan(iMotor);
  });
});

describe("el remedio existe y solo rellena huecos", () => {
  const WRITER = "src/modules/patients/data/patient-birthdate-writer.ts";

  it("el writer condiciona la escritura a la fecha NULA, en el propio where", () => {
    const src = sinComentarios(leer(WRITER));
    expect(
      src,
      "sin esto, la pantalla podria pisar la fecha que decidio la rama de un consentimiento firmado",
    ).toMatch(/\.where\(/);
    expect(src).toMatch(/is null/);
  });

  it("y deja rastro clinico inline en la transaccion (regla dura 8)", () => {
    const src = sinComentarios(leer(WRITER));
    expect(src).toMatch(/recordAudit\(tx,/);
    expect(src, "el valor va al rastro: es insumo del diagnostico, no un dato de contacto").toMatch(
      /fechaDeNacimiento: birthDate/,
    );
  });

  it("la ficha ofrece el bloque SOLO cuando falta", () => {
    const pagina = sinComentarios(leer("src/app/(app)/pacientes/[patientId]/page.tsx"));
    expect(pagina).toMatch(/<CompletarFechaDeNacimiento/);
    expect(
      pagina,
      "si se rindiera siempre, un campo editable permanente invita a teclear encima de un dato bueno",
    ).toMatch(/leFaltaLaFecha/);
  });

  it("y la puerta OFRECE la salida, que es lo que la distingue de un callejon", () => {
    const action = sinComentarios(leer("src/modules/clinical-pipeline/actions.ts"));
    expect(action).toMatch(/faltaLaFechaDeNacimiento/);
    expect(action, "la etiqueta tiene que nombrar el dato, no decir solo 'ir a la ficha'").toMatch(
      /fecha de nacimiento/,
    );
    const run = sinComentarios(leer("src/modules/clinical-pipeline/services/run-pipeline.ts"));
    // LA BANDERA SOLO EN EL CASO QUE LA FICHA RESUELVE. Un enlace que no resuelve nada es peor que ninguno.
    expect(run).toMatch(/edad\.enLaFicha \? \{ faltaLaFechaDeNacimiento: "1" \}/);
  });

  it("el esquema rechaza lo imposible y lo dice en espanol", () => {
    const src = leer("src/modules/patients/validations.ts");
    const bloque = src.slice(src.indexOf("fechaDeNacimientoPacienteSchema"));
    expect(bloque).toMatch(/\\d\{4\}-\\d\{2\}-\\d\{2\}/);
    expect(bloque, "una fecha posterior a hoy no es la de nacimiento de nadie").toMatch(/130/);
  });
});
