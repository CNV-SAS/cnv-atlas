import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { brutoReconocido } from "@/modules/payments/cobro-reconocido";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DEL BRUTO Y DEL INVENTARIO: LAS DOS PANTALLAS DICEN LO MISMO (smoke del 2026-09-29).
//
// LOS DOS DEFECTOS QUE CIERRA, y los dos son la misma forma: una regla aplicada en una pantalla y no en la
// otra, sobre el mismo hecho.
//
//   1. LA VENTA DEVUELTA SEGUIA EN EL BRUTO. El descuento del 2026-09-17 cubria la DISPUTA PERDIDA; la
//      devolucion del paciente se construyo despues (2026-09-22), con otro estado, y se quedo fuera. Inicio
//      decia 3.256.900 y el profesional 3.166.900: los 90.000 de una LUVIA que habia vuelto.
//   2. EL INVENTARIO CONTABA LOS PRODUCTOS DE PRUEBA en Inicio y no en Direccion: 1.903 contra 1.820.
//
// Es lo mismo que ya paso con "45 referencias". Por eso la cuenta vive en UN modulo neutro y este candado
// comprueba que las dos pantallas lo usen: un comentario en un lector no alcanza al otro.

describe("el bruto reconocido", () => {
  const venta = (id: string, amount: number) => ({ id, amount: String(amount) });

  it("suma lo pagado cuando no hay nada que descontar", () => {
    expect(
      brutoReconocido({
        pagadas: [venta("a", 100_000), venta("b", 50_000)],
        disputasPerdidas: [],
        devoluciones: [],
      }),
    ).toBe(150_000);
  });

  // LA DISPUTA PERDIDA RESTA LA VENTA ENTERA: el banco devolvio todo.
  it("una disputa perdida saca la venta completa", () => {
    expect(
      brutoReconocido({
        pagadas: [venta("a", 100_000), venta("b", 50_000)],
        disputasPerdidas: ["a"],
        devoluciones: [],
      }),
    ).toBe(50_000);
  });

  // LA DEVOLUCION RESTA LO DEVUELTO, NO LA VENTA: quien devolvio una de cuatro sigue habiendo comprado tres.
  // Restar la venta entera seria el error en el otro sentido, y es el que mas se parece a lo correcto.
  it("una devolucion parcial resta solo lo devuelto", () => {
    expect(
      brutoReconocido({
        pagadas: [venta("a", 360_000)],
        disputasPerdidas: [],
        devoluciones: [90_000],
      }),
    ).toBe(270_000);
  });

  // EL CASO DEL SMOKE, con sus cifras.
  it("reproduce el caso del smoke: la LUVIA devuelta sale del bruto", () => {
    expect(
      brutoReconocido({
        pagadas: [venta("todas", 3_256_900)],
        disputasPerdidas: [],
        devoluciones: [90_000],
      }),
    ).toBe(3_166_900);
  });

  it("aguanta cifras nulas sin inventar un numero", () => {
    expect(
      brutoReconocido({
        pagadas: [{ id: "a", amount: null }],
        disputasPerdidas: [],
        devoluciones: [null],
      }),
    ).toBe(0);
  });
});

describe("las dos pantallas usan la misma cuenta", () => {
  const INICIO = sinComentarios(readFileSync("src/modules/dashboard/data/tablero-reader.ts", "utf8"));
  const DIRECCION = sinComentarios(readFileSync("src/modules/direccion/data/dashboard-reader.ts", "utf8"));

  it("las dos llaman a brutoReconocido, y ninguna suma por su cuenta", () => {
    expect(INICIO).toContain("brutoReconocido");
    expect(DIRECCION).toContain("brutoReconocido");
  });

  it("las dos descuentan las devoluciones", () => {
    expect(INICIO).toContain("ESTADO_DEVUELTA");
    expect(DIRECCION).toContain("ESTADO_DEVUELTA");
  });

  it("y las dos excluyen los productos de prueba del inventario", () => {
    expect(INICIO).toContain("EMBED_PRODUCTO_NO_DE_PRUEBA");
    expect(DIRECCION).toContain("EMBED_PRODUCTO_NO_DE_PRUEBA");
  });
});

