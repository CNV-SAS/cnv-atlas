import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));
vi.mock("@/modules/payments/data/payments-repository", () => ({
  findLivePendingDuplicate: vi.fn(),
  findRecentCashSaleDuplicate: vi.fn(),
}));

import { leerLineas } from "@/modules/payments/actions";

// ═══ UNA VENTA PUEDE TENER VARIAS LINEAS, Y HASTA HOY NO PODIA ═══
//
// EL DEFECTO (2026-09-12, smoke del Bloque 2a). Santiago anadia un segundo producto y se generaba OTRO
// checkout con OTRO enlace: el paciente recibia dos links para una sola compra. Y el caso de varios
// productos estaba en el criterio de aceptacion de contabilidad como "el mas comun en una consulta real".
//
// LO QUE ENSEÑA, y por eso el comentario es largo: el estrangulamiento estaba en DOS capas y NINGUNA era
// el modelo. `transaction_items` es una fila por linea, el writer las inserta todas, el servicio itera, y
// el esquema de Zod admite hasta CINCUENTA. Lo unico que mandaba una sola linea eran el formulario y la
// funcion que leia dos campos sueltos del FormData.
//
// Buscar la causa en el modelo habria costado horas y no habia nada que arreglar ahi.

function fd(valor: string | null): FormData {
  const f = new FormData();
  if (valor !== null) f.set("lineas", valor);
  return f;
}

describe("las líneas del checkout", () => {
  it("lee varias, cada una con su producto y su cantidad", () => {
    const lineas = leerLineas(
      fd(JSON.stringify([
        { nutraceuticalId: "a", quantity: "2" },
        { nutraceuticalId: "b", quantity: "1" },
        { nutraceuticalId: "c", quantity: "3" },
      ])),
    );
    expect(lineas).toEqual([
      { nutraceuticalId: "a", quantity: 2 },
      { nutraceuticalId: "b", quantity: 1 },
      { nutraceuticalId: "c", quantity: 3 },
    ]);
  });

  it("y una sola sigue funcionando, que es el caso de todos los días", () => {
    expect(leerLineas(fd(JSON.stringify([{ nutraceuticalId: "a", quantity: "1" }])))).toEqual([
      { nutraceuticalId: "a", quantity: 1 },
    ]);
  });
});

describe("lo que viene roto NO se convierte en una venta", () => {
  // La regla: ante un campo ilegible se devuelve lista VACIA y el esquema de Zod la rechaza con su
  // mensaje. NO se cae a un valor por defecto, porque el defecto sería cobrar algo que nadie eligió.

  it("un JSON roto da lista vacía, no un producto inventado", () => {
    expect(leerLineas(fd("[{"))).toEqual([]);
  });

  it("el campo ausente da lista vacía", () => {
    expect(leerLineas(fd(null))).toEqual([]);
  });

  it("y algo que no es una lista tampoco se interpreta", () => {
    expect(leerLineas(fd(JSON.stringify({ nutraceuticalId: "a", quantity: 1 })))).toEqual([]);
  });

  it("una cantidad que no es número llega como NaN, para que Zod la rechace", () => {
    // Deliberado: convertirla a 1 aquí sería decidir una cantidad que el profesional no escribió. Se deja
    // pasar rota para que la rechace quien tiene el mensaje de error, no quien lee el formulario.
    const [l] = leerLineas(fd(JSON.stringify([{ nutraceuticalId: "a", quantity: "dos" }])));
    expect(Number.isNaN(l.quantity)).toBe(true);
  });
});
