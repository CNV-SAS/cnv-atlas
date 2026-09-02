import { describe, expect, it } from "vitest";

import type { EngineIndicators } from "@/clinical-engine";
import {
  cAF,
  cFFMI,
  cFMI,
  cIAE,
  cIEHH,
  cIFC,
  cIR,
  cIRC,
  cISCM,
  cPABU,
  type Sexo,
} from "@/clinical-engine/frozen/engine.core.derived.js";
import { indicatorBands, indicatorRange } from "@/modules/diagnoses/data/indicator-ranges";
import { fmtDec } from "@/lib/format/decimal";

// Rangos de referencia (verbatim del HTML) + DELTA unificada de Gildardo (CA-2, opcion B): Δ = valor −
// referencia de normalidad (promedio del rango si dos bordes; el corte si uno). Ancla los casos
// representativos y, abajo, la REGRESION que Gildardo pide antes de publicar: el antes (HTML) y el
// despues (CA-2) sobre el donante golden Juan Esteban, para dejar por escrito que Δ cambian.

const ind = {
  ifc: 5.3651,
  irc: 1.8218,
  pabu: 1.9925,
  icaBis: 0.3745,
  iscm: -2.072,
  iehh: 0.5,
  iae: -17.6,
  eb: 36.4,
  FMI: 6.369,
  FFMI: 21.1,
  AF: 5.8,
  IR: 0.798,
} as unknown as EngineIndicators;

describe("indicatorRange (referencia verbatim + Δ contra el borde, Gildardo §2)", () => {
  it("AF (M) 5,8: rango '6.5–7.0°', Δ contra el BORDE inferior (6.5) = -0.7 (Gildardo §2)", () => {
    expect(indicatorRange("AF", ind, true)).toEqual({ reference: "6,5–7,0°", delta: "-0,7" });
  });

  it("IR (M) 0,798: un solo limite '<0.78', Δ contra el corte = 0.018 (sin cambio)", () => {
    expect(indicatorRange("IR", ind, true)).toEqual({ reference: "<0,78", delta: "0,018" });
  });

  it("IFC/IRC/FMI (M): salen del CLASIFICADOR del motor (Q20/C11), no de la tabla de display", () => {
    // IFC 5.3651: sano = optima (> hi 6.68). Umbral 6.68, Δ = valor − 6.68 = -1.31.
    expect(indicatorRange("IFC", ind, true)).toEqual({ reference: "> 6,68", delta: "-1,31" });
    // IRC 1.8218: sano = bajo riesgo (< lo 1.68). Umbral 1.68, Δ = valor − 1.68 = 0.14.
    expect(indicatorRange("IRC", ind, true)).toEqual({ reference: "< 1,70", delta: "0,12" });
    // FMI 6.369: Normal 3–6. Gildardo §2: Δ contra el BORDE superior 6 = 0.37 (antes promedio 4.5 = 1.87).
    expect(indicatorRange("FMI", ind, true)).toEqual({ reference: "3–6", delta: "0,37" });
  });

  it("IFC/IRC/FMI (F): usan los cortes femeninos del clasificador", () => {
    // F: cIFC hi 3.28, cIRC lo 2.27, cFMI Normal 5–9. FMI Δ contra el BORDE superior 9 = -2.63 (Gildardo §2).
    expect(indicatorRange("IFC", ind, false)).toEqual({ reference: "> 3,28", delta: "2,09" });
    expect(indicatorRange("IRC", ind, false)).toEqual({ reference: "< 2,30", delta: "-0,48" });
    expect(indicatorRange("FMI", ind, false)).toEqual({ reference: "5–9", delta: "-2,63" });
  });

  it("ICA-BIS: referencia de coherencia 0 (NO φ), Δ = el valor mismo", () => {
    expect(indicatorRange("ICA-BIS", ind, true)).toEqual({ reference: "0 (coherencia)", delta: "0,3745" });
  });

  it("EB: referencia '—' (edad no sellada) → Δ TAMBIEN oculta (no se muestra una diferencia sin referencia)", () => {
    expect(indicatorRange("EB", ind, true)).toEqual({ reference: "—", delta: null });
  });
});