// ═══ Y CADA PANTALLA TIENE QUE DECIR DE QUIEN ES SU CIFRA (Santiago, 2026-10-01) ═══
//
// EL DEFECTO QUE ESTE ARCHIVO NO ATRAPO, y es la leccion: comprobaba que las dos pantallas usaran la MISMA
// CUENTA, y las dos la usaban. Lo que no comprobaba es que contaran SOBRE EL MISMO UNIVERSO, y ahi estaba el
// problema: /direccion decia "0 pagos" y el Inicio del mismo admin decia 11.900 de las MISMAS ventas.
//
// LA CAUSA ERA UN COMENTARIO MIO que parecia buen diseno: "no se filtra por profesional, la RLS decide que
// ve". Vale para un INTEGRANTE y se rompe para un ADMIN, cuya RLS le deja ver TODAS las ventas: su tarjeta
// "Tu mes" le mostraba el mes de la organizacion entera.
//
// LA REGLA QUE QUEDA: la RLS dice QUE PUEDE VER alguien; el rotulo de una cifra promete algo mas estrecho
// ("lo tuyo", "este mes"). Cuando no coinciden, manda la promesa del rotulo, y el alcance SE ESCRIBE.
describe("cada tarjeta cuenta sobre el universo que su rotulo promete", () => {
  // Se lee aqui: el `INICIO` del describe de arriba vive en su propio alcance.
  const INICIO = sinComentarios(readFileSync("src/modules/dashboard/data/tablero-reader.ts", "utf8"));
  it("el tablero personal acota al profesional de quien mira, no a lo que su RLS alcanza", () => {
    // El alcance escrito: sin esto la tarjeta vuelve a depender de la RLS y un admin ve el mes de todos.
    expect(INICIO).toContain("miProfesional");
    expect(INICIO).toContain('.eq("profile_id", userId)');
    // ── SE CUENTAN LOS FILTROS, NO LAS MENCIONES ──
    //
    // La primera version contaba cuantas veces aparecia `miProfesional` y NO atrapo el defecto: cada consulta
    // lo nombra dos veces (la condicion del ternario y el filtro), asi que quitar UN filtro dejaba mentions
    // de sobra. Hay que contar el filtro mismo, que es lo que acota.
    const filtros = INICIO.split('"professional_id", miProfesional').length - 1;
    expect(
      filtros,
      "alguna de las tres cifras de Tu mes (ventas, comision, inventario) dejo de acotarse a quien mira",
    ).toBe(3);
  });

  it("y si quien mira no vende, lo dice en vez de mostrar ceros", () => {
    // UN CERO SIN SIGNIFICADO SE LEE COMO "no vendi" en vez de "esto no es tuyo". La pantalla oculta la
    // seccion; sin esta bandera volveria a mostrar tres ceros a un administrador.
    expect(INICIO).toContain("esIntegrante");
  });
});

// ═══ Y EL PRODUCTO DE PRUEBA NO INFLA EL DINERO (Santiago, 2026-10-01) ═══
//
// EL HUECO: el filtro de productos de prueba llegaba al INVENTARIO y no a las ventas ni a la comision. En el
// smoke, una venta con ADAPTO-STRESS (real, 107.100) y PRUEBA SMOKE BLOQUE 3 (de prueba, 11.900) dio 119.000
// de ventas y 20.000 de comision; lo real eran 107.100 y 18.000.
//
// LA DECISION: una venta es de prueba O real, NUNCA LAS DOS (guard en el servicio), y una venta de prueba no
// cuenta en el dinero. Contar por linea seria mas fino y mucho mas caro: el bruto se suma del IMPORTE DE LA
// VENTA en las tres pantallas que comparten la cuenta, y pasarlo a sumar lineas cambiaria el contador
// compartido y el reparto ya sellado, para un caso que no deberia existir.
describe("una venta de producto de prueba no cuenta en el dinero", () => {
  const INICIO2 = sinComentarios(readFileSync("src/modules/dashboard/data/tablero-reader.ts", "utf8"));
  const DIRECCION2 = sinComentarios(readFileSync("src/modules/direccion/data/dashboard-reader.ts", "utf8"));

  it("las dos pantallas excluyen la venta, con el select compartido", () => {
    for (const [nombre, src] of [["Inicio", INICIO2], ["Direccion", DIRECCION2]] as const) {
      expect(src, nombre + " no lee las lineas de prueba").toContain("EMBED_LINEA_DE_PRUEBA");
      expect(src, nombre + " no excluye la venta de prueba").toContain("ventaDePrueba");
    }
  });

  // ═══ Y LAS CUATRO PANTALLAS DEL DINERO, no dos (Santiago, 2026-10-01) ═══
  //
  // SU TABLERO DECIA 0 VENTAS DEL MES Y SU HISTORIAL 3.661.000: la misma venta salia de una cifra y se
  // quedaba en la otra, porque el filtro llego a los tableros y no a los dos lectores del HISTORIAL. Dos
  // reglas para el mismo hecho, otra vez, y por la misma causa: el barrido no cubrio todas las capas.
  //
  // LA REGLA QUE QUEDA: el dinero que nunca se facturo NO ES DINERO, en ninguna pantalla.
  it("el historial del integrante y su propio perfil aplican la misma regla que los tableros", () => {
    const integrante = sinComentarios(readFileSync("src/modules/payments/data/integrante-reader.ts", "utf8"));
    const perfil = sinComentarios(readFileSync("src/modules/professionals/data/perfil-reader.ts", "utf8"));
    for (const [nombre, src] of [["integrante", integrante], ["perfil", perfil]] as const) {
      expect(src, nombre + ": su dinero no excluye el producto de prueba").toMatch(/is_test|EMBED_LINEA_DE_PRUEBA/);
      expect(src, nombre + ": su dinero no excluye el paciente marcado").toContain("cuenta_como_de_prueba");
    }
    // Y LA COMISION CON LA MISMA REGLA QUE LAS VENTAS: sin esto, el margen y las ventas de la MISMA tarjeta
    // contaban universos distintos, que es como empezo todo esto.
    expect(integrante).toContain("from professional_revenue r");
    expect(perfil).toContain("esVentaReal");
  });

  it("y el guard impide mezclarlas en la misma venta, que es lo que hace valida la exclusion entera", () => {
    // SIN EL GUARD, excluir la venta entera descontaria tambien la linea REAL. Las dos piezas se sostienen
    // la una a la otra: si alguien quita el guard, este filtro empieza a perder dinero de verdad.
    const servicio = sinComentarios(readFileSync("src/modules/payments/services/payments-service.ts", "utf8"));
    expect(servicio).toContain("junto con productos reales");
  });
});
