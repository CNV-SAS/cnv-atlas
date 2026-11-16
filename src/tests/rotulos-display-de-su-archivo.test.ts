import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { rotuloDisplayDeIndice } from "@/modules/diagnoses/data/indicator-ranges";

import * as core from "@/clinical-engine/frozen/engine.core.derived.js";

import { HTML_VIGENTE, CAMBIOS_NUEVOS, htmlDeCambioNuevo } from "./fixtures/html-vigente";

// La entrega de la v17, DERIVADA como en los demas candados: la ultima de la convencion nueva.
const ENTREGA_V17 = CAMBIOS_NUEVOS[CAMBIOS_NUEVOS.length - 1];

// CANDADO DE LOS ROTULOS DE LA TABLA DE INDICES (2026-09-09).
//
// EL DEFECTO, y lo vio Santiago con Gildardo delante: su tabla dice "Envejecimiento acelerado" y la
// nuestra decia "Acelerado". Al ir a mirar no era una etiqueta suelta, era una FAMILIA ENTERA.
//
// SU ARCHIVO TIENE DOS JUEGOS DE CLASIFICADORES: los CIENTIFICOS (`cIFC`, `cPABU`, `cIAE`, `cIEHH`), que
// son los que el motor congelado sella en el snapshot, y los de DISPLAY (`dIFC`, `dPABU`, `dIAE`,
// `dIEHH`), que son los que su tabla de Diagnostico PINTA. Nosotros mostrabamos los cientificos.
//
// YA LO SABIAMOS POR EL ICA-BIS: esa fila se porto de `dICA` justo por esto, y quedo escrito que su
// archivo "tiene DOS reglas, una por superficie". Lo que no se hizo entonces fue barrer las demas. Es la
// leccion de siempre: arreglar el caso que se reporto y no la FORMA del caso.
//
// SE DERIVA DE SU ARCHIVO VIGENTE. Una tabla de rotulos escrita aqui seria una tercera copia del mismo
// texto, y este texto es lo que el profesional LEE como veredicto.

