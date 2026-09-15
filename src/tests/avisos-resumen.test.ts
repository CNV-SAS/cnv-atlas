import { describe, expect, it } from "vitest";

import { armarResumen, clave, limiteDe, type Pendiente } from "@/modules/avisos/resumen";

// ═══ EL RESUMEN DE AVISOS (Bloque A): las reglas de Santiago del 2026-09-15, con fechas fijas ═══

const ENLACE = "https://atlas.cnvsystem.com/pagos";

const p = (over: Partial<Pendiente> = {}): Pendiente => ({
  tipo: "sin_documento",
  transactionId: "t-1",
  desde: "2026-09-14T15:00:00Z", // lunes 14, 10 a. m. de Bogota
  monto: "107100",
  productos: "MULTI-CELL BASE x1",
  causa: "Falló: falta el tipo de persona del cliente",
  enGestionHasta: null,
  enGestionNota: null,
  enGestionPor: null,
  ...over,
});

// 7 a. m. y 5 p. m. de Bogota, en UTC.
const am = (dia: string) => new Date(`${dia}T12:00:00Z`);
const pm = (dia: string) => new Date(`${dia}T22:00:00Z`);

describe("los plazos de cada tipo", () => {
  it("sin documento: el cierre de su dia; revision: 5 dias habiles; nota credito: 5 dias habiles", () => {
    expect(limiteDe(p())).toBe("2026-09-14");
    expect(limiteDe(p({ tipo: "revision" }))).toBe("2026-09-21");
    expect(limiteDe(p({ tipo: "nota_credito" }))).toBe("2026-09-21");
  });

  it("una venta de las 9 p. m. de Bogota es de su dia, no del siguiente en UTC", () => {
    expect(limiteDe(p({ desde: "2026-09-15T02:00:00Z" }))).toBe("2026-09-14");
  });
});

