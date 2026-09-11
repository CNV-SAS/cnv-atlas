import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

// ═══ LUVIA SE VENDE, Y NO HAY REGLA DE ALERGENOS QUE LA GOBIERNE (2026-09-11) ═══
//
// ESTE ARCHIVO AFIRMABA LO CONTRARIO HASTA HOY, y por eso empieza contando el error en vez de la regla.
//
// La 0124 retuvo LUVIA "hasta que Direccion Cientifica firme las equivalencias de alergenos". No habia
// nada que firmar: la decision se tomo el 27 de agosto ("nada de tablas de alergenos, ni de equivalencias,
// ni de filtros"), la ejecutamos el 28, y la pregunta volvio el 11 de septiembre con otro producto de
// ejemplo. TERCERA vez que vuelve la misma pieza cerrada, y esta vez con un producto retenido detras.
//
// LO QUE EL CANDADO CUIDA AHORA es que no vuelva por cuarta vez: que la base no tenga equivalencias, que
// el texto que se muestra sea el que declara la ficha y no una deduccion nuestra, y que el gate de
// disponibilidad siga cerrado en las dos capas para los productos que de verdad no se venden todavia.
//
// LO QUE NO CUIDA, y hay que decirlo: la §7.7 del modelo comercial exige lo contrario (bloqueo activo con
// confirmacion y registro) y paso revision legal. Ese conflicto no es cientifico y no lo cierra un test:
// va al asesor legal en `docs/entregas/RESUMEN_LEGAL_ALERGENO_LUVIA.md`. Si vuelve con que el bloqueo es
// exigible, ESTE ARCHIVO es lo primero que cambia.

vi.mock("server-only", () => ({}));

const HABILITA = "drizzle/0126_luvia_habilitada_sin_regla_de_alergenos.sql";
const SERVICIO = "src/modules/payments/services/payments-service.ts";
const PAGINA = "src/app/(app)/pagos/page.tsx";
const DESPACHO = "src/modules/nutraceuticals/services/inventory-service.ts";

describe("LUVIA entra al catálogo como producto vendible de tercero", () => {
  const mig = readFileSync(HABILITA, "utf8");

  it("queda `en_consultorio`, que es lo que abre las dos puertas", () => {
    // `en_consultorio` no es "se muestra en la tienda": es el unico valor que el checkout y el despacho
    // aceptan. Por eso una sola linea abre las dos y no queda media puerta.
    expect(mig).toMatch(/SET "commercial_availability" = 'en_consultorio'/);
  });

  it("y sigue siendo de TERCERO, con su titular de marca, que es lo que la 0124 hizo bien", () => {
    // Habilitar la venta no cambia de quien es el producto. El titular es campo propio y se muestra al
    // paciente por la doctrina del fabricante aparente (§7.7): eso NO esta en disputa y no se toca.
    const alta = readFileSync("drizzle/0124_luvia_cargado_sin_habilitar.sql", "utf8");
    expect(alta).toContain("'tercero'");
    expect(alta).toContain("Centro de Nutrición Integral Katherine Ruiz");
    expect(mig, "la habilitación no debe tocar la propiedad ni el titular").not.toMatch(/"ownership"|"brand_owner"/);
  });
});

describe("el gate de disponibilidad sigue cerrado, que es lo que protege a los que aún no se venden", () => {
  // Los seis `no_disponible` del catalogo SI se van a vender; todavia no se han maquilado. El gate no
  // sobraba: existia por ellos, y LUVIA solo lo estaba usando por un motivo equivocado.

  it("el SERVICIO rechaza cualquier producto que no sea `en_consultorio`", () => {
    // Es la capa que importa: la accion recibe ids y se puede invocar con cualquiera, asi que un filtro
    // de formulario no alcanza. Regla 2: ninguna logica de negocio en pages.
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

describe("no hay regla que traduzca un ingrediente a una alergia", () => {
  const mig = readFileSync(HABILITA, "utf8");

  it("las cinco equivalencias de la 0123 se borran, y se nombran una por una", () => {
    // Un DELETE sin WHERE seria mas corto y diria menos: taparia una fila que alguien hubiera anadido
    // despues. Se borra lo que sembramos nosotros, nombrandolo.
    for (const par of ["'trigo', 'gluten'", "'cebada', 'gluten'", "'centeno', 'gluten'", "'avena', 'gluten'", "'leche', 'lactosa'"]) {
      expect(mig, `falta retirar la equivalencia ${par}`).toContain(`(${par})`);
    }
  });

  it("y la nota de LUVIA pierde la deducción: queda lo que declara la ficha", () => {
    // El "(gluten)" y el "todavia" los retiro el de su propio archivo: sugerian un cruce pendiente que
    // nunca aprobo. Nuestra nota decia lo mismo con otras palabras ("se trata como gluten").
    // Se mira SOLO la sentencia, no el archivo: el encabezado cita la nota vieja para explicar qué se
    // quita, y un candado sobre el archivo entero confundiría la explicación con la pieza.
    const update = mig.slice(mig.indexOf('UPDATE "nutraceutical_allergens"'));
    const sentencia = update.slice(0, update.indexOf(";"));
    expect(sentencia).toMatch(/SET "notes" = 'Declarado en la ficha del fabricante\./);
    expect(sentencia, "la nota sigue deduciendo gluten de la avena").not.toContain("se trata como gluten");
  });

  it("el prompt del menú NO lleva bloque de alergias, que es la mitad que se retiró el 28", () => {
    // Es la pieza que de verdad podia hacer daño: una verificacion PARCIAL (una instruccion que el modelo
    // cumple "casi siempre") es peor que ninguna, porque el profesional aprende a creerle.
    const prompt = readFileSync("src/modules/treatment/ai/prompts/menu.v3.ts", "utf8");
    // Se mira SOLO el armado del prompt: el encabezado del archivo si nombra las alergias, y debe, porque
    // explica por que NO van. Un candado sobre el archivo entero confundiria la explicacion con la pieza.
    const desde = prompt.indexOf("export function buildMenuPrompt");
    const armado = prompt.slice(desde, prompt.indexOf("\n/**", desde));
    expect(desde).toBeGreaterThan(0);
    expect(armado.length).toBeGreaterThan(500);
    expect(armado.toLowerCase()).not.toMatch(/alergia|alergen|intoleranc/);
  });
});
