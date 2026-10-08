import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { procedeElRetracto } from "@/modules/payments/domicilio";

// ═══ EL RETRACTO: QUIEN LO VE, QUIEN LO EJECUTA, Y EN QUE SE DISTINGUE (Santiago, smoke 2026-10-08) ═══
//
// Tres preguntas suyas, y las tres valian. Una era una sospecha fundada que resulto infundada, y las otras dos
// eran defectos de verdad.

const raiz = process.cwd();
const leer = (rel: string) => readFileSync(join(raiz, rel), "utf8");

describe("el sello roto no reintegra nada", () => {
  // SU PREGUNTA: *"¿como va a dejar retractarse si ya alguien destapo el producto?"*. La sospecha era buena y
  // valia comprobarla antes de tocar nada: si el boton "Volvio abierto" reintegrara igual, seria dinero que CNV
  // no debe. NO LO HACE, y este candado lo fija, porque es la clase de cosa que un refactor rompe en silencio.
  it("con el sello roto el retracto NO procede, y lo dice con su articulo", () => {
    const v = procedeElRetracto({
      estado: { aplica: true, motivo: null, vencido: false, limite: "2026-10-16", diasHabilesRestantes: 3 },
      selloIntacto: false,
    });
    expect(v.procede).toBe(false);
    // EL MOTIVO CON SU FUNDAMENTO: una negativa de un derecho del consumidor tiene que decir por que, porque el
    // paciente puede reclamar ante la Superintendencia y ahi la razon es lo que se defiende.
    expect(v.motivo).toContain("47");
  });

  it("y el writer calcula el reintegro DESDE el veredicto, no desde el monto", () => {
    // AQUI ESTA LA MITAD QUE IMPORTA: la regla pura podria decir "no procede" y el writer reintegrar igual. El
    // reintegro cuelga del veredicto con un ternario, y si alguien lo separa, el dinero sale sin derecho.
    const src = leer("src/modules/payments/data/retracto-writer.ts");
    expect(src).toContain("veredicto.procede ? reintegroPorRetracto(");
    expect(src, "el evento de auditoria dejo de distinguir aceptado de negado").toContain(
      'veredicto.procede ? "venta.retracto_aceptado" : "venta.retracto_negado"',
    );
  });

  it("y dentro del plazo con sello intacto SI procede, que es el control de que no niega siempre", () => {
    // Sin este caso, un cambio que negara TODO pasaria verde en los dos de arriba.
    const v = procedeElRetracto({
      estado: { aplica: true, motivo: null, vencido: false, limite: "2026-10-16", diasHabilesRestantes: 3 },
      selloIntacto: true,
    });
    expect(v.procede).toBe(true);
  });
});

describe("el profesional lo ve pero no lo ejecuta", () => {
  // SU PREGUNTA: *"¿esto no deberia aparecer solo a admin?"*. No: el paciente le pregunta A EL, asi que tiene
  // que poder decirle el plazo y la condicion del sello. Lo que no puede es mover dinero de CNV.
  //
  // Y EL GUARD YA ESTABA BIEN (la accion devuelve "sin permiso"), asi que no habia hueco de dinero. Lo que
  // estaba mal era la EXPOSICION: se le ofrecia un boton que iba a rebotar, y un guard correcto mal expuesto se
  // siente igual que un defecto.
  it("la accion sigue siendo de quien maneja el dinero", () => {
    const src = leer("src/modules/payments/actions.ts");
    const i = src.indexOf("export async function registrarRetractoFormAction");
    expect(i).toBeGreaterThan(0);
    const cuerpo = src.slice(i, src.indexOf("export async function", i + 10));
    expect(cuerpo, "el retracto dejo de ser decision de CNV: mueve dinero").toContain("canViewRevenue(user)");
  });

  it("y la pantalla solo ofrece el boton a quien puede usarlo", () => {
    const src = leer("src/modules/payments/components/bloque-retracto.tsx");
    expect(src).toContain("puedeRegistrar");
    // Y A QUIEN NO, LE DICE QUE HACER: con el paciente al telefono, "no puedes" lo deja sin respuesta.
    expect(src).toContain("avísale a CNV");
  });

  it("y la informacion se le sigue mostrando, que es lo que Santiago queria conservar", () => {
    // EL CONTROL CONTRA EL ARREGLO FACIL: esconder el bloque entero al profesional "resolveria" el reporte y
    // perderia lo unico que de verdad hace falta, que es que pueda explicarselo al paciente.
    const src = leer("src/modules/payments/components/bloque-retracto.tsx");
    expect(src, "el bloque se escondio al profesional en vez de solo quitarle el boton").not.toMatch(
      /if \(!puedeRegistrar\) return null/,
    );
  });
});

describe("la devolucion dice en que se distingue del retracto", () => {
  it("lo explica en la pantalla, no solo en los comentarios", () => {
    // ESTABA EXPLICADO EN EL CODIGO Y EN NINGUNA PANTALLA, o sea en el unico sitio donde quien elige no lo lee.
    // Y elegir mal no es inocente: registrar como devolucion algo que era un retracto le quita al paciente el
    // amparo del articulo 47.
    const src = leer("src/modules/payments/components/registrar-devolucion.tsx");
    expect(src).toContain("Esto no es el retracto");
    expect(src).toContain("5 días hábiles");
    expect(src).toContain("sellado");
  });
});

describe("el motivo del bloqueo llega a la pantalla", () => {
  it("la venta en efectivo traduce el error de inventario, igual que la del link", () => {
    // LO QUE PASABA: el porton de la bodega funcionaba y en /pagos salia "No se pudo registrar la venta en
    // efectivo." y nada mas. La accion solo deja pasar CheckoutError y ModalidadError.
    //
    // SE COMPRUEBAN LAS DOS VIAS: arreglar una sola es como se llega a que la misma venta explique su rechazo
    // por un camino y no por el otro, que es exactamente lo que paso.
    const src = leer("src/modules/payments/services/payments-service.ts");
    const traducciones = src.match(/if \(e instanceof InventarioDeVentaError\) throw new CheckoutError\(e\.message\);/g);
    expect(
      traducciones?.length ?? 0,
      "falta la traduccion en una de las dos vias (link y efectivo): el motivo del bloqueo se pierde en esa",
    ).toBeGreaterThanOrEqual(2);
  });
});
