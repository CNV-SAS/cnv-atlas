import { describe, expect, it } from "vitest";

import * as core from "@/clinical-engine/frozen/engine.core.derived.js";
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
// LOS QUE FALTAN, con el paso que los enciende. Se escriben cuando ese paso exista, no antes.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("v17 §13 · los casos que todavia no se pueden escribir", () => {
  const PENDIENTES: Record<string, string> = {
    A: "paso 3 (cortes MCCB) y 4 (dominio 2): A1·S1, #1 y dominio 2 = 0",
    B: "paso 3 y 4: A4·S5, #32, dominio 2 = 1 + 1 por cintura = 2, activa R2",
    C: "paso 3 y 4: A9·S9, #81, dominios 1 y 2 = 3",
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
