import { describe, expect, it } from "vitest";

// Modulo congelado en JS; `allowJs` lo resuelve.
import { computeDFIFromData } from "@/clinical-engine/frozen/engine.dfi.authorized.js";
import { dfiNarrative } from "@/clinical-engine/dfi-narrative";

// CANDADO DE CA-6: un dominio SIN DATO no puntúa, y nada aguas abajo lo vuelve a puntuar.
//
// SU INSTRUCCIÓN (2026-08-30, punto 4): "Un vértice de susceptibilidad leve dibujado sobre un dominio
// que no se midió es la misma lectura favorable de un vacío que corregimos en el ISCM, y en el radar
// pesa más porque se ve de un golpe. Sin dato, el dominio no puntúa y el radar no dibuja ese vértice."
//
// ÉL NOMBRÓ UNO Y APARECIERON CUATRO SITIOS con esa forma (d1, d2, d3, d5). De los cuatro, dos importan
// de verdad y conviene decir cuál es cuál, porque nuestro primer reporte lo describió mal:
//   · d2 y d3 están VIVOS: un paciente sin ISCM o sin EB-BIS los tenía puntuados hoy.
//   · d1 es una GUARDA: sus índices se derivan de Cole-Cole, así que nunca faltan por el camino real.
//   · d5 se anula con el ICEC ausente.
//
// Y LA CORRECCIÓN DEL RELATO, que vale más que el arreglo: dijimos que d3 sin dato AFIRMABA PATOLOGÍA
// (severidad 2, "envejecimiento acelerado"). Esa rama existe en `computeDFI`, pero NO se alcanza por el
// camino real: el adaptador fabricaba iae = 0 y lo clasificaba "Concordante", así que lo que de verdad
// pasaba era la lectura FAVORABLE ("su ritmo de envejecimiento es acorde con su edad cronológica"). Es la
// misma trampa de siempre: razonar sobre la función suelta en vez de ejecutar el pipeline. El defecto era
// real y la corrección es la misma; la descripción no lo era. Lo cierra CA-7 en el adaptador.
//
// Y SE PRUEBA AGUAS ABAJO, no solo en el motor: la severidad anulada volvía a aparecer como afirmación en
// la PROSA (el párrafo decía "carga contextual baja (entorno favorable)" con el ICEC ausente). Suprimir
// una cifra no basta si lo derivado sigue visible.

/** Índices mínimos para que su función no corte antes de llegar a los dominios. */
const bis = (extra: Record<string, unknown> = {}) => ({
  sexo: "Masculino", edad: 45, Re: 400, Ri: 700, Rinf: 320, C: 1.5,
  FMI: 8, FFMI: 19, IFC: 4.1, IRC: 1.9, PABU: 1.8, IEHH: 0.5, ISCM: 1.0, ...extra,
});

type Dom = { id: string; sev: number | null; lectura: string; clasif: string };
type Res = { domains: Dom[]; riesgo: { score: number }; sinDato: string[] };

const dfi = (b: Record<string, unknown>, enc: Record<string, unknown> = {}) =>
  computeDFIFromData(enc, b) as Res;
const dom = (r: Res, id: string) => r.domains.find((d) => d.id === id)!;

describe("los cuatro dominios que puntuaban sobre un vacío", () => {
  it("d2 Metabólico sin ISCM no puntúa (el que él nombró)", () => {
    const r = dfi(bis({ ISCM: undefined }));
    expect(dom(r, "d2").sev).toBe(null);
    expect(r.sinDato).toContain("d2");
  });

  it("d3 Envejecimiento sin EB-BIS no puntúa · antes daba 0 y lo llamaba ritmo esperado", () => {
    // El que más se ve: el dominio salía en VERDE con la frase "su ritmo de envejecimiento es acorde con
    // su edad cronológica" sobre un paciente al que nadie le calculó la edad biológica.
    const d = dom(dfi(bis()), "d3");
    expect(d.sev, "el dominio 3 volvió a puntuar sin EB-BIS").toBe(null);
    expect(d.sev, "y si volviera, lo haría en verde: severidad 0").not.toBe(0);
    expect(d.lectura).not.toContain("acorde con su edad cronológica");
    expect(d.clasif).not.toMatch(/IAE [+-]?0/); // ni un "IAE +0 años" inventado por el fallback
  });

  it("d5 Epigenético sin ICEC no puntúa", () => {
    expect(dom(dfi(bis()), "d5").sev).toBe(null);
  });

  it("d1 Celular: la guarda existe, pero por el camino real NO se alcanza (y está bien)", () => {
    // HONESTIDAD SOBRE EL ALCANCE. Quitar IFC del insumo NO anula el dominio, y no es un defecto: el
    // adaptador lo DERIVA de Cole-Cole (`num("IFC") || calcIFC(C, Rinf)`), que es su fallback deliberado,
    // y Re/Ri/Rinf/C son columnas OBLIGATORIAS del Biody. O sea que d1 siempre tiene con qué puntuar.
    // La rama de CA-6a queda como guarda de una entrada que hoy no existe; decirlo aquí evita que el
    // verde de este archivo se lea como "los cuatro estaban vivos".
    expect(dom(dfi(bis({ IFC: undefined })), "d1").sev).not.toBe(null);
  });

  it("CONTROL: con sus datos, los cuatro puntúan como siempre", () => {
    // Sin este control, todo lo de arriba pasaría verde también si hubiéramos anulado los dominios
    // SIEMPRE, que es romperlo entero en vez de arreglarlo.
    const r = dfi(bis({ ISCM: 2.0, IAE: 4 }), {});
    expect(dom(r, "d1").sev).not.toBe(null);
    expect(dom(r, "d2").sev).not.toBe(null);
    expect(dom(r, "d4").sev).not.toBe(null);
    expect(r.sinDato).not.toContain("d1");
  });
});

