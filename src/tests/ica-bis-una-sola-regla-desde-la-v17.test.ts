import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { veredictoSev } from "@/clinical-engine/severity";
import {
  clasificarIcaBis,
  CODIGO_CLASE_ICA_BIS,
  conClaseIcaBis,
} from "@/modules/diagnoses/data/indicator-ranges";
import { indicesAniAlterados } from "@/modules/reports/data/hc-indices-ani";

import { CAMBIOS_NUEVOS, htmlDeCambioNuevo } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ICA-BIS: UNA SOLA REGLA DESDE LA v17  ·  2026-11-16
//
// ═══ LO QUE ESTE ARCHIVO DEFENDIA ANTES, Y POR QUE CAMBIA ═══
//
// Nacio como candado del punto 17 del cotejo (2026-09-05): **su archivo tenia DOS reglas para esta fila,
// una por superficie**, y el candado fijaba que cada una viviera donde le tocaba.
//
//   · DIAGNOSTICO (ATLAS_v8 L14623): `dICA`, clasificador de MAGNITUD con cinco escalones.
//   · HISTORIA CLINICA (ATLAS_v8 L15425): `icaBisClf = cPABU(t_pabu)`, con su nota al lado
//     ("cICABIS eliminado — usar cPABU global").
//
// Y nacio afirmando lo contrario de lo que su archivo decia: la primera version aplico la regla de la HC
// a la PANTALLA y paso verde, certificando mi lectura y no su archivo. Por eso cada caso citaba la LINEA.
//
// ═══ SU v17 CIERRA LA DIVISION, Y LA CIERRA BORRANDO UNA DE LAS DOS ═══
//
// **`dICA` ya no existe en su ATLAS_v17.** Las dos superficies suyas leen `cPABU`, con los percentiles
// del sexo de su Tabla 7.3. Asi que aqui no hay que elegir entre dos fuentes suyas: solo queda una.
//
// Y NO ERA UNA DIFERENCIA DE PALABRAS. Desde la v17 el ICA-BIS lleva SIGNO (PABU − φ), y `dICA` estaba
// escrito para la magnitud: todo el lado negativo, que ahora es el EXCESO de adiposidad, caia en su rama
// de "Reserva bioeléctrica", que se lee como algo bueno y va en azul. Medido en la nube el 2026-11-16
// (`scripts/los-veredictos-de-la-hc-contra-el-dfi.mjs`): en las **552** consultas con informe sellado la
// pantalla y la HC daban veredictos distintos, y en **323** la pantalla decia "reserva bioeléctrica"
// donde su clasificador dice desplazamiento por exceso.
//
// LO QUE SE CONSERVA de aquel candado: el control del COLOR, que fue el defecto que Santiago reporto
// ("desviación leve con color verde"), ahora sobre las etiquetas de `cPABU`; y la regla de la HC, que no
// cambia, porque siempre fue esta.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const PANTALLA = "src/modules/diagnoses/components/evaluation-results.tsx";
const HISTORIA = "src/modules/reports/data/hc-composicion.ts";
const ENTREGA_V17 = CAMBIOS_NUEVOS[CAMBIOS_NUEVOS.length - 1];

const leer = (p: string) => sinComentarios(readFileSync(p, "utf8"));

// φ = 1,618. Los percentiles del ICA-BIS en MUJERES (su Tabla 7.3): p10 −0,43 · p25 −0,20 · p75 0,45 ·
// p90 0,86. Se sondea con la PABU, que es lo que el clasificador recibe.
const pabuDe = (ica: number) => 1.618 + ica;

