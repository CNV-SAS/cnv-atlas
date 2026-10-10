import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  normalizeSex,
  sexoParaDiagnosticar,
} from "@/modules/clinical-pipeline/services/build-engine-input";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ QUE FALTE EL SEXO ES UNA PUERTA, NO UN 500 (Sentry, 2026-10-10) ═══
//
// ── EL CASO ──────────────────────────────────────────────────────────────────────────────────────
//
// Una integrante abrió la pestaña Diagnóstico de una paciente sin sexo registrado. `normalizeSex` lanzó,
// la excepción salió de la acción, la petición murió con un 500, el panel quedó en "Esta pestaña no se
// pudo mostrar" y "Volver a intentarlo" llevaba a una página que no cargaba. Siete eventos en Sentry: lo
// intentó siete veces sin que nada le dijera qué faltaba ni dónde ponerlo.
//
// ── QUE VIGILA ESTE CANDADO, Y POR QUE SON TRES COSAS DISTINTAS ─────────────────────────────────
//
//   1. QUE LA PUERTA Y EL FRENO MIREN LO MISMO. Es la parte que no se puede comprobar leyendo: si la
//      puerta admite un valor que `normalizeSex` rechaza, vuelve el 500 exacto; y si rechaza uno que el
//      motor aceptaría, se frena a un paciente sano. Se prueban juntos sobre los mismos valores.
//   2. QUE NINGUN CAMINO AL MOTOR SE LA SALTE. El 500 no vino de que faltara la regla: vino de que había
//      DOS llamadores de `buildEngineInput` y ninguno la tenía. Un tercero mañana la volvería a traer.
//   3. QUE EL REMEDIO SEA ALCANZABLE. La ficha rellena el hueco y nunca pisa un valor, así que el aviso
//      solo puede mandar ahí cuando el sexo está VACIO. Mandar un "mujer" de los perfiles viejos a la
//      ficha sería mandarlo a una puerta cerrada, que es el defecto que acabamos de corregir en la
//      prescripción.

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

describe("la puerta del sexo y el freno del motor no pueden divergir", () => {
  // EL MISMO JUEGO DE VALORES PARA LOS DOS. Incluye lo que de verdad hay en la base: nulos del import del
  // HTML, blancos del intake viejo de texto libre, y palabras completas de antes de la decisión A.
  const VALORES: (string | null)[] = [
    "F",
    "M",
    "f",
    "m",
    " F ",
    null,
    "",
    "   ",
    "mujer",
    "Femenino",
    "masculino",
    "X",
    "0",
  ];

  it.each(VALORES.map((v) => [JSON.stringify(v)] as const))(
    "para %s, la puerta admite exactamente lo que el motor acepta",
    (crudo) => {
      const v = JSON.parse(crudo) as string | null;
      const puerta = sexoParaDiagnosticar(v);
      let motorLoAcepta = true;
      try {
        normalizeSex(v);
      } catch {
        motorLoAcepta = false;
      }
      expect(
        puerta.allowed,
        `la puerta dice ${puerta.allowed} y el motor ${motorLoAcepta} para ${crudo}. Si divergen, un valor ` +
          "pasa la puerta y revienta en normalizeSex, que es el 500 que este candado existe para que no vuelva.",
      ).toBe(motorLoAcepta);
    },
  );

  it("vacio manda a la ficha; un valor invalido NO, porque la ficha no lo arregla", () => {
    for (const vacio of [null, "", "   "]) {
      const r = sexoParaDiagnosticar(vacio);
      expect(r.allowed).toBe(false);
      if (r.allowed) return;
      expect(r.enLaFicha, `${JSON.stringify(vacio)} lo completa el profesional en la ficha`).toBe(true);
    }
    // "mujer" NO: el writer de la ficha solo escribe donde el valor esta vacio, asi que el enlace no
    // resolveria nada. Lo canoniza el script de normalizacion.
    const invalido = sexoParaDiagnosticar("mujer");
    expect(invalido.allowed).toBe(false);
    if (invalido.allowed) return;
    expect(invalido.enLaFicha).toBe(false);
  });

  it("el mensaje dice que falta Y donde se pone, no solo que no se puede", () => {
    const r = sexoParaDiagnosticar(null);
    expect(r.allowed).toBe(false);
    if (r.allowed) return;
    expect(r.message).toMatch(/sexo/i);
    expect(r.message, "sin esto el profesional queda bloqueado sin saber a donde ir").toMatch(/ficha/i);
    // Y NO SE NOMBRA UN SIMBOLO NI UN CODIGO DE ERROR: lo lee quien atiende, con el paciente delante.
    expect(r.message).not.toMatch(/normalizeSex|null|undefined|500/);
  });
});