describe("el riesgo integrado se renormaliza, no se abarata", () => {
  it("un dominio sin dato NO baja el riesgo por no haberse medido", () => {
    // En JavaScript null/3 es 0, así que el término desaparecía sumando cero: el paciente salía con
    // MENOS riesgo por no haber medido. Es la misma lectura favorable de un vacío, en la cifra que el
    // profesional lee primero. La renormalización es decisión NUESTRA y está declarada en la ronda.
    // El caso que lo hace evidente: TODOS los dominios medidos en severidad 3 (lo peor) y el ICEC
    // ausente. Renormalizado da 100. Diluyendo el término ausente daría 85, o sea que al paciente más
    // grave del sistema le bajaría el riesgo por una casilla que nadie llenó.
    const r = dfi(bis({ ISCM: 3.0, IAE: 12, IFC: 1.0, IRC: 3.0 }), { d2_21: ["Laxantes"] });
    expect(r.sinDato, "este caso ya no ejercita la renormalización").toContain("d5");
    for (const id of ["d1", "d2", "d3", "d4"]) {
      expect(dom(r, id).sev, `${id} no quedó en 3: el caso ya no prueba lo que dice`).toBe(3);
    }
    expect(r.riesgo.score, "el dominio ausente está diluyendo el riesgo").toBe(100);
  });

  it("`sinDato` viaja con el resultado para que la pantalla pueda decirlo", () => {
    // Sin esto el riesgo saldría calculado sobre menos dominios y nadie lo sabría: cambiar una cifra
    // clínica en silencio es peor que no calcularla.
    const r = dfi(bis());
    expect(Array.isArray(r.sinDato)).toBe(true);
    expect(r.sinDato.length).toBeGreaterThan(0);
  });
});

describe("y la prosa tampoco vuelve a afirmar lo que no se midió", () => {
  const base = {
    dom4Veto: false, veto: false, nivelLabel: "MEDIO",
    ifcL: "Normal", ircL: "Normal", iehhL: "Bajo", iscmL: "Bajo",
    fen: "Normal", aeL: "Concordante", iae: 0,
  };

  it("cada dominio anulado dice que no se evaluó, en vez de dar su lectura favorable", () => {
    const p = dfiNarrative({
      ...base,
      domSev: { d1: null, d2: null, d3: null, d4: 0, d5: null },
    }).parrafo;
    for (const frase of ["no se evaluó el dominio celular-eléctrico", "no se evaluó: falta el ISCM",
      "no se evaluó: falta la edad biológica", "no se evaluó: falta el ICEC"]) {
      expect(p, `falta la frase "${frase}"`).toContain(frase);
    }
    // Y NINGUNA de las lecturas favorables que salían antes sobre esos mismos vacíos.
    for (const falsa of ["entorno favorable", "función celular óptima", "acorde con su edad cronológica"]) {
      expect(p, `la prosa volvió a afirmar "${falsa}" sobre un dominio no medido`).not.toContain(falsa);
    }
  });

  it("CONTROL: con datos, la prosa es la de siempre", () => {
    const p = dfiNarrative({ ...base, domSev: { d1: 0, d2: 0, d3: 0, d4: 0, d5: 0 } }).parrafo;
    expect(p).toContain("entorno favorable");
    expect(p).not.toContain("no se evaluó");
  });

  it("un dominio sin dato no activa su ruta", () => {
    // `null >= 2` es false, que es lo correcto, pero depender de cómo compara JavaScript un null es
    // frágil de leer. Queda fijado: sin dato no hay ruta, igual que en el motor.
    const r = dfiNarrative({ ...base, domSev: { d1: null, d2: null, d3: null, d4: 0, d5: null } });
    expect(r.parrafo).toContain("Ruta 6 (Mantenimiento)");
  });
});
