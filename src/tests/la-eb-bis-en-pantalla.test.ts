import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { bandaIae, cifraEbBis, cifraIae, textoIae } from "@/clinical-engine/presentacion-eb-bis";
import { buildIndicatorDefs } from "@/clinical-engine/registry-data";
import { indicatorRange } from "@/modules/diagnoses/data/indicator-ranges";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LA FILA DE LA EB-BIS EN PANTALLA SE LEE CON LOS TEXTOS Y EL FORMATO DE SU TABLA 3
//
// Los cuatro ajustes que Santiago reporto el 2026-10-30 tras revisar las cuatro reemitidas, y que son
// cuatro formas de lo mismo: el numero estaba bien y lo que se leia no.
//
//   a) *"El IAE sin signo: la tabla dice '3,5' y su tabla 3 pide 1 decimal con signo: '+3,5'"*
//   b) *"El Δ del IAE dice '0,0' cuando cae dentro de -5 a +5: se lee como si el IAE fuera cero"*
//   c) *"La fila dice 'Edad Bioeléctrica (EB-BIS)'. Su tabla 3 dice 'Edad biológica estimada'"*
//   d) *"la cifra v5 sale con 'acorde con sus pares', que es texto de la v7: el documento viejo no decia
//      eso"*
//
// LOS CUATRO SON DE PRESENTACION Y NINGUNO TOCA UNA CIFRA, y eso es lo que hay que poder comprobar aqui:
// el valor, el clasificador, el color y lo sellado siguen exactamente iguales. Un candado que solo mirara
// los textos dejaria pasar un cambio de formato que se llevara por delante el numero.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const defEb = () => buildIndicatorDefs().find((d) => d.code === "EB")!;

const TABLA = sinComentarios(
  readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8"),
);

describe("(a) el IAE siempre con su signo, por un solo formateador", () => {
  it("un decimal, coma, y el signo en los dos sentidos", () => {
    expect(cifraIae(3.5)).toBe("+3,5");
    expect(cifraIae(-3.5)).toBe("-3,5");
    expect(cifraIae(12.4)).toBe("+12,4"); // su propio ejemplo de la tabla 3
    // EL CERO FINAL NO SE PIERDE: "+3" en vez de "+3,0" seria otro formato, no el suyo.
    expect(cifraIae(3)).toBe("+3,0");
  });

  it("el cero va sin signo, porque ni «+0,0» ni «-0,0» son ciertos", () => {
    expect(cifraIae(0)).toBe("0,0");
  });

  it("y su frase completa se compone de la misma cifra, no de una copia", () => {
    // Si `textoIae` volviera a armar el signo por su cuenta, las dos superficies podrian divergir en el
    // caso del cero o en el de los negativos, que es de donde salio este ajuste.
    expect(textoIae(12.4)).toBe("+12,4 años: envejecimiento acelerado estimado");
    expect(textoIae(-7)).toBe("-7,0 años: envejecimiento desacelerado estimado");
    expect(textoIae(0)).toBe("0,0 años: acorde con sus pares");
  });

  it("la pantalla NO vuelve a armar el signo a mano en ninguna celda", () => {
    // Las dos celdas que lo hacian: el Valor del IAE (que pasaba por el formateador general, sin signo) y
    // la Δ de la fila del EB (que lo componia con su propio ternario). Las dos son el MISMO numero.
    expect(TABLA).toContain('if (code === "IAE") return cifraIae(v);');
    expect(TABLA).toContain("cifraIae(indicators.iae)");
    expect(TABLA, "la pantalla vuelve a componer el signo del IAE a mano").not.toMatch(
      /indicators\.iae >= 0 \? "\+"/,
    );
  });
});

describe("(b) dentro de la banda, el Δ del IAE es una raya", () => {
  const ind = { iae: 0 } as Parameters<typeof indicatorRange>[1];

  it("en toda la banda, incluidos sus dos bordes cerrados", () => {
    for (const iae of [-5, -4.9, 0, 2.2, 5]) {
      expect(indicatorRange("IAE", { ...ind, iae }, true)?.delta).toBeNull();
    }
  });

  it("pero la distancia al limite cruzado SE CONSERVA, que es la mitad suya de la regla", () => {
    expect(indicatorRange("IAE", { ...ind, iae: 8.2 }, true)?.delta).toBe("3,2");
    expect(indicatorRange("IAE", { ...ind, iae: -17.6 }, true)?.delta).toBe("-12,6");
  });

  it("y la referencia no se toca: sigue siendo su banda", () => {
    expect(indicatorRange("IAE", { ...ind, iae: 1 }, true)?.reference).toBe("−5 a +5 años");
  });

  it("se cambia en la funcion que comparten la pantalla y la historia clinica, no en una celda", () => {
    // Si se hubiera hecho en el componente, la pantalla diria "—" y la tabla ANI-BIS-E de la historia
    // clinica "0,0" sobre el mismo indicador. Las dos leen `indicatorRange`.
    const hc = sinComentarios(readFileSync("src/modules/reports/data/hc-indices-ani.ts", "utf8"));
    expect(hc).toContain("indicatorRange(fila.codigo, indicadores, sexoM)?.delta");
  });
});

