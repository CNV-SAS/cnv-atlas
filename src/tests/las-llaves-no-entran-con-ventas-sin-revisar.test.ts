import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ LAS LLAVES DE PRODUCCION NO ENTRAN CON VENTAS SIN REVISAR (Santiago, 2026-10-15) ═══
//
// LA REGLA, y es un ORDEN, no una recomendacion: las credenciales reales de Alegra y Wompi se montan SOLO
// cuando el smoke termine y todo lo de prueba este marcado.
//
// POR QUE. El smoke se hace con profesionales y pacientes REALES (decision suya: es lo que necesita para
// probar de verdad), asi que esas ventas NACEN REALES. Y la marca a mano solo frena la factura si llega
// ANTES que la cola: en el instante en que `alegra_config` tiene su fila de produccion y Vercel apunta a la
// URL de produccion, todo lo que estaba esperando se emite con numeracion de la DIAN. Lo que se marque cinco
// minutos despues ya no se arregla con una marca, se arregla con una nota credito que hace una persona.
//
// DONDE VIVE LA REGLA, que es lo que este candado protege: en `scripts/config-alegra-produccion.sql`, que es
// el unico sitio por el que se pasa obligatoriamente para montar las llaves. Antes de escribir nada lista
// las ventas que la cola emitiria y ABORTA mientras su bandeja diga '<REVISAR>'.
//
// Una regla escrita solo en un documento la cumple quien se acuerda; escrita en el script, la cumple el que
// corre el script. Es la leccion de [[un-guard-sin-superficie-que-lo-alcance]].

const COLA = readFileSync("src/modules/payments/data/facturacion-repository.ts", "utf8");
const GUARD = readFileSync("scripts/config-alegra-produccion.sql", "utf8");

/** El cuerpo de un predicado exportado de la cola, tal cual. */
function predicado(nombre: string): string {
  const m = COLA.match(new RegExp(`export const ${nombre} = sql\`([^\`]+)\``));
  expect(m, `no se encontro ${nombre} en facturacion-repository: cambio su forma`).not.toBeNull();
  return m![1];
}

describe("el guard de las llaves mira EXACTAMENTE lo que miraria la cola", () => {
  // ═══ POR QUE SE COMPARAN LOS TEXTOS ═══
  //
  // La condicion esta COPIADA en el script (es SQL suelto: no puede importar nada de TypeScript). Una
  // condicion PARECIDA seria peor que ninguna: diria "no hay nada que facturar" y la cola emitiria otra
  // cosa. Asi que lo que se vigila es que sigan siendo la misma letra, y el dia que la cola cambie este
  // candado se pone rojo nombrando el archivo que hay que actualizar.
  it.each(["LE_FALTA_ALGO", "FACTURABLE", "LA_FACTURA_ES_DE_CNV"])(
    "el script repite %s letra por letra",
    (nombre) => {
      expect(
        GUARD,
        `la cola cambio ${nombre} y el guard de scripts/config-alegra-produccion.sql quedo con la version vieja`,
      ).toContain(predicado(nombre));
    },
  );

  it("y suma los dos frenos que no son predicados exportados", () => {
    // La marca a mano (0217): es el unico freno que cubre el caso del smoke, paciente y profesional reales
    // con acto de prueba.
    expect(GUARD).toContain("transactions.marcada_como_prueba_at is null");
    // El tope de intentos: una venta que agoto reintentos ya no la toca la cola, asi que tampoco cuenta.
    expect(GUARD).toContain("transactions.alegra_attempts < 5");
    expect(
      COLA,
      "cambio el tope de intentos por defecto de la cola y el guard quedo con el 5",
    ).toContain("maxIntentos = 5");
  });

  it("y deja fuera las de paciente de prueba, que ya tienen su propio freno", () => {
    // `motivoSiPacienteYAmbienteNoCuadran` es simetrica: en produccion exige paciente real. Contarlas aqui
    // llenaria la lista de filas que nunca se van a emitir, y una lista con ruido no se revisa.
    expect(GUARD).toContain("coalesce(pa.cuenta_como_de_prueba, false) = false");
  });
});

describe("y aborta mientras nadie haya mirado la lista", () => {
  it("la bandeja nace en '<REVISAR>', no en 'si'", () => {
    // Si naciera en 'si', el guard existiria y no frenaria nada: es [[una-bandera-ignorada-deja-creer-que-se-aplico]].
    expect(GUARD).toMatch(/\('ventas_pendientes_revisadas', '<REVISAR>'\)/);
  });

  it("y el aborto dice que hacer, no solo que no", () => {
    const i = GUARD.indexOf("ABORTADO: % ventas se facturarian");
    expect(i, "se cayo el aborto del guard de ventas pendientes").toBeGreaterThan(0);
    const mensaje = GUARD.slice(i, GUARD.indexOf("', n);", i));
    expect(mensaje).toContain("DIAN");
    expect(mensaje, "no dice como resolverlo (marcar en /pagos)").toContain("marca como prueba");
    expect(mensaje).toContain("ventas_pendientes_revisadas");
  });

  it("y la lista va ANTES de revisar los valores, que es lo que la vuelve consultable hoy", () => {
    // Con los '<LLENAR>' puestos, correr el script en ensayo imprime la lista. Si el orden se invirtiera,
    // la unica forma de ver la lista seria tener ya las llaves en la mano, que es tarde.
    expect(GUARD.indexOf("VENTAS QUE SE FACTURARIAN")).toBeLessThan(
      GUARD.indexOf("ABORTADO: falta llenar"),
    );
  });
});
