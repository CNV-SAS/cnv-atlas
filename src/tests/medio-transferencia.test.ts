import { readFileSync } from "node:fs";
import { join } from "node:path";

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

// ═══ Y LA OFRECEN LAS DOS PANTALLAS QUE COBRAN, NO SOLO UNA (Santiago, 2026-10-10) ═══
//
// Textual suyo: *"en el flujo de venta de tratamiento no tenemos la opción de transferencia."* El medio existía
// desde el 2026-09-25, el servidor lo entendía, y /pagos lo preguntaba. La venta EN CONSULTA no: mandaba
// siempre efectivo. O sea que la pantalla que de verdad usa el integrante con el paciente delante era justo la
// que guardaba el dato mal, y lo guardaba en silencio.
//
// ES EL PATRÓN DE "una regla también vive en varios sitios": arreglar solo donde se reportó deja el peor sin
// tocar. Este candado mira las DOS, para que la próxima no vuelva a quedarse en una.
describe("las dos pantallas que cobran ofrecen transferencia", () => {
  const leer = (rel: string) => readFileSync(join(process.cwd(), rel), "utf8");
  const PAGOS = "src/modules/payments/components/register-cash-sale-form.tsx";
  const CONSULTA = "src/modules/treatment/components/venta-en-consulta-form.tsx";

  it("/pagos la pregunta en el campo del medio", () => {
    const src = leer(PAGOS);
    expect(src).toContain('name="canal"');
    expect(src).toContain('<option value="transferencia">Transferencia</option>');
  });

  it("la venta en consulta la ofrece y MANDA el canal", () => {
    const src = leer(CONSULTA);
    // Sin este `set`, el servidor cae en su valor por defecto (efectivo) y la transferencia se guarda mal.
    expect(src).toContain('fd.set("canal", canal);');
    expect(src).toContain("Cobrar por transferencia");
    expect(src).toContain('setConfirmando("transferencia")');
  });

  it("y los reintentos no la degradan a efectivo", () => {
    const src = leer(CONSULTA);
    // Los avisos de link pendiente y de duplicado VUELVEN A COBRAR. Si llamaran sin el medio, el segundo
    // intento (el camino que nadie mira) registraría como efectivo lo que se cobró por transferencia.
    expect(src).toContain("cobrarYaPagada(canalUsado.current, { anularLinks: true })");
    expect(src).toContain("cobrarYaPagada(canalUsado.current, { confirmDuplicate: true })");
    expect(src, "no debe quedar ningún cobro que no diga el medio").not.toMatch(/cobrarYaPagada\(\s*\{/);
  });

  it("pero NO bajo Distribución, donde el servidor deriva el canal", () => {
    const src = leer(CONSULTA);
    // Preguntar allá sería ofrecer una respuesta que se descarta: el paciente le paga al integrante.
    const bloque = src.slice(src.indexOf("LA TRANSFERENCIA, QUE AQUÍ NO EXISTÍA"), src.indexOf("Cobrar por transferencia"));
    expect(bloque).toContain("esDeDistribucion ? null : (");
  });
});
