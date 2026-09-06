import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { cPABU } from "@/clinical-engine/frozen/engine.core.derived.js";
import { veredictoSev } from "@/clinical-engine/severity";
import { CODIGO_CLASE_ICA_BIS, conClaseIcaBis } from "@/modules/diagnoses/data/indicator-ranges";
import { indicesAniAlterados } from "@/modules/reports/data/hc-indices-ani";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL PUNTO 17 DEL COTEJO (2026-09-05): la fila ICA-BIS toma la clasificacion del PABU.
//
// Su archivo: `var icaBisClf = t_icaBis !== null ? cPABU(t_pabu) : null` (linea 15425 de la entrega del
// 4-sep), con la nota al lado "cICABIS eliminado — usar cPABU global". Nosotros teniamos un clasificador
// PROPIO (`clasificarIcaBis`) que graduaba la desviacion en leve/moderada/severa/critica, o sea justo lo
// que el habia borrado, y su comentario del PABU lo prohibe: "La MAGNITUD del deterioro no se gradua
// aqui... Duplicar esa graduacion en la PABU añadiria bandas sin aportar informacion nueva".
//
// El candado tiene TRES partes, y la tercera es la que importa: el defecto no era una funcion mal escrita
// sino una REGLA aplicada en un solo sitio de los dos que la necesitan (leccion del candado sobre el
// SITIO DE LLAMADA). Por eso se afirma que los dos consumidores pasan por la misma funcion.

const leer = (p: string) => sinComentarios(readFileSync(p, "utf8"));

const PANTALLA = "src/modules/diagnoses/components/evaluation-results.tsx";
const HISTORIA = "src/modules/reports/data/hc-composicion.ts";
const RANGOS = "src/modules/diagnoses/data/indicator-ranges.ts";

describe("ICA-BIS: la clase y la severidad salen del PABU (cotejo punto 17)", () => {
  it("conClaseIcaBis resuelve la entrada ICA-BIS a la del PABU, sin tocar las demas", () => {
    const sev = conClaseIcaBis({ IFC: 0, PABU: 2, FMI: 3 });
    expect(sev["ICA-BIS"]).toBe(2);
    expect(sev.PABU).toBe(2);
    expect(sev.IFC).toBe(0);
    expect(sev.FMI).toBe(3);

    const clases = conClaseIcaBis<{ label: string } | null>({
      PABU: { label: "Desviación por déficit" },
      "ICA-BIS": null, // lo que sella el snapshot
    });
    expect(clases["ICA-BIS"]).toEqual({ label: "Desviación por déficit" });
  });

  it("el codigo del que toma la clase es el PABU, no otro", () => {
    expect(CODIGO_CLASE_ICA_BIS).toBe("PABU");
  });

  // LA CONSECUENCIA CLINICA, que es la razon de todo esto. Con el clasificador propio, una desviacion de
  // 0,3745 caia en "Desviación leve" con severidad 0: verde, junto a un rotulo que decia que hay
  // desviacion. Con el del PABU es ambar (severidad 2), como en su archivo.
  it("una desviacion fuera de la zona φ queda en ambar (sev 2), no en verde", () => {
    const desviado = veredictoSev(cPABU(1.9925)); // ICA-BIS = 1,9925 − 1,618 = 0,3745
    expect(desviado).toBe(2);
    expect(cPABU(1.9925).l).toBe("Desviación por déficit");
    expect(conClaseIcaBis({ PABU: desviado })["ICA-BIS"]).toBe(2);
  });

  it("dentro de la zona φ sigue en verde (sev 0): el candado no convierte todo en alerta", () => {
    const enZona = veredictoSev(cPABU(1.65));
    expect(enZona).toBe(0);
    expect(cPABU(1.65).l).toContain("Zona φ");
  });

  // EL CONTROL de la asercion negativa: sin el alias, la fila NO aparece. Asi queda demostrado que el
  // test compara algo, y de paso queda escrito que la historia clinica estaba MUDA (el snapshot sella
  // `classifications["ICA-BIS"] = null` y `indicatorSeverities` no emite la clave).
  it("la fila ICA-BIS entra en los indices alterados de la HC con el alias, y no sin el", () => {
    const valores = { PABU: 1.9925, "ICA-BIS": 0.3745 };
    const clasesCrudas = { PABU: { label: "Desviación por déficit" }, "ICA-BIS": null };
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
    expect(ica).toBeDefined();
    expect(ica?.clasificacion).toBe("Desviación por déficit");
    expect(ica?.sev).toBe(2);
  });

  // LOS SITIOS DE LLAMADA. El defecto era una regla en un solo sitio de los dos, asi que lo que se fija
  // es que los dos pasen por la MISMA funcion, no que la funcion exista.
  it("los dos consumidores de la fila pasan por conClaseIcaBis", () => {
    for (const p of [PANTALLA, HISTORIA]) {
      expect(leer(p), p).toContain("conClaseIcaBis");
    }
  });

  it("el clasificador propio no vuelve: nada gradua la desviacion del ICA-BIS", () => {
    const rangos = leer(RANGOS);
    expect(rangos).not.toContain("clasificarIcaBis");
    // Las cuatro bandas que el borro. Si alguna reaparece en la capa de display, esto se pone rojo.
    for (const banda of ["Desviación leve", "Desviación moderada", "Desviación severa", "Zona crítica"]) {
      expect(rangos, banda).not.toContain(banda);
      expect(leer(PANTALLA), banda).not.toContain(banda);
    }
  });
});