// Guard del bug de ICA-BIS (hallazgo de smoke 2026-08-01): la Δ debe resolverse por INDICADOR, no por
// su referencia. ICA-BIS y PABU se veian con la misma Δ porque icaBis = pabu − φ por definicion; el
// sintoma real era que ICA-BIS mostraba la referencia de PABU ("φ = 1.618"). Estos casos lo atrapan.
describe("la Δ se resuelve por indicador, no por referencia (guard de ICA-BIS)", () => {
  it("ICA-BIS y PABU NO comparten la referencia, y la de ICA-BIS no es φ", () => {
    const pabu = indicatorRange("PABU", ind, true);
    const ica = indicatorRange("ICA-BIS", ind, true);
    expect(ica?.reference).not.toBe(pabu?.reference);
    expect(ica?.reference).not.toContain("1.618");
  });

  it("cambiar el valor de un indicador cambia SOLO su Δ, no la de otro con referencia parecida", () => {
    const a = { ...ind, icaBis: 0.1 } as unknown as EngineIndicators;
    const b = { ...ind, icaBis: 0.5 } as unknown as EngineIndicators;
    // La Δ de ICA-BIS sigue a su propio valor...
    expect(indicatorRange("ICA-BIS", a, true)?.delta).not.toBe(indicatorRange("ICA-BIS", b, true)?.delta);
    // ...y la de PABU no cambia (no se contamina por compartir la columna de referencia).
    expect(indicatorRange("PABU", a, true)?.delta).toBe(indicatorRange("PABU", b, true)?.delta);
  });
});

// REGRESION del Δ sobre el donante golden. Gildardo §2 (2026-08-17) revirtio CA-2 opcion B (punto medio) a
// Δ CONTRA EL BORDE que decide. Se deja el ANTES (punto medio) en el nombre del caso y se assertan los
// valores NUEVOS (borde). Cambian AF y FFMI (vuelven a medir contra el borde, como el HTML); ISCM ya era
// corte unico; IAE se queda en punto medio (excepcion pendiente, a la ronda).
describe("regresion Δ sobre el donante golden (antes punto medio → despues borde, Gildardo §2)", () => {
  it("AF: -1.0 (promedio 6.75) → -0.7 (borde inferior 6.5, 1 decimal)", () => {
    expect(indicatorRange("AF", ind, true)?.delta).toBe("-0,7");
  });

  it("ISCM: -2.07 (valor crudo, ref implicita 0) → -1.07 (corte -1)", () => {
    expect(indicatorRange("ISCM", ind, true)).toEqual({ reference: "≤−1", delta: "-1,07" });
  });

  it("FFMI: 0.10 (promedio 21) → 4.10 (borde inferior 17)", () => {
    expect(indicatorRange("FFMI", ind, true)).toEqual({ reference: "17–25", delta: "4,10" });
  });

  it("sin cambio: IR 0.018, ICA-BIS 0.3745, PABU 0.3745, IEHH 0.500", () => {
    expect(indicatorRange("IR", ind, true)?.delta).toBe("0,018");
    expect(indicatorRange("ICA-BIS", ind, true)?.delta).toBe("0,3745");
    expect(indicatorRange("PABU", ind, true)?.delta).toBe("0,3745");
    expect(indicatorRange("IEHH", ind, true)?.delta).toBe("0,500");
  });

  it("IAE (dos colas): Δ = distancia al límite cruzado, 0 dentro del rango (Gildardo §5, 2026-09-01)", () => {
    // ESTE CANDADO CAMBIÓ DE ASERCIÓN, y hay que saber por qué. Hasta el 2026-09-01 exigía `delta: null`:
    // el Δ del IAE se dejaba en "—" por su §2 del 18 de agosto ("el dato que manda es el valor, no el Δ"),
    // interpretado en una decisión de Santiago del 19.
    //
    // ÉL CAMBIÓ DE CRITERIO en la entrega del 1 de septiembre (§5): ahora el IAE sí lleva Δ, y lo define
    // él mismo: "la distancia al límite del rango que se cruzó, y cero mientras esté dentro de −5 a +5".
    // No se relajó el candado porque estorbara: se movió porque el autor movió la decisión, y la nueva es
    // posterior y explícita donde la anterior era inferida. Va declarado, no aplicado en silencio.
    //
    // El donante golden tiene IAE −17,6: cruzó por abajo, así que la distancia al límite es −17,6 + 5.
    expect(indicatorRange("IAE", ind, true)).toEqual({ reference: "−5 a +5 años", delta: "-12,6" });
  });

  it("y dentro del rango el Δ es cero, no la distancia a un borde", () => {
    // La otra mitad de su regla, que es la que distingue su criterio del de los demás indicadores: mientras
    // el IAE está dentro de −5 a +5 no hay límite cruzado, así que el Δ es 0. Sin este caso, el candado de
    // arriba pasaría verde también con una fórmula que midiera siempre contra el borde más cercano.
    for (const iae of [-5, -2.4, 0, 3.1, 5]) {
      expect(indicatorRange("IAE", { ...ind, iae }, true)?.delta).toBe("0,0");
    }
    // Y por el otro lado cruza igual: +8,2 está 3,2 años por encima del límite superior.
    expect(indicatorRange("IAE", { ...ind, iae: 8.2 }, true)?.delta).toBe("3,2");
  });
});

