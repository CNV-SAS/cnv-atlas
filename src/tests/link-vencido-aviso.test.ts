import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { CHECKOUT_TTL_MS } from "@/modules/payments/data/checkout-reader";

// ═══ UN AVISO NO DA UNA RAZON FALSA (Santiago, 2026-09-24) ═══
//
// El aviso de "este paciente tiene un link sin pagar" decía SIEMPRE "para que no quede cobrado dos veces", y
// se lo mostró sobre un link de 117 horas. Dos cosas son falsas ahí:
//
//   · un link vencido NO SE PUEDE PAGAR (el checkout lo rechaza pasado el TTL, y la página de Wompi caduca
//     con su propia firma), así que no hay cobro doble que evitar;
//   · y tampoco retiene inventario: lo disponible descuenta solo las reservas VIVAS (`expires_at > now()`).
//
// La acción sigue valiendo (cierra un link que si no se queda pendiente para siempre), pero por otra razón.
// Un aviso que da una razón falsa enseña a no creerle a los avisos, y eso cuesta más que el aviso.

const ACCIONES = readFileSync("src/modules/payments/actions.ts", "utf8");
const INVENTARIO = readFileSync("src/modules/payments/data/inventario-de-venta.ts", "utf8");

describe("el aviso del link pendiente", () => {
  it("distingue el link vivo del vencido", () => {
    expect(ACCIONES).toContain("Ya venció y no se puede pagar");
    expect(ACCIONES).toContain("para que no quede cobrado dos veces");
    // La decisión sale del TTL, no de un número escrito a mano en el mensaje.
    expect(ACCIONES).toContain("CHECKOUT_TTL_MS");
  });

  it("y el TTL es el mismo del checkout, no una copia", () => {
    expect(CHECKOUT_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("CONTROL: una reserva vencida NO retiene inventario (si retuviera, la razón buena sería otra)", () => {
    // Este es el hecho del que depende el texto: si algún día lo disponible dejara de filtrar por
    // `expires_at > now()`, un link vencido SÍ retendría unidades y el mensaje tendría que volver a cambiar.
    const vivas = INVENTARIO.match(/expires_at > now\(\)/g) ?? [];
    expect(vivas.length, "lo disponible dejó de descontar solo las reservas vivas").toBeGreaterThanOrEqual(2);
  });
});