describe("cuando se envia y cuando no", () => {
  it("SIN NADA PENDIENTE no llega correo", () => {
    const r = armarResumen({ pendientes: [], anteriores: [], ahora: am("2026-09-15"), franja: "am", enlace: ENLACE });
    expect(r.enviar).toBe(false);
    expect(r.motivoSiNo).toBe("Nada pendiente.");
  });

  it("lo NUEVO se envia, y va primero con su titulo", () => {
    const r = armarResumen({ pendientes: [p({ tipo: "revision", causa: "Falta la versión del Integrante" })], anteriores: [], ahora: am("2026-09-15"), franja: "am", enlace: ENLACE });
    expect(r.enviar).toBe(true);
    expect(r.conteo.nuevos).toBe(1);
    expect(r.asunto).toContain("1 nueva");
    expect(r.cuerpo).toContain("── NUEVO ──");
    expect(r.cuerpo).toContain("lleva 1 día");
  });

  it("LO QUE YA ESTABA sigue, con sus dias; lo vencido sube de tono y va a escalamiento", () => {
    const revision = p({ tipo: "revision", transactionId: "r-1", causa: "Falta la versión del Integrante" });
    const sinDoc = p({ transactionId: "s-1" }); // vence el 14
    const r = armarResumen({
      pendientes: [revision, sinDoc],
      anteriores: [clave(revision), clave(sinDoc)],
      ahora: am("2026-09-16"),
      franja: "am",
      enlace: ENLACE,
    });
    expect(r.conteo).toMatchObject({ nuevos: 0, siguen: 1, vencidos: 1 });
    expect(r.asunto).toContain("1 vencida");
    expect(r.cuerpo.indexOf("VENCIDO")).toBeLessThan(r.cuerpo.indexOf("SIGUE PENDIENTE"));
    expect(r.cuerpo).toContain("venció el 14/9/2026");
    expect(r.escalamiento.enviar).toBe(true);
    expect(r.escalamiento.cuerpo).toContain("MULTI-CELL BASE x1");
    expect(r.escalamiento.cuerpo).not.toContain("Pagos en revisión");
  });

  it("EN GESTION HASTA saca del correo; con todo en gestion y nada vencido, NO llega correo", () => {
    const revision = p({ tipo: "revision", enGestionHasta: "2026-09-18", enGestionNota: "Llamé al Integrante", enGestionPor: "Santiago" });
    const r = armarResumen({ pendientes: [revision], anteriores: [clave(revision)], ahora: am("2026-09-16"), franja: "am", enlace: ENLACE });
    expect(r.enviar).toBe(false);
    expect(r.motivoSiNo).toContain("en gestión");
    expect(r.claves, "lo que esta en gestion igual cuenta como visto").toEqual([clave(revision)]);
  });

  it("CONTROL: pasada su fecha de gestion, vuelve", () => {
    const revision = p({ tipo: "revision", enGestionHasta: "2026-09-16" });
    const r = armarResumen({ pendientes: [revision], anteriores: [clave(revision)], ahora: am("2026-09-17"), franja: "am", enlace: ENLACE });
    expect(r.enviar).toBe(true);
    expect(r.conteo.siguen).toBe(1);
  });

  it("un VENCIDO vuelve aunque este en gestion: el plazo gana", () => {
    const nc = p({ tipo: "nota_credito", enGestionHasta: "2026-12-31" });
    const r = armarResumen({ pendientes: [nc], anteriores: [clave(nc)], ahora: am("2026-09-22"), franja: "am", enlace: ENLACE });
    expect(r.conteo.vencidos).toBe(1);
    expect(r.enviar).toBe(true);
  });

  it("LA TARDE solo manda lo nuevo desde la manana y lo sin documento de HOY", () => {
    const deAyer = p({ tipo: "revision", transactionId: "r-ayer" });
    const tarde = armarResumen({ pendientes: [deAyer], anteriores: [clave(deAyer)], ahora: pm("2026-09-15"), franja: "pm", enlace: ENLACE });
    expect(tarde.enviar, "repetiria lo de la manana").toBe(false);

    const deHoy = p({ transactionId: "s-hoy", desde: "2026-09-15T15:00:00Z" });
    const conHoy = armarResumen({ pendientes: [deHoy], anteriores: [clave(deHoy)], ahora: pm("2026-09-15"), franja: "pm", enlace: ENLACE });
    expect(conHoy.enviar).toBe(true);
    expect(conHoy.cuerpo).toContain("vence al cierre de hoy");
    expect(conHoy.escalamiento.enviar, "el escalamiento sale solo en la manana").toBe(false);
  });
});

describe("agrupado por causa", () => {
  it("doce fallos del mismo motivo son UNA linea con su numero, y se listan cinco", () => {
    const doce = Array.from({ length: 12 }, (_, i) => p({ transactionId: `t-${i}`, desde: "2026-09-15T15:00:00Z" }));
    const r = armarResumen({ pendientes: doce, anteriores: [], ahora: am("2026-09-15"), franja: "am", enlace: ENLACE });
    expect(r.cuerpo.match(/Ventas cobradas sin factura/g)).toHaveLength(1);
    expect(r.cuerpo).toContain("12 ventas: Falló: falta el tipo de persona del cliente");
    expect(r.cuerpo).toContain("y 7 más con la misma causa");
  });

  it("CONTROL: dos causas distintas son dos lineas", () => {
    const r = armarResumen({
      pendientes: [p({ transactionId: "a", desde: "2026-09-15T15:00:00Z" }), p({ transactionId: "b", causa: "Sin ítem en Alegra: LUVIA", desde: "2026-09-15T15:00:00Z" })],
      anteriores: [],
      ahora: am("2026-09-15"),
      franja: "am",
      enlace: ENLACE,
    });
    expect(r.cuerpo.match(/Ventas cobradas sin factura/g)).toHaveLength(2);
  });
});
