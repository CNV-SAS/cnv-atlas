import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

import { describe, expect, it } from "vitest";

import { efrRiskRank } from "@/clinical-engine";
import { Diana } from "@/modules/diagnoses/components/diana";

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO de la GEOMETRIA de la Diana (care Santiago 2026-08-18): al pasar el SVG de tamaño fijo en px
// a escalable (fluido), el riesgo real no es que no compile, sino que la celda del paciente caiga en OTRA
// posicion relativa. Como el `viewBox` conserva el sistema de coordenadas, la posicion NO debe moverse.
// Este test lo prueba ejecutando: recomputa la posicion del marcador con las MISMAS constantes de
// geometria y verifica que el marcador renderizado cae ahi. Si alguien cambia SIZE/HOLE/R/BAND o el
// viewBox, o reintroduce width/height fijos, este candado cae.
// ══════════════════════════════════════════════════════════════════════════════════════════════

// Constantes de geometria, ESPEJO de diana.tsx (si divergen, el test deja de proteger; van juntas).
const SIZE = 320;
const C = SIZE / 2;
const R = 138;
const HOLE = 26;
const SECTORS = 9;
const RINGS = 9;
const SECTOR_DEG = 360 / SECTORS;
const BAND = (R - HOLE) / RINGS;
// MARGEN DEL LIENZO (2026-09-05). El viewBox dejo de ser "0 0 320 320" para ganar sitio para los tres
// renglones del rotulo de sector, que a ras del borde salian apretados e ilegibles.
//
// SE AJUSTA EL ALCANCE, NO LA ASERCION, y la diferencia es la que hace que este candado siga sirviendo:
// lo que protege es que la celda del paciente NO se mueva, y eso lo mide el segundo caso comparando
// coordenadas ABSOLUTAS contra la formula. Ensanchar el lienzo por los cuatro lados no toca el sistema
// de coordenadas (el dibujo sigue en 0..320), asi que esas coordenadas no cambian: el segundo caso pasa
// SIN tocarlo, que es la prueba de que el cambio fue de encuadre y no de geometria.
//
// Y EL PAD YA NO SE ESPEJA (2026-09-06). Lo tenia copiado como constante y tuvo que actualizarse a mano
// la primera vez que crecio (16 -> 44, al anclar los rotulos hacia afuera), que es un candado que se
// rompe por un cambio legitimo y no aporta: el margen del lienzo es una decision VISUAL. Lo que si es
// invariante y se afirma abajo es que el encuadre sea SIMETRICO y que el dibujo siga cabiendo entero
// dentro de el. Las de SIZE/R/HOLE si se espejan, porque de esas sale la formula del marcador.

function polar(r: number, angleDeg: number): [number, number] {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
}

// Posicion esperada del marcador del paciente para unas bandas dadas, con la formula de diana.tsx.
function expectedMarker(bands: { ifc: number; irc: number; ffmi: number; fmi: number }): [number, number] {
  const ringIndex = efrRiskRank(bands.ifc, bands.irc);
  const sectorIndex = efrRiskRank(bands.ffmi, bands.fmi);
  const patInner = HOLE + ringIndex * BAND;
  const patOuter = patInner + BAND;
  const patStart = sectorIndex * SECTOR_DEG;
  return polar((patInner + patOuter) / 2, patStart + SECTOR_DEG / 2);
}

function render(bands: { ifc: number; irc: number; ffmi: number; fmi: number }, stateNumber: number): string {
  return renderToStaticMarkup(
    createElement(Diana, {
      bands,
      stateNumber,
      frSectorName: "Reserva",
      structuralName: "Equilibrado",
    }),
  );
}

describe("Diana: la geometria no se movio al pasar el SVG a escalable (care 2026-08-18)", () => {
  it("el SVG conserva el sistema de coordenadas y ya NO fija width/height en px (fluido)", () => {
    const html = render({ ifc: 2, irc: 2, ffmi: 2, fmi: 2 }, 41);
    const vb = html.match(/viewBox="([^"]+)"/);
    expect(vb, "el SVG tiene viewBox").not.toBeNull();
    const [minX, minY, w, h] = vb![1].split(" ").map(Number);
    // El encuadre es SIMETRICO y el DIBUJO sigue cabiendo entero dentro de el: el origen del sistema de
    // coordenadas no se movio, solo hay margen alrededor. Se deriva el margen del propio viewBox en vez
    // de espejarlo: cuanto margen se deja es una decision visual, que quepa el dibujo no.
    const pad = -minX;
    expect(pad, "el lienzo deja margen alrededor del dibujo").toBeGreaterThan(0);
    expect(minY, "el margen es simetrico").toBe(minX);
    expect(w).toBe(SIZE + pad * 2);
    expect(h).toBe(w);
    // Fluido: sin atributos width=/height= en el <svg> (antes 320x320). El marcador SI lleva r="11".
    const svgTag = html.slice(html.indexOf("<svg"), html.indexOf(">", html.indexOf("<svg")) + 1);
    expect(svgTag).not.toMatch(/\swidth="/);
    expect(svgTag).not.toMatch(/\sheight="/);
  });

  it("el marcador del paciente cae en la posicion que dicta la geometria (varias bandas)", () => {
    const casos: { bands: { ifc: number; irc: number; ffmi: number; fmi: number }; num: number }[] = [
      { bands: { ifc: 1, irc: 1, ffmi: 1, fmi: 1 }, num: 1 },
      { bands: { ifc: 2, irc: 3, ffmi: 1, fmi: 2 }, num: 40 },
      { bands: { ifc: 3, irc: 3, ffmi: 3, fmi: 3 }, num: 81 },
    ];
    for (const { bands, num } of casos) {
      const html = render(bands, num);
      // El marcador es el unico <circle ... r="11">.
      const m = html.match(/<circle[^>]*\br="11"[^>]*>/);
      expect(m, `marcador presente para el estado ${num}`).not.toBeNull();
      const cx = Number(m![0].match(/\bcx="([\d.-]+)"/)![1]);
      const cy = Number(m![0].match(/\bcy="([\d.-]+)"/)![1]);
      const [ex, ey] = expectedMarker(bands);
      expect(cx, `cx del estado ${num}`).toBeCloseTo(ex, 3);
      expect(cy, `cy del estado ${num}`).toBeCloseTo(ey, 3);
    }
  });
});
