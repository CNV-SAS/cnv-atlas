import { describe, expect, it } from "vitest";

import type { EngineIndicators } from "@/clinical-engine";
import {
  cAF,
  cFFMI,
  cFFMI_MCCB,
  ISCM_REF,
  cFMI,
  cFMI_MCCB,
  MCCB_CORTES,
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
    // IFC 5.3651: sano = optima (> hi). v17 §3, Tabla 6.1: hi 6,7 (antes 6,68). Δ = 5,3651 − 6,7 = -1,33.
    expect(indicatorRange("IFC", ind, true)).toEqual({ reference: "> 6,70", delta: "-1,33" });
    // IRC 1.8218: sano = bajo riesgo (< lo 1.68). Umbral 1.68, Δ = valor − 1.68 = 0.14.
    expect(indicatorRange("IRC", ind, true)).toEqual({ reference: "< 1,70", delta: "0,12" });
    // FMI 6.369, RE-DERIVADO de su Tabla 10.2 (v17 §2.4): la banda sana pasa de 3-6 (Excel Mapa E_BIS)
    // a 3,7-6,4 (el libro, por sexo). Su regla de la Δ no cambia (contra el BORDE superior, el que
    // decide), cambia el borde: 6,369 − 6,4 = -0,031, o sea que este donante deja de estar por ENCIMA
    // del borde y queda justo por debajo. Es el mismo numero leido contra otro corte.
    expect(indicatorRange("FMI", ind, true)).toEqual({ reference: "3,7–6,4", delta: "-0,03" });
  });

  it("IFC/IRC/FMI (F): usan los cortes femeninos del clasificador", () => {
    // F: cIFC hi 3,3 · cIRC lo 2,3 · FMI con los cortes del libro 5,0-8,1 (antes 5-9 del Excel).
    // v17 §3: hi 3,3 (antes 3,28). Δ = 5,3651 − 3,3 = 2,07.
    expect(indicatorRange("IFC", ind, false)).toEqual({ reference: "> 3,30", delta: "2,07" });
    expect(indicatorRange("IRC", ind, false)).toEqual({ reference: "< 2,30", delta: "-0,48" });
    // 6,369 − 8,1 = -1,731 contra el borde superior femenino del libro (antes -2,63 contra el 9).
    expect(indicatorRange("FMI", ind, false)).toEqual({ reference: "5,0–8,1", delta: "-1,73" });
  });

  it("ICA-BIS: referencia de coherencia 0 (NO φ), Δ = el valor mismo", () => {
    // DOS DECIMALES desde el 2026-09-06. La ASERCION es la misma (la referencia es 0, no φ, y la Δ es el
    // valor mismo); lo que cambio es el FORMATO, por el criterio de Santiago: su archivo no tiene una
    // regla de decimales, tiene la que quedo en cada sitio, y el estandar de Atlas es 2.
    expect(indicatorRange("ICA-BIS", ind, true)).toEqual({ reference: "0 (coherencia)", delta: "0,37" });
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

  it("ISCM: sin Δ y con el rango central de su sexo (v17 §6: no hay corte que medir)", () => {
    // ═══ RE-DERIVADO (2026-11-12) ═══
    //
    // Decia `{ reference: "≤−1", delta: "-1,07" }`: la referencia era la frontera del nivel ISCM-1 y
    // la Δ la distancia a ese −1. Su libro retiro los cuatro niveles, asi que esa frontera ya no
    // decide nada y una Δ contra ella seria una cifra con forma de dato. La referencia pasa a ser el
    // rango central del sexo (P25 a P75 de su tabla del §6) y la Δ a "—", como el IAE.
    expect(indicatorRange("ISCM", ind, true)).toEqual({
      reference: `${fmtDec(ISCM_REF.M.p25).replace("-", "−")} a ${fmtDec(ISCM_REF.M.p75)}`,
      delta: null,
    });
  });

  it("FFMI: 4,10 (borde 17 del Excel) → 2,30 (borde 18,8 del libro)", () => {
    // RE-DERIVADO de su Tabla 10.2 (v17 §2.4). Su regla sigue siendo la Δ contra el BORDE INFERIOR (lo
    // que decide en el FFMI es el deficit), y el borde pasa de 17 a 18,8 en hombres:
    //   21,1 − 18,8 = 2,30   (antes 21,1 − 17 = 4,10)
    expect(indicatorRange("FFMI", ind, true)).toEqual({ reference: "18,8–21,0", delta: "2,30" });
  });

  it("sin cambio de CRITERIO: IR, ICA-BIS, PABU e IEHH siguen midiendo contra lo mismo", () => {
    // Este caso es de CA-2 (Δ contra el borde) y lo que fija es que a estos cuatro no les cambio el
    // criterio. Los DECIMALES son otra cosa y se movieron el 2026-09-06: PABU e ICA-BIS pasaron de 4 a 2
    // por el estandar de Atlas (ver el comentario en indicator-ranges).
    //
    // Y QUEDA A LA VISTA LO QUE FALTA POR DECIDIR: IR sigue en 3 decimales e IEHH en 3. No se tocan
    // aqui porque son anteriores a este cotejo y bajarlos es una decision de display sobre cifras
    // clinicas (el IR se compara contra un corte de 0,78: a dos decimales su Δ pasa de 0,018 a 0,02).
    // Esta preguntado. Si se unifica, este caso se actualiza con la razon.
    expect(indicatorRange("IR", ind, true)?.delta).toBe("0,018");
    expect(indicatorRange("ICA-BIS", ind, true)?.delta).toBe("0,37");
    // El PABU pasa a TRES el 2026-09-06: su corte es φ = 1,618 y una Δ con dos decimales no alcanza a
    // distinguir del corte contra el que se mide. El IEHH baja a DOS: su corte es 0, un entero.
    expect(indicatorRange("PABU", ind, true)?.delta).toBe("0,374");
    // EL IEHH SE QUEDO SIN Δ CON LA v17 §5, y el caso lo dice en vez de seguir afirmando un numero:
    // su clasificador es de DOS COLAS (deficit por abajo, capacitancia alta por arriba), asi que una Δ
    // sola no dice de que lado esta el paciente. Es la regla general de dos colas que quedo registrada
    // con el IAE, aplicada por segunda vez. La referencia que se muestra es su zona optima.
    expect(indicatorRange("IEHH", ind, true)?.delta).toBe(null);
    expect(indicatorRange("IEHH", ind, true)?.reference).toBe("−1 a +1");
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

  it("y dentro del rango el Δ es «—», no un cero que se lee como el IAE (Santiago, 2026-10-30)", () => {
    // ═══ SEGUNDA VUELTA DE ESTA MISMA CELDA, Y HAY QUE SABER QUÉ SE CAMBIÓ CONTRA QUÉ ═══
    //
    // Esta aserción exigía "0,0" dentro de la banda, y el cero era de GILDARDO: su §5 del 2026-09-01 define
    // el Δ del IAE como *"la distancia al límite del rango que se cruzó, y cero mientras esté dentro de −5
    // a +5"*. Antes de eso había sido `null` por decisión de Santiago del 2026-08-19.
    //
    // Santiago lo devuelve a `null`, con un argumento de lectura: *"El Δ del IAE dice '0,0' cuando cae
    // dentro de -5 a +5: se lee como si el IAE fuera cero. Dentro de la banda, '—'."* Y el argumento se
    // sostiene sobre algo propio de ESTA fila y de ninguna otra: el IAE ya es una diferencia, así que la
    // fila pone dos números con signo uno al lado del otro, y el "0,0" de la columna Δ queda junto a un
    // "+3,5" en la columna Valor. En un indicador que no fuera ya una diferencia, el cero no confundiría.
    //
    // ESTO CONTRADICE A GILDARDO Y NO SE APLICA EN SILENCIO: va al documento de dudas, porque el cero es
    // suyo y porque en septiembre ya movió esta decisión una vez. Lo que NO se toca es la otra mitad de su
    // regla, la distancia cuando sí cruzó, que es la que el test de arriba fija.
    for (const iae of [-5, -2.4, 0, 3.1, 5]) {
      expect(indicatorRange("IAE", { ...ind, iae }, true)?.delta).toBeNull();
    }
    // Y por el otro lado cruza igual: +8,2 está 3,2 años por encima del límite superior. ESTE CASO ES EL
    // QUE IMPIDE QUE EL CAMBIO SE PASE DE LARGO: si alguien devolviera `null` siempre, la mitad útil de su
    // definición desaparecería sin que nada fallara.
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

  // RE-ANCLADO a su v17 §3 (Tabla 6.1). Este candado se puso ROJO al portar, que es exactamente para lo
  // que existe: un cambio de ciencia no puede entrar en silencio.
  it("IFC: umbral sano/alerta 6.7 (M) / 3.3 (F)", () => {
    b2(cIFC, "M", 6.7);
    b2(cIFC, "F", 3.3);
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
  // ═══ LOS DOS SE REAPUNTAN CON LA v17 (§5 y §6, 2026-11-12) ═══
  //
  // El ISCM-BIS ya no tiene cortes que vigilar: su libro retiro los cuatro niveles, y su clasificador
  // devuelve la ubicacion entre percentiles. Lo que si se vigila es que los PERCENTILES de la pantalla
  // sean los de su tabla, y eso se hace abajo leyendolos de `ISCM_REF` en vez de copiarlos.
  //
  // El IEHH cambia de corte: el 0 (frontera entre su "Óptimo" y su "Leve") desaparece, y las fronteras
  // pasan a ser −1 y +1, las dos zonas de su Tabla 8.2.
  it("IEHH: fronteras en −1 y +1 (sus tres zonas)", () => {
    b1(cIEHH, -1);
    b1(cIEHH, 1);
    // Y el 0 ya NO es frontera: a los dos lados del cero se lee lo mismo (optimo), que es justo el
    // cambio de significado del indice.
    expect(cIEHH(-0.01).l).toBe(cIEHH(0.01).l);
  });
  it("IAE: cortes -5 y +5", () => {
    b1(cIAE, -5);
    b1(cIAE, 5);
  });
  // ═══ RE-ANCLADO A SU v17 §4 (2026-11-11) ═══
  //
  // Antes: `cPABU(1.618)` con UN argumento y la zona fija de ±0,15, asi que φ caia en "Homeostasis".
  // Su v17 lee el ICA-BIS contra los PERCENTILES del sexo (Tabla 7.3), asi que el clasificador recibe el
  // sexo y la frontera ya no es simetrica: en φ el ICA-BIS es 0, que esta dentro del P25-P75 de los dos
  // sexos (M: -0,27 a 0,36 · F: -0,20 a 0,45), o sea RANGO HABITUAL. La propiedad que este caso fija es
  // la misma (φ es lo normal); lo que cambia es como se llama y de donde sale la frontera.
  it("PABU: el punto φ = 1.618 cae en el rango habitual de los dos sexos", () => {
    expect(cPABU(1.618, "M").l).toContain("Rango habitual");
    expect(cPABU(1.618, "F").l).toContain("Rango habitual");
    // Y sin sexo no se clasifica, como el IFC: es la regla general de su v17 §3.
    expect(cPABU(1.618, null).l).toContain("Sin sexo");
  });
});

// Candado de indicatorBands (cortes inline del hibrido DFI): los numeros que muestran las tarjetas se
// re-encodean aca, asi que se ANCLAN contra las fronteras del clasificador frozen. Si Gildardo mueve un
// corte, el frozen cambia y este test truena, forzando actualizar la cadena de bandas junto con el motor.
describe("indicatorBands: cortes anclados contra el clasificador frozen (no drift silencioso)", () => {
  const M: Sexo = "M";
  // RE-ANCLADO a su v17 §3 (Tabla 6.1): 4,1 y 6,7 en hombres. Las dos cadenas (el clasificador del motor
  // y la de bandas de la tarjeta) se mueven JUNTAS, que es lo que este caso existe para forzar.
  it("IFC (M): transiciones en 4.1 (disfuncion/alerta) y 6.7 (alerta/optima)", () => {
    expect(cIFC(4.09, M).risk).toBe("alto");
    expect(cIFC(4.1, M).risk).toBe("moderado");
    expect(cIFC(6.7, M).risk).toBe("moderado");
    expect(cIFC(6.71, M).risk).toBe("bajo");
    expect(indicatorBands("IFC", true)).toContain(fmtDec(4.1));
    expect(indicatorBands("IFC", true)).toContain(fmtDec(6.7));
  });
  it("IRC (M): transiciones en 1.7 y 2.1", () => {
    expect(cIRC(1.67, M).risk).toBe("bajo");
    expect(cIRC(1.7, M).risk).toBe("moderado");
    expect(cIRC(2.1, M).risk).toBe("moderado");
    expect(cIRC(2.11, M).risk).toBe("alto");
    expect(indicatorBands("IRC", true)).toContain(fmtDec(1.7));
    expect(indicatorBands("IRC", true)).toContain(fmtDec(2.1));
  });
  it("IEHH: sus TRES zonas, y el caso J de su §13", () => {
    // Sus cuatro valores del caso J (−1,5 / −1 / +1 / +1,2) y lo que su documento espera de cada uno:
    // Déficit / óptimo / óptimo / capacitancia alta. Los dos bordes CERRADOS hacia el optimo.
    expect(cIEHH(-1.5).l).toBe("Déficit");
    expect(cIEHH(-1).l).toBe("Óptimo");
    expect(cIEHH(1).l).toBe("Óptimo");
    expect(cIEHH(1.2).l).toBe("Capacitancia alta");
    // Y la zona numerica, que es la que usa el DFI para sumar en las dos direcciones.
    expect(cIEHH(-1.5).zona).toBe(-1);
    expect(cIEHH(0).zona).toBe(0);
    expect(cIEHH(1.2).zona).toBe(1);
    expect(indicatorBands("IEHH", true)).toContain("−1 a +1");
  });
  it("ISCM: sin niveles, con la ubicacion entre percentiles de su sexo (caso I de su §13)", () => {
    // Su caso I: un ISCM-BIS de 4,25 en mujer cae en P75 a P90, y en hombre pasa de P90. Es el mismo
    // numero leido contra dos tablas, que es el punto entero de haberlo puesto por sexo.
    expect(cISCM(4.25, "F").banda).toBe("P75 a P90");
    expect(cISCM(4.25, "M").banda).toBe("> P90");
    // Y no queda ni rastro de los cuatro niveles retirados.
    for (const sexo of ["F", "M"] as const) {
      for (const v of [-5, -1, 0, 1, 2.5, 2.6, 5]) {
        expect(cISCM(v, sexo).l).not.toMatch(/ISCM-[1-4]/);
      }
    }
    // Sin valor o sin sexo lo dice, en vez de ubicarlo en una banda que no le corresponde.
    expect(cISCM(null, "F").banda).toBe(null);
    expect(cISCM(1, null).banda).toBe(null);
    // La banda que se MUESTRA sale de sus percentiles, leidos del frozen y no copiados aqui. El signo
    // menos es el TIPOGRAFICO en toda esta ficha, asi que se compara con el mismo que muestra.
    const comoSeMuestra = (v: number) => fmtDec(v).replace("-", "−");
    expect(indicatorBands("ISCM", true)).toContain(comoSeMuestra(ISCM_REF.M.p25));
    expect(indicatorBands("ISCM", true)).toContain(comoSeMuestra(ISCM_REF.M.p75));
    expect(indicatorBands("ISCM", false)).toContain(comoSeMuestra(ISCM_REF.F.p25));
    // Y ninguna de las dos fichas lleva un guion corto suelto delante de un numero.
    expect(indicatorBands("ISCM", true)).not.toMatch(/-d/);
  });
  it("IAE: transiciones en -5/5, con los bordes CERRADOS hacia el extremo (su v16)", () => {
    // CAMBIO EL 2026-11-07, y no es un ajuste de este test: `cIAE` se re-porto de su v16 (L4568), donde
    // los dos bordes estan cerrados. Antes `-5` y `+5` caian en "Concordante"; ahora caen en el extremo.
    // La razon esta en `el-borde-de-los-cinco-dice-lo-mismo.test.ts`: con el corte abierto, un IAE de
    // +5,0 hacia que el informe dijera "envejecimiento acelerado estimado" y la tabla "Acorde con sus
    // pares", y la ruta que trata el envejecimiento no se activaba.
    expect(cIAE(-6).l).toBe("Desacelerado");
    expect(cIAE(-5).l).toBe("Desacelerado");
    expect(cIAE(-4.9).l).toBe("Concordante");
    expect(cIAE(4.9).l).toBe("Concordante");
    expect(cIAE(5).l).toBe("Acelerado");
    expect(cIAE(6).l).toBe("Acelerado");
    expect(indicatorBands("IAE", true)).toContain("−5");
  });
  it("FMI/FFMI (M): la banda que se MUESTRA es la del clasificador que GOBIERNA (v17: el MCCB)", () => {
    // ═══ RE-ANCLADO (2026-11-12) Y LA PROPIEDAD ES LA MISMA ═══
    //
    // Este candado existe para que la banda mostrada no derive del clasificador. Lo que cambio con la
    // v17 es CUAL clasificador gobierna: el sector de la Diana, el fenotipo y el dominio
    // metabolico-estructural salen de `cFFMI_MCCB`/`cFMI_MCCB` (su Tabla 10.2), asi que la ficha del
    // indicador tiene que mostrar ESOS cortes. `cFMI`/`cFFMI` se quedan con sus banderas clinicas en la
    // columna de diagnostico de la tabla de composicion, y ahi se siguen vigilando (su propio diff).
    //
    // LOS NUMEROS NO SE ESCRIBEN AQUI: salen de `MCCB_CORTES`, el mismo sitio del que los lee la
    // pantalla. Antes estaban a mano en los dos lados, que es como se divergio la primera vez.
    const { fmi, ffmi } = MCCB_CORTES.M;
    expect(cFMI_MCCB(fmi[0], M).l).toBe("Normal");
    expect(cFMI_MCCB(fmi[1], M).l).toBe("Normal");
    expect(cFMI_MCCB(fmi[0] - 0.01, M).l).toBe("Bajo");
    expect(cFMI_MCCB(fmi[1] + 0.01, M).l).toBe("Alto");
    expect(cFFMI_MCCB(ffmi[0], M).l).toBe("Normal");
    expect(cFFMI_MCCB(ffmi[1], M).l).toBe("Normal");
    const uno = (v: number) => v.toFixed(1).replace(".", ",");
    expect(indicatorBands("FMI", true)).toContain(`${uno(fmi[0])}–${uno(fmi[1])}`);
    expect(indicatorBands("FFMI", true)).toContain(`${uno(ffmi[0])}–${uno(ffmi[1])}`);
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