// CANDADO (Q20/C11, 2026-08-02): la referencia que muestra indicator-ranges debe salir del
// CLASIFICADOR del motor, no de una tabla aparte. Prueba que cada umbral/borde que mostramos cae
// EXACTAMENTE donde el clasificador cambia de banda. Si Gildardo mueve un corte en engine.core.js,
// este test truena y obliga a actualizar la referencia: evita que las dos fuentes (tabla mostrada
// vs clasificador) diverjan en silencio, que es como los tres (IFC/IRC/FMI) habian divergido.
describe("CANDADO · la referencia sale del clasificador del motor (no de una tabla aparte)", () => {
  const E = 0.01;
  // El clasificador cambia de banda EXACTAMENTE en b: la etiqueta justo por debajo != justo por encima.
  const b2 = (fn: (v: number, s: Sexo) => { l: string }, s: Sexo, b: number) =>
    expect(fn(b - E, s).l, `frontera ${b} (${s})`).not.toBe(fn(b + E, s).l);
  const b1 = (fn: (v: number) => { l: string }, b: number) =>
    expect(fn(b - E).l, `frontera ${b}`).not.toBe(fn(b + E).l);

  it("IFC: umbral sano/alerta 6.68 (M) / 3.28 (F)", () => {
    b2(cIFC, "M", 6.68);
    b2(cIFC, "F", 3.28);
  });
  // ACTUALIZADO al porte del ATLAS_v8 del 2026-08-29 (punto 6 de su respuesta): los cortes pasan a los del
  // articulo. Este candado se puso ROJO al portar, que es exactamente para lo que existe: un cambio de
  // ciencia no puede entrar en silencio.
  it("IRC: umbral sano/alerta 1.7 (M) / 2.3 (F)", () => {
    b2(cIRC, "M", 1.7);
    b2(cIRC, "F", 2.3);
  });
  it("FMI: banda Normal 3–6 (M) / 5–9 (F)", () => {
    b2(cFMI, "M", 3);
    b2(cFMI, "M", 6);
    b2(cFMI, "F", 5);
    b2(cFMI, "F", 9);
  });
  it("FFMI: banda Normal 17–25 (M) / 15–23 (F)", () => {
    b2(cFFMI, "M", 17);
    b2(cFFMI, "M", 25);
    b2(cFFMI, "F", 15);
    b2(cFFMI, "F", 23);
  });
  it("AF: banda Normal 6.5–7.0 (M) / 6.0–6.5 (F)", () => {
    b2(cAF, "M", 6.5);
    b2(cAF, "M", 7.0);
    b2(cAF, "F", 6.0);
    b2(cAF, "F", 6.5);
  });
  it("IR: corte 0.78 (M) / 0.82 (F)", () => {
    b2(cIR, "M", 0.78);
    b2(cIR, "F", 0.82);
  });
  it("ISCM: corte -1", () => b1(cISCM, -1));
  it("IEHH: corte 0", () => b1(cIEHH, 0));
  it("IAE: cortes -5 y +5", () => {
    b1(cIAE, -5);
    b1(cIAE, 5);
  });
  it("PABU: el punto φ = 1.618 cae en la zona de homeostasis del clasificador direccional", () => {
    // cPABU direccional (swap del 18): un solo argumento; |1.618-φ|=0 ≤ 0.15 → zona φ
    expect(cPABU(1.618).l).toContain("Homeostasis");
  });
});

