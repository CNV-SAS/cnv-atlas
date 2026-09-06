import { describe, expect, it } from "vitest";

import { buildComposition } from "@/modules/diagnoses/data/composition-map";
import {
  CODIGOS_ANI,
  DECIMALES_POR_DEFECTO,
  decimalesDe,
  esIndicadorAni,
} from "@/modules/diagnoses/data/indicator-ranges";

// CANDADO SOBRE LAS DOS CAPAS DE DISPLAY, pedido por Santiago tras el punto 30: *"si discreparon una vez,
// pueden discrepar otra"*.
//
// EL DEFECTO: `indicator-ranges` es la fuente única de los decimales, y su propio comentario decía que la
// llamaban "los TRES consumidores" (el valor en Diagnóstico, la Δ, la historia clínica). Había un CUARTO:
// la tabla de composición de Wang, que es otra capa de display y NO la consultaba. El **AF** salía ahí con
// dos decimales y aquí con uno, y el uno es instrucción de Gildardo (D-016); el **IR**, con dos allí y
// tres aquí. No era una diferencia con su archivo: eran nuestras dos capas discrepando sobre una
// instrucción suya.
//
// POR QUÉ ESTE CANDADO Y NO SOLO EL ARREGLO: el arreglo hace que la tabla de composición PREGUNTE, así que
// hoy no pueden discrepar. Este test fija que siga preguntando, y sobre todo cubre el caso que volvería a
// abrir el agujero: **una fila nueva** cuya clave sea uno de los doce indicadores. Se DERIVA de las dos
// tablas, no lleva los números escritos a mano.

// Una composición mínima: solo hacen falta las CLAVES de las filas y que la tabla se construya. Los
// valores no importan aquí (se comparan decimales, no cifras), pero se dan reales para que las filas
// existan de verdad y no por una rama de "sin dato".
const CRUDO: Record<string, number> = {
  peso: 80.4,
  talla: 177,
  FM: 18,
  FFM: 62.4,
  MMEM: 25.2,
  AF: 6.42,
  IR: 0.7614,
  FFMI: 19.904,
  ECW: 17.3,
  ICW: 27.5,
  TBW: 44.8,
};

describe("las dos capas de display no pueden discrepar sobre los decimales", () => {
  const comp = buildComposition(CRUDO, null);
  const filas = [...comp.eval, ...comp.diag].flatMap((n) => n.rows);

  it("el control: la tabla de composición trae filas de indicadores ANI", () => {
    // Sin este control, una composición vacía haría pasar el test sin comparar nada.
    const deIndicadores = filas.filter((f) => esIndicadorAni(f.key));
    expect(
      deIndicadores.map((f) => f.key),
      "si no hay ninguna fila de indicador, el candado no está mirando nada",
    ).toEqual(expect.arrayContaining(["AF", "IR", "FFMI"]));
  });

  it("cada fila que ES un indicador ANI usa los decimales de la tabla única", () => {
    for (const fila of filas) {
      if (!esIndicadorAni(fila.key)) continue;
      const esperado = decimalesDe(fila.key);
      // `decimals` ausente significa "el default del render", que son dos. Se compara el EFECTIVO.
      const efectivo = fila.decimals ?? DECIMALES_POR_DEFECTO;
      expect(
        efectivo,
        `${fila.key} se muestra con ${efectivo} decimales en la tabla de composición y con ${esperado} en indicator-ranges`,
      ).toBe(esperado);
    }
  });

  it("y los casos que originaron el defecto quedan fijados por su motivo", () => {
    // El AF por instrucción de Gildardo (D-016) y el IR porque recorre menos de una unidad. Se citan
    // aquí para que, si alguien cambia la tabla única, el rojo diga POR QUÉ era ese número.
    expect(decimalesDe("AF"), "D-016: un decimal, instrucción de Gildardo").toBe(1);
    expect(decimalesDe("IR"), "recorre 0,70-0,90: menos de una unidad").toBe(3);
    // Y el resto de los doce no se mueve del estándar sin que este test lo diga.
    for (const codigo of CODIGOS_ANI) {
      if (["AF", "IR", "PABU", "EB", "IAE"].includes(codigo)) continue;
      expect(decimalesDe(codigo), `${codigo} debería ir al estándar`).toBe(DECIMALES_POR_DEFECTO);
    }
  });
});
