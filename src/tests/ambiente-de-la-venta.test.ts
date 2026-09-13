import { describe, expect, it } from "vitest";

import { motivoSiLaVentaNoEsDeEsteAmbiente, wompiEnvDeLaLlave } from "@/modules/payments/ambiente";
import { wompiEventSchema } from "@/modules/payments/validations";

// ═══ UN PAGO DE PRUEBA NUNCA SE FACTURA EN PRODUCCION ═══
//
// ESCRITO EL DIA ANTES DE SALIR A PRODUCCION CON PACIENTES REALES (2026-09-13), y es lo que mas importa de
// todo el Bloque 2a, porque protege contra un error que no se ve y no se deshace bien.
//
// LOS DOS CASOS REALES. La base de produccion ya guardaba ventas del smoke:
//
//   1. Un pago con tarjeta de PRUEBA de Wompi a un paciente REAL. El guard de `is_test` mira el PACIENTE, y
//      en produccion "paciente real" queda permitido. La cola le habria emitido una factura electronica
//      REAL por un pago que nunca movio dinero.
//   2. Una venta con la factura 7 del SANDBOX. Reintentada en produccion, habria leido la factura 7 DE
//      PRODUCCION, que es el documento de otra persona, y podria haberle registrado un pago.
//
// Los dos se cierran por el PAGO y por la FACTURA, sin depender de que alguien marque a nadie.

describe("el modo del pago sale de la llave de Wompi", () => {
  it("una llave de producción da producción", () => {
    expect(wompiEnvDeLaLlave("pub_prod_abc123")).toBe("produccion");
  });

  it("una llave de prueba da prueba", () => {
    expect(wompiEnvDeLaLlave("pub_test_abc123")).toBe("test");
  });

  it("LO DESCONOCIDO CUENTA COMO PRUEBA, que es el lado seguro de equivocarse", () => {
    // Una llave ausente o rara deja la venta como prueba: solo se factura en sandbox. Equivocarse hacia
    // aca es una venta real que no se factura y sale en el panel. Equivocarse hacia el otro lado es una
    // factura fiscal por un pago de juguete, que se deshace con nota credito.
    expect(wompiEnvDeLaLlave(undefined)).toBe("test");
    expect(wompiEnvDeLaLlave(null)).toBe("test");
    expect(wompiEnvDeLaLlave("")).toBe("test");
    expect(wompiEnvDeLaLlave("pub_sandbox_x")).toBe("test");
    // Ni siquiera un prefijo parecido cuela: tiene que ser exactamente el de produccion.
    expect(wompiEnvDeLaLlave("prod_pub_x")).toBe("test");
    expect(wompiEnvDeLaLlave("PUB_PROD_x")).toBe("test");
  });
});

describe("dónde se puede facturar cada venta", () => {
  it("CASO 1: un pago de PRUEBA no se factura en producción", () => {
    const motivo = motivoSiLaVentaNoEsDeEsteAmbiente({ wompiEnv: "test", alegraEnv: null }, "produccion");
    expect(motivo, "un pago de prueba se habría facturado como real").not.toBeNull();
    expect(motivo).toMatch(/PRUEBA/);
  });

  it("CASO 2: una factura del sandbox no se relee en producción, aunque el pago fuera real", () => {
    // Aunque se corrigiera el modo del pago, el id de la factura sigue siendo del sandbox. El mismo numero en
    // produccion es otra factura.
    const motivo = motivoSiLaVentaNoEsDeEsteAmbiente(
      { wompiEnv: "produccion", alegraEnv: "sandbox" },
      "produccion",
    );
    expect(motivo, "se habría releído la factura de otra persona").not.toBeNull();
    expect(motivo).toMatch(/otra factura/);
  });

  it("y un pago REAL no se factura en sandbox: su factura va en producción", () => {
    expect(motivoSiLaVentaNoEsDeEsteAmbiente({ wompiEnv: "produccion", alegraEnv: null }, "sandbox")).not.toBeNull();
  });

  it("los dos casos que SÍ cuadran no dicen nada", () => {
    expect(motivoSiLaVentaNoEsDeEsteAmbiente({ wompiEnv: "test", alegraEnv: null }, "sandbox")).toBeNull();
    expect(motivoSiLaVentaNoEsDeEsteAmbiente({ wompiEnv: "test", alegraEnv: "sandbox" }, "sandbox")).toBeNull();
    expect(motivoSiLaVentaNoEsDeEsteAmbiente({ wompiEnv: "produccion", alegraEnv: null }, "produccion")).toBeNull();
    expect(
      motivoSiLaVentaNoEsDeEsteAmbiente({ wompiEnv: "produccion", alegraEnv: "produccion" }, "produccion"),
    ).toBeNull();
  });

  it("un modo de pago inválido no se factura en ningún ambiente", () => {
    // Si la columna tuviera basura, lo seguro es no emitir en ningun lado, no adivinar.
    expect(motivoSiLaVentaNoEsDeEsteAmbiente({ wompiEnv: "raro", alegraEnv: null }, "sandbox")).not.toBeNull();
    expect(motivoSiLaVentaNoEsDeEsteAmbiente({ wompiEnv: "raro", alegraEnv: null }, "produccion")).not.toBeNull();
  });
});

describe("el webhook ya no tira el instrumento de pago", () => {
  // EL DEFECTO: el esquema declaraba cinco campos, y Zod ELIMINA los que no declara. Wompi mandaba
  // `payment_method_type` en cada evento, llegaba autenticado por la firma, y se tiraba antes de guardar.
  // Es el mismo patron que el cuerpo del error de Alegra: el dato llega y lo descartamos nosotros.

  const evento = (extra: Record<string, unknown> = {}) => ({
    event: "transaction.updated",
    timestamp: 1789249512,
    signature: { checksum: "x", properties: ["transaction.id"] },
    data: {
      transaction: {
        id: "12116973-1789249512-60107",
        reference: "tx-1",
        status: "APPROVED",
        amount_in_cents: 10710000,
        currency: "COP",
        ...extra,
      },
    },
  });

  it("conserva payment_method_type cuando Wompi lo manda", () => {
    const r = wompiEventSchema.safeParse(evento({ payment_method_type: "CARD" }));
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.data.transaction.payment_method_type, "Zod volvió a eliminar el instrumento").toBe("CARD");
  });

  it("y un evento SIN él sigue siendo válido: no puede impedir sellar el pago", () => {
    // El pago del paciente es lo que no se puede perder. El instrumento es informativo.
    expect(wompiEventSchema.safeParse(evento()).success).toBe(true);
  });
});
