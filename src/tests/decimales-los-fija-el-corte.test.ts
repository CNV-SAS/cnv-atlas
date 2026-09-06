import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { EngineIndicators } from "@/clinical-engine";
import {
  DECIMALES_POR_DEFECTO,
  decimalesDe,
  indicatorRange,
} from "@/modules/diagnoses/data/indicator-ranges";
import { INDICES_ANI } from "@/modules/reports/data/hc-indices-ani";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LA REGLA DE DECIMALES (Santiago, 2026-09-06): LOS DECIMALES LOS FIJA EL CORTE, NO EL GUSTO.
// La precisión mostrada tiene que ALCANZAR PARA DISTINGUIR DEL CORTE.
//
// DE DÓNDE SALE. El 05 puse el PABU y el ICA-BIS en cuatro decimales copiando su tabla; Santiago lo
// devolvió porque su archivo no tiene una regla (2 en unos sitios, 3 en otros, 4 en otros) y copiarla
// importa su desorden. Los bajé a dos, y entonces apareció el otro lado: el IR se compara contra 0,78 y su
// Δ es 0,018, que a dos decimales se aplasta a 0,02 y pierde la distancia.
//
// LA REGLA QUE QUEDÓ, y este candado la fija: tres decimales donde el CORTE los pide (PABU, φ = 1,618) o
// donde el indicador vive en menos de una unidad (IR, 0,70-0,90); dos en el resto; y uno donde no lo
// decide el corte sino otra cosa (AF por instrucción suya D-016; EB e IAE porque están en años).
//
// Y LO QUE ESTE ARCHIVO PROTEGE DE VERDAD ES LA FUENTE ÚNICA. El defecto original no fue elegir mal un
// número: fue que el VALOR, su Δ y la historia clínica tenían cada uno el suyo, y por eso el mismo renglón
// llegó a decir 0,42 en el valor y 0,4157 en la Δ. Con una tabla, que coincidan no es disciplina.

const ind = {
  ifc: 6.98,
  irc: 1.62,
  pabu: 1.2023,
  icaBis: 0.4157,
  iscm: -5.09,
  iehh: 0.805,
  iae: 11.1,
  eb: 33.1,
  FMI: 5.76,
  FFMI: 19.9,
  AF: 6.7,
  IR: 0.759,
} as unknown as EngineIndicators;

/** Decimales que trae una cadena ya formateada ("0,42" -> 2). "N/D" o sin coma -> 0. */
const decimalesDe_ = (s: string | null): number => {
  if (!s) return 0;
  const m = s.match(/,(\d+)/);
  return m ? m[1].length : 0;
};

const CODIGOS = ["IFC", "IRC", "FMI", "FFMI", "PABU", "ICA-BIS", "ISCM", "IEHH", "IAE", "AF", "IR"];

describe("la regla: los decimales los fija el corte", () => {
  it("tres SOLO donde el corte los pide o el indicador vive en menos de una unidad", () => {
    // PABU: su corte es φ = 1,618, tres decimales. IR: recorre 0,70-0,90, o sea menos de una unidad.
    expect(decimalesDe("PABU")).toBe(3);
    expect(decimalesDe("IR")).toBe(3);
  });

  it("uno donde NO lo decide el corte, y por razones que se nombran una a una", () => {
    // AF: instrucción suya (D-016), "dos sugieren una exactitud que el equipo no tiene".
    expect(decimalesDe("AF")).toBe(1);
    // EB e IAE: están en AÑOS. Es convención de unidad, no precisión de corte.
    expect(decimalesDe("EB")).toBe(1);
    expect(decimalesDe("IAE")).toBe(1);
  });

  it("dos en todo el resto, que es el estándar", () => {
    expect(DECIMALES_POR_DEFECTO).toBe(2);
    for (const c of ["IFC", "IRC", "FMI", "FFMI", "ICA-BIS", "ISCM", "IEHH"]) {
      expect(decimalesDe(c), c).toBe(2);
    }
  });

  it("un código desconocido cae al estándar, no rompe", () => {
    expect(decimalesDe("NO_EXISTE")).toBe(DECIMALES_POR_DEFECTO);
  });
});

describe("EL DEFECTO ORIGINAL: el valor y su Δ, en la misma fila, con los mismos decimales", () => {
  it("cada Δ trae los decimales que su indicador declara", () => {
    for (const c of CODIGOS) {
      const r = indicatorRange(c, ind, true);
      if (!r?.delta) continue; // EB no lleva Δ, a propósito
      expect(decimalesDe_(r.delta), `${c}: Δ ${r.delta}`).toBe(decimalesDe(c));
    }
  });

  it("y la pantalla formatea el VALOR con la misma tabla, no con un número propio", () => {
    // Aserción sobre el sitio de llamada: el defecto era que hubiera DOS números, así que probar la tabla
    // no basta; hay que probar que la pantalla la usa.
    const PANTALLA = sinComentarios(
      readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8"),
    );
    expect(PANTALLA).toContain("decimalesDe(code)");
    expect(PANTALLA, "ya no queda un número escrito a mano").not.toContain("fmtDec(v, 2)");
  });
});

describe("la historia clínica usa la MISMA tabla que la pantalla", () => {
  it("ninguna fila escribe sus decimales a mano", () => {
    const HC = sinComentarios(readFileSync("src/modules/reports/data/hc-indices-ani.ts", "utf8"));
    expect(HC, "quedaba un toFixed con el número escrito").not.toMatch(/toFixed\(\d\)/);
    expect(HC).toContain("decimalesDe(codigo)");
  });

  it("y el resultado coincide con el de la pantalla para el mismo indicador", () => {
    // El control de fondo: si las dos tablas divergieran, esto lo dice con el número.
    for (const fila of INDICES_ANI) {
      const salida = fila.formato(1.23456);
      const esperados = decimalesDe(fila.codigo);
      expect(decimalesDe_(salida), `${fila.codigo}: "${salida}"`).toBe(esperados);
    }
  });
});
