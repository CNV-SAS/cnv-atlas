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

describe("el ISCM ausente no se clasifica, y el dominio 2 ya no depende de el (punto 4 + v17 §2.3)", () => {
  // ═══ ESTE BLOQUE SE REESCRIBIO CON LA v17 (2026-11-12), Y LA REGLA SUYA NO SE TOCO ═══
  //
  // Hasta aqui el DOMINIO 2 salia del NIVEL del ISCM-BIS, asi que este candado probaba las dos cosas a
  // la vez: que un ISCM ausente no se clasifica (su punto 4) y que por eso el dominio no puntuaba.
  //
  // Su v17 §2.3 separa las dos: el ISCM-BIS **ya no gradua** el dominio 2 (*"se reporta sin nivel"*), que
  // ahora sale de la GRAVEDAD DEL SECTOR MCCB (su Tabla 11.2) mas la adiposidad central. Asi que:
  //
  //   · la regla de "el indice ausente no se clasifica" sigue igual y se sigue probando (CA-4/CA-5): un
  //     ISCM que falta se cita como "-", nunca como 0;
  //   · la regla de "un dominio sin dato no puntua" (su punto 4 del 30-ago) sigue igual y se sigue
  //     probando, pero sobre el insumo NUEVO: sin sector no hay dato, y sin sector no puntua.
  //
  // Lo que NO se hace es borrar el candado porque su insumo cambio. Se reapunta, citando el documento.
  it("sin ISCM el dominio 2 se clasifica igual, por su sector: el ISCM dejo de graduarlo", () => {
    const d = dom2(bis());
    // La clasificacion es el SECTOR, no el nivel del ISCM. Con FMI 8 y FFMI 19 en hombre, los cortes
    // MCCB (H: FMI 3,7/6,4 · FFMI 18,8/21,0) dan FMI alto con FFMI normal = S6, gravedad base 1.
    expect(d.clasif).toBe("S6 · Obesidad con masa normal");
    expect(d.sev).toBe(1);
    expect(d.clasif).not.toContain("ISCM");
  });

  it("y el ISCM ausente se CITA como '-', nunca como un 0 medido (su punto 4, intacto)", () => {
    const d = dom2(bis());
    const linea = d.items.find((i) => i.startsWith("ISCM-BIS"))!;
    expect(linea).toContain("ISCM-BIS -");
    // Esta es la afirmacion que se hacia antes y ya no: un 0 impreso como si lo hubieran medido.
    expect(linea).not.toMatch(/ISCM-BIS 0/);
    // Y tampoco vuelve por la puerta del nivel: su v17 lo reporta SIN nivel.
    expect(linea).toContain("se reporta sin nivel");
    expect(linea).not.toContain("Leve");
  });

  it("CONTROL: con ISCM presente se cita su valor, y el dominio no se mueve por el", () => {
    // Sin esto el verde de arriba no distingue "lo arreglamos" de "lo rompimos entero". Y prueba lo que
    // su v17 pide: el ISCM se ve, y NO cambia la severidad.
    const sin = dom2(bis());
    const con = dom2(bis({ ISCM: 2.0 }));
    expect(con.items.find((i) => i.startsWith("ISCM-BIS"))).toContain("ISCM-BIS 2");
    expect(con.sev).toBe(sin.sev);
    expect(con.clasif).toBe(sin.clasif);
  });

  it("un ISCM de CERO MEDIDO sí se cita: cero respondido no es cero ausente", () => {
    // Es la distincion entera del punto 4, y la misma de CA-3 sobre calcLE8. Si esto se rompiera,
    // habriamos cambiado "no inventes un dato" por "ignora un dato valido".
    expect(dom2(bis({ ISCM: 0 })).items.find((i) => i.startsWith("ISCM-BIS"))).toContain("ISCM-BIS 0");
  });

  it("la severidad del dominio 2 SIN SECTOR es null: el dominio NO puntúa", () => {
    // ESTE TEST YA SE HABIA INVERTIDO UNA VEZ, Y ASI ES COMO SE INVIERTE UN CANDADO: citando la
    // respuesta, no borrandolo. Decia "sigue siendo 1, que es SU default"; el respondio el 2026-08-30,
    // punto 4:
    //
    //   "No debe puntuar 1. Un vértice de susceptibilidad leve dibujado sobre un dominio que no se midió
    //    es la misma lectura favorable de un vacío que corregimos en el ISCM, y en el radar pesa más
    //    porque se ve de un golpe. Ese `?? 1` está escrito para una clasificación fuera del mapa, que es
    //    otra cosa: ahí sí hay dato y no lo reconoce el clasificador. Sin dato, el dominio no puntúa."
    //
    // Con la v17 el "sin dato" del dominio 2 es OTRO: ya no es el ISCM que falta, es el SECTOR que no se
    // puede resolver (sin FFMI o sin FMI). La regla no cambia; cambia de que depende.
    expect(dom2(bis({ FFMI: 0 })).sev).toBe(null);
    expect(dom2(bis({ FMI: 0 })).sev).toBe(null);
    expect(dom2(bis({ FFMI: 0 })).clasif).toBe("Sector N/C");
  });

  it("y la adiposidad central NO convierte un dominio sin dato en un dominio con 1 (CA-6f)", () => {
    // La otra mitad de su regla: un MODIFICADOR no puede fabricar severidad sobre un vacio. Con cintura
    // de 100 cm en un hombre (>= 94, su corte de la OMS) el dominio sube 1 cuando HAY sector...
    expect(dom2(bis({ cintura: 100 })).sev).toBe(2);
    expect(dom2(bis({ cintura: 100 })).clasif).toContain("adiposidad central");
    // ...y se queda en null cuando no lo hay, aunque la cintura este medida.
    expect(dom2(bis({ cintura: 100, FFMI: 0 })).sev).toBe(null);
  });

  it("el ICT tambien la enciende, que es la otra mitad de su corte", () => {
    // Su regla: cintura H >= 94 / M >= 80, O ICT >= 0,50. Con la cintura por debajo del corte pero el
    // ICT por encima, tiene que encenderse igual.
    const d = dom2(bis({ cintura: 85, ICT: 0.55 }));
    expect(d.clasif).toContain("adiposidad central");
    // Su `_dfiFmt` escribe los decimales con COMA, que es como se leen en Colombia.
    expect(d.items.find((i) => i.startsWith("Adiposidad"))).toContain("ICT de 0,55");
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
