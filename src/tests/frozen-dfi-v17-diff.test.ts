import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CAMBIOS_NUEVOS, htmlDeCambioNuevo } from "./fixtures/html-vigente";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// DIFF-dfi/v17: las lineas de `engine.dfi.js` que se portaron del ATLAS_v17.html  ·  2026-11-12
//
// ═══ POR QUE ESTE CANDADO EXISTE ═══
//
// `frozen-deriva-vigente` compara todo `engine.dfi.js` linea a linea contra `HTML_VIGENTE`, que resuelve
// al v9 (la convencion de carpeta nueva no entra ahi a proposito: sus HTML estan en `.gitignore` y un
// candado que dependiera de ellos fallaria en cualquier clon). Con el paso 4 del porte, el DOMINIO 2 de
// Atlas deja de coincidir con esa entrega **a proposito**, asi que esas lineas quedan toleradas alla y
// ancladas aqui, contra el archivo del que salieron. Es el mismo mecanismo de `frozen-core-diff`.
//
// LO QUE SE COMPARA, pieza por pieza y contra SU archivo:
//
//   · el bloque del DOMINIO 2 completo (su v17 §2.3: gravedad por sector + adiposidad central);
//   · las cinco lineas que lo alimentan en `computeDFIFromData` (`_sec`, `_cint`/`_talla`, `_ict`,
//     `_adip`, y el `_fmiK` con los cortes MCCB);
//   · la linea del ICA-BIS (la PABU manda, el guardado es la reserva);
//   · los cortes del IFC que el DFI CITA (su Tabla 6.1), que eran una SEGUNDA FUENTE de los de `cIFC`
//     y se habian quedado en los de la v16.
//
// Y FALLA RUIDOSO SIN EL ARCHIVO, que es lo correcto: su HTML vive solo en la maquina de Santiago.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const ENTREGA = "9 noviembre";
const NUESTRO = "src/clinical-engine/frozen/engine.dfi.js";

const sinEspacio = (t: string) => t.replace(/\s+/g, "");

// Las lineas que la v17 trajo a este modulo. Cada una tiene que estar, TAL CUAL, en su archivo.
const LINEAS_DE_SU_V17 = [
  // El sector y la adiposidad central, en el adaptador.
  "const _sec = sectorMCCB(FFMI, FMI, sexoM);",
  'const _cint = num("cintura", "circCint"), _talla = num("tallaCm", "talla");',
  'const _ict = num("ICT", "ict") || (_cint > 0 && _talla > 0 ? _cint / _talla : 0);',
  "const _adip = { cintura: _cint, ict: _ict, central: (_cint > 0 && _cint >= (esMasc ? 94 : 80)) || _ict >= 0.50 };",
  // El FMI categorizado con los cortes MCCB (con la caida a los viejos sin sexo, que es suya).
  "_fmiK = cFMI_MCCB(FMI, sexoM).k || cFMI(FMI, sexoM).k;",
  // El ICA-BIS: la PABU manda.
  'const icaBis = pabu ? pabu - 1.618 : (num("ICA_BIS", "icaBis") || null);',
  // Los cortes del IFC que el DFI cita (su Tabla 6.1).
  'ifc:  esMasc ? "H: <4,1 bajo · 4,1–6,7 normal · >6,7 alto" : "M: <2,1 bajo · 2,1–3,3 normal · >3,3 alto",',
  // El dominio 2, linea por linea.
  "const sec = idx.sector || null, adip = idx.adip || {};",
  "if(adip.central) s2=_dfiCap3(s2+1);",
  'const fen = sec ? sec.fen : (idx.structL || "");',
  'clasif:`${sec ? sec.id + " · " + fen : "Sector N/C"}${adip.central ? " · adiposidad central" : ""}`,',
  'lectura: s2>=3?"Fenotipo estructural de alto riesgo.":s2===2?"Fenotipo o adiposidad central a corregir.":s2===1?"Carga estructural leve: prevención eficaz.":"Perfil metabólico-estructural favorable.",',
];

// Lo que la v17 RETIRA. Su §14 lo pide explicito: nada de la aplicacion puede conservarlos.
const RETIRADOS = [
  // El ISCM-BIS graduando el dominio 2 (sus niveles ISCM-1 a ISCM-4 salen del dominio).
  { que: "el mapa de niveles del ISCM graduando el dominio 2", patron: /iscmMap/ },
  // Los cortes del IFC de la v16 en la cita del DFI.
  { que: "los cortes 4,12 / 6,68 del IFC (v16)", patron: /4,12|6,68|2,08|3,28/ },
  // El fenotipo con sarcopenia como escalon del dominio 2.
  { que: "el escalon del dominio 2 por fenotipo con sarcopenia", patron: /Sarcop\|Déficit\|Deficit/ },
];

describe(`engine.dfi.js: el dominio 2 sale de su ATLAS del ${ENTREGA}`, () => {
  it("la entrega existe en disco (sin ella, este candado no compara nada)", () => {
    expect(CAMBIOS_NUEVOS, `no esta la entrega ${ENTREGA}`).toContain(ENTREGA);
    expect(existsSync(htmlDeCambioNuevo(ENTREGA))).toBe(true);
  });

  const suyo = () => sinEspacio(readFileSync(htmlDeCambioNuevo(ENTREGA), "utf8").replace(/\r\n/g, "\n"));
  const nuestro = () => readFileSync(NUESTRO, "utf8").replace(/\r\n/g, "\n");

  for (const linea of LINEAS_DE_SU_V17) {
    it(`esta en su v17: ${linea.slice(0, 64)}`, () => {
      // Primero que la tengamos nosotros: si no, el porte no se hizo (o se deshizo).
      expect(sinEspacio(nuestro()).includes(sinEspacio(linea)), `falta en ${NUESTRO}`).toBe(true);
      // Y despues que salga de EL, que es lo que convierte esto en paridad y no en una preferencia.
      expect(suyo().includes(sinEspacio(linea)), `no aparece en su ATLAS_v17 del ${ENTREGA}`).toBe(true);
    });
  }

  for (const r of RETIRADOS) {
    it(`ya no queda en el dominio 2: ${r.que}`, () => {
      // Se mira SOLO el bloque del dominio 2 y el adaptador, no el modulo entero: `iscmCl` sigue
      // existiendo (lo retira el paso 5) y el regex de sarcopenia vive tambien en otros dominios.
      const src = nuestro();
      const i = src.indexOf("// ---- Dominio 2 ·");
      const j = src.indexOf("// ---- Dominio 3 ·", i);
      expect(i, "no se encontro el bloque del dominio 2").toBeGreaterThan(-1);
      expect(j, "no se encontro el final del bloque del dominio 2").toBeGreaterThan(i);
      expect(r.patron.test(src.slice(i, j)), `${r.que}: sigue en el dominio 2`).toBe(false);
    });
  }

  it("y el adaptador ya no cita los cortes del IFC de la v16", () => {
    // Era una SEGUNDA FUENTE de los cortes de `cIFC`: el clasificador decidia con 4,1/6,7 y el texto
    // del dominio 1 le decia al profesional 4,12/6,68. Su §14 lo prohibe por nombre.
    expect(/4,12|6,68|2,08|3,28/.test(nuestro())).toBe(false);
  });
});