// Candado de indicatorBands (cortes inline del hibrido DFI): los numeros que muestran las tarjetas se
// re-encodean aca, asi que se ANCLAN contra las fronteras del clasificador frozen. Si Gildardo mueve un
// corte, el frozen cambia y este test truena, forzando actualizar la cadena de bandas junto con el motor.
describe("indicatorBands: cortes anclados contra el clasificador frozen (no drift silencioso)", () => {
  const M: Sexo = "M";
  it("IFC (M): transiciones en 4.12 (disfuncion/alerta) y 6.68 (alerta/optima)", () => {
    expect(cIFC(4.11, M).risk).toBe("alto");
    expect(cIFC(4.12, M).risk).toBe("moderado");
    expect(cIFC(6.68, M).risk).toBe("moderado");
    expect(cIFC(6.69, M).risk).toBe("bajo");
    expect(indicatorBands("IFC", true)).toContain(fmtDec(4.12));
    expect(indicatorBands("IFC", true)).toContain(fmtDec(6.68));
  });
  it("IRC (M): transiciones en 1.7 y 2.1", () => {
    expect(cIRC(1.67, M).risk).toBe("bajo");
    expect(cIRC(1.7, M).risk).toBe("moderado");
    expect(cIRC(2.1, M).risk).toBe("moderado");
    expect(cIRC(2.11, M).risk).toBe("alto");
    expect(indicatorBands("IRC", true)).toContain(fmtDec(1.7));
    expect(indicatorBands("IRC", true)).toContain(fmtDec(2.1));
  });
  it("IEHH: transiciones en 0/1/2 (Optimo/Leve/Moderado/Severo)", () => {
    expect(cIEHH(0).l).toBe("Óptimo");
    expect(cIEHH(1).l).toBe("Leve");
    expect(cIEHH(2).l).toBe("Moderado");
    expect(cIEHH(2.1).l).toBe("Severo");
    expect(indicatorBands("IEHH", true)).toContain("≤0");
  });
  it("ISCM: transiciones en -1/1/2.5 (ISCM-1..4)", () => {
    expect(cISCM(-1).l).toContain("ISCM-1");
    expect(cISCM(1).l).toContain("ISCM-2");
    expect(cISCM(2.5).l).toContain("ISCM-3");
    expect(cISCM(2.6).l).toContain("ISCM-4");
    expect(indicatorBands("ISCM", true)).toContain("≤−1");
    expect(indicatorBands("ISCM", true)).toContain(fmtDec(2.5, 1));
  });
  it("IAE: transiciones en -5/5 (desacelerado/concordante/acelerado)", () => {
    expect(cIAE(-6).l).toBe("Desacelerado");
    expect(cIAE(-5).l).toBe("Concordante");
    expect(cIAE(5).l).toBe("Concordante");
    expect(cIAE(6).l).toBe("Acelerado");
    expect(indicatorBands("IAE", true)).toContain("−5");
  });
  it("FMI/FFMI (M): banda Normal 3-6 / 17-25", () => {
    expect(cFMI(3, M).l).toBe("Normal");
    expect(cFMI(6, M).l).toBe("Normal");
    expect(cFFMI(17, M).l).toBe("Normal");
    expect(cFFMI(25, M).l).toBe("Normal");
    expect(indicatorBands("FMI", true)).toContain("3–6");
    expect(indicatorBands("FFMI", true)).toContain("17–25");
  });
  it("los indicadores sin bandas de display devuelven null (PABU/EB)", () => {
    expect(indicatorBands("PABU", true)).toBeNull();
    expect(indicatorBands("EB", true)).toBeNull();
  });
});

