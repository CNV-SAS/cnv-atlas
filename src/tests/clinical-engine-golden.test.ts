// ─────────────────────────────────────────────────────────────────────────────
// GOLDEN TESTS del motor clinico ANI-BIS-E (B11, regla dura 6). Candado de paridad:
// anclan la cadena (import Biody -> normalizacion -> ciencia CONGELADA) a los valores
// del export REAL de Juan Esteban. Portados de las 3 suites de Gildardo; corren en la
// suite normal (src/**). El fixture del Biody esta ANONIMIZADO (sin PII): el motor solo
// usa columnas numericas + Género, asi que el oro es identico.
//
// Tolerancia 1e-3 (definida por Gildardo, aceptada tal cual).
// ─────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "vitest";

import {
  analizarDesdeBiody,
  analizarDFI,
  calcLE8,
  ClinicalInputError,
  normalizeSexo,
  RUTA_COND,
  rutasPorCondicion,
} from "@/clinical-engine/analysis";

import biodyJson from "./fixtures/clinical-engine/biody-juan-esteban-anon.json";
import encJson from "./fixtures/clinical-engine/encuesta-sintetica.json";
import goldenJson from "./fixtures/clinical-engine/dfi-golden.json";

const biody = biodyJson as Record<string, unknown>;
const enc = encJson as Record<string, unknown>;
const golden = goldenJson as {
  le8: number;
  /** La EB-BIS y el IAE del donante, informativos: los asserta el caso de CA-3 (ver abajo). */
  EB: number;
  IAE: number;
  dominios: Array<{ id: string; sev: number }>;
  riesgo: { l: string; score: number };
  veto: boolean;
  rutas: string[];
};
const sexoBiody = biody["Género "];

const near = (a: number | null, b: number, eps = 1e-3) =>
  a != null && Math.abs(a - b) <= eps;

describe("ANI-BIS-E · Golden Juan Esteban (export real, anonimizado)", () => {
  const r = analizarDesdeBiody(biody, sexoBiody);

  it('normaliza el sexo del Biody ("Male") a canonico', () => {
    expect(r.sexo).toBe("M");
  });

  it("indices BIS coinciden con la ciencia congelada", () => {
    expect(near(r.indices.IFC, 5.3651)).toBe(true);
    expect(near(r.indices.IRC, 1.8218)).toBe(true);
    expect(near(r.indices.PABU, 1.9925)).toBe(true);
    expect(near(r.indices.FMI, 6.369)).toBe(true);
    expect(near(r.indices.FFMI, 21.1)).toBe(true);
  });

  it("clasificaciones clinicas correctas", () => {
    expect(r.clases.IFC.l).toBe("Alerta funcional");
    expect(r.clases.IRC.l).toBe("Riesgo moderado");
    // ═══ RE-DERIVADO DE SU v17 §4 (2026-11-11), NO "actualizado" ═══
    //
    // Antes: `cPABU` direccional con zona fija de ±0,15, asi que una PABU de 1,9925 (por encima de φ)
    // daba "Desviación por déficit" sin graduar. Su v17 lee el ICA-BIS contra los percentiles del sexo
    // (Tabla 7.3, n = 5.891). La aritmetica, para que el valor esperado no sea un numero copiado de
    // nuestra propia salida:
    //
    //   ICA-BIS = 1,9925 − 1,618 = 0,3745
    //   hombres: P75 = 0,36 · P90 = 0,83
    //   0,3745 esta por ENCIMA del P75 y por DEBAJO del P90 → "alejamiento LEVE por déficit"
    //
    // Es el escalon que su tabla pide para este donante, y por eso el golden sigue probando paridad con
    // SU archivo y no con lo que nosotros calculamos.
    expect(r.clases.PABU.l).toBe("Alejamiento leve por déficit");
    expect(r.clases.FMI.l).toBe("Alto SS");
    expect(r.clases.FFMI.l).toBe("Normal");
  });

  it("fenotipo EFR y recomendacion bloqueados", () => {
    expect(r.fenotipoEFR.key).toBe("N_N_N_A");
    expect(r.fenotipoEFR.dx).toBe(
      "Composición saludable con grasa alta → riesgo de progresión",
    );
    expect(r.fenotipoEFR.nutraceuticos).toBe(
      "BERBERINA METABO, OMEGA COMPLEX, MULTI-CELL BASE",
    );
  });
});

describe("ANI-BIS-E · fallar en voz alta (proteccion anti-caos)", () => {
  it("rechaza sexo desconocido en vez de adivinar", () => {
    expect(() => normalizeSexo("X")).toThrow(ClinicalInputError);
  });

  it("rechaza un Excel al que le falta una columna del motor", () => {
    const roto = { ...biody };
    delete roto["Infinite resistance "]; // Rinf: sin el, IFC seria basura
    expect(() => analizarDesdeBiody(roto, "Male")).toThrow(ClinicalInputError);
  });
});

