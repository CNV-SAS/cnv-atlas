import { describe, expect, it } from "vitest";

import {
  avisoDelCambioDeModalidad,
  inicioDelSiguienteCorte,
  modalidadEnLaFecha,
} from "@/modules/payments/modalidad";

// ═══ EL CAMBIO DE MODALIDAD ENTRA AL SIGUIENTE CORTE (2026-09-25) ═══
//
// La regla es del modelo comercial §2 y su razon es la que hay que proteger: "el periodo en curso se cierra
// bajo la modalidad anterior, PARA NO PARTIR UNA LIQUIDACION EN DOS REGIMENES".
//
// Lo que este candado vigila de verdad es la parte que se puede equivocar sin que se note: que el corte que
// manda es el de la modalidad QUE SE VA, no el de la que llega.

describe("el inicio del siguiente corte", () => {
  it("en comision es el dia 1 del mes que viene, porque su liquidacion es mensual", () => {
    expect(inicioDelSiguienteCorte("2026-09-08", "comision")).toBe("2026-10-01");
    expect(inicioDelSiguienteCorte("2026-09-01", "comision")).toBe("2026-10-01");
    expect(inicioDelSiguienteCorte("2026-09-30", "comision")).toBe("2026-10-01");
  });

  it("en distribucion es el 16 o el 1, porque su corte es quincenal", () => {
    expect(inicioDelSiguienteCorte("2026-09-08", "distribucion")).toBe("2026-09-16");
    expect(inicioDelSiguienteCorte("2026-09-15", "distribucion")).toBe("2026-09-16");
    expect(inicioDelSiguienteCorte("2026-09-16", "distribucion")).toBe("2026-10-01");
    expect(inicioDelSiguienteCorte("2026-09-28", "distribucion")).toBe("2026-10-01");
  });

  it("cruza el año sin inventar un mes 13", () => {
    expect(inicioDelSiguienteCorte("2026-12-20", "comision")).toBe("2027-01-01");
    expect(inicioDelSiguienteCorte("2026-12-03", "distribucion")).toBe("2026-12-16");
    expect(inicioDelSiguienteCorte("2026-12-31", "distribucion")).toBe("2027-01-01");
  });

  it("MANDA EL CORTE DE LA MODALIDAD QUE SE VA, no el de la que llega", () => {
    // Un integrante en Comision que pasa a Distribucion el 8 de septiembre: su periodo en curso es septiembre
    // COMPLETO (corte mensual), asi que el cambio entra el 1 de octubre. Tomar el corte de la modalidad nueva
    // daria el 16 de septiembre y partiria la liquidacion mensual de septiembre en dos regimenes, que es
    // exactamente lo que la regla prohibe.
    const { rigeDesde } = avisoDelCambioDeModalidad("2026-09-08", "comision", "distribucion");
    expect(rigeDesde).toBe("2026-10-01");
    expect(rigeDesde).not.toBe("2026-09-16");

    // Y al revés: quien está en Distribución cierra su quincena, no el mes.
    expect(avisoDelCambioDeModalidad("2026-09-08", "distribucion", "comision").rigeDesde).toBe("2026-09-16");
  });

  it("el aviso explica que hoy no pasa nada, porque si no se lee como que el boton fallo", () => {
    const { aviso } = avisoDelCambioDeModalidad("2026-09-08", "comision", "distribucion");
    expect(aviso).toContain("2026-10-01");
    expect(aviso).toContain("Comisión"); // bajo cual se liquida lo ya vendido
    expect(aviso).toContain("Distribución");
  });
});

describe("la modalidad que regia en una fecha", () => {
  const vigencias = [
    { modality: "comision" as const, validFrom: "2026-01-01", validTo: "2026-09-30" },
    { modality: "distribucion" as const, validFrom: "2026-10-01", validTo: null },
  ];

  it("una venta vieja sigue siendo del regimen viejo: el cambio NO reescribe el pasado", () => {
    expect(modalidadEnLaFecha(vigencias, "2026-09-29")).toBe("comision");
    expect(modalidadEnLaFecha(vigencias, "2026-09-30")).toBe("comision");
    expect(modalidadEnLaFecha(vigencias, "2026-10-01")).toBe("distribucion");
    expect(modalidadEnLaFecha(vigencias, "2026-11-15")).toBe("distribucion");
  });

  it("sin ninguna vigencia es comision, que es lo que todos son hoy", () => {
    // Asi ningun integrante existente necesita backfill, y el cambio no toca lo ya vendido.
    expect(modalidadEnLaFecha([], "2026-09-25")).toBe("comision");
  });

  it("antes de la primera vigencia tambien es comision", () => {
    expect(modalidadEnLaFecha(vigencias, "2025-12-31")).toBe("comision");
  });

  it("no depende del orden en que vengan las filas", () => {
    // Un lector que olvide el ORDER BY no puede cambiar la respuesta.
    const alReves = [...vigencias].reverse();
    expect(modalidadEnLaFecha(alReves, "2026-09-29")).toBe("comision");
    expect(modalidadEnLaFecha(alReves, "2026-10-02")).toBe("distribucion");
  });
});
