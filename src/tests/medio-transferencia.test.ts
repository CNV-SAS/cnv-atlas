import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cuentaDelPago, type MapaDeAlegra } from "@/modules/payments/facturacion";
import { medioDianDelPago } from "@/modules/payments/medio-de-pago";

// ═══ LA TRANSFERENCIA ES UN MEDIO, NO UN EFECTIVO CON OTRO NOMBRE (Santiago, 2026-09-25) ═══
//
// Atlas nació con dos canales (pasarela y efectivo), pero antes de Atlas se cobraba por transferencia, y hoy
// también se puede. Anotarla como efectivo no es un matiz de etiqueta:
//
//   · el medio viaja a la FACTURA ELECTRÓNICA y la DIAN separa efectivo de transferencia débito;
//   · y decide la CUENTA del pago: la del efectivo se llama "Efectivo en poder de Integrantes", o sea que la
//     plata sigue por recoger. Una transferencia ya llegó a una cuenta.

const MAPA: MapaDeAlegra = {
  env: "sandbox",
  ivaTaxId: "4",
  invoiceTemplateId: "16",
  creditNoteTemplateId: "17",
  costCenterPropioId: "1",
  costCenterTerceroId: "2",
  bankAccountEfectivoId: "5",
  bankAccountPasarelaId: "6",
  bankAccountTransferenciaId: null,
};

describe("el medio de pago de una transferencia", () => {
  it("es transferencia débito ante la DIAN, no efectivo", () => {
    expect(medioDianDelPago({ canal: "transferencia", tipo: null, tipoTarjeta: null })).toBe(
      "transferencia_debito",
    );
    // Control: el efectivo sigue siendo efectivo.
    expect(medioDianDelPago({ canal: "efectivo", tipo: null, tipoTarjeta: null })).toBe("efectivo");
  });

  it("SIN SU CUENTA CONFIGURADA no hereda la del efectivo: devuelve null", () => {
    // Apuntarla a la del efectivo diría que un dinero que ya está en el banco sigue en el bolsillo de
    // alguien. El pago espera y el panel dice por qué; la factura sale igual.
    expect(cuentaDelPago("transferencia", MAPA)).toBeNull();
    expect(cuentaDelPago("efectivo", MAPA)).toBe(5);
    expect(cuentaDelPago("wompi", MAPA)).toBe(6);
  });

  it("y con su cuenta configurada, usa la suya", () => {
    expect(cuentaDelPago("transferencia", { ...MAPA, bankAccountTransferenciaId: "9" })).toBe(9);
  });
});
