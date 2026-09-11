import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

import { indicatorBands } from "@/modules/diagnoses/data/indicator-ranges";
import { INDICES_ANI, indicesAniAlterados } from "@/modules/reports/data/hc-indices-ani";

// CANDADO DEL BLOQUE ANI-BIS-E DE LA HISTORIA CLINICA (2026-08-24).
//
// Hallazgo que lo motiva: su HC muestra IEHH e IAE y la nuestra no mostraba NINGUNO de los ocho, porque en
// Atlas viven en una tabla aparte del Diagnostico. Por la regla del cotejo, un indicador que el muestra y
// nosotros no es siempre accionable, y estos son los mas propios del modelo.

const clas = { IEHH: { label: "Leve" }, IAE: { label: "Acelerado" }, IFC: { label: "Función óptima" } };

describe("indices ANI-BIS-E de la historia clinica", () => {
  it("porta las OCHO filas de su tabla, en su orden", () => {
    expect(INDICES_ANI.map((f) => f.codigo)).toEqual([
      "IFC",
      "IRC",
      "ISCM",
      "IEHH",
      "EB",
      "IAE",
      "PABU",
      "ICA-BIS",
    ]);
  });

  it("el NOMBRE completo sale de SU archivo, no de nuestro glosario", () => {
    // La HC la puede leer otro profesional y un medico no tiene por que saber que es un IAE. Los nombres
    // son los que el usa ("IFC · Funcion Celular"): el glosario interno marca varios como "confirmar
    // Gildardo", asi que escribir ahi un nombre nuestro seria afirmar algo que el no confirmo.
    const n = Object.fromEntries(INDICES_ANI.map((f) => [f.codigo, f.nombre]));
    expect(n.IFC).toBe("Función Celular");
    expect(n.IRC).toBe("Riesgo Celular");
    expect(n.ISCM).toBe("Síndrome Celular");
    expect(n.IEHH).toBe("Hidro-Homeostasis");
    expect(n.IAE).toBe("Aceleración del Envejecimiento");
  });

  it("PABU va SIN nombre: su archivo no le da uno y no se inventa", () => {
    expect(INDICES_ANI.find((f) => f.codigo === "PABU")!.nombre).toBeNull();
  });

  it("EB-BIS va SIN nombre: el suyo dice 'Edad Biológica' y nosotros NO la rotulamos como edad", () => {
    // Divergencia deliberada ya registrada (D-010/D-011): la EB-BIS es un indice funcional bioelectrico,
    // no la edad del cuerpo. Poner "Edad Biologica" en la historia clinica la contradiria.
    expect(INDICES_ANI.find((f) => f.codigo === "EB")!.nombre).toBeNull();
  });

  // ═══ EL CANDADO QUE FALTABA, Y POR QUE EL QUE HABIA NO SERVIA (2026-09-10) ═══
  //
  // EL CASO DE ABAJO comparaba nuestras cadenas contra cadenas escritas A MANO EN ESTE ARCHIVO. Eso es un
  // candado que compara DOS COPIAS NUESTRAS: pasa verde mientras las dos digan lo mismo, aunque las dos
  // digan algo distinto de lo que dice el. Y eso fue exactamente lo que paso.
  //
  // LO QUE SE LE ESCAPO: la referencia del IRC decia "<1,68 bajo riesgo". El 2026-08-29 se portaron sus
  // cortes del IRC por sexo (1,7/2,1 H y 2,3/2,8 M) al clasificador, y esta columna, que los CITA, se
  // quedo en los viejos. Durante doce dias la historia clinica imprimio un corte que su propio
  // clasificador ya no usaba: un hombre con IRC 1,69 salia clasificado "Bajo riesgo" con una referencia al
  // lado diciendo que el bajo riesgo empieza por debajo de 1,68.
  //
  // ESTE COTEJA CONTRA SU ARCHIVO. Lee la fila del bloque "ANI BIS-E" de su HC en la entrega VIGENTE (que
  // se deriva del directorio, nunca se escribe a mano) y compara las dos referencias por sexo. Asi el dia
  // que el vuelva a mover un corte, esto se pone rojo y nombra la fila, en vez de esperar a que alguien
  // se acuerde de barrer los sitios que lo citan.
  it("cada referencia coincide con la de SU archivo vigente, no con una copia nuestra", () => {
    const html = readFileSync(HTML_VIGENTE, "utf8");
    // SE ANCLA POR EL `idx:"..."` DE LA FILA, no por numero de linea: una posicion se desincroniza en
    // cuanto el inserta algo mas arriba, y eso ya nos paso con los rangos de `funcionDelHtml`.
    //
    // Su codigo de la HC: `{ idx:"IRC", ref:sexoK_v==="M"?"<1,7 bajo riesgo":"<2,3 bajo riesgo", val:...`
    // o, cuando la referencia no depende del sexo, `ref:"ISCM-1 ≤ −1", val:...`.
    const suRef = (idx: string): { h: string; m: string } => {
      const marca = `idx:"${idx}",`;
      const i = html.indexOf(marca);
      expect(i, `no aparece la fila idx:"${idx}" en ${HTML_VIGENTE}`).toBeGreaterThan(-1);
      const desdeRef = html.slice(html.indexOf("ref:", i) + 4, html.indexOf("val:", i));
      // Las cadenas entre comillas del fragmento: dos si es por sexo (hombre primero, como el lo escribe),
      // una si es plana. Cualquier otra cantidad significa que cambio la forma y hay que mirarla.
      const textos = [...desdeRef.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
      expect(
        textos.length,
        `la referencia de ${idx} tiene una forma que este candado no reconoce: ${desdeRef.trim()}`,
      ).toBeGreaterThan(0);
      // Con sexo, su expresion es `sexoK_v==="M" ? <hombre> : <mujer>`, asi que la primera cadena es el
      // literal "M" del comparador y las dos siguientes las referencias.
      if (textos.length === 3 && textos[0] === "M") return { h: textos[1], m: textos[2] };
      return { h: textos[0], m: textos[0] };
    };

    // SU CODIGO DE FILA NO ES SIEMPRE EL NUESTRO: el suyo rotula la fila de la EB como "EB-BIS" y el
    // nuestro la llama "EB" (la sigla sola, por la divergencia deliberada de arriba).
    const SU_IDX: Record<string, string> = { EB: "EB-BIS" };

    for (const fila of INDICES_ANI) {
      const suyo = suRef(SU_IDX[fila.codigo] ?? fila.codigo);
      expect(fila.referencia(true), `referencia de ${fila.codigo} (hombre)`).toBe(suyo.h);
      expect(fila.referencia(false), `referencia de ${fila.codigo} (mujer)`).toBe(suyo.m);
    }
  });

  it("las referencias son las suyas, verbatim y por sexo", () => {
    const ifc = INDICES_ANI.find((f) => f.codigo === "IFC")!;
    expect(ifc.referencia(true)).toBe("≥6,68 óptimo");
    expect(ifc.referencia(false)).toBe("≥3,28 óptimo");
    expect(INDICES_ANI.find((f) => f.codigo === "IAE")!.referencia(true)).toBe("−5 a +5 años");
    // EL CORTE DEL IRC, que es el que se quedo atras doce dias. Lo cubre el caso de arriba contra su
    // archivo; queda tambien aqui, nombrado, para que el dia que alguien lo vuelva a tocar lea por que.
    const irc = INDICES_ANI.find((f) => f.codigo === "IRC")!;
    expect(irc.referencia(true)).toBe("<1,7 bajo riesgo");
    expect(irc.referencia(false)).toBe("<2,3 bajo riesgo");
  });

  it("muestra el caso de su captura: IEHH leve e IAE acelerado", () => {
    // COMA DECIMAL desde el 2026-09-06, y no es cosmetico: en la MISMA fila la referencia ya decia
    // "≥6,68 óptimo" (coma) y el valor "0.89" (punto), porque la referencia es nuestra y el formato del
    // valor venia copiado del suyo. Es el "sistema mezclado" que la regla de ortografia por superficie
    // nombra, y en un documento clinico en español. Los DECIMALES tambien salen ahora de `decimalesDe`.
    const r = indicesAniAlterados({ IEHH: 0.89, IAE: 12.3 }, clas, { IEHH: 2, IAE: 3 }, true);
    expect(r.map((x) => `${x.codigo} ${x.valor} ${x.clasificacion}`)).toEqual([
      "IEHH 0,89 Leve",
      "IAE +12,3 a Acelerado",
    ]);
  });

  it("el IAE positivo lleva su signo, como en su tabla", () => {
    const r = indicesAniAlterados({ IAE: 12.3 }, { IAE: { label: "Acelerado" } }, { IAE: 3 }, true);
    expect(r[0].valor).toBe("+12,3 a");
  });

  it("los decimales salen de la tabla unica, no de un numero escrito en esta fila", () => {
    // El PABU lleva TRES porque su corte es φ = 1,618, y el ICA-BIS DOS. Antes esta tabla decia 3 y 4
    // (los suyos verbatim), asi que la HC y la pantalla mostraban la misma cifra con distinta precision.
    const pabu = indicesAniAlterados({ PABU: 1.2023 }, { PABU: { label: "Desviación por exceso" } }, { PABU: 2 }, true);
    expect(pabu[0].valor).toBe("1,202");
    const ica = indicesAniAlterados({ "ICA-BIS": 0.4157 }, { "ICA-BIS": { label: "Desviación leve" } }, { "ICA-BIS": 2 }, true);
    expect(ica[0].valor).toBe("0,42");
  });

  it("aplica los MISMOS dos filtros del resto de la tabla: sin valor y sin alteración quedan fuera", () => {
    expect(indicesAniAlterados({ IEHH: null }, clas, { IEHH: 3 }, true)).toEqual([]);
    expect(indicesAniAlterados({ IFC: 7.2 }, clas, { IFC: 0 }, true)).toEqual([]);
  });

  it("sin clasificación no se afirma que está alterado", () => {
    expect(indicesAniAlterados({ IEHH: 0.89 }, {}, { IEHH: 2 }, true)).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS DOS SUPERFICIES DEL MISMO CORTE NO PUEDEN CONTRADECIRSE (2026-09-10)
//
// POR QUE EXISTE ESTE BLOQUE, y es la pregunta que hizo Santiago al proponer retirar la tabla de cortes
// de /ani-bis-e: "la tabla acaba de destapar el IRC desfasado doce dias, y eso paso porque los cortes se
// pusieron a la vista juntos. ¿Donde mas se veria esa clase de desfase?".
//
// LA RESPUESTA HONESTA ERA: EN NINGUN SITIO. Habia dos candados y ninguno cubria el cruce.
//   · `hc-indices-ani` (arriba) prueba que nuestra REFERENCIA coincide con la de SU archivo.
//   · `indicator-ranges` prueba que nuestras BANDAS coinciden con el CLASIFICADOR congelado.
// Los dos pueden estar verdes y las dos superficies decir cosas distintas, porque comparan contra cosas
// distintas. Es justo lo que paso con el IRC.
//
// ASI QUE EL CRUCE SE VUELVE UN TEST, y por eso la tabla puede retirarse: un test corre en cada commit y
// una tabla solo funciona si alguien la mira. Mejor detector, y ademas gratis.
//
// COMO COMPARA: todo numero que aparece en la referencia tiene que aparecer entre los de las bandas.
// Numericamente, no como cadena: el escribe "1,7" y nosotros "1,70", y son el mismo corte. Al reves NO se
// exige (las bandas traen los tramos intermedios, que la referencia no menciona).
describe("la referencia de su HC y las bandas del clasificador no pueden decir cortes distintos", () => {
  const numeros = (s: string): number[] =>
    [...s.matchAll(/−?-?\d+(?:[.,]\d+)?/g)]
      .map((m) => Number(m[0].replace("−", "-").replace(",", ".")))
      .filter((n) => Number.isFinite(n));

  for (const fila of INDICES_ANI) {
    for (const sexM of [true, false]) {
      const quien = `${fila.codigo} (${sexM ? "hombre" : "mujer"})`;
      const bandas = indicatorBands(fila.codigo, sexM);
      // Sin bandas no hay cruce que hacer: PABU, ICA-BIS y EB son referencia de PUNTO, no de banda.
      if (bandas == null) continue;
      it(`el corte de ${quien} dice lo mismo en las dos`, () => {
        const enBandas = numeros(bandas);
        for (const n of numeros(fila.referencia(sexM))) {
          expect(
            enBandas,
            `${quien}: la referencia de su HC cita ${n} y las bandas del clasificador no lo tienen (${bandas}). ` +
              `O el movió el corte y falta portarlo a una de las dos, o una de las dos se quedó atrás.`,
          ).toContain(n);
        }
      });
    }
  }
});
