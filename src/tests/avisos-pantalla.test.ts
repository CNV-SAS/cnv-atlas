import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppRole, CurrentUser } from "@/modules/auth/roles";
import { canAtenderPendientesVentas } from "@/modules/avisos/policies/can-atender-pendientes";
import { pendientesVisibles, type Pendiente } from "@/modules/avisos/resumen";

// ═══ LO QUE LA PANTALLA HACE CON LOS AVISOS (Bloque A) ═══

const usuario = (roles: AppRole[]): CurrentUser => ({
  id: "u1",
  email: "u@x.co",
  fullName: "U",
  organizationId: "org",
  status: "active",
  roles,
});

describe("quien atiende los pendientes de ventas", () => {
  it("admin, direccion y soporte; un profesional no", () => {
    expect(canAtenderPendientesVentas(usuario(["admin"]))).toBe(true);
    expect(canAtenderPendientesVentas(usuario(["direccion"]))).toBe(true);
    expect(canAtenderPendientesVentas(usuario(["soporte"]))).toBe(true);
    expect(canAtenderPendientesVentas(usuario(["professional"]))).toBe(false);
  });
});

describe("la franja cuenta con la misma regla que el correo", () => {
  const p = (over: Partial<Pendiente>): Pendiente => ({
    tipo: "sin_documento",
    transactionId: "t",
    desde: "2026-09-15T15:00:00Z",
    monto: "1",
    productos: "",
    causa: "c",
    enGestionHasta: null,
    enGestionNota: null,
    enGestionPor: null,
    ...over,
  });
  it("lo que esta en gestion no suma; un vencido suma aunque lo este", () => {
    const hoy = new Date("2026-09-15T16:00:00Z");
    const r = pendientesVisibles(
      [
        p({ transactionId: "a" }),
        p({ transactionId: "b", tipo: "revision", enGestionHasta: "2026-09-18" }),
        p({ transactionId: "c", desde: "2026-09-10T15:00:00Z", enGestionHasta: "2026-12-31" }),
      ],
      hoy,
    );
    expect(r).toEqual({ total: 2, vencidos: 1 });
  });
});

// ── las acciones ──
vi.mock("@/lib/observability/report-error", () => ({ reportServerError: vi.fn() }));
const actual = { roles: ["soporte"] as AppRole[] };
vi.mock("@/modules/auth/session", () => ({ getCurrentUser: vi.fn(async () => usuario(actual.roles)) }));
vi.mock("@/modules/avisos/data/avisos-repository", () => ({
  registrarEnGestion: vi.fn(),
  ponerMarca: vi.fn(),
  quitarMarca: vi.fn(),
  hayQuienRecibaPendientes: vi.fn(async () => false),
}));

describe("las acciones de avisos", () => {
  beforeEach(() => vi.clearAllMocks());
  const fd = (o: Record<string, string>) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  };

  it("soporte marca en gestion; una fecha pasada se rechaza", async () => {
    const { marcarEnGestionFormAction } = await import("@/modules/avisos/actions");
    const repo = await import("@/modules/avisos/data/avisos-repository");
    const base = { tipo: "sin_documento", transactionId: "11111111-1111-4111-8111-111111111111", nota: "Esperando a contabilidad" };
    const pasada = await marcarEnGestionFormAction({ error: null, success: null, warning: null }, fd({ ...base, hasta: "2020-01-01" }));
    expect(pasada.error).toMatch(/anterior a hoy/);
    const ok = await marcarEnGestionFormAction({ error: null, success: null, warning: null }, fd({ ...base, hasta: "2099-01-01" }));
    expect(ok.success).toMatch(/en gestión/);
    expect(repo.registrarEnGestion).toHaveBeenCalledTimes(1);
  });

  it("la marca la cambia SOLO el administrador, y avisa si nadie queda recibiendo", async () => {
    const { cambiarMarcaFormAction } = await import("@/modules/avisos/actions");
    const datos = fd({ profileId: "11111111-1111-4111-8111-111111111111", tipo: "pendientes_ventas", poner: "no" });
    actual.roles = ["direccion"];
    expect((await cambiarMarcaFormAction({ error: null, success: null, warning: null }, datos)).error).toMatch(/Solo el administrador/);
    actual.roles = ["admin"];
    const r = await cambiarMarcaFormAction({ error: null, success: null, warning: null }, datos);
    expect(r.warning).toMatch(/NADIE recibe/);
  });
});
