import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ENTREGAS, htmlDeEntrega, HTML_VIGENTE } from "./fixtures/html-vigente";

// EL INTERRUPTOR `LE8_MAPEO_CORREGIDO`: su archivo lo ENCENDIO, y su propio archivo dice que asi no.
//
// QUE PASO. Hasta la entrega del 1 de septiembre el interruptor estaba en `false`. En la del 2 aparece en
// `true`. El 30 de agosto Gildardo lo habia escrito textualmente: *"la media 58,578 y la desviacion 13,332
// del ICEC no estan establecidas... el interruptor se queda en `false`. No lo enciendan por partes ni por
// su cuenta."* Y el comentario que acompana la bandera, que sigue INTACTO en el archivo del 2, exige DOS
// cosas a la vez para encenderla: recalcular mu y sigma sobre la base con el mapeo ya corregido, Y
// sustituir esos dos numeros en la llamada a `_zBis`. Textual suyo: "Se recalibran en el MISMO acto, nunca
// por separado."
//
// LOS DOS NUMEROS SIGUEN SIENDO LOS MISMOS. La llamada del termino contextual sigue diciendo
// `_zBis(_icecVal, 58.578, 13.332)`, byte por byte igual que el 1 de septiembre. O sea que la segunda
// condicion no se cumplio: el interruptor se encendio SOLO, que es justo lo que el prohibio.
//
// POR QUE IMPORTA, con su propia cifra: encenderlo sin recalibrar "baja la edad bioelectrica de TODOS los
// pacientes entre 1 y 8 anos, mas cuanto mas sano este el paciente". No es un matiz de display, es la
// cifra que el reporte le entrega al paciente.
//
// QUE HACE ATLAS MIENTRAS TANTO: NO porta el cambio. El frozen se queda en `false`. Esto NO es corregirle
// la ciencia (Regla 0), es no aplicar un cambio que su propio archivo declara invalido sin el otro medio.
// Va preguntado en la ronda del 2026-09-03 (P-92), y hasta que responda esta divergencia es deliberada.
//
// SU RESPUESTA DEL 2026-09-04, que cambia el MOTIVO del bloqueo y por eso entra aqui: mu y sigma no
// estan "pendientes de firma", estan BLOQUEADAS por ausencia de ICEC en toda fuente disponible. Textual:
// "el ICEC se calcula desde la encuesta, y ninguna de esas fuentes la trae... se recalibra cuando haya
// una masa de pacientes con encuesta completa".
//
// Y UN DATO SUYO QUE NO SE HABIA DICHO: mu = 58,578 y sigma = 13,332, las que el interruptor usa HOY,
// TAMPOCO tienen origen documentado. Sus dos documentos tecnicos describen la v3 (Ridge sobre ocho
// variables), que no lleva ICEC ni LE8; la v5 vigente vive solo en el HTML, y esas dos constantes con
// ella. O sea que el candado no vigila "faltan las nuevas": vigila que las viejas tampoco tienen respaldo.
//
// COMO MUERE ESTE CANDADO, que es lo que lo hace util: el dia que el recalibre, mu y sigma dejaran de ser
// 58.578 y 13.332, el tercer caso se pondra ROJO y ahi hay que portar las dos cosas juntas. Si en cambio
// responde "vuelvanlo a false", el primer caso se pone rojo. Cualquiera de las dos salidas nos obliga a
// volver aqui; ninguna nos deja olvidarlo en silencio, que es como se perdieron seis dias en P-50.

const suyoVigente = () => readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
const suyoAnterior = () =>
  readFileSync(htmlDeEntrega(ENTREGAS[ENTREGAS.length - 2]), "utf8")
    .replace(/\r\n/g, "\n");

describe("LE8_MAPEO_CORREGIDO: encendido en su archivo, sin la recalibracion que el mismo exige", () => {
  it("su entrega VIGENTE lo tiene en true", () => {
    expect(suyoVigente()).toContain("const LE8_MAPEO_CORREGIDO = true;");
  });

  it("y lleva DOS entregas encendido sin que mu y sigma se muevan", () => {
    // EL CONTROL CAMBIO DE FORMA (2026-09-03), y el motivo es el hallazgo. Decia "la anterior lo tenia en
    // false: el cambio es de esta entrega", y con la entrega del 3-sep la "anterior" paso a ser la del 2,
    // que ya lo traia encendido. El caso se puso rojo diciendo algo cierto: **ya no es un cambio reciente,
    // es un estado que PERSISTE**.
    //
    // Y eso es mas grave que lo que el control medía antes, asi que la asercion sube de nivel en vez de
    // relajarse: lo que se afirma ahora es la DURACION. Si en la proxima entrega sigue igual, este texto
    // hay que volver a mirarlo, porque tres entregas ya no es un descuido.
    const entregasConElEncendido = ENTREGAS.filter((c) =>
      readFileSync(htmlDeEntrega(c), "utf8").includes(
        "const LE8_MAPEO_CORREGIDO = true;",
      ),
    );
    expect(entregasConElEncendido.length).toBeGreaterThanOrEqual(2);
    // Y en TODAS ellas mu y sigma siguen sin moverse, que es la condicion que el mismo puso.
    for (const c of entregasConElEncendido) {
      expect(
        readFileSync(htmlDeEntrega(c), "utf8"),
        `${c}: si aqui mu y sigma cambiaron, hay que portar`,
      ).toContain("_zBis(_icecVal, 58.578, 13.332)");
    }
  });

  it("PERO mu y sigma del ICEC siguen sin recalibrar, que es la condicion que el puso", () => {
    // Este es el caso que se pone rojo cuando responda recalibrando, y ese rojo es la senal de portar.
    expect(suyoVigente()).toContain("_zBis(_icecVal, 58.578, 13.332)");
    expect(suyoAnterior()).toContain("_zBis(_icecVal, 58.578, 13.332)");
  });

  it("y su instruccion de no encenderlo por separado sigue escrita en el MISMO archivo", () => {
    // Lo que convierte esto en una contradiccion interna suya y no en una discrepancia nuestra.
    const v = suyoVigente();
    expect(v).toContain("NO PONER EN true SIN RESOLVER LO SIGUIENTE");
    expect(v).toContain("MISMO acto, nunca por separado");
    expect(v).toContain("esta bandera se queda en `false`");
  });

  it("Atlas NO porta el cambio: el frozen se queda en false", () => {
    const dfi = readFileSync("src/clinical-engine/frozen/engine.dfi.js", "utf8");
    expect(dfi).toContain("const LE8_MAPEO_CORREGIDO = false;");
  });
});
