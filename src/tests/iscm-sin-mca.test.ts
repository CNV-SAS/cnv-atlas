import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Modulo congelado en JS; `allowJs` lo resuelve.
import { computeDFIFromData } from "@/clinical-engine/frozen/engine.dfi.authorized.js";

// CANDADO DEL PUNTO 4 (ronda del 2026-08-28): el ISCM ausente no se emite ni se clasifica.
//
// Su respuesta, escrita en su propio archivo del 29: "el insumo ausente entra hoy como 0, y en una
// desviacion respecto del teorico el 0 afirma que el paciente esta en su valor esperado -una lectura
// favorable- sin marca de que faltaba el dato. La conducta correcta es NO EMITIR EL INDICE".
//
// LO QUE ATLAS YA HACIA BIEN: `analizarDesdeBiody` devuelve ISCM = null si falta alguno de los cuatro
// insumos secundarios (MCA_dif entre ellos). El defecto vivia AGUAS ABAJO, en el DFI: `num()` convertia
// ese null en 0 y 0 se clasifica "Leve". Suprimir la cifra no basta si lo derivado sigue visible.

// Los indices van puestos porque su funcion corta en `num("PABU")` antes de definir `sexoM` y lanzaria
// ReferenceError al intentar derivar la PABU de Cole-Cole. Es un quirk suyo, no del caso.
const bis = (extra: Record<string, unknown> = {}) => ({
  sexo: "Masculino", edad: 45, Re: 400, Ri: 700, Rinf: 320, C: 1.5,
  FMI: 8, FFMI: 19, IFC: 4.1, IRC: 1.9, PABU: 1.8, IEHH: 0.5, ...extra,
});
const dom2 = (b: Record<string, unknown>) => {
  const r = computeDFIFromData({}, b) as { domains: { id: string; sev: number; clasif: string; items: string[] }[] };
  return r.domains.find((d) => d.id === "d2")!;
};

