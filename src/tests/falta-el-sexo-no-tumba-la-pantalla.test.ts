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

  it("y ningun otro ARCHIVO del modulo actualiza el perfil", () => {
    const todos = readdirSync(join(RAIZ, "src/modules/patients/data"))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => `src/modules/patients/data/${f}`);
    const escritores = todos.filter((f) => /update\(patientProfiles\)/.test(sinComentarios(leer(f))));
    expect(
      escritores,
      "un segundo archivo que escriba el sexo dejaria el candado de este sin valor: las dos formas de " +
        "escribirlo (rellenar un hueco y corregir un valor) viven juntas a proposito, para que no divergan",
    ).toEqual([WRITER]);
  });

  // ═══ Y DESDE EL 2026-10-10 HAY DOS ACTOS, NO UNO (Santiago) ═══
  //
  // ── POR QUE SE ABRIO LA PUERTA QUE ESTE MISMO ARCHIVO DECIA CERRAR ──
  //
  // Porque cerrarla dejaba un callejon. Textual suyo: *"un paciente por ejemplo transexual puede pensar que
  // es el genero, entonces el profesional debe poder cambiarlo."* El motor usa el sexo BIOLOGICO, asi que un
  // genero anotado ahi no es un dato de identidad mal puesto: es un insumo clinico equivocado que produce
  // clasificaciones equivocadas, y no tenia arreglo desde la pantalla.
  //
  // ── LO QUE NO SE RELAJO ──
  //
  // Que nadie pise un sexo EN SILENCIO. Rellenar un hueco sigue sin poder pisar nada (su `where` lo impone);
  // pisar un valor es OTRA funcion, exige motivo, y deja en el rastro de que valor a cual se paso. Si esas
  // tres cosas se caen, volvemos a tener un dato clinico que cambia sin que nadie pueda reconstruir por que
  // el mismo paciente se clasifico de dos formas.
  describe("corregir un sexo ya registrado es otro acto, y deja dicho de que a que", () => {
    it("rellenar un hueco sigue sin poder pisar un valor", () => {
      const src = sinComentarios(leer(WRITER));
      const completar = src.slice(
        src.indexOf("export async function completarSexoDelPaciente"),
        src.indexOf("export async function corregirSexoDelPaciente"),
      );
      expect(completar.length, "falta la funcion de completar").toBeGreaterThan(0);
      expect(completar, "completar dejo de condicionar al valor vacio: ya podria pisar un sexo").toMatch(
        /is null/,
      );
    });

    it("corregir exige MOTIVO y lo valida en el servidor", () => {
      const validaciones = leer("src/modules/patients/validations.ts");
      expect(validaciones).toMatch(/correccionDeSexoSchema/);
      // SIN MINIMO, un espacio pasaria por motivo y el rastro no explicaria nada.
      const schema = validaciones.slice(validaciones.indexOf("correccionDeSexoSchema"));
      expect(schema, "el motivo tiene que exigir algo escrito, no solo existir").toMatch(/\.min\(\d+/);
    });

    it("y escribe en el rastro clinico el valor ANTERIOR, el nuevo y el motivo", () => {
      const src = sinComentarios(leer(WRITER));
      const corregir = src.slice(src.indexOf("export async function corregirSexoDelPaciente"));
      expect(corregir, "falta la funcion de corregir").not.toBe("");
      expect(corregir).toMatch(/recordAudit/);
      expect(
        corregir,
        "sin el valor anterior, el rastro no explica por que dos diagnosticos del mismo paciente clasifican distinto",
      ).toMatch(/sexoAnterior/);
      expect(corregir).toMatch(/motivo/);
      // ── Y EL VIEJO SE LEE CON LA FILA BLOQUEADA ──
      //
      // Lee y escribe en la misma transaccion. Sin `for update`, entre leer y escribir cabe otra correccion
      // y el rastro afirmaria que se partio de un valor que ya no era el que habia.
      expect(corregir, 'la lectura del valor viejo perdio su `for("update")`').toMatch(
        /\.for\(\s*"update"\s*\)/,
      );
    });

    it("la ficha ofrece completar O corregir, nunca las dos a la vez", () => {
      const pagina = sinComentarios(leer("src/app/(app)/pacientes/[patientId]/page.tsx"));
      expect(pagina).toMatch(/<CorregirSexo/);
      // SON EXCLUYENTES POR CONSTRUCCION: uno pide que falte, el otro que este. Ofrecer los dos sobre el
      // mismo campo es como se lee una pantalla mal hecha.
      expect(pagina).toMatch(/puedeCorregirSexo = canCorrectPatientSex\(user\) && !leFaltaElSexo/);
    });

    it("y dice que NO rehace los diagnosticos ya generados, antes de pulsar", () => {
      // ES LA PARTE QUE MAS IMPORTA DEL TEXTO. Un diagnostico generado es el registro de lo que se concluyo
      // con los datos de entonces, y Atlas no lo reescribe por detras. Sin decirlo, el profesional corrige
      // el dato y se va creyendo que el diagnostico de al lado quedo al dia.
      const comp = leer("src/modules/patients/components/corregir-sexo.tsx");
      expect(comp).toMatch(/diagnosticosGenerados/);
      expect(comp, "el aviso tiene que nombrar el camino que SI los rehace").toMatch(/Corregir/);
    });
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

  // ═══ Y EL OTRO HUECO DEL MISMO LOTE: LAS CONSULTAS SIN ENCUESTA (Santiago, 2026-10-10) ═══
  //
  // El caso llego al reves: el pregunto por dos pacientes que aparecian sin respuestas y habia que averiguar
  // si el importador las habia perdido. NO las habia perdido (el archivo no las trae), y en ese lote eran
  // CATORCE, no dos.
  //
  // O SEA QUE EL IMPORTADOR HIZO LO CORRECTO Y NADIE PUDO SABERLO sin cotejar el JSON a mano. Es el mismo
  // defecto que el sexo y por eso va en el mismo candado: un hueco que entra en silencio reaparece meses
  // despues como una pantalla que no deja pasar.
  it("y tampoco mete consultas sin encuesta en silencio", () => {
    const writer = sinComentarios(leer("src/modules/importacion-html/data/importar-lote-writer.ts"));
    expect(writer).toMatch(/consultasSinRespuestas/);
    // SE CUENTA DONDE SE SABE: el unico punto que ya cruzo las respuestas de esa consulta contra las
    // preguntas vigentes. Contarlo en otro sitio obliga a repetir el cruce, y dos sitios que cuentan lo
    // mismo acaban dando cifras distintas.
    expect(writer).toMatch(/if \(respuestas\.length === 0\) sinRespuestas\+\+/);
    const pantalla = sinComentarios(
      leer("src/modules/importacion-html/components/revision-importacion.tsx"),
    );
    expect(pantalla, "se cuenta pero no se dice: un conteo que no llega a la pantalla no avisa a nadie").toMatch(
      /consultasSinRespuestas/,
    );
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