/** Extrae de su HTML los rotulos de un clasificador de display, en el orden en que aparecen. */
function rotulosDeSuDisplay(nombre: string): string[] {
  const src = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
  const i = src.indexOf(`const ${nombre}  =`) >= 0 ? src.indexOf(`const ${nombre}  =`) : src.indexOf(`const ${nombre} =`);
  if (i < 0) throw new Error(`no aparece ${nombre} en ${HTML_VIGENTE}`);
  const linea = src.slice(i, src.indexOf("\n", i));
  return [...linea.matchAll(/\{l:'([^']+)'/g)].map((m) => m[1]);
}

// ═══ YA NO QUEDA NINGUN INDICE QUE SE SONDEE POR VALOR CONTRA SU DISPLAY VIEJO (2026-11-16) ═══
//
// Aqui habia un mapa de SONDAS (un valor por rama) que comparaba nuestro rotulo contra los `{l:'...'}`
// de su clasificador de display. Se fue vaciando por la MISMA razon tres veces seguidas: **una entrega
// posterior suya pisa su capa de display vieja**.
//
//   · el IFC salio el 2026-09-21 (sus cortes de display eran los historicos 3,5/6,0, que el prohibio);
//   · el IAE salio el 2026-10-29 (su tabla 3 de la EB-BIS v7 gobierna como se presenta);
//   · el IEHH sale hoy, y este es el caso mas limpio de los tres: **lo movio EL**. Su `dIEHH` del v9
//     tenia los cuatro escalones; su ATLAS_v17 lo reemplaza por `const dIEHH = v=>v==null?null:cIEHH(v);`
//     con su propio comentario *"v17: tres zonas (libro, Tabla 8.2)"*. Sondear por valor contra el v9
//     seria anclar a una entrega superada, que es justo lo que la cabecera de `html-vigente` describe
//     como el candado mas peligroso: el que da una garantia que ya no existe.
//
// El mecanismo de leer sus rotulos NO se retira: lo siguen usando el vocabulario del IFC y el control
// del IAE, abajo. Lo que se retira es la comparacion por valor, que ya no tiene a quien comparar.

describe("los rótulos de los índices son los de SU capa de display", () => {
  it("el control: sus clasificadores de display se leen y traen rótulos", () => {
    // Sin esto, un cambio de forma en su HTML daria listas vacias y todo lo de abajo pasaria verde
    // comparando nada contra nada.
    for (const d of ["dIFC", "dIAE", "dIEHH"]) {
      expect(rotulosDeSuDisplay(d).length, `no se leyeron los rótulos de ${d}`).toBeGreaterThan(2);
    }
  });

  it("y los que NO difieren no se tocan", () => {
    // IRC e ISCM tienen el mismo rotulo en las dos capas (su `dIRC` delega literalmente en `cIRC`).
    // Meterlos en el mapa seria una copia que puede divergir sola del clasificador congelado.
    expect(rotuloDisplayDeIndice("IRC", 1.5)).toBeNull();
    expect(rotuloDisplayDeIndice("ISCM", -2)).toBeNull();
    expect(rotuloDisplayDeIndice("ICA-BIS", 0.4), "ICA-BIS ya se resuelve entero aparte").toBeNull();
  });

  it("y sin valor no hay rótulo que inventar", () => {
    expect(rotuloDisplayDeIndice("IAE", null)).toBeNull();
    expect(rotuloDisplayDeIndice("IEHH", null)).toBeNull();
  });
});

// ═══ EL IFC: SU PALABRA, CON EL ESCALON DEL CLASIFICADOR SELLADO (2026-09-21) ═══
//
// EL CASO REAL, de una integrante: paciente MUJER con IFC 2,11. La tabla decia "Disfunción celular
// establecida" y el SOAP "función celular en rango normal". Estaba mal la tabla: su entrada del IFC
// reclasificaba con 3,5/6,0, los cortes historicos unicos que Gildardo prohibio en su prompt porque
// "desplazaban sistematicamente la lectura de las mujeres". Con su `cIFC` (2,08/3,28 en mujeres), 2,11 es
// banda media: "Alerta funcional". Y el color de la fila ya lo decia (ambar), porque sale del sellado: la
// tabla se contradecia sola.
describe("el IFC se traduce por su banda sellada, no se reclasifica", () => {
  it("el caso de la integrante: 2,11 en una mujer es banda media, no disfunción establecida", () => {
    expect(rotuloDisplayDeIndice("IFC", 2.11, "Alerta funcional")).toBe("Alerta funcional");
    expect(rotuloDisplayDeIndice("IFC", 2.11, "Alerta funcional")).not.toContain("establecida");
  });

  it("el escalón lo decide el sellado: el mismo valor en un hombre sí es disfunción", () => {
    // 2,11 en un hombre cae bajo su corte (4,12): ahi SI es el escalon malo, y la palabra es la suya.
    expect(rotuloDisplayDeIndice("IFC", 2.11, "Disfunción celular")).toBe("Disfunción celular establecida");
  });

  it("sin rótulo sellado no se reclasifica por valor", () => {
    // Es exactamente lo que produjo el defecto: volver a los cortes del display cuando falta el sellado.
    expect(rotuloDisplayDeIndice("IFC", 2.11)).toBeNull();
    expect(rotuloDisplayDeIndice("IFC", 2.11, null)).toBeNull();
  });

  it("las tres palabras siguen siendo las de su display, en su orden", () => {
    // Lo que se conserva del porte del 2026-09-09 es su VOCABULARIO. Se deriva de su archivo vigente.
    const suyos = rotulosDeSuDisplay("dIFC");
    const nuestros = ["Disfunción celular", "Alerta funcional", "Función óptima"].map((sellado) =>
      rotuloDisplayDeIndice("IFC", 1, sellado),
    );
    expect(nuestros).toEqual(suyos.slice(0, 3));
  });
});

// ═══ EL PABU LO RESPONDIO GILDARDO, Y MANDA EL SELLADO (2026-09-21) ═══
//
// Su respuesta a la pregunta 3 (2026-09-07): *"Ya revisé ATLAS y está bien como lo tienen"*, cuando la
// tabla mostraba `cPABU`. El barrido del 2026-09-09 la cambio a `dPABU` sin instruccion suya. Este test
// impide que el siguiente barrido de rotulos la vuelva a abrir.
describe("el PABU de la tabla es el sellado, por respuesta de Gildardo", () => {
  it("no tiene rótulo de display: manda `cPABU`", () => {
    expect(rotuloDisplayDeIndice("PABU", 1.2)).toBeNull();
    expect(rotuloDisplayDeIndice("PABU", 2.36)).toBeNull();
  });

  it("y la respuesta sigue escrita donde se la hicimos", () => {
    const pendientes = readFileSync("docs/PENDIENTES_CIENTIFICOS.md", "utf8");
    expect(pendientes).toContain("Ya revisé ATLAS y está bien como lo tienen");
  });
});

// ═══ EL IAE: SUS PALABRAS DE LA TABLA 3, QUE PISAN A `dIAE` (2026-10-29) ═══
//
// ESTE CANDADO ESTABA VERDE DEFENDIENDO LA FUENTE EQUIVOCADA, y lo atrapo al cambiarla, que es
// exactamente para lo que existe. Lo defendido era correcto cuando se escribio: el 2026-09-09 Santiago
// vio con Gildardo delante que su tabla decia "Envejecimiento acelerado" y la nuestra "Acelerado", y la
// fuente de la verdad entonces era su capa de display `dIAE` (ATLAS_v8 L14444).
//
// LO QUE CAMBIO ES QUE HAY UNA ENTREGA SUYA POSTERIOR Y MAS ESPECIFICA. Su tabla 3 del 2026-10-26
// ("Salidas y presentacion en pantalla" de la EB-BIS v7) define como se presenta ESTE indicador, con su
// pie literal: *"toda salida se presenta como estimacion, nunca como diagnostico"*. Dice "envejecimiento
// acelerado estimado", "desacelerado estimado" y "acorde con sus pares", y sus cortes son CERRADOS
// (>= +5,0 y <= -5,0) donde los de `dIAE` eran abiertos (<-5 y <=5).
//
// ES EL MISMO MOVIMIENTO QUE HIZO EL IFC un mes antes, y por eso no hay que inventar criterio: un
// clasificador de display suyo deja de regir cuando el entrega algo posterior que habla de ese mismo
// indicador. Santiago lo instruyo asi, textual: *"la tabla 3 de Gildardo dice 'acorde con sus pares'...
// La pantalla dice 'Concordante'. Usa sus textos."*
//
// LO QUE QUEDA SIN CERRAR, Y VA AL DOCUMENTO DE DUDAS: el COLOR de la fila sigue saliendo del
// clasificador SELLADO (`cIAE`), cuyos cortes son los abiertos. En un IAE de exactamente +5,0 el rotulo
// dice "acelerado" (tabla 3) y el color sigue el del sellado. Es una pregunta suya, no nuestra.
describe("el IAE se rotula con su tabla 3, no con su display viejo", () => {
  it("las tres frases suyas, con la palabra 'estimado' que su pie de tabla exige", () => {
    expect(rotuloDisplayDeIndice("IAE", 8)).toBe("envejecimiento acelerado estimado");
    expect(rotuloDisplayDeIndice("IAE", -8)).toBe("envejecimiento desacelerado estimado");
    expect(rotuloDisplayDeIndice("IAE", 0)).toBe("acorde con sus pares");
  });

  it("y sus cortes cerrados: +5,0 exacto es acelerado, no intermedio", () => {
    // Es la diferencia concreta con `dIAE`, que en +5,0 decia "Concordante". Su tabla 3 escribe ">=" y
    // "<=", asi que el borde pertenece a la cola.
    expect(rotuloDisplayDeIndice("IAE", 5)).toBe("envejecimiento acelerado estimado");
    expect(rotuloDisplayDeIndice("IAE", -5)).toBe("envejecimiento desacelerado estimado");
    expect(rotuloDisplayDeIndice("IAE", 4.9)).toBe("acorde con sus pares");
  });

  it("CONTROL: su display viejo sigue en su archivo, y no se toca", () => {
    // No se borra de su HTML ni se corrige: su archivo es su archivo. Lo que cambia es CUAL de sus dos
    // fuentes rige esta fila. Si algun dia `dIAE` desapareciera de su entrega, este control lo diria.
    expect(rotulosDeSuDisplay("dIAE")).toContain("Envejecimiento acelerado");
  });
});

// ═══ EL IEHH: SUS TRES ZONAS, PORQUE SU PROPIA v17 DELEGO EL DISPLAY EN EL CLASIFICADOR (2026-11-16) ═══
//
// EL DEFECTO QUE CIERRA, reportado por Santiago sobre una consulta ya reemitida a 4.0.0: la HC decia
// *"Equilibrio hídrico −1,57 · Equilibrio hídrico óptimo · referencia −1 a +1"*. La referencia ya era la
// de la v17 y el veredicto no, asi que la misma linea afirmaba que el valor esta DENTRO de un rango que
// ella misma imprime y del que esta fuera; y el analisis del SOAP, dos parrafos mas abajo, decia *"un
// IEHH en zona de déficit"*. Medido en la nube: en 265 de 552 consultas el rotulo y el clasificador se
// contradicen. Es el hazard 4 de CLAUDE.md: no es redaccion, es que LEEN FUENTES DISTINTAS.
//
// LA CAUSA: `ROTULOS_DISPLAY.IEHH` era una copia de su `dIEHH` del v9, con los CUATRO escalones de
// entonces y "Equilibrio hídrico óptimo" para TODO v <= 0. Su v17 §5 rehizo el indicador: tres zonas,
// y el valor bueno deja de ser "todo lo que este por debajo de cero" para ser el CENTRO. Con la escalera
// vieja encima, el deficit (la cola que su v17 inventa para poder nombrarlo) salia como optimo.
//
// Y LO MOVIO EL, QUE ES LO QUE HACE ESTE CASO FACIL: su ATLAS_v17 escribe
// `const dIEHH = v=>v==null?null:cIEHH(v);` con el comentario *"v17: tres zonas (libro, Tabla 8.2)"*.
// Asi que delegar en `cIEHH` no es una decision nuestra sobre su contenido: es portar la suya.
describe("el IEHH se rotula con su clasificador de la v17, no con la escalera de la v16", () => {
  it("el caso de Santiago: −1,57 es déficit, no equilibrio óptimo", () => {
    expect(rotuloDisplayDeIndice("IEHH", -1.57)).toBe("Déficit");
    expect(rotuloDisplayDeIndice("IEHH", -1.57)).not.toContain("óptimo");
  });

  it("las tres zonas, con sus palabras", () => {
    expect(rotuloDisplayDeIndice("IEHH", -2)).toBe("Déficit");
    expect(rotuloDisplayDeIndice("IEHH", 0)).toBe("Óptimo");
    expect(rotuloDisplayDeIndice("IEHH", 2)).toBe("Capacitancia alta");
  });

  it("y los dos bordes pertenecen al centro, como su clasificador los escribe", () => {
    // `cIEHH`: `v < -1` deficit · `v <= 1` optimo · resto capacitancia alta. Los bordes importan porque
    // son justo donde una copia a mano se equivoca de signo.
    expect(rotuloDisplayDeIndice("IEHH", -1)).toBe("Óptimo");
    expect(rotuloDisplayDeIndice("IEHH", 1)).toBe("Óptimo");
    expect(rotuloDisplayDeIndice("IEHH", -1.0001)).toBe("Déficit");
    expect(rotuloDisplayDeIndice("IEHH", 1.0001)).toBe("Capacitancia alta");
  });

  it("y el rótulo no es una copia: es su propio clasificador", () => {
    // El dia que el mueva una zona, esta fila se mueve con el. Una copia aqui seria la tercera fuente
    // del mismo veredicto, que es lo que acaba de costar la contradiccion.
    for (const v of [-3, -1.57, -1, 0, 1, 1.5, 4]) {
      expect(rotuloDisplayDeIndice("IEHH", v)).toBe(String(core.cIEHH(v).l));
    }
  });

  it("CONTROL: su v17 delega el display del IEHH en `cIEHH`", () => {
    // Si una entrega suya posterior le devolviera escalones propios al `dIEHH`, este control lo diria, y
    // entonces mandaria su display otra vez (es la regla que ya movio al IFC y al IAE, en el otro sentido).
    const suyo = readFileSync(htmlDeCambioNuevo(ENTREGA_V17), "utf8").replace(/\r\n/g, "\n");
    const i = suyo.indexOf("const dIEHH");
    expect(i, "no aparece dIEHH en su ATLAS_v17").toBeGreaterThan(0);
    expect(suyo.slice(i, suyo.indexOf("\n", i)).replace(/\s+/g, "")).toContain("dIEHH=v=>v==null?null:cIEHH(v)");
  });
});