describe("(c) el nombre de la EB-BIS es el de su tabla 3", () => {
  it("el registro del motor la nombra «Edad biológica estimada»", () => {
    expect(defEb().name).toBe("Edad biológica estimada");
  });

  it("y la expresion retirada no vuelve por el registro", () => {
    // Su tercera ronda del 2026-07-30 habia prohibido "edad biologica" en todo el sistema; su tabla 3 del
    // 2026-10-26 lo revierte con "estimada". Lo que NO puede volver es el nombre viejo, porque entonces la
    // pantalla y el informe del paciente dirian dos cosas distintas del mismo indicador.
    expect(defEb().name).not.toContain("Bioeléctrica");
    expect(defEb().unit).toBe("años");
  });

  it("LA SIGLA NO SE PIERDE: la fila la pinta como etiqueta", () => {
    // Era el fondo de su decision del 30 de julio ("la sigla no cambia"), y es lo que hace que la fila se
    // lea "EB-BIS · Edad biológica estimada" y no solo el nombre largo.
    expect(TABLA).toContain('{ code: "EB", label: "EB-BIS", key: "eb" }');
  });

  it("y el nombre viaja por la BASE, asi que la migracion del registro existe", () => {
    // `registry-data.ts` no es lo que la pantalla lee: el nombre sale de `indicator_definitions`. Sin la
    // migracion generada, este cambio no se ve en ningun entorno, que es el defecto que cerro la 0113.
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
      entries: { tag: string }[];
    };
    const registros = journal.entries.filter((e) => /_registro_del_motor$/.test(e.tag));
    expect(registros.length).toBeGreaterThanOrEqual(3);
    const sql = readFileSync(`drizzle/${registros[registros.length - 1].tag}.sql`, "utf8");
    expect(sql).toContain("'EB', 'Edad biológica estimada'");
  });
});

describe("(d) la cita del documento anterior no lleva el vocabulario nuevo", () => {
  const MARCA = sinComentarios(
    readFileSync("src/modules/diagnoses/components/marca-de-reemision.tsx", "utf8"),
  );

  it("muestra las dos cifras viejas", () => {
    expect(MARCA).toContain("cifraEbBis(reemision.anterior.eb)");
    expect(MARCA).toContain("cifraIae(reemision.anterior.iae)");
  });

  it("y NINGUNA frase de la v7 sobre ellas", () => {
    expect(MARCA).not.toContain("bandaIae");
    for (const frase of ["acorde con sus pares", "acelerado estimado", "desacelerado estimado"]) {
      expect(MARCA, `la cita del documento anterior afirma "${frase}"`).not.toContain(frase);
    }
  });

  it("CONTROL: esas frases SI existen y son las de la v7 vigente", () => {
    // Sin esto, el test de arriba pasaria igual si las frases hubieran desaparecido del sistema entero, y
    // entonces no estaria comprobando nada.
    expect(bandaIae(0)).toBe("acorde con sus pares");
    expect(bandaIae(5)).toBe("envejecimiento acelerado estimado");
    expect(bandaIae(-5)).toBe("envejecimiento desacelerado estimado");
  });
});

describe("y NINGUNO de los cuatro toco una cifra", () => {
  it("la EB-BIS se sigue imprimiendo igual: un decimal, coma, sin signo", () => {
    // La EB-BIS no es una diferencia, asi que no lleva signo. Si `cifraIae` se hubiera colado en su celda,
    // una edad de 23,5 años se imprimiria "+23,5".
    expect(cifraEbBis(23.5)).toBe("23,5");
    expect(cifraEbBis(40)).toBe("40,0");
  });

  it("y el clasificador del IAE sigue saliendo de su tabla 3, con sus cortes cerrados", () => {
    expect(bandaIae(4.9)).toBe("acorde con sus pares");
    expect(bandaIae(5)).toBe("envejecimiento acelerado estimado");
    expect(bandaIae(-4.9)).toBe("acorde con sus pares");
    expect(bandaIae(-5)).toBe("envejecimiento desacelerado estimado");
  });
});
