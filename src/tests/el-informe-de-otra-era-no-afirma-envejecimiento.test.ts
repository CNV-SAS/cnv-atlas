import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DOMINIO_ENVEJECIMIENTO,
  esDeOtraCiencia,
  SIN_ESTIMACION,
  sinEnvejecimientoDeOtraCiencia,
} from "@/modules/reports/envejecimiento-sin-estimacion";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN INFORME DE OTRA ERA DEL MOTOR NO AFIRMA NADA SOBRE ENVEJECIMIENTO  ·  Santiago, 2026-11-08
//
// *"Los informes de las consultas reales que quedaron en 1.x (repetidas, sin fecha, menores) muestran el
// dominio Envejecimiento calculado con la v5, aunque no muestren la EB-BIS."*
//
// ═══ POR QUE NO BASTABA CON SUPRIMIR LA CIFRA ═══
//
// La cifra ya estaba fuera: el cuadro de la edad biologica solo sale con `ebBis.estado === "ok"`, y un
// sello de la era 1.x no lo trae. Lo que quedaba vivo era el DOMINIO 3, cuya severidad sale del IAE de
// la v5: de ahi salen su etiqueta ("Prioritario"), su color, su punta en la figura y su frase. El
// documento no decia la cifra retirada pero SI su veredicto.
//
// Es la misma leccion que "suprimir una cifra no basta si lo derivado sigue visible", que este proyecto
// ya tiene escrita.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const DOMINIOS = [
  { id: "d1", dominio: "Celular-Eléctrico", nivel: "A vigilar", sev: 1, lectura: "Lectura d1." },
  { id: "d3", dominio: "Envejecimiento", nivel: "Prioritario", sev: 3, lectura: "Tu cuerpo envejece rápido." },
  { id: "d5", dominio: "Epigenético-Contextual", nivel: "Óptimo", sev: 0, lectura: "Lectura d5." },
];

describe("cuando el sello es de otra era del motor", () => {
  const r = sinEnvejecimientoDeOtraCiencia(DOMINIOS, "1.0.0", "3.2.0");

  it("el dominio de envejecimiento se queda SIN severidad y SIN etiqueta", () => {
    // No basta cambiar la frase: con la severidad puesta, el dominio sigue pintandose de rojo y con su
    // punta en la figura, asi que el documento diria "no se estimó" en un bloque rojo. Es la
    // contradiccion de siempre.
    const d3 = r.find((d) => d.id === DOMINIO_ENVEJECIMIENTO);
    expect(d3?.sev, "la severidad de la v5 sigue pintando el dominio").toBeNull();
    expect(d3?.nivel, "la etiqueta del veredicto sigue a la vista").toBeNull();
  });

  it("y su lectura dice lo que pasa, en vez de afirmar sobre el paciente", () => {
    expect(r.find((d) => d.id === DOMINIO_ENVEJECIMIENTO)?.lectura).toBe(SIN_ESTIMACION);
    expect(SIN_ESTIMACION).toContain("versión anterior del modelo");
  });

  it("LOS OTROS CUATRO NO SE TOCAN: no dependen de la EB-BIS y son validos", () => {
    // Esconder el bloque entero habria sido la otra forma de "arreglarlo", y habria quitado cuatro areas
    // buenas para tapar una.
    expect(r.filter((d) => d.id !== "d3")).toEqual(DOMINIOS.filter((d) => d.id !== "d3"));
  });
});

describe("y cuando el sello es del motor de hoy, no cambia NADA", () => {
  it("devuelve la misma lista, sin copiarla", () => {
    // El caso normal no paga ni una copia, y el diff de un informe de hoy es exactamente cero.
    const mismos = sinEnvejecimientoDeOtraCiencia(DOMINIOS, "3.2.0", "3.2.1");
    expect(mismos).toBe(DOMINIOS);
  });
});

describe("el corte es la version MAYOR, que es el criterio de la casa", () => {
  it("dos menores del mismo mayor son la misma ciencia", () => {
    expect(esDeOtraCiencia("3.0.0", "3.2.0")).toBe(false);
    // Y las dos grafias del mayor 1 que conviven en produccion.
    expect(esDeOtraCiencia("anibise-1.4.0", "1.0.0")).toBe(false);
  });

  it("y dos mayores distintos no lo son", () => {
    expect(esDeOtraCiencia("1.0.0", "3.2.0")).toBe(true);
  });

  it("SIN VERSION SE TRATA COMO OTRA CIENCIA, no como la de hoy", () => {
    // Si no se puede saber con que ciencia se calculo, su veredicto no se puede sostener. El error
    // facil es el contrario: tratar el null como "seguro que es el de hoy".
    expect(esDeOtraCiencia(null, "3.2.0")).toBe(true);
    expect(esDeOtraCiencia(undefined, "3.2.0")).toBe(true);
    expect(esDeOtraCiencia("sin version", "3.2.0")).toBe(true);
  });
});

describe("y el informe lo aplica", () => {
  it("el documento filtra los dominios ANTES de pintarlos", () => {
    const DOC = sinComentarios(readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8"));
    expect(DOC).toContain("sinEnvejecimientoDeOtraCiencia(");
    // Y COMPARA CONTRA EL MOTOR DE HOY, no contra una cadena escrita a mano: el dia que el motor suba de
    // mayor, esto se mueve con el.
    expect(DOC).toContain("ENGINE_VERSION,");
  });

  it("y la figura usa la MISMA lista, no la cruda", () => {
    // Si el radar se dibujara con `dfiPacCrudo`, la punta del dominio 3 seguiria pintada con la
    // severidad de la v5 mientras su texto dice que no se estimo.
    const DOC = sinComentarios(readFileSync("src/modules/reports/pdf/report-document.tsx", "utf8"));
    expect(DOC).toContain("<RadarDelPaciente dominios={dfiPac.dominios}");
    expect(DOC, "quedo algun uso de la lista cruda fuera del filtro").not.toMatch(
      /dfiPacCrudo\.dominios(?!,\s*\n\s*snapshot)/,
    );
  });
});
