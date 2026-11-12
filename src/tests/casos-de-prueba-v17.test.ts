import { describe, expect, it } from "vitest";

import * as core from "@/clinical-engine/frozen/engine.core.derived.js";
import { computeDFIFromData } from "@/clinical-engine/frozen/engine.dfi.authorized.js";
import { efrRiskRank } from "@/clinical-engine/types";
import { icaBisDeLaPabu } from "@/clinical-engine/ica-bis";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// SUS CASOS DE PRUEBA DE LA v17 §13, COMO GOLDENS  ·  2026-11-11
//
// ═══ POR QUE ESTOS Y NO NUESTRAS PROPIAS CIFRAS ═══
//
// Su documento trae VEINTIDOS casos (A a V) con el resultado que da SU `ATLAS_v17.html`, y dice lo que
// hay que hacer con ellos: *"ATLAS CNV debe dar los mismos"*. Es la regla 6 de la arquitectura: un golden
// prueba PARIDAD con su archivo, no correccion clinica, y el valor esperado sale de EL.
//
// ═══ ESTE ARCHIVO CRECE CON EL PORTE, Y LO DICE ═══
//
// Los veintidos casos no se pueden escribir hoy: diez (M a R) necesitan el IEHH y el ISCM-BIS con z por
// sexo, cuatro (S a V) necesitan las alertas criticas, y A a D necesitan el MCCB y el dominio 2. Lo que
// NO se hace es escribirlos ahora con nuestras cifras: un golden que afirma un valor que nadie verifico
// contra su archivo es peor que no tenerlo, porque parece una garantia.
//
// Los que faltan quedan NOMBRADOS abajo, con el paso del porte que los enciende.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("v17 §13 · los casos que el paso 2 ya cubre (IFC, PABU e ICA-BIS por sexo)", () => {
  // CASO E · "H; PABU 1,05 → ICA-BIS −0,568: desplazamiento marcado por exceso"
  it("E · hombre con PABU 1,05: ICA-BIS −0,568 y desplazamiento MARCADO por exceso", () => {
    const ica = icaBisDeLaPabu(1.05) as number;
    expect(ica).toBeCloseTo(-0.568, 3);
    // Su Tabla 7.3, hombres: P10 = −0,50. −0,568 esta por debajo, o sea la cola extrema.
    const clase = core.cPABU(1.05, "M");
    expect(clase.l).toBe("Desplazamiento marcado por exceso");
    expect(clase.dir).toBe("exceso");
    expect(clase.g).toBe(2);
  });

  // CASO F · "H; IFC 3,8 → IFC bajo: disfunción celular"
  it("F · hombre con IFC 3,8: disfuncion celular (con el corte viejo era alerta funcional)", () => {
    expect(core.cIFC(3.8, "M").l).toBe("Disfunción celular");
    // La frase de su §3: con el corte global de 3,5 este hombre quedaba en "alerta funcional" y NO
    // recibia la alerta de ejercicio. El corte nuevo (4,1) lo mete en disfuncion.
    expect(core.cIFC(3.8, "M").risk).toBe("alto");
  });

  // CASO G · "PABU 2,0 en mujer y en hombre → Mujer: rango habitual. Hombre: alejamiento leve por déficit"
  it("G · PABU 2,0: rango habitual en mujer, alejamiento leve por deficit en hombre", () => {
    // Es el caso que demuestra para que sirve leer por sexo: el MISMO numero, dos lecturas.
    expect(core.cPABU(2.0, "F").l).toBe("Rango habitual");
    expect(core.cPABU(2.0, "M").l).toBe("Alejamiento leve por déficit");
    // ICA-BIS = 0,382. Mujeres: P75 = 0,45 (dentro). Hombres: P75 = 0,36 (por encima).
    expect(icaBisDeLaPabu(2.0)).toBeCloseTo(0.382, 3);
  });

  // CASO K · "Paciente sin sexo registrado → IFC, PABU e ICA-BIS: «Sin sexo: no se clasifica»"
  it("K · sin sexo registrado: no se clasifica, y la PABU no se calcula", () => {
    expect(core.cIFC(5.0, null).l).toBe("Sin sexo: no se clasifica");
    expect(core.cIFC(5.0, null).k).toBe(0);
    expect(core.cPABU(1.9, null).l).toBe("Sin sexo: no se clasifica");
    // Y la PABU devuelve 0, que en su motor significa SIN DATO: la k = 0,9 queda retirada.
    expect(core.calcPABU(600, 1300, 420, 3, null)).toBe(0);
    expect(core.calcPABU(600, 1300, 420, 3, "M")).toBeGreaterThan(0);
  });

  // Y las dos formas del sexo, que es su §3 ("sexoBIS acepta M, Masculino, F y Femenino").
  it("las dos formas del sexo dan la misma lectura", () => {
    expect(core.cIFC(3.8, "Masculino").l).toBe(core.cIFC(3.8, "M").l);
    expect(core.cPABU(2.0, "Femenino").l).toBe(core.cPABU(2.0, "F").l);
    expect(core.calcPABU(600, 1300, 420, 3, "Masculino")).toBe(core.calcPABU(600, 1300, 420, 3, "M"));
  });

  // ── LOS BORDES DE SU TABLA 6.1, QUE ES DONDE EL CAMBIO SE NOTA ──
  it("los cuatro bordes del IFC caen como su tabla dice", () => {
    // Su tabla: bajo < 4,1 · normal 4,1 a 6,7 · alto > 6,7 (hombres); 2,1 y 3,3 en mujeres.
    expect(core.cIFC(4.09, "M").l).toBe("Disfunción celular");
    expect(core.cIFC(4.1, "M").l).toBe("Alerta funcional");
    expect(core.cIFC(6.7, "M").l).toBe("Alerta funcional");
    expect(core.cIFC(6.71, "M").l).toBe("Función óptima");
    expect(core.cIFC(2.09, "F").l).toBe("Disfunción celular");
    expect(core.cIFC(2.1, "F").l).toBe("Alerta funcional");
    expect(core.cIFC(3.3, "F").l).toBe("Alerta funcional");
    expect(core.cIFC(3.31, "F").l).toBe("Función óptima");
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS CASOS QUE ENCIENDEN LOS PASOS 3 Y 4 (los cortes MCCB, el sector y el dominio 2)  ·  2026-11-12
//
// Son sus casos A, B y C de la §13, con sus datos y su resultado esperado:
//
//   A · H; IFC 7,0; IRC 1,5; FFMI 22,0; FMI 3,0; cintura 80 cm; talla 178 cm  ->  A1·S1, #1; dominio 2 = 0
//   B · H; IFC 5,0; IRC 1,9; FFMI 22,5; FMI 7,0; cintura 98 cm; talla 176 cm  ->  A4·S5, #32; dominio 2 =
//       1 + 1 (cintura) = 2; activa R2
//   C · M; IFC 2,0; IRC 3,0; FFMI 15,0; FMI 9,0; cintura 92 cm; talla 158 cm  ->  A9·S9, #81; dominios 1 y
//       2 = 3; riesgo integrado critico
//
// DEL CASO C SE COMPRUEBA EL DOMINIO 2 Y NO EL 1: su dominio 1 llega a 3 con el IEHH recalculado por sexo,
// que es el paso 5. Lo que ya se puede comprobar se comprueba; lo que no, sigue nombrado abajo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("v17 §13 · los casos del sector y del dominio 2 (pasos 3 y 4)", () => {
  // El anillo y el sector se numeran con el MISMO orden de riesgo que pinta la Diana.
  const ORDEN: [number, number][] = [[3, 1], [3, 2], [2, 1], [2, 2], [3, 3], [2, 3], [1, 1], [1, 2], [1, 3]];
  const rango = (a: number, b: number) => ORDEN.findIndex(([x, y]) => x === a && y === b);

  function diana(sexo: "M" | "F", ifc: number, irc: number, ffmi: number, fmi: number) {
    const i = core.cIFC(ifc, sexo).k;
    const r = core.cIRC(irc, sexo).k;
    const f = core.cFFMI_MCCB(ffmi, sexo).k;
    const m = core.cFMI_MCCB(fmi, sexo).k;
    return {
      anillo: `A${rango(i, r) + 1}`,
      sector: core.sectorMCCB(ffmi, fmi, sexo),
      estado: rango(i, r) * 9 + rango(f, m) + 1,
    };
  }

  // La fila minima para su adaptador del DFI. Los indices van puestos porque su funcion corta antes de
  // derivarlos de Cole-Cole; es un quirk suyo, no del caso.
  const fila = (x: Record<string, unknown>) => ({
    Re: 400, Ri: 700, Rinf: 320, C: 1.5, PABU: 1.8, edad: 40, ...x,
  });
  const dom2 = (x: Record<string, unknown>) => {
    const r = computeDFIFromData({}, fila(x)) as {
      domains: { id: string; sev: number | null; clasif: string }[];
      riesgo: { l: string };
      rutas: string[];
    };
    return { d2: r.domains.find((d) => d.id === "d2")!, riesgo: r.riesgo.l, rutas: r.rutas };
  };

  it("A · hombre atletico magro: A1·S1, estado #1 y dominio 2 = 0", () => {
    const d = diana("M", 7.0, 1.5, 22.0, 3.0);
    expect(d.anillo).toBe("A1");
    expect(d.sector?.id).toBe("S1");
    expect(d.sector?.fen).toBe("Atlético magro");
    expect(d.estado).toBe(1);
    // Cintura 80 cm en hombre (< 94) e ICT 80/178 = 0,449 (< 0,50): sin adiposidad central, asi que el
    // dominio 2 se queda en la gravedad del sector, que para S1 es 0.
    const { d2 } = dom2({ sexo: "M", IFC: 7.0, IRC: 1.5, FFMI: 22.0, FMI: 3.0, cintura: 80, tallaCm: 178 });
    expect(d2.sev).toBe(0);
    expect(d2.clasif).toBe("S1 · Atlético magro");
  });

  it("B · hombre con obesidad muscular: A4·S5, estado #32, dominio 2 = 1 + 1 y activa la R2", () => {
    const d = diana("M", 5.0, 1.9, 22.5, 7.0);
    expect(d.anillo).toBe("A4");
    expect(d.sector?.id).toBe("S5");
    expect(d.sector?.g).toBe(1);
    expect(d.estado).toBe(32);
    // Cintura 98 cm (>= 94) e ICT 98/176 = 0,557 (>= 0,50): adiposidad central por las dos vias. 1 + 1 = 2.
    const { d2, rutas } = dom2({ sexo: "M", IFC: 5.0, IRC: 1.9, FFMI: 22.5, FMI: 7.0, cintura: 98, tallaCm: 176 });
    expect(d2.sev).toBe(2);
    expect(d2.clasif).toContain("adiposidad central");
    // SU RESULTADO ESPERADO DICE "activa R2", no "solo R2": la R1 se enciende por el dominio 1 y eso no
    // contradice su caso. Se afirma la R2, que es lo que el caso fija.
    expect(rutas.some((x) => x.startsWith("R2"))).toBe(true);
  });

  it("C · mujer con obesidad sarcopenica: A9·S9, estado #81, dominio 2 = 3 y riesgo critico", () => {
    const d = diana("F", 2.0, 3.0, 15.0, 9.0);
    expect(d.anillo).toBe("A9");
    expect(d.sector?.id).toBe("S9");
    expect(d.sector?.fen).toBe("Obesidad sarcopénica");
    expect(d.estado).toBe(81);
    // S9 ya trae gravedad 3, y la adiposidad central (cintura 92 >= 80 en mujer, ICT 92/158 = 0,582) no
    // puede subirlo mas: su modificador tiene tope 3. Es el caso que prueba el tope.
    const { d2, riesgo } = dom2({ sexo: "F", IFC: 2.0, IRC: 3.0, FFMI: 15.0, FMI: 9.0, cintura: 92, tallaCm: 158 });
    expect(d2.sev).toBe(3);
    expect(riesgo).toBe("CRÍTICO");
  });

  it("y el tope de 3 del modificador se comprueba aparte, sin depender del sector peor", () => {
    // Con S8 (gravedad 2) mas adiposidad central da 3, y no 3 por casualidad: es 2 + 1.
    const { d2 } = dom2({ sexo: "F", IFC: 3.0, IRC: 2.5, FFMI: 15.0, FMI: 6.0, cintura: 92, tallaCm: 158 });
    expect(core.sectorMCCB(15.0, 6.0, "F")?.id).toBe("S8");
    expect(d2.sev).toBe(3);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL ORDEN DE SUS NUEVE SECTORES ES EL ORDEN DE RIESGO DE LA DIANA  ·  el supuesto de `sector-mccb.ts`
//
// `sectorDelIndice` resuelve el sector por el RANGO que ya coloca y colorea la celda, no por sus dos
// bandas. Eso solo vale si `MCCB_SECTORES` esta ordenado igual que `EFR_RISK_ORDER`, y aqui se comprueba
// par por par. Si Gildardo reordenara su Tabla 11.2, este candado truena antes de que un paciente vea el
// rotulo de un sector sobre la celda de otro.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("los nueve sectores del libro caen en el orden de la Diana", () => {
  it("cada sector de su tabla esta en la posicion que `efrRiskRank` le da a sus bandas", () => {
    const sectores = core.MCCB_SECTORES as readonly core.SectorMCCB[];
    expect(sectores).toHaveLength(9);
    sectores.forEach((s, i) => {
      expect(efrRiskRank(s.fn, s.fm), `${s.id} no cae en el indice ${i}`).toBe(i);
      // Y su codigo es el indice mas uno, que es lo que permite derivarlo sin escribir los nueve.
      expect(s.id).toBe(`S${i + 1}`);
    });
  });

  it("y la gravedad de cada sector es la de su decision del 7 de noviembre", () => {
    // S1 a S4 = 0 · S5 y S6 = 1 · S8 = 2 · S7 y S9 = 3. Se escribe aqui porque es lo que puntua el
    // dominio metabolico-estructural: si un dia cambia un numero, cambia la severidad de una cohorte.
    const g = Object.fromEntries((core.MCCB_SECTORES as readonly core.SectorMCCB[]).map((s) => [s.id, s.g]));
    expect(g).toEqual({ S1: 0, S2: 0, S3: 0, S4: 0, S5: 1, S6: 1, S7: 3, S8: 2, S9: 3 });
  });

  it("sin sexo o sin valor no hay sector, que es su manera de decir que no hay dato", () => {
    expect(core.sectorMCCB(20, 5, null)).toBe(null);
    expect(core.sectorMCCB(0, 5, "M")).toBe(null);
    expect(core.sectorMCCB(20, 0, "M")).toBe(null);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LOS QUE FALTAN, con el paso que los enciende. Se escriben cuando ese paso exista, no antes.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("v17 §13 · los casos que todavia no se pueden escribir", () => {
  const PENDIENTES: Record<string, string> = {
    D: "paso 5 (IEHH con z por sexo): el IEHH en deficit suma 1 y el dominio 1 llega a 3",
    H: "paso 6 (dominio 3 sin el escalon de IAE > 3): 0 / 2 / 3 / 0",
    I: "paso 5 (ISCM-BIS con z por sexo): P75 a P90 en mujer, > P90 en hombre",
    J: "paso 5 (cIEHH en tres zonas): deficit / optimo / optimo / capacitancia alta",
    L: "ya cubierto por `el-ica-bis-lleva-signo` (el historico se deriva de la PABU sellada)",
    M: "paso 5: IEHH −0,099 e ISCM-BIS 0,834 con sus siete componentes",
    N: "paso 5: los mismos datos como hombre dan IEHH −0,569 e ISCM-BIS −4,172",
    O: "paso 5: IEHH −0,081 e ISCM-BIS −0,196",
    P: "paso 5: sin sexo o sin un componente, los dos indices quedan en 0 (sin dato)",
    Q: "paso 5 + migracion: al abrir una consulta vieja, los valores se recalculan y los de v16 se conservan",
    R: "paso 5: los percentiles de los 5.255 registros de su informe tecnico",
    S: "paso 7 (alertas criticas por sexo): mujer sin alertas, hombre con IFC critico",
    T: "paso 7: las tres alertas a la vez en una mujer",
    U: "paso 7: IFC critico, IRC muy elevado e ICA-BIS critico por exceso en un hombre",
    V: "paso 7: sin sexo, o con los indicadores en 0, no se emite ninguna",
  };

  it("estan nombrados los diecisiete que faltan, con el paso que los enciende", () => {
    // ESTE CASO NO ES DECORACION: si alguien da el porte por terminado, la lista de abajo dice cuantos
    // casos de los suyos quedaron sin comprobar. Y al cerrar un paso, los que ese paso enciende se
    // escriben de verdad y salen de aqui.
    // El NUMERO sale de la lista, no al contrario: afirmar "17" a mano es la cifra que envejece.
    expect(Object.keys(PENDIENTES).length, "la lista de pendientes quedo vacia o se desbordo").toBeGreaterThan(0);
    expect(Object.keys(PENDIENTES).length).toBeLessThanOrEqual(22);
    for (const [caso, razon] of Object.entries(PENDIENTES)) {
      expect(razon.length, `el caso ${caso} no dice que paso lo enciende`).toBeGreaterThan(20);
    }
  });
});