// GOLDEN DEL IRC contra el ATLAS_v8 del 2026-08-29 (respuesta a la ronda del 28, punto 6).
//
// LO QUE ANCLA, y por que no basta con los dos cortes: el cambio con consecuencia clinica NO son los
// decimales (1,68 -> 1,7), es el caso SIN SEXO. Antes caia a un corte propio de 2,0/3,4 que, segun su
// respuesta, "no sale de ninguna parte"; ahora cae al MASCULINO, que es el mas exigente, "porque usar el
// femenino subestimaria el riesgo de un hombre". Un paciente sin sexo registrado con IRC 2,5 pasaba de
// moderado a ALTO. Eso es lo que se blinda.
describe("IRC · golden contra el archivo de Gildardo (2026-08-29)", () => {
  const M = "Masculino";
  const F = "Femenino";

  it("hombre: <1,7 bajo · 1,7–2,1 moderado · >2,1 alto", () => {
    expect(cIRC(1.69, M).risk).toBe("bajo");
    expect(cIRC(1.7, M).risk).toBe("moderado");
    expect(cIRC(2.1, M).risk).toBe("moderado");
    expect(cIRC(2.11, M).risk).toBe("alto");
  });

  it("mujer: <2,3 bajo · 2,3–2,8 moderado · >2,8 alto", () => {
    expect(cIRC(2.29, F).risk).toBe("bajo");
    expect(cIRC(2.3, F).risk).toBe("moderado");
    expect(cIRC(2.8, F).risk).toBe("moderado");
    expect(cIRC(2.81, F).risk).toBe("alto");
  });

  // LA RAMA SIN SEXO NO ES ALCANZABLE EN ATLAS, y conviene que quede escrito porque es lo que decide
  // cuanto de esta correccion nos afecta.
  //
  // Su cambio mas significativo es este: el respaldo sin sexo pasa de un 2,0/3,4 que "no sale de ninguna
  // parte" al corte masculino. Pero en Atlas `normalizeSexo` LANZA si el sexo falta o no se reconoce
  // ("ningun indice puede calcularse sin el"), asi que esa rama nunca se ejecuta por el pipeline: nuestro
  // guard ya era mas estricto que su archivo. Lo que SI nos cambia son los decimales.
  //
  // El candado se queda igualmente, sobre el frozen directamente: protege el comportamiento del motor por
  // si ese guard se relajara alguna vez, que es justo cuando la rama pasaria a importar.
  const SIN_SEXO = "" as unknown as Parameters<typeof cIRC>[1];

  it("SIN SEXO (rama inalcanzable hoy) usa el corte masculino, el mas exigente", () => {
    // Con el corte viejo (2,0/3,4) un 2,5 era moderado; con el masculino es ALTO.
    expect(cIRC(2.5, SIN_SEXO).risk).toBe("alto");
    // Y coincide con el masculino en las tres bandas, que es la forma de decir "es el mismo corte".
    for (const v of [1.5, 1.69, 1.7, 2.0, 2.1, 2.11, 3.0]) {
      expect(cIRC(v, SIN_SEXO).risk).toBe(cIRC(v, M).risk);
    }
  });

  it("los cortes RETIRADOS ya no clasifican a nadie", () => {
    expect(cIRC(2.0, SIN_SEXO).risk).not.toBe("bajo"); // con el corte viejo, 2,0 era el limite bajo
    expect(cIRC(3.0, SIN_SEXO).risk).toBe("alto"); // con 3,4 de hi, 3,0 era moderado
    // 2,28 es el caso que SEPARA los dos cortes femeninos: con el viejo lo=2,27 era moderado; con el
    // nuevo lo=2,3 es bajo. Si el corte viejo volviera, esta linea cae.
    expect(cIRC(2.28, F).risk).toBe("bajo");
  });

  it("el valor NO se multiplica por diez al mostrarlo: el x10 ya esta en la formula", () => {
    // De ahi salia el 16,222 que le reportamos. `indicatorBands` habla en la escala del clasificador.
    expect(indicatorBands("IRC", true)).toContain(fmtDec(1.7));
    expect(indicatorBands("IRC", true)).not.toContain("17,0");
  });
});
