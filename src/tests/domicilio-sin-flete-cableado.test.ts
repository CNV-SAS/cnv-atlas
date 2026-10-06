import { beforeEach, describe, expect, it, vi } from "vitest";

// ═══ EL CABLEADO DEL DOMICILIO, DESPUES DE QUITARLE EL FLETE (2026-10-05) ═══
//
// QUE VIGILA, y por que no basta con el barrido de `domicilio.test.ts`: ese comprueba que el flete no haya
// vuelto. Esto comprueba lo contrario, que es el otro modo de romperse: que lo que SI tiene que viajar siga
// viajando. El bloque de pantalla se reescribio entero, y un campo renombrado en el formulario sin
// renombrarlo en la accion **no lo ve nadie**: el envio se cobra igual y llega sin direccion o sin telefono.
//
// ES LA FAMILIA DEL HAZARD 5 DE CLAUDE.md (el `name` del boton que no viaja en `new FormData(form)`): un dato
// que deja de llegar al servidor sin un solo error por ninguna parte.
//
// EL PRIMER ARGUMENTO es la entrada ya validada (`registerCashSale(sale, user, ...)`).
//
// SE PRUEBA EN LA ACCION Y NO EN EL SERVICIO a proposito: la accion es la frontera donde el FormData se
// traduce a la entrada del servicio, y es justo ahi donde un nombre de campo se desalinea.

vi.mock("server-only", () => ({}));
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
  findLivePendingDuplicate: vi.fn(async () => null),
  findRecentCashSaleDuplicate: vi.fn(async () => null),
  getProfessionalProfileIdByUser: vi.fn(),
  getVentaVisible: vi.fn(),
}));
vi.mock("@/modules/payments/services/facturacion-service", () => ({ reintentarFacturasPendientes: vi.fn() }));
vi.mock("@/modules/payments/services/inventario-venta-service", () => ({ reintentarDescuentosPendientes: vi.fn() }));
vi.mock("@/modules/payments/services/payments-service", () => ({
  CheckoutError: class CheckoutError extends Error {},
  VentaError: class VentaError extends Error {},
  anularLink: vi.fn(),
  createCheckout: vi.fn(async () => ({ transactionId: "tx-1", checkoutUrl: "https://x" })),
  entregarVenta: vi.fn(),
  linksPendientesQueBloquean: vi.fn(async () => []),
  registerCashSale: vi.fn(async () => ({ transactionId: "cash-1", amount: 107100, linksAnulados: 0 })),
}));

const { registerCashSaleFormAction } = await import("@/modules/payments/actions");
const servicio = await import("@/modules/payments/services/payments-service");

const PACIENTE = "22222222-2222-4222-8222-222222222222";
const PRODUCTO = "44444444-4444-4444-8444-444444444444";
const vacio = { error: null, success: null, duplicateWarning: null, pendingLinkWarning: null, outOfPlanWarning: null };

function formulario(extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("patientId", PACIENTE);
  fd.set("lineas", JSON.stringify([{ nutraceuticalId: PRODUCTO, quantity: "1" }]));
  fd.set("idempotencyKey", "55555555-5555-4555-8555-555555555555");
  fd.set("ventaSueltaMotivo", "Compra suelta del smoke");
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

const CAMPOS_DEL_ENVIO = {
  aDomicilio: "true",
  ciudadDestino: "Leticia",
  departamentoDestino: "Amazonas",
  direccionEntrega: "Calle 8 # 9-10, barrio Centro",
  celularEntrega: "3001234567",
};

describe("el domicilio del formulario llega completo a la venta", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sin la casilla marcada no viaja ningun domicilio", async () => {
    await registerCashSaleFormAction(vacio, formulario());
    const input = vi.mocked(servicio.registerCashSale).mock.calls[0]?.[0];
    expect(input?.domicilio).toBeUndefined();
  });

  it("con la casilla marcada viajan ciudad, departamento, direccion y celular", async () => {
    await registerCashSaleFormAction(vacio, formulario(CAMPOS_DEL_ENVIO));
    const input = vi.mocked(servicio.registerCashSale).mock.calls[0]?.[0];
    expect(input?.domicilio).toEqual({
      ciudad: "Leticia",
      departamento: "Amazonas",
      direccion: "Calle 8 # 9-10, barrio Centro",
      celular: "3001234567",
    });
  });

  // LA CIUDAD ES LIBRE, y "Leticia" lo demuestra: era el ejemplo del modelo §5.5 de un destino SIN cobertura,
  // que antes se rechazaba. Sin flete no hay destino que le cueste dinero a CNV.
  it("una ciudad que antes no tenia cobertura ya no se rechaza", async () => {
    const r = await registerCashSaleFormAction(vacio, formulario(CAMPOS_DEL_ENVIO));
    expect(r.error).toBeNull();
  });

  // EL CELULAR VACIO NO ES UN ERROR DE LA PANTALLA: significa "usa el que el paciente registro en la
  // encuesta", y quien lo resuelve es el servidor. Lo que no puede es viajar como cadena vacia, porque
  // entonces el servidor la tomaria por un numero tecleado y sellaria un envio sin telefono.
  it("el celular vacio viaja como ausente, no como cadena vacia", async () => {
    await registerCashSaleFormAction(vacio, formulario({ ...CAMPOS_DEL_ENVIO, celularEntrega: "   " }));
    const input = vi.mocked(servicio.registerCashSale).mock.calls[0]?.[0];
    expect(input?.domicilio?.celular).toBeUndefined();
  });

  // NINGUNA CIFRA DEL ENVIO VIAJA. Si alguien volviera a poner un campo de costo en el formulario, esto lo
  // atrapa: la entrada del servicio no tiene donde recibirlo.
  it("no viaja ninguna cifra del envio, aunque el formulario traiga una", async () => {
    await registerCashSaleFormAction(
      vacio,
      formulario({ ...CAMPOS_DEL_ENVIO, costoDelDomiciliario: "14.000" }),
    );
    const input = vi.mocked(servicio.registerCashSale).mock.calls[0]?.[0];
    expect(JSON.stringify(input?.domicilio)).not.toMatch(/14000|14\.000|costo/i);
  });
});
