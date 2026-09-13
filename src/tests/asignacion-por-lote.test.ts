import { describe, expect, it } from "vitest";

import { asignarPorLotes } from "@/modules/nutraceuticals/asignacion-por-lote";
import { wompiEventSchema } from "@/modules/payments/validations";

// ═══ DE QUE LOTES SALE UNA VENTA, Y DE QUE AMBIENTE ES SU PAGO ═══

describe("asignarPorLotes: sale primero lo que vence primero", () => {
  const marzo = { lotId: "A", vence: "2027-03-01", disponible: 2 };
  const junio = { lotId: "B", vence: "2027-06-01", disponible: 5 };

  it("una venta de 3 con 2 en marzo y 5 en junio: las 2 de marzo y 1 de junio", () => {
    // La entrega de antes exigia UN lote que cubriera todo y habria elegido junio, dejando marzo en la
    // vitrina hasta vencerse.
    expect(asignarPorLotes([junio, marzo], 3)).toEqual({
      asignaciones: [
        { lotId: "A", cantidad: 2 },
        { lotId: "B", cantidad: 1 },
      ],
      faltante: 0,
    });
  });

  it("si alcanza con el primero, no toca el segundo", () => {
    expect(asignarPorLotes([marzo, junio], 2).asignaciones).toEqual([{ lotId: "A", cantidad: 2 }]);
  });

  it("si no alcanza, asigna lo que hay y dice cuánto falta", () => {
    expect(asignarPorLotes([marzo, junio], 9)).toEqual({
      asignaciones: [
        { lotId: "A", cantidad: 2 },
        { lotId: "B", cantidad: 5 },
      ],
      faltante: 2,
    });
  });

  it("un lote sin disponible (o en negativo) no se toca", () => {
    expect(
      asignarPorLotes([{ ...marzo, disponible: 0 }, { lotId: "C", vence: "2027-01-01", disponible: -1 }, junio], 1)
        .asignaciones,
    ).toEqual([{ lotId: "B", cantidad: 1 }]);
  });

  it("el resultado no depende del orden en que la base devolvió los lotes", () => {
    const mismoDia = [
      { lotId: "Z", vence: "2027-03-01", disponible: 3 },
      { lotId: "Y", vence: "2027-03-01", disponible: 3 },
    ];
    expect(asignarPorLotes(mismoDia, 4)).toEqual(asignarPorLotes([...mismoDia].reverse(), 4));
  });

  it("sin lotes, todo falta", () => {
    expect(asignarPorLotes([], 3)).toEqual({ asignaciones: [], faltante: 3 });
  });
});

describe("el ambiente del pago viene del evento de Wompi", () => {
  const evento = (extra: Record<string, unknown>) => ({
    event: "transaction.updated",
    timestamp: 1,
    signature: { checksum: "x", properties: [] },
    data: { transaction: { id: "t", reference: "r", status: "APPROVED", amount_in_cents: 1, currency: "COP" } },
    ...extra,
  });

  it("conserva 'test' y 'prod', los dos valores que documenta Wompi", () => {
    for (const environment of ["test", "prod"]) {
      const r = wompiEventSchema.safeParse(evento({ environment }));
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.environment).toBe(environment);
    }
  });

  it("un evento sin ambiente se acepta: no puede impedir sellar el pago", () => {
    expect(wompiEventSchema.safeParse(evento({})).success).toBe(true);
  });

  it("un ambiente desconocido se rechaza, no se adivina", () => {
    expect(wompiEventSchema.safeParse(evento({ environment: "sandbox" })).success).toBe(false);
  });
});