describe("ANI-BIS-E fase 2 · indices secundarios (datos reales)", () => {
  const sin = analizarDesdeBiody(biody, sexoBiody);
  // LA EDAD VA ENTERA, Y ESTO CAMBIO EL 2026-10-28. Decia `edad: 54.628`, que es la columna DECIMAL del
  // equipo, o sea exactamente el error 6 que Gildardo pidio corregir: *"La edad tomada de la columna
  // decimal del equipo se redondea hacia arriba (30,95 pasa a 31), mientras ATLAS la trunca (30).
  // Correccion: usar siempre años cumplidos desde la fecha de nacimiento (truncar)"*. El fixture del
  // golden traia el defecto adentro, y la v7 lo rechaza en vez de calcular sobre el.
  const con = analizarDesdeBiody(biody, sexoBiody, { icec: 58.578, edad: 54 });

  it("ISCM-BIS anclado al Excel real (con el FIX de FMI: -2.072, no -1.568)", () => {
    expect(near(sin.indices.ISCM, -2.072)).toBe(true);
    expect(sin.clases.ISCM?.l).toBe("ISCM-1 Bajo riesgo");
  });

  it("IEHH anclado al Excel real", () => {
    expect(near(sin.indices.IEHH, 0.151)).toBe(true);
    expect(sin.clases.IEHH?.l).toBe("Leve");
  });

  it("EB-BIS/IAE = null sin EDAD, y el motivo lo dice", () => {
    // CAMBIO LA RAZON, NO EL RESULTADO (2026-10-28). Antes era null "sin encuesta", porque la v5 necesitaba
    // el ICEC. La v7 no lo necesita, pero SI necesita la edad, que antes solo servia para restar el IAE.
    // Que el null venga con su motivo es lo que su §5 pide mostrar ("EB-BIS pendiente: " mas el motivo);
    // un null sin explicacion manda a buscar en siete campos.
    expect(sin.indices.EB_BIS).toBeNull();
    expect(sin.indices.IAE).toBeNull();
    expect(sin.ebBis.estado).toBe("pendiente");
    expect(sin.ebBis.motivo).toContain("fecha de nacimiento");
  });

  it("EB-BIS/IAE v7 con la edad entera: calcula, y sella las dos versiones", () => {
    // LAS CIFRAS DE ESTE DONANTE NO SE ANCLAN AQUI, a proposito: el ancla no circular de la v7 son los
    // SIETE casos que Gildardo calculo con su implementacion (`eb-bis-v7.golden.test.ts`). Fijar aqui un
    // numero que salio de nuestra propia corrida seria anclar el motor contra si mismo, que es justo lo
    // que ese golden evita. Esto comprueba el CABLEADO: que los insumos llegan y el resultado se sella.
    expect(con.ebBis.estado).toBe("ok");
    expect(con.indices.EB_BIS).not.toBeNull();
    expect(con.indices.IAE).not.toBeNull();
    expect(con.ebBis.versionMotor).toBe("EB-BIS v7");
    expect(con.ebBis.versionParametros).toBe("7.1.0");
    expect(con.clases.IAE?.l).toBeTruthy();
  });

  it("y la edad DECIMAL se rechaza en vez de truncarse en silencio (su error 6)", () => {
    // Truncar aqui taparia el defecto que el pidio corregir EN SU ORIGEN: si llega 54,628 es que alguien
    // tomo la edad de la columna del equipo y no de la fecha de nacimiento, y eso hay que verlo. La
    // diferencia no es cosmetica: el equipo redondea hacia arriba y Atlas trunca, asi que el mismo
    // paciente tenia dos edades segun quien la leyera.
    const conDecimal = analizarDesdeBiody(biody, sexoBiody, { icec: 58.578, edad: 54.628 });
    expect(conDecimal.ebBis.estado).toBe("pendiente");
    expect(conDecimal.ebBis.motivo).toContain("años cumplidos");
    expect(conDecimal.indices.EB_BIS).toBeNull();
  });

  it("el ICEC ya NO mueve la EB-BIS: solo decide la alerta (su §2)", () => {
    // Es el cambio de fondo frente a la v5, donde el ICEC pesaba -7,982 en la formula. Si alguien
    // reintroduce el ICEC al calculo, estas dos cifras dejan de coincidir.
    const sinIcec = analizarDesdeBiody(biody, sexoBiody, { edad: 54 });
    expect(sinIcec.indices.EB_BIS).toBe(con.indices.EB_BIS);
    expect(sinIcec.ebBis.alertaDiscordancia).toBe(false);
  });
});

