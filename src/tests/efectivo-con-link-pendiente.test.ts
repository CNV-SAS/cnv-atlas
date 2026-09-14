import { beforeEach, describe, expect, it, vi } from "vitest";

// ═══ COBRAR EN EFECTIVO CON UN LINK PENDIENTE DEL MISMO PRODUCTO (decision (b), 2026-09-14) ═══
//
// La accion no registra la venta mientras el paciente tenga un link pendiente con el mismo producto: avisa, y
// solo con "Anular el link y cobrar en efectivo" la registra, pidiendo al servicio que anule el link en la
// misma transaccion. Que la anulacion y las unidades funcionen se prueba contra base real
// (venta-anulacion-y-revision-db). Aqui, la puerta.

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/observability/report-error", () => ({ reportServerError: vi.fn() }));
vi.mock("@/modules/auth/session", () => ({
  getCurrentUser: vi.fn(async () => ({
    id: "u1",
    email: "p@x.co",
    fullName: "P",
    organizationId: "org-1",
    status: "active",
    roles: ["professional"],
  })),
}));
vi.mock("@/modules/payments/data/payments-repository", () => ({
  findLivePendingDuplicate: vi.fn(),
  findRecentCashSaleDuplicate: vi.fn(async () => null),
  getVentaVisible: vi.fn(),
}));
vi.mock("@/modules/payments/services/facturacion-service", () => ({ reintentarFacturasPendientes: vi.fn() }));
vi.mock("@/modules/payments/services/inventario-venta-service", () => ({ reintentarDescuentosPendientes: vi.fn() }));
vi.mock("@/modules/payments/services/payments-service", () => ({
  CheckoutError: class CheckoutError extends Error {},
  VentaError: class VentaError extends Error {},
  anularLink: vi.fn(),
  createCheckout: vi.fn(),
  linksPendientesQueBloquean: vi.fn(),
  registerCashSale: vi.fn(async () => ({ transactionId: "cash-1", amount: 107100, linksAnulados: 1 })),
}));

const { registerCashSaleFormAction } = await import("@/modules/payments/actions");
const servicio = await import("@/modules/payments/services/payments-service");

const PACIENTE = "22222222-2222-4222-8222-222222222222";
const PRODUCTO = "44444444-4444-4444-8444-444444444444";
const vacio = { error: null, success: null, duplicateWarning: null, pendingLinkWarning: null };

function formulario(extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("patientId", PACIENTE);
  fd.set("lineas", JSON.stringify([{ nutraceuticalId: PRODUCTO, quantity: "1" }]));
  fd.set("idempotencyKey", "55555555-5555-4555-8555-555555555555");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe("efectivo con un link pendiente del mismo producto", () => {
  beforeEach(() => vi.clearAllMocks());

  it("AVISA y NO registra la venta", async () => {
    vi.mocked(servicio.linksPendientesQueBloquean).mockResolvedValue([
      { id: "link-1", amount: "107100", createdAt: new Date().toISOString(), productos: "MULTI-CELL BASE x1" },
    ]);
    const r = await registerCashSaleFormAction(vacio, formulario());
    expect(r.pendingLinkWarning).toMatch(/link de pago sin pagar.*MULTI-CELL BASE x1.*Atlas lo anula/);
    expect(servicio.registerCashSale).not.toHaveBeenCalled();
  });

  it("con 'Anular el link y cobrar' registra la venta y le pide al servicio que anule", async () => {
    const r = await registerCashSaleFormAction(vacio, formulario({ anularLinks: "true" }));
    expect(servicio.registerCashSale).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: PACIENTE }),
      expect.anything(),
      expect.any(String),
      { anularLinksQueComparten: true },
    );
    expect(r.success).toMatch(/Se anuló el link de pago pendiente/);
  });

  it("CONTROL: sin link pendiente registra sin anular nada", async () => {
    vi.mocked(servicio.linksPendientesQueBloquean).mockResolvedValue([]);
    const r = await registerCashSaleFormAction(vacio, formulario());
    expect(servicio.registerCashSale).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.any(String),
      { anularLinksQueComparten: false },
    );
    expect(r.error).toBeNull();
  });
});
