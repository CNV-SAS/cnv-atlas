import { describe, expect, it } from "vitest";

import { readFileSync } from "node:fs";

import {
  indicatorRange,
  referenciaDelIndice,
} from "@/modules/diagnoses/data/indicator-ranges";
import { INDICES_ANI } from "@/modules/reports/data/hc-indices-ani";
import type { EngineIndicators } from "@/clinical-engine/types";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA MISMA REFERENCIA EN LAS CUATRO SUPERFICIES  ·  Santiago, 2026-11-16
//
// ═══ LO QUE VIO ═══
//
// En la HC web de una paciente, la fila del ICA-BIS decia *"0.00-0.15 Zona φ"* (la zona fija que su v17
// retiro) mientras el diagnostico y el PDF decian *"0 (coherencia)"*, sobre el MISMO numero de la MISMA
// consulta. Y la propia HC dice debajo que los rangos son los del modelo vigente.
//
// ═══ POR QUE ESTE CANDADO ES SOBRE LA FORMA Y NO SOBRE UNA CADENA ═══
//
// Las cuatro superficies son dos CAMINOS de codigo: `INDICES_ANI[].referencia` (HC web) e
// `indicatorRange().reference` (diagnostico, PDF de la HC y la Δ de la propia tabla de la HC). Mientras
// fueran dos sitios donde escribir el texto, cualquier correccion podia volver a hacerse en uno solo:
// asi nacio el defecto, y asi llevaba desde que la v17 movio el ICA-BIS. Aqui se fija que los dos
// caminos devuelvan lo MISMO para los ocho indices y los dos sexos, sin nombrar ninguna cadena, para que
// el dia que Gildardo cambie una referencia este caso siga valiendo.
//
// Las cadenas concretas, que SON suyas, las cotejan contra su archivo `hc-indices-ani` y
// `frozen-indices-v17-diff`. Este candado mide otra cosa: que no vuelvan a ser dos.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Un juego de indicadores con TODOS los ocho presentes, para que `indicatorRange` no devuelva null. */
const INDICADORES = {
  ifc: 1.89,
  irc: 2.71,
  iscm: -0.4,
  iehh: -1.57,
  eb: 55.2,
  iae: 12.4,
  pabu: 1.42,
  icaBis: -0.198,
} as unknown as EngineIndicators;

const LOS_OCHO = ["IFC", "IRC", "ISCM", "IEHH", "EB", "IAE", "PABU", "ICA-BIS"];

describe("la referencia de cada índice es la misma en las cuatro superficies", () => {
  it("la tabla de la HC web y la del diagnóstico/PDF dicen lo mismo, en hombre y en mujer", () => {
    for (const sexoM of [true, false]) {
      for (const fila of INDICES_ANI) {
        const hcWeb = fila.referencia(sexoM);
        // ESTE es el que pintan el diagnostico (`evaluation-results`) y el PDF de la HC
        // (`hc-documento-reader`, que RE-DERIVA la referencia en vez de usar la compuesta).
        const diagnosticoYPdf = indicatorRange(fila.codigo, INDICADORES, sexoM)?.reference;
        expect(
          hcWeb,
          `${fila.codigo} (${sexoM ? "hombre" : "mujer"}): la HC web dice "${hcWeb}" y el diagnóstico/PDF "${diagnosticoYPdf}"`,
        ).toBe(diagnosticoYPdf);
      }
    }
  });

  it("los ocho índices tienen referencia: ninguno cae en la raya por descuido", () => {
    for (const sexoM of [true, false]) {
      for (const codigo of LOS_OCHO) {
        expect(referenciaDelIndice(codigo, sexoM), `${codigo} sin referencia`).toBeTruthy();
      }
    }
    expect(INDICES_ANI.map((f) => f.codigo)).toEqual(LOS_OCHO);
  });

  it("el ICA-BIS usa la tabla de percentiles de su v17, no la zona fija retirada", () => {
    // Su §4 reemplaza la zona fija de ±0,15 por los percentiles del sexo (Tabla 7.3), y el texto lo
    // escribe EL: `icaBisRefTxt`, del motor congelado. Esta es la fila que Santiago reporto.
    const h = referenciaDelIndice("ICA-BIS", true)!;
    const m = referenciaDelIndice("ICA-BIS", false)!;
    expect(h).not.toContain("0.00");
    expect(h).not.toContain("Zona");
    expect(h, "volvió a la redacción nuestra en vez de la suya").not.toContain("coherencia");
    expect(h).toContain("(H)");
    expect(m).toContain("(M)");
    expect(h).not.toBe(m); // es POR SEXO: si los dos coinciden, dejó de leer su tabla
  });

  it("el texto no se escribe en dos sitios: las dos superficies llaman a la misma función", () => {
    const hc = readFileSync("src/modules/reports/data/hc-indices-ani.ts", "utf8");
    expect(hc).toContain("referenciaDelIndice");
    // Las cadenas que estaban escritas aqui y ademas en `indicator-ranges`.
    for (const cadena of ["0.00–0.15 Zona φ", "= Edad cronológica", "φ = 1,618 (k=0,78)"]) {
      expect(hc, `la referencia "${cadena}" volvió a escribirse en la tabla de la HC`).not.toContain(
        cadena,
      );
    }
    // Y el diagnostico ya no redacta la suya: la rama del ICA-BIS devuelve la funcion de Gildardo.
    // (La cadena vieja sigue NOMBRADA en el comentario de cabecera, que es donde tiene que estar: es la
    // historia del defecto. Lo que se comprueba es que no vuelva a ser un valor DEVUELTO.)
    const rangos = readFileSync("src/modules/diagnoses/data/indicator-ranges.ts", "utf8");
    expect(rangos, 'el diagnóstico volvió a su propia redacción del ICA-BIS').not.toContain(
      'reference: "0 (coherencia)"',
    );
    expect(rangos).toContain('core.icaBisRefTxt');
  });
});
