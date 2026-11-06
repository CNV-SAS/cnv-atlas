import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { entraAEntregas, LO_PERMITIDO } from "../../scripts/check-entregas.mjs";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EL CONTROL DE docs/entregas/ MUERDE, Y LA LISTA ES DE LO PERMITIDO
//
// ═══ DE DONDE SALE (incidente del 2026-11-05) ═══
//
// Once PDF con nombre, documento y cifras de pacientes reales llegaron al historial publicado, en cinco
// commits, desde el 1 de septiembre, por `git add -A`. El .gitignore frenaba xlsx, csv y docx, pero no
// pdf: **la lista de lo prohibido iba un formato por detras**, y se habia reescrito tres veces, cada vez
// despues del archivo que la estreno.
//
// El control invierte la lista. Este candado afirma las dos cosas que lo hacen util y que un cambio
// bienintencionado podria deshacer:
//
//   1 · que la lista sigue siendo de lo PERMITIDO (si alguien la convierte en lista de prohibidos, el
//       siguiente formato vuelve a pasar solo);
//   2 · que de verdad RECHAZA, ejecutando la decision sobre rutas concretas, no leyendo el archivo. Es
//       la leccion de los candados de la HC: tres miraban el codigo y ninguno renderizaba el documento.
//
// Y el 3 es el que vuelve a nacer solo: que el GANCHO siga llamando al control. Un control que nadie
// ejecuta no frena nada, y el gancho es un archivo que se borra sin que falle ningun test.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

describe("el control de docs/entregas", () => {
  it("permite solo texto revisable, y la lista es de lo PERMITIDO", () => {
    expect([...LO_PERMITIDO].sort()).toEqual([".js", ".json", ".md", ".sql"]);
  });

  it("deja entrar lo que se revisa en el diff", () => {
    expect(entraAEntregas("docs/entregas/CAMBIOS_ATLAS_v15_para_Santiago.md")).toBe(true);
    expect(entraAEntregas("docs/entregas/sql/BAJA_DE_LOS_FANTASMA_2026-10-01.sql")).toBe(true);
    expect(entraAEntregas("docs/entregas/Gildardo responses/EB_BIS_v7_param_7.1.0_Santiago/ebBisV7.js")).toBe(true);
    expect(entraAEntregas("docs/entregas/Gildardo responses/EB_BIS_v7_param_7.1.0_Santiago/casos.json")).toBe(true);
  });

  it("RECHAZA el formato que estreno el incidente, a cualquier profundidad", () => {
    // El `*` de un pathspec de git cruza las barras, y el control tiene que cubrir lo mismo.
    expect(entraAEntregas("docs/entregas/SUGERENCIA_INFORME_ANBISE.pdf")).toBe(false);
    expect(entraAEntregas("docs/entregas/cotejo-visual/reportes/HC enviada al correo.pdf")).toBe(false);
    expect(entraAEntregas("docs/entregas/dudas/una/dos/tres/informe.pdf")).toBe(false);
  });

  it("RECHAZA los formatos que ya habian estrenado la regla antes", () => {
    expect(entraAEntregas("docs/entregas/dudas/Biody BIS - export.xlsx")).toBe(false);
    expect(entraAEntregas("docs/entregas/exports/cohorte.csv")).toBe(false);
    expect(entraAEntregas("docs/entregas/Gildardo responses/Nuevos cambios html/ATLAS_v17.html")).toBe(false);
  });

  it("y RECHAZA el que todavia no ha llegado, que es el punto", () => {
    // Ninguno de estos esta en el .gitignore. Con una lista de prohibidos pasarian los cinco.
    for (const r of [
      "docs/entregas/captura.webp",
      "docs/entregas/foto.heic",
      "docs/entregas/caso.zip",
      "docs/entregas/acta.rtf",
      "docs/entregas/paciente.pages",
    ]) {
      expect(entraAEntregas(r), `${r} entro, y no deberia`).toBe(false);
    }
  });

  it("un archivo SIN extension tampoco entra (un export sin punto es igual de opaco)", () => {
    expect(entraAEntregas("docs/entregas/export-sin-extension")).toBe(false);
  });

  it("no se mete donde no es su asunto: fuera de la carpeta no opina", () => {
    expect(entraAEntregas("src/app/apple-icon.png")).toBe(true);
    expect(entraAEntregas("public/brand/logo-horizontal.png")).toBe(true);
    expect(entraAEntregas("docs/distribucion/exportador-html/ATLAS_v9.html")).toBe(true);
  });

  it("los HEREDADOS siguen entrando, porque sacarlos es otra decision, Y NINGUNO ES UN PDF", () => {
    // Lo que ya estaba versionado no traba un commit (ver el .gitignore: sacar los siete .docx deja a un
    // clon nuevo sin las especificaciones de Gildardo). Pero la excepcion NO puede volverse la puerta:
    // si algun dia aparece un .pdf en HEREDADOS, el incidente del 2026-11-05 vuelve por la lista blanca.
    const fuente = readFileSync("scripts/check-entregas.mjs", "utf8");
    const bloque = fuente.slice(fuente.indexOf("const HEREDADOS"), fuente.indexOf("export function entraAEntregas"));
    expect(bloque).not.toMatch(/\.pdf"/i);
    expect(bloque).not.toMatch(/\.(xlsx|xls)"/i);
    expect(entraAEntregas("docs/entregas/Gildardo responses/cohorte_AEC_ACT_2026-08-18.csv")).toBe(true);
  });

  it("el GANCHO de pre-commit llama al control (si no, el control no frena nada)", () => {
    const gancho = readFileSync(".githooks/pre-commit", "utf8");
    expect(gancho).toContain("scripts/check-entregas.mjs");
  });
});