describe("ningun camino al motor se salta la puerta", () => {
  // LOS QUE PUEDEN NO LLAMARLA, con su razon escrita. La simulacion con la ciencia de hoy no es un camino
  // al diagnostico: es una lectura de apoyo para un aviso, envuelta en un catch que devuelve null a
  // proposito (un fallo ahi no puede impedir ver el diagnostico que ya existe).
  const SIN_PUERTA_A_PROPOSITO = new Map([
    [
      "src/modules/clinical-pipeline/data/simular-con-ciencia-de-hoy.ts",
      "lectura de apoyo: catch que devuelve null, no sella nada",
    ],
    ["src/modules/clinical-pipeline/services/build-engine-input.ts", "es donde viven la puerta y el freno"],
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
      // Si esta en la lista, se exige que SIGA siendo lo que su razon dice: la silenciosa tiene que
      // seguir teniendo su catch. Una excepcion declarada que cambia de conducta es peor que ninguna.
      if (archivo.includes("simular-con-ciencia-de-hoy")) {
        expect(src, "la excepcion vale porque se traga el fallo y devuelve null").toMatch(/catch/);
      }
      return;
    }
    // SE BUSCA LA LLAMADA, NO EL NOMBRE, y la diferencia es todo el candado: al verificarlo invirtiendo
    // el writer (quitar la puerta de run-pipeline) el test siguio VERDE, porque el nombre seguia en la
    // linea del import, antes de todo. Un candado que mira un nombre mira el import.
    const iPuerta = src.search(/sexoParaDiagnosticar\s*\(/);
    const iMotor = src.search(/\bbuildEngineInput\s*\(/);
    expect(
      iPuerta,
      `${archivo} arma el insumo del motor sin mirar el sexo. normalizeSex LANZA, y una excepcion que sale ` +
        "de una server action es un 500 con la pantalla caida (el caso del 2026-10-10). Llama a " +
        "sexoParaDiagnosticar antes y devuelve su mensaje como error de validacion, o declara la excepcion " +
        "en SIN_PUERTA_A_PROPOSITO con su razon.",
    ).toBeGreaterThanOrEqual(0);
    expect(iPuerta, "la puerta va ANTES de armar el insumo, no despues").toBeLessThan(iMotor);
  });
});

describe("el remedio existe y solo rellena huecos", () => {
  const WRITER = "src/modules/patients/data/patient-sex-writer.ts";

  it("el writer condiciona la escritura al valor VACIO, en el propio where", () => {
    const src = sinComentarios(leer(WRITER));
    expect(src, "sin esto, la pantalla podria pisar el sexo de un diagnostico ya sellado").toMatch(
      /\.where\(/,
    );
    expect(src).toMatch(/is null/);
    expect(src, "vacio es nulo O en blanco: las dos formas existen en la base").toMatch(/btrim/);
  });

  it("y ningun otro escritor del modulo actualiza el perfil sin esa condicion", () => {
    const todos = readdirSync(join(RAIZ, "src/modules/patients/data"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `src/modules/patients/data/${f}`);
    const escritores = todos.filter((f) => /update\(patientProfiles\)/.test(sinComentarios(leer(f))));
    expect(
      escritores,
      "un segundo escritor sin el where dejaria el candado del primero sin valor",
    ).toEqual([WRITER]);
  });

  it("el bloque de la ficha aparece SOLO cuando falta", () => {
    const pagina = sinComentarios(leer("src/app/(app)/pacientes/[patientId]/page.tsx"));
    expect(pagina).toMatch(/<CompletarSexo/);
    expect(
      pagina,
      "si se rindiera siempre, un campo editable permanente invita a teclear encima de un dato bueno",
    ).toMatch(/leFaltaElSexo/);
  });

  it("y los dos paneles pintan la etiqueta que trae el enlace, no una fija", () => {
    // Estuvo fija en "Completar la encuesta" y por eso la segunda salida habria mandado a la encuesta a
    // arreglar un dato que no esta ahi.
    for (const f of [
      "src/modules/clinical-pipeline/components/generate-diagnosis-panel.tsx",
      "src/modules/clinical-pipeline/components/pipeline-runner.tsx",
    ]) {
      const src = sinComentarios(leer(f));
      expect(src, `${f} tiene que pintar la etiqueta de la salida`).toMatch(/salida\.etiqueta/);
      expect(src, `${f} no puede volver a escribir la etiqueta a mano`).not.toMatch(
        /Completar la encuesta con el paciente/,
      );
    }
  });
});

describe("y el import deja de meter pacientes sin sexo en silencio", () => {
  it("los cuenta y la pantalla lo dice al terminar", () => {
    const writer = sinComentarios(leer("src/modules/importacion-html/data/importar-lote-writer.ts"));
    expect(
      writer,
      "el hueco por donde entro el caso: el mapeo devuelve null y nadie se enteraba",
    ).toMatch(/pacientesSinSexo/);
    const pantalla = sinComentarios(
      leer("src/modules/importacion-html/components/revision-importacion.tsx"),
    );
    expect(pantalla).toMatch(/pacientesSinSexo/);
  });

  it("y ningun lector clinico vuelve a suponer masculino cuando falta", () => {
    // LA SUPOSICION QUE DEJO A UNA PACIENTE CLASIFICADA COMO HOMBRE: decidir el sexo con
    // "si no empieza por f, es hombre" hace que CUALQUIER ausencia caiga en masculino, en silencio.
    // Se barre la FORMA, no el archivo, porque la misma linea reaparecio en tres sitios distintos.
    const sospechosos = fuentes("src/modules").filter((f) => {
      const src = sinComentarios(leer(f));
      return /startsWith\(\s*"f"\s*\)\s*\?\s*"F"\s*:\s*"M"/.test(src) || /!\(\w*\.?sex\w*\s*\?\?\s*""\)/.test(src);
    });
    expect(
      sospechosos,
      `estos deciden el sexo por "si no empieza por f, es hombre": ${sospechosos.join(", ")}. Una paciente ` +
        "sin sexo se clasifica y se trata como hombre, y nada en pantalla lo dice. Sin el dato no se adivina: " +
        "se devuelve null y el bloque no se rinde.",
    ).toEqual([]);
  });
});
