import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { veredictoSev } from "@/clinical-engine/severity";
import {
  clasificarIcaBis,
  CODIGO_CLASE_ICA_BIS,
  conClaseIcaBis,
} from "@/modules/diagnoses/data/indicator-ranges";
import { indicesAniAlterados } from "@/modules/reports/data/hc-indices-ani";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PUNTO 17 DEL COTEJO (2026-09-05). SU ARCHIVO TIENE DOS REGLAS PARA LA FILA ICA-BIS, UNA
// POR SUPERFICIE, y este candado fija que cada una viva donde le toca.
//
//  · DIAGNOSTICO -> COMPOSICION CORPORAL (ATLAS_v8 L14623): `dICA`, clasificador de MAGNITUD con cinco
//    escalones. "Desviación leve" existe ahi y va AMBAR (#f59e0b).
//  · REPORTE / HISTORIA CLINICA (ATLAS_v8 L15425): `icaBisClf = cPABU(t_pabu)`, con su nota al lado
//    ("cICABIS eliminado — usar cPABU global").
//
// LO QUE REPORTO SANTIAGO ERA EL COLOR: nuestro escalon "Desviación leve" traia severidad 0, o sea VERDE,
// y el suyo es AMBAR. Textual: "ahi pone desviación leve con color verde, mientras que la PABU es color
// amarillo... además el html lo pinta amarillo".
//
// Y ESTE CANDADO NACIO AFIRMANDO LO CONTRARIO. La primera version aplicaba la regla de la HC a la
// PANTALLA, porque encontre la linea de la HC y su nota y las lei como "retiro el clasificador". El
// candado paso verde: certificaba mi lectura, no su archivo. Por eso los casos de abajo citan la LINEA de
// donde sale cada regla, y hay un caso por superficie.

const PANTALLA = "src/modules/diagnoses/components/evaluation-results.tsx";
const HISTORIA = "src/modules/reports/data/hc-composicion.ts";

const leer = (p: string) => sinComentarios(readFileSync(p, "utf8"));

describe("la PANTALLA gradua la magnitud, con SUS colores (ATLAS_v8 L14623)", () => {
  it("los cinco escalones positivos son los suyos, etiqueta y hex", () => {
    expect(clasificarIcaBis(0.1)).toEqual({ l: "Zona φ — Homeostasis óptima", c: "#16a34a" });
    expect(clasificarIcaBis(0.4157)).toEqual({ l: "Desviación leve", c: "#f59e0b" });
    expect(clasificarIcaBis(1.0)).toEqual({ l: "Desviación moderada", c: "#f97316" });
    expect(clasificarIcaBis(2.0)).toEqual({ l: "Desviación severa", c: "#ef4444" });
    expect(clasificarIcaBis(4.0)).toEqual({ l: "Zona crítica", c: "#7f1d1d" });
    expect(clasificarIcaBis(null)).toBeNull();
  });

  it("EL DEFECTO QUE REPORTO: 'Desviación leve' es AMBAR, no verde", () => {
    // Es la asercion del punto 17. La severidad NO se elige: sale del hex de su archivo por el mismo
    // camino que los quince clasificadores congelados.
    const leve = clasificarIcaBis(0.4157);
    expect(leve!.l).toBe("Desviación leve");
    expect(veredictoSev(leve)).toBe(2);
    expect(veredictoSev(leve)).not.toBe(0);
  });

  it("y la zona φ sigue en verde: el candado no convierte todo en alerta", () => {
    expect(veredictoSev(clasificarIcaBis(0.1))).toBe(0);
  });

  it("la rama negativa se porta aunque hoy no se alcance (el motor sella la magnitud)", () => {
    // Se porta igual que la positiva: retirarla seria decidir por el. No se alcanza porque `icaBis` se
    // sella como |PABU - phi|, que es lo que muestra su propia tabla (0,4157 con un PABU de 1,2023).
    expect(clasificarIcaBis(-0.1)!.l).toBe("Reserva bioeléctrica leve");
    expect(clasificarIcaBis(-0.3)!.l).toBe("Reserva bioeléctrica moderada");
    expect(clasificarIcaBis(-1)!.l).toBe("Reserva bioeléctrica superior");
  });

  it("la pantalla usa ESTE clasificador, no el de la historia clinica", () => {
    const src = leer(PANTALLA);
    expect(src).toContain("clasificarIcaBis");
    expect(src, "la regla de la HC no debe aplicarse aqui").not.toContain("conClaseIcaBis");
  });
});

describe("la HISTORIA CLINICA toma la del PABU (ATLAS_v8 L15425)", () => {
  it("conClaseIcaBis resuelve la entrada ICA-BIS a la del PABU, sin tocar las demas", () => {
    const sev = conClaseIcaBis({ IFC: 0, PABU: 2, FMI: 3 });
    expect(sev["ICA-BIS"]).toBe(2);
    expect(sev.PABU).toBe(2);
    expect(sev.IFC).toBe(0);
    expect(CODIGO_CLASE_ICA_BIS).toBe("PABU");
  });

  it("la historia clinica pasa por ahi, y la pantalla no", () => {
    expect(leer(HISTORIA)).toContain("conClaseIcaBis");
  });

  // EL CONTROL de la asercion negativa: sin el alias, la fila NO aparece en la HC. Asi queda demostrado
  // que el test compara algo, y de paso queda escrito que la HC estaba MUDA (el snapshot sella
  // `classifications["ICA-BIS"] = null` y `indicatorSeverities` no emite la clave).
  it("con el alias la fila entra en los indices alterados de la HC, y sin el no", () => {
    const valores = { PABU: 1.2023, "ICA-BIS": 0.4157 };
    const clasesCrudas = { PABU: { label: "Desviación por exceso" }, "ICA-BIS": null };
    const sevCrudas = { PABU: 2 };

    const sinAlias = indicesAniAlterados(valores, clasesCrudas, sevCrudas, true);
    expect(sinAlias.map((f) => f.codigo)).not.toContain("ICA-BIS");

    const conAlias = indicesAniAlterados(
      valores,
      conClaseIcaBis<{ label?: string | null } | null>(clasesCrudas),
      conClaseIcaBis<number>(sevCrudas),
      true,
    );
    const ica = conAlias.find((f) => f.codigo === "ICA-BIS");
    expect(ica?.clasificacion).toBe("Desviación por exceso");
    expect(ica?.sev).toBe(2);
  });
});
