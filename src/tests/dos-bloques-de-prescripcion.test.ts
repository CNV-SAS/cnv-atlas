import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ NUTRACEUTICOS Y PRODUCTOS DE TERCERO, EN BLOQUES DISTINTOS (Santiago, 2026-09-26) ═══
//
// EL DEFECTO ERA DE MEZCLA: el desplegable de prescribir traia TODO el catalogo junto, asi que LUVIA (producto
// de tercero, con participacion del proveedor y otra relacion de consumo) salia en la misma lista que los
// VITACELLEBIS de CNV. Santiago pidio separarlos y adoptar la ficha que Gildardo tiene en su HTML.
//
// SE VIGILA POR EL CODIGO FUENTE porque lo que importa es una SEPARACION, y lo que la rompe es que alguien
// vuelva a poner `protocol.catalog` entero en el desplegable. Un test de render no distingue "salen los dos en
// dos bloques" de "salen los dos en uno".

const src = readFileSync(
  join(process.cwd(), "src/modules/treatment/components/nutraceuticals-section.tsx"),
  "utf8",
);
// EL CODIGO SIN COMENTARIOS, para lo que se afirma sobre la LOGICA. Mi primera version comprobaba que la
// palabra "LUVIA" no apareciera en el archivo, y fallo contra mi propio comentario, que la nombra para explicar
// el caso. Lo que no debe existir es el producto CABLEADO, no la palabra escrita.
const codigo = sinComentarios(src);

describe("los dos bloques de prescripcion", () => {
  it("las dos listas salen de la PROPIEDAD del producto, no de nombres a mano", () => {
    // Con una lista de nombres, un producto de tercero nuevo apareceria entre los nutraceuticos hasta que
    // alguien se acordara de agregarlo aqui.
    expect(src).toContain('c.ownership !== "tercero"');
    expect(src).toContain('c.ownership === "tercero"');
    expect(codigo).not.toContain("LUVIA"); // el nombre no se cablea en la logica (el comentario si lo nombra)
  });

  it("el desplegable de nutraceuticos YA NO trae el catalogo entero", () => {
    // Es la linea exacta que hacia la mezcla.
    expect(codigo).not.toContain("{protocol.catalog.map((c) => (");
    expect(src).toContain("{nutraceuticosDeCnv.map((c) => (");
  });

  it("prescribir contra el modelo va PLEGADO, con el rotulo que lo dice", () => {
    // Abierto y al mismo nivel que la recomendacion, prescribir contra el modelo se veia igual de normal que
    // seguirlo, y no lo es.
    expect(src).toContain("¿Quieres prescribir un nutracéutico que el modelo no recomendó?");
    // EL ROTULO LO CAMBIO SANTIAGO EL 2026-09-26: "que no es un nutracéutico de CNV" definia el bloque por lo
    // que NO es, y quien prescribe piensa en lo que quiere hacer, no en nuestra taxonomia de catalogo.
    expect(src).toContain("¿Quieres prescribir un producto diferente para el tratamiento del paciente?");
  });

  it("la ficha del producto externo lleva los campos de la de Gildardo", () => {
    // Su `OTROS_PRODUCTOS` del v9 trae descripcion, presentacion, dosis, INVIMA, alergenos y fabricante. Todos
    // estaban ya en nuestra tabla sin que nadie los leyera; no se inventa ninguno.
    for (const campo of ["description", "presentation", "servingSize", "sanitaryRegistration", "brandOwner", "alergenosDeclarados"]) {
      expect(src, `falta ${campo} en la ficha`).toContain(campo);
    }
    expect(src).toContain("INVIMA");
  });

  it("el alergeno se MUESTRA y no se cruza con la encuesta", () => {
    // Textual del comentario de Gildardo, y es la misma decision que ya teniamos (yuxtaponer, no inferir): la
    // ficha declara lo suyo y la valoracion es del profesional. Si alguien comparara aqui, estaria haciendo
    // inferencia clinica, que el Anexo 3 y el consentimiento prohiben.
    expect(src).toContain("NO lo cruza con las alergias de la encuesta");
    // La yuxtaposicion sigue siendo el unico mecanismo que pone las dos declaraciones juntas.
    expect(src).toContain("YuxtaposicionAlergenos");
  });
});
