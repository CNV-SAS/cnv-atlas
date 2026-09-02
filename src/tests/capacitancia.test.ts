import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CAP_REF,
  capRef,
  clasificarCapacitancia,
  medianaCapacitancia,
  type CapRefRow,
} from "@/clinical-engine/capacitancia";

import { HTML_VIGENTE } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE TRANSCRIPCION de CAP_REF, en DOS niveles, porque uno solo no basta:
//
//   1. Contra SU ARCHIVO. Cotejo cifra por cifra de las doce filas.
//   2. Coherencia INTERNA. Un candado que solo compara dos copias no prueba correccion: si el error
//      viene de la fuente, las dos coinciden y pasa verde. Los percentiles tienen que ser crecientes,
//      los n positivos y las decadas contiguas y sin huecos.

// Ancla DERIVADA, no escrita a mano: hasta el 29-ago este test miraba la entrega del 28. Una ruta literal
// a una entrega superada deja el candado verde POR CONSTRUCCION. Ver `html-vigente-lock.test.ts`.
const RUTA = HTML_VIGENTE;

// Extrae CAP_REF de su archivo parseando las filas, sin evaluar codigo suyo.
function capRefDeSuArchivo(): { M: CapRefRow[]; F: CapRefRow[] } {
  const html = readFileSync(RUTA, "utf8");
  const i = html.indexOf("const CAP_REF = {");
  expect(i, "CAP_REF no está en el archivo de Gildardo: ¿cambió la entrega?").toBeGreaterThan(-1);
  const bloque = html.slice(i, html.indexOf("};", i));
  const salida: { M: CapRefRow[]; F: CapRefRow[] } = { M: [], F: [] };
  let sexo: "M" | "F" | null = null;
  for (const linea of bloque.split("\n")) {
    if (/^\s*M:\s*\[/.test(linea)) sexo = "M";
    else if (/^\s*F:\s*\[/.test(linea)) sexo = "F";
    const m = /d:\s*\[(\d+),\s*(\d+)\]\s*,\s*n:\s*(\d+)\s*,\s*p5:\s*([\d.]+)\s*,\s*p10:\s*([\d.]+)\s*,\s*p25:\s*([\d.]+)\s*,\s*p50:\s*([\d.]+)\s*,\s*p75:\s*([\d.]+)\s*,\s*p90:\s*([\d.]+)\s*,\s*p95:\s*([\d.]+)/.exec(
      linea,
    );
    if (!m || !sexo) continue;
    salida[sexo].push({
      d: [Number(m[1]), Number(m[2])],
      n: Number(m[3]),
      p5: Number(m[4]),
      p10: Number(m[5]),
      p25: Number(m[6]),
      p50: Number(m[7]),
      p75: Number(m[8]),
      p90: Number(m[9]),
      p95: Number(m[10]),
    });
  }
  return salida;
}

describe("CAP_REF: transcripción verbatim contra el archivo de Gildardo", () => {
  const suyo = capRefDeSuArchivo();

  it("se extrajeron las doce filas de su archivo (si no, el candado no está probando nada)", () => {
    expect(suyo.M).toHaveLength(6);
    expect(suyo.F).toHaveLength(6);
  });

  it.each(["M", "F"] as const)("%s: las seis filas coinciden cifra por cifra", (sexo) => {
    expect(CAP_REF[sexo]).toEqual(suyo[sexo]);
  });
});

describe("CAP_REF: coherencia interna (lo que el cotejo de copias NO puede ver)", () => {
  const todas = [...CAP_REF.M, ...CAP_REF.F];

  it.each(todas.map((f, i) => [i, f] as const))("fila %i: los percentiles son crecientes", (_i, f) => {
    const serie = [f.p5, f.p10, f.p25, f.p50, f.p75, f.p90, f.p95];
    for (let j = 1; j < serie.length; j++) expect(serie[j]).toBeGreaterThan(serie[j - 1]);
  });

  it("todos los n son positivos y suman los 5.181 del artículo", () => {
    for (const f of todas) expect(f.n).toBeGreaterThan(0);
    expect(todas.reduce((s, f) => s + f.n, 0)).toBe(5181);
  });

  it.each(["M", "F"] as const)("%s: las décadas son contiguas y sin huecos desde los 18", (sexo) => {
    const filas = CAP_REF[sexo];
    expect(filas[0].d[0]).toBe(18);
    for (let i = 1; i < filas.length; i++) expect(filas[i].d[0]).toBe(filas[i - 1].d[1] + 1);
  });

  it("su propio ejemplo: la mediana del hombre joven casi dobla la de la mujer joven", () => {
    // Es la razon por la que la estratificacion no era opcional; si esto deja de cumplirse, algo se movio.
    expect(CAP_REF.M[0].p50).toBe(2.4);
    expect(CAP_REF.F[0].p50).toBe(1.37);
  });
});

describe("capRef: sin sexo o sin edad NO clasifica, y se ve por qué", () => {
  it("sin sexo, sin edad o con edad inválida devuelve null", () => {
    expect(capRef(null, 40)).toBeNull();
    expect(capRef("M", null)).toBeNull();
    expect(capRef("M", 0)).toBeNull();
    expect(capRef("Otro", 40)).toBeNull();
  });

  it("el clasificador NO queda mudo: dice que falta sexo o edad", () => {
    // Decision suya explicita: aqui no hay respaldo razonable (a diferencia de calcPABU), asi que no se
    // adivina. Pero un hueco sin explicacion se lee como defecto, asi que la razon viaja en la etiqueta.
    const r = clasificarCapacitancia(2.1, null, 40);
    expect(r.l).toBe("Sin referencia (falta sexo o edad)");
    expect(r.ref).toBeNull();
  });

  it("distingue SIN DATO de SIN REFERENCIA: no son lo mismo aguas abajo", () => {
    expect(clasificarCapacitancia(0, "M", 40).l).toBe("Sin dato");
    expect(clasificarCapacitancia(2.1, null, 40).l).toBe("Sin referencia (falta sexo o edad)");
  });

  it("acepta las formas largas del sexo, como su archivo", () => {
    expect(capRef("Masculino", 25)?.sexo).toBe("M");
    expect(capRef("Femenino", 25)?.sexo).toBe("F");
  });

  it("fuera de las décadas del artículo aplica el extremo y LO MARCA", () => {
    // Solo se activa POR DEBAJO de 18: su última banda es [70, 200], así que absorbe a todos los
    // mayores sin marcarlos. Lo escribo aquí porque es fácil suponer lo contrario (que un paciente de
    // 95 años quedaría marcado) y el candado tiene que decir lo que el código hace, no lo que parece.
    expect(capRef("M", 15)?.fueraDeRango).toBe(true);
    expect(capRef("M", 95)?.fueraDeRango).toBe(false);
    expect(capRef("M", 201)?.fueraDeRango).toBe(true);
    expect(capRef("M", 45)?.fueraDeRango).toBe(false);
  });
});

describe("clasificarCapacitancia: bandas y colores", () => {
  it("el mismo 2,40 es Normal en un hombre joven y Alta en una mujer joven", () => {
    // El caso que hace que la estratificacion importe, comprobado de punta a punta.
    expect(clasificarCapacitancia(2.4, "M", 25).l).toBe("Normal");
    const ella = clasificarCapacitancia(2.4, "F", 25);
    expect(ella.l).toBe("Alta");
    expect(ella.banda).toBe("> P95");
  });

  it("las cinco bandas, en un hombre de 25 (P5 1,56 · P25 2,06 · P75 2,82 · P95 3,53)", () => {
    expect(clasificarCapacitancia(1.0, "M", 25)).toMatchObject({ l: "Muy baja", banda: "< P5" });
    expect(clasificarCapacitancia(1.8, "M", 25)).toMatchObject({ l: "Baja", banda: "P5-P25" });
    expect(clasificarCapacitancia(2.5, "M", 25)).toMatchObject({ l: "Normal", banda: "P25-P75" });
    expect(clasificarCapacitancia(3.0, "M", 25)).toMatchObject({ l: "Alta", banda: "P75-P95" });
    expect(clasificarCapacitancia(4.0, "M", 25)).toMatchObject({ l: "Alta", banda: "> P95" });
  });

  it("por encima de P75 se rotula Alta, NUNCA Óptimo (decisión suya)", () => {
    for (const v of [3.0, 4.0, 9.9]) expect(clasificarCapacitancia(v, "M", 25).l).not.toMatch(/óptim|optim/i);
  });

  it("NINGÚN color es azul (decisión suya: el azul ya significa dos cosas distintas)", () => {
    const AZUL = /^#(3b82f6|60a5fa|2563eb|1d4ed8|93c5fd|bfdbfe|0ea5e9|38bdf8)$/i;
    const casos = [0, 1.0, 1.8, 2.5, 3.0, 4.0];
    for (const v of casos) {
      expect(AZUL.test(clasificarCapacitancia(v, "M", 25).c), `${v} nF salió azul`).toBe(false);
      expect(AZUL.test(clasificarCapacitancia(v, "F", 25).c), `${v} nF salió azul`).toBe(false);
    }
    expect(AZUL.test(clasificarCapacitancia(2.1, null, 40).c)).toBe(false);
  });
});

describe("medianaCapacitancia: la línea de referencia de Seguimiento", () => {
  it("devuelve la mediana del grupo, y null cuando no se puede resolver", () => {
    expect(medianaCapacitancia("M", 25)).toBe(2.4);
    expect(medianaCapacitancia("F", 25)).toBe(1.37);
    expect(medianaCapacitancia(null, 25)).toBeNull();
  });
});

// ── EL ÚLTIMO CABLE (2026-09-01) ────────────────────────────────────────────────────────────────────
//
// Todo lo de arriba pasaba verde con la tabla PORTADA Y DESCONECTADA: durante seis días el módulo tenía
// sus doce filas verbatim, su candado y las tres decisiones suyas, y ninguna raíz de la app lo alcanzaba.
// La tarjeta de Seguimiento lo decía en pantalla ("la referencia de su grupo aún no se muestra aquí"), que
// es lo único que impidió que fuera un fallo silencioso.
//
// POR ESO EL CANDADO VA SOBRE EL SITIO DE LLAMADA. Un test de la función no distingue "portada y usada" de
// "portada y muerta", que es exactamente la clase de defecto que llevamos seis veces en una semana.
describe("la referencia está CABLEADA, no solo portada", () => {
  const READER = readFileSync("src/modules/followups/data/serie-reader.ts", "utf8");
  // SIN COMENTARIOS, y es la QUINTA vez: el comentario que explica el cambio CITA el texto viejo ("decía
  // aún no se muestra aquí"), asi que el candado se cazaba a si mismo. Ya no se escribe la funcion a mano.
  const TARJETA = sinComentarios(
    readFileSync("src/modules/followups/components/seguimiento-visual.tsx", "utf8"),
  );

  it("el reader de la serie resuelve la referencia del grupo del paciente", () => {
    expect(READER).toContain("capRef");
    expect(READER).toContain("clasificarCapacitancia");
    // Con la ÚLTIMA medición, no la primera: la década de edad puede cambiar durante el seguimiento.
    expect(READER).toContain("enPantalla[enPantalla.length - 1]");
  });

  it("y la tarjeta la dibuja como línea de referencia", () => {
    expect(TARJETA).toContain("referencia: serie.refC.mediana");
    expect(TARJETA).toContain("referenciaLabel");
  });

  it("`subirEsMejor` NUNCA es true: subir puede ser adiposidad, no mejoría", () => {
    // Su corrección del 2026-08-27 §9. Es la aserción que no se puede relajar aunque estorbe: pintar de
    // verde el tramo que sube afirmaría justo lo que él retiró.
    expect(TARJETA).toContain("subirEsMejor={null}");
    expect(TARJETA).not.toContain("subirEsMejor={true}");
  });

  it("y el texto ya NO dice que la referencia no se muestra", () => {
    // El texto era honesto mientras el cable faltaba; dejarlo ahora sería el defecto inverso, un texto que
    // describe mal lo que el sistema hace.
    expect(TARJETA).not.toContain("aún no se muestra aquí");
  });

  it("sin sexo o sin edad NO se inventa una referencia, y la pantalla lo dice", () => {
    // Su decisión 1, la que este cableado no puede romper: a diferencia de calcPABU, aquí no hay respaldo
    // razonable y cualquier elección se equivoca en casi un nanofaradio.
    expect(medianaCapacitancia(null, 40)).toBeNull();
    expect(medianaCapacitancia("M", null)).toBeNull();
    expect(TARJETA).toContain("falta el sexo o la fecha de nacimiento");
  });
});