describe("la fila ICA-BIS se lee con `cPABU`, en las DOS superficies", () => {
  it("las cinco zonas de su Tabla 7.3, en una mujer", () => {
    expect(clasificarIcaBis(pabuDe(1.0), "F")!.l).toBe("Alejamiento marcado por déficit");
    expect(clasificarIcaBis(pabuDe(0.6), "F")!.l).toBe("Alejamiento leve por déficit");
    expect(clasificarIcaBis(pabuDe(0.1), "F")!.l).toBe("Rango habitual");
    expect(clasificarIcaBis(pabuDe(-0.3), "F")!.l).toBe("Desplazamiento leve por exceso");
    expect(clasificarIcaBis(pabuDe(-0.6), "F")!.l).toBe("Desplazamiento marcado por exceso");
  });

  it("EL LADO NEGATIVO YA NO DICE 'reserva bioeléctrica': dice exceso", () => {
    // Es el defecto concreto que cierra, y el que mas pesa: 323 consultas en la nube. "Reserva" se lee
    // como algo bueno y se pintaba de azul; lo que hay es desplazamiento por exceso de adiposidad.
    for (const ica of [-0.25, -0.3, -0.6, -1.2]) {
      const clase = clasificarIcaBis(pabuDe(ica), "F")!;
      expect(clase.l, `ICA-BIS ${ica}`).not.toMatch(/reserva/i);
      expect(clase.l, `ICA-BIS ${ica}`).toMatch(/exceso/i);
    }
  });

  it("y los cortes son los de SU sexo, no los de uno aplicado a los dos", () => {
    // El p25 de la mujer es −0,20 y el del hombre −0,27: un ICA-BIS de −0,24 cae en zonas distintas.
    expect(clasificarIcaBis(pabuDe(-0.24), "F")!.l).toBe("Desplazamiento leve por exceso");
    expect(clasificarIcaBis(pabuDe(-0.24), "M")!.l).toBe("Rango habitual");
  });

  it("sin sexo o sin PABU no se clasifica: su regla, la misma del IFC", () => {
    expect(clasificarIcaBis(pabuDe(0.5), null)).toBeNull();
    expect(clasificarIcaBis(null, "F")).toBeNull();
    expect(clasificarIcaBis(0, "F")).toBeNull();
  });

  it("EL CONTROL DEL COLOR, que fue el defecto de 2026-09-05: la alteración no es verde", () => {
    // La severidad NO se elige: sale del hex de su archivo por el mismo camino que los quince
    // clasificadores congelados. El rango habitual sigue en verde, para que el candado no convierta
    // todo en alerta.
    expect(veredictoSev(clasificarIcaBis(pabuDe(0.1), "F"))).toBe(0);
    expect(veredictoSev(clasificarIcaBis(pabuDe(0.6), "F"))).toBe(2);
    expect(veredictoSev(clasificarIcaBis(pabuDe(1.0), "F"))).toBe(3);
    expect(veredictoSev(clasificarIcaBis(pabuDe(-0.6), "F"))).toBe(3);
  });

  it("la pantalla y la historia clínica usan la MISMA regla", () => {
    const pantalla = leer(PANTALLA);
    expect(pantalla).toContain("clasificarIcaBis");
    // Y se le pasa la PABU con el sexo del sello, no el ICA-BIS: es donde se perdia el signo.
    expect(pantalla).toContain("clasificarIcaBis(indicators.pabu, snapshot.sexo)");
    expect(leer(HISTORIA)).toContain("conClaseIcaBis");
  });

  it("CONTROL: `dICA` ya no está en su archivo, que es lo que justifica el cambio", () => {
    // Si una entrega suya posterior le devolviera a esta fila un clasificador propio de pantalla, este
    // control lo diria, y entonces habria que volver a separar las dos superficies.
    const suyo = readFileSync(htmlDeCambioNuevo(ENTREGA_V17), "utf8");
    expect(suyo).not.toContain("const dICA");
    expect(suyo, "y su nota de que se usa cPABU sigue ahí").toContain("cICABIS eliminado");
  });
});

describe("la HISTORIA CLINICA toma la del PABU (y eso no cambió)", () => {
  it("conClaseIcaBis resuelve la entrada ICA-BIS a la del PABU, sin tocar las demas", () => {
    const sev = conClaseIcaBis({ IFC: 0, PABU: 2, FMI: 3 });
    expect(sev["ICA-BIS"]).toBe(2);
    expect(sev.PABU).toBe(2);
    expect(sev.IFC).toBe(0);
    expect(CODIGO_CLASE_ICA_BIS).toBe("PABU");
  });

  // EL CONTROL de la asercion negativa: sin el alias, la fila NO aparece en la HC. Asi queda demostrado
  // que el test compara algo, y de paso queda escrito que la HC estaba MUDA (el snapshot sella
  // `classifications["ICA-BIS"] = null` y `indicatorSeverities` no emite la clave).
  it("con el alias la fila entra en los indices alterados de la HC, y sin el no", () => {
    const valores = { PABU: 2.7, "ICA-BIS": 1.082 };
    const clasesCrudas = { PABU: { label: "Alejamiento marcado por déficit" }, "ICA-BIS": null };
    const sevCrudas = { PABU: 3 };

    const sinAlias = indicesAniAlterados(valores, clasesCrudas, sevCrudas, false);
    expect(sinAlias.map((f) => f.codigo)).not.toContain("ICA-BIS");

    const conAlias = indicesAniAlterados(
      valores,
      conClaseIcaBis<{ label?: string | null } | null>(clasesCrudas),
      conClaseIcaBis<number>(sevCrudas),
      false,
    );
    const ica = conAlias.find((f) => f.codigo === "ICA-BIS");
    expect(ica?.clasificacion).toBe("Alejamiento marcado por déficit");
    expect(ica?.sev).toBe(3);
  });
});