describe("ANI-BIS-E fase 2 · condiciones de ruta (predicados)", () => {
  it("R2 se activa por composicion/antropometria aunque ISCM sea bajo", () => {
    const d = {
      ifc: 5.3651,
      IRC: 1.8218,
      FMI: 6.369,
      FFMI: 21.1,
      ISCM: -2.072,
      sexo: "M",
      ICC: 0.933,
      ICT: 0.544,
      IR: 0.798,
      iae: 0,
    };
    expect(RUTA_COND.R2(d)).toBe(true);
    expect(rutasPorCondicion(d)).toContain("R2");
  });

  it("R1 exige IFC bajo + IRC alto + IAE acelerado simultaneos", () => {
    expect(RUTA_COND.R1({ ifc: 3.0, IRC: 4.0, iae: 8 })).toBe(true);
    expect(RUTA_COND.R1({ ifc: 3.0, IRC: 4.0, iae: 0 })).toBe(false);
  });

  it("R3 (TCA) es puramente de ENCUESTA", () => {
    expect(RUTA_COND.R3({ d2_21: ["Vómito"] })).toBe(true);
    expect(RUTA_COND.R3({ d2_20: "Muy insatisfecho/a" })).toBe(true);
    expect(RUTA_COND.R3({ d2_21: [] })).toBe(false);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL GOLDEN DEL DFI SE REANCLO EL 2026-11-06, Y ESTO ES LO QUE SE MOVIO Y POR QUE
//
// Un golden no se toca para que pase: se reancla cuando la CIENCIA cambia, con su razon escrita. Esta
// esta registrada en `docs/entregas/CAMBIOS_AUTORIZADOS.md` como **CA-3**, con la instruccion de Gildardo
// verificada en su propio archivo (`ATLAS_v15.html` lineas 11834, 4458 y 13965, y su §1.4).
//
// QUE CAMBIO: `analizarDFI` calculaba por dentro la EB-BIS de la **v5** y con ella resolvia el dominio 3,
// el riesgo integrado y la R4, mientras la pantalla y el informe mostraban la **v7**. En su v15 no hay dos
// edades biologicas en la misma consulta: hay una, y es la v7.
//
// LO QUE SE MOVIO EN ESTE CASO DE REFERENCIA, medido y no estimado:
//
//   EB-BIS   29,9  ->  58      (el paciente tiene 54 anos)
//   IAE     -24,7  ->  +4
//   d3 (envejecimiento)  sev 0 -> 1
//   riesgo integrado     25 -> 30  (el NIVEL sigue siendo MEDIO)
//   los otros cuatro dominios, el veto y las rutas: IGUALES
//
// Y ESA PRIMERA LINEA ES EL ARGUMENTO ENTERO: la v5 decia que el cuerpo de una persona de 54 anos se
// comporta como el de una de 30. La v7 dice 58. El golden viejo bloqueaba una cifra que no era creible.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("ANI-BIS-E fase 2b · DFI (BIS real + encuesta sintetica)", () => {
  const r = analizarDFI(biody, enc);

  it("el DFI lee la EB-BIS de la v7, no la v5 (CA-3)", () => {
    // EL CONTROL POSITIVO DEL REANCLAJE: sin esto, el golden de abajo podria volver a pasar con la v5 si
    // alguien revirtiera el cambio y reajustara los numeros. Esto afirma el HECHO, no el resultado.
    //
    // La v5 para este donante daba EB 29,9 (una persona de 54 anos "comportandose" como una de 30). Si la
    // cifra volviera a estar por debajo de la edad real por veinte anos, es que volvio la v5.
    expect(golden.EB).toBeGreaterThan(50);
    expect(golden.IAE).toBeLessThan(10);
  });

  it("LE8/ICEC reproduce el golden", () => {
    expect(r.le8.total).toBe(golden.le8);
    expect(calcLE8(enc).total).toBe(golden.le8);
  });

  it("y el componente de Alimentacion SI se movio con el v16, aunque el total no (2026-11-06)", () => {
    // ESTO EXISTE PORQUE UN VERDE INVITA A CREER QUE NADA CAMBIO. El re-porte de `calcPatron` del v16
    // (su §4.2) baja la Alimentacion de este donante de 60 a 57 (sus carnes rojas estan en 3-4 dias, que
    // antes daba el bono de +3 y ahora no da nada), pero el ICEC TOTAL se queda en 80: 637/8 = 79,625
    // redondea a 80, y antes 640/8 daba 80 exacto. El redondeo se come la diferencia.
    //
    // O SEA QUE ESTE GOLDEN NO CUBRE ESE CAMBIO, y conviene que este escrito donde se mira: lo cubren
    // `patron.golden.test.ts` (sus siete casos) y `le8-encendido.test.ts` (la derivacion a mano). El
    // tamaño sobre la cohorte se mide, no se infiere de aqui.
    const alim = r.le8.scores.find((s) => s.dom === "Alimentación");
    expect(alim?.v).toBe(57);
  });

  it("severidad de los 5 dominios bloqueada", () => {
    const sev = r.domains.map((d) => ({ id: d.id, sev: d.sev }));
    expect(sev).toEqual(golden.dominios);
  });

  it("riesgo integrado y veto bloqueados", () => {
    expect(r.riesgo.l).toBe(golden.riesgo.l);
    expect(r.riesgo.score).toBe(golden.riesgo.score);
    expect(r.veto).toBe(golden.veto);
  });

  it("rutas AUTORITATIVAS (del DFI, no del predicado suelto) bloqueadas", () => {
    expect(r.rutas).toEqual(golden.rutas);
  });
});