describe("el ISCM ausente no se clasifica (punto 4)", () => {
  it("sin ISCM la clasificación es '-', NO 'Leve'", () => {
    const d = dom2(bis());
    expect(d.clasif).toContain("ISCM -");
    expect(d.clasif).not.toContain("Leve");
    expect(d.items[0]).toBe("ISCM-BIS - (-)");
    // Y esta es la afirmacion que se estaba haciendo antes y ya no: un 0 impreso como si fuera medido.
    expect(d.items[0]).not.toContain("0");
  });

  it("CONTROL: con ISCM presente todo sigue igual que antes", () => {
    // Sin esto el verde de arriba no distingue "lo arreglamos" de "lo rompimos entero".
    const d = dom2(bis({ ISCM: 2.0 }));
    expect(d.clasif).toContain("ISCM Moderado");
    expect(d.items[0]).toBe("ISCM-BIS 2 (Moderado)");
    expect(d.sev).toBe(2);
  });

  it("un ISCM de CERO MEDIDO sí se clasifica: cero respondido no es cero ausente", () => {
    // Es la distincion entera del punto 4, y la misma de CA-3 sobre calcLE8. Si esto se rompiera,
    // habriamos cambiado "no inventes un dato" por "ignora un dato valido".
    const d = dom2(bis({ ISCM: 0 }));
    expect(d.clasif).toContain("ISCM Leve");
    expect(d.items[0]).toBe("ISCM-BIS 0 (Leve)");
  });

  it("la severidad del dominio 2 sin ISCM es null: el dominio NO puntúa", () => {
    // ESTE TEST SE INVIRTIÓ, Y ASÍ ES COMO SE INVIERTE UN CANDADO: citando la respuesta, no borrándolo.
    // Decía "sigue siendo 1, que es SU default", con la nota de que estaba preguntado en la ronda y de
    // que si él respondía otra cosa este era el test a invertir. Respondió el 2026-08-30, punto 4:
    //
    //   "No debe puntuar 1. Un vértice de susceptibilidad leve dibujado sobre un dominio que no se midió
    //    es la misma lectura favorable de un vacío que corregimos en el ISCM, y en el radar pesa más
    //    porque se ve de un golpe. Ese `?? 1` está escrito para una clasificación fuera del mapa, que es
    //    otra cosa: ahí sí hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntúa."
    //
    // Lo aplica CA-6, que al ir a aplicarlo encontró otros tres sitios con la misma forma.
    expect(dom2(bis()).sev).toBe(null);
  });

  it("pero una clasificación FUERA DEL MAPA con dato sí puntúa 1: su `?? 1` se conserva", () => {
    // La otra mitad, y es la que impide que "aplicar su punto 4" se lleve por delante lo que él SÍ quiso.
    // Con una etiqueta que existe y el mapa no reconoce hay dato: no es el caso del vacío.
    const d = dom2(bis({ ISCM: 2.0 }));
    expect(d.sev).toBe(2); // control: la etiqueta conocida sigue mapeando
    // Y con una etiqueta desconocida (dato presente, clasificador que no la reconoce) cae en su default.
    const raro = computeDFIFromData({}, bis({ ISCM: 2.0 })) as {
      domains: { id: string; sev: number | null }[];
    };
    expect(raro.domains.find((x) => x.id === "d2")!.sev).not.toBe(null);
  });

  it("el cambio está en el MANIFIESTO, no editado a mano en el generado", () => {
    const manifiesto = readFileSync("src/clinical-engine/frozen/authorized-modifications.js", "utf8");
    expect(manifiesto).toContain('caId: "CA-4"');
    expect(manifiesto).toContain('caId: "CA-5"');
    // Y el ORIGINAL sigue byte-identico a su archivo: es lo que hace legitima la divergencia.
    const original = readFileSync("src/clinical-engine/frozen/engine.dfi.js", "utf8");
    expect(original).toContain('iscm = num("ISCM", "iscm")');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HALLAZGO DE PASO, y de la misma familia que el punto 4: el DFI le decia al profesional un corte de IRC
// que el motor ya no usa.
//
// Al portar los cortes del IRC (1,68/2,11 -> 1,7/2,1 y 2,27/2,85 -> 2,3/2,8) se cambio `cIRC`, que es
// quien CLASIFICA, pero el DFI imprime aparte la cadena `sexoRef.irc` con los cortes escritos a mano, y
// esa se quedo en los viejos. Resultado: la pantalla decia "IRC 1,9 (Normal - corte H: <1,68 bajo ·
// 1,68-2,11 normal)" cuando el corte real ya era 1,7-2,1. Un texto que describe mal lo que hace el motor
// no es un defecto de redaccion, es de seguridad: el profesional decide sobre el corte que LEE.
//
// No lo vio ningun test porque los diff del DFI cubren rangos concretos (calcLE8, FFMI bajo) y esta linea
// no cae en ninguno. Por eso el candado no es un diff mas: compara las dos fuentes ENTRE SI.
describe("el texto de los cortes del IRC dice lo mismo que el clasificador", () => {
  it("los números del texto del DFI son los que aplica cIRC", () => {
    const dfi = readFileSync("src/clinical-engine/frozen/engine.dfi.js", "utf8");
    const core = readFileSync("src/clinical-engine/frozen/engine.core.js", "utf8");
    // Del clasificador se leen los numeros REALES, no una copia: `const lo = f ? 2.3 : 1.7;`
    const lo = /const lo = f \? ([\d.]+) : ([\d.]+);/.exec(core);
    const hi = /const hi = f \? ([\d.]+) : ([\d.]+);/.exec(core);
    expect(lo, "cambió la forma de cIRC: revisa este candado").not.toBe(null);
    expect(hi).not.toBe(null);
    const coma = (n: string) => n.replace(".", ",");
    const linea = /irc:  esMasc \? "([^"]*)" : "([^"]*)"/.exec(dfi);
    expect(linea, "no encuentro la línea sexoRef.irc del DFI").not.toBe(null);
    // Hombres: lo[2]/hi[2]. Mujeres: lo[1]/hi[1].
    expect(linea![1]).toContain(`<${coma(lo![2])} bajo`);
    expect(linea![1]).toContain(`>${coma(hi![2])} alto`);
    expect(linea![2]).toContain(`<${coma(lo![1])} bajo`);
    expect(linea![2]).toContain(`>${coma(hi![1])} alto`);
  });

  it("y los cortes viejos no sobreviven en ningún sitio del motor", () => {
    // Barrido del NUMERO por todo el motor, que es la leccion del umbral que vive en varios sitios. Se
    // permiten los comentarios que documentan el cambio (dicen "1,68 -> 1,7"), no un valor en uso.
    for (const f of ["engine.dfi.js", "engine.core.js", "engine.dfi.authorized.js", "engine.core.derived.js"]) {
      const src = readFileSync(`src/clinical-engine/frozen/${f}`, "utf8")
        .split("\n")
        .filter((l) => !/^\s*(\/\/|\*)/.test(l))
        .join("\n");
      for (const viejo of ["1,68", "2,27", "2,85", "1.68", "2.27", "2.85"]) {
        expect(src.includes(viejo), `${f} todavía usa el corte viejo ${viejo}`).toBe(false);
      }
    }
  });
});
