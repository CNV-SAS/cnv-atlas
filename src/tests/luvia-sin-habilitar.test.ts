import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

// ═══ LUVIA ESTA CARGADO Y NO SE PUEDE VENDER (Bloque 1, 2026-09-11) ═══
//
// Es la verificacion que pidio Santiago, y no es una formalidad: LUVIA declara AVENA, y la avena implica
// gluten salvo certificacion. Hasta que Direccion Cientifica firme las equivalencias, una venta de LUVIA a
// un celiaco seria un daño que CNV prescribio y facturo.
//
// SE COMPRUEBA EN LAS DOS CAPAS, porque la bandera gateaba media puerta hasta hace unas horas: la entrega
// si la miraba (`recordDespacho`) y la venta no (el checkout filtraba solo por "tiene precio"). Un candado
// sobre una sola de las dos habria pasado verde con el hueco abierto.

vi.mock("server-only", () => ({}));

const MIGRACION_LUVIA = "drizzle/0124_luvia_cargado_sin_habilitar.sql";
const SERVICIO = "src/modules/payments/services/payments-service.ts";
const PAGINA = "src/app/(app)/pagos/page.tsx";
const DESPACHO = "src/modules/nutraceuticals/services/inventory-service.ts";

describe("LUVIA entra al catálogo bloqueado", () => {
  const mig = readFileSync(MIGRACION_LUVIA, "utf8");

  it("se crea con `no_disponible`, no con `en_consultorio`", () => {
    expect(mig).toContain("'no_disponible'");
    expect(mig, "LUVIA entró como vendible").not.toContain("'en_consultorio'");
  });

  it("y como producto de TERCERO, con su titular de marca y su proveedor", () => {
    // El titular es campo propio y no se deduce del proveedor: por la doctrina del fabricante aparente,
    // lo que hay que mostrar al paciente es quien pone la marca, no quien entrega.
    expect(mig).toContain("'tercero'");
    expect(mig).toContain("Centro de Nutrición Integral Katherine Ruiz");
  });

  it("declara AVENA, y sin certificación de ausencia", () => {
    // Lo que el producto DICE es avena; lo que eso implica lo dice la relación, no esta fila. Y mientras
    // `absence_certified_for` sea nulo, la relación por contaminación cruzada implica gluten, que es el
    // tratamiento seguro.
    expect(mig).toContain("'avena'");
    expect(mig).not.toMatch(/absence_certified_for['"]?\s*\)?\s*(VALUES|SELECT)[^;]*avena sin gluten/i);
  });
});

describe("la venta está cerrada en las DOS capas", () => {
  it("el SERVICIO rechaza cualquier producto que no sea `en_consultorio`", () => {
    // Es la capa que importa: la acción recibe ids y se puede invocar con cualquiera, así que un filtro
    // de formulario no alcanza. Regla 2: ninguna lógica de negocio en pages.
    const src = readFileSync(SERVICIO, "utf8");
    expect(src).toContain('n.commercial_availability !== "en_consultorio"');
    expect(src).toContain("no está disponible para la venta");
  });

  it("y la PANTALLA tampoco lo ofrece, para que nadie tenga que descubrirlo con un error", () => {
    const src = readFileSync(PAGINA, "utf8");
    expect(src).toContain('n.commercial_availability === "en_consultorio"');
  });

  it("la ENTREGA sigue cerrada, que era la mitad que ya funcionaba", () => {
    const src = readFileSync(DESPACHO, "utf8");
    expect(src).toContain('prod.commercial_availability !== "en_consultorio"');
  });
});

describe("las equivalencias se construyen y NO se encienden", () => {
  const mig = readFileSync("drizzle/0123_alergenos_y_retencion.sql", "utf8");

  it("ninguna relación entra firmada", () => {
    // Una fila sin firma es una PROPUESTA: existe, se puede revisar y no gobierna nada. El día que la
    // tabla se cablee al bloqueo, filtrar por `signed_at` es lo que impide que una propuesta decida.
    const insert = mig.slice(mig.indexOf('INSERT INTO "allergen_relations"'));
    expect(insert.slice(0, insert.indexOf(";"))).not.toContain("signed_at");
  });

  it("y la relación de la avena NO es directa: es por contaminación cruzada", () => {
    // Fue la corrección de Santiago, y es la razón por la que la firma no es un trámite: la avena por sí
    // sola no contiene gluten. Una equivalencia binaria habría dicho una cosa falsa en los dos sentidos.
    expect(mig).toMatch(/'avena',\s*'gluten',\s*'por_contaminacion_cruzada'/);
    expect(mig).not.toMatch(/'avena',\s*'gluten',\s*'directa'/);
  });

  it('"Ninguna" y "Otra" no se mapean, y son dos ausencias distintas', () => {
    // "Ninguna" no es un alérgeno. "Otra" es texto libre y no se puede cotejar: su tratamiento no es "no
    // bloquea" sino que EXIGE la misma confirmación, aplicando la conducta de Gildardo del 30 de agosto.
    const bloque = mig.slice(mig.indexOf('INSERT INTO "survey_option_allergens"'));
    expect(bloque.slice(0, bloque.indexOf(";"))).not.toContain("'Ninguna'");
    expect(bloque.slice(0, bloque.indexOf(";"))).not.toContain("'Otra'");
    expect(mig).toContain("un dato que falta no entra al calculo");
  });
});
