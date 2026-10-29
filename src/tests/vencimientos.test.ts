import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DIAS_DE_ALERTA_POR_DEFECTO,
  clasificar,
  diasEntre,
  lotesQueAlertar,
  quienAsumeElVencido,
  textoDelPlazo,
  type LoteEnCustodia,
} from "@/modules/nutraceuticals/vencimientos";

// CANDADO DE LOS VENCIMIENTOS (2026-09-28). Las dos frases del modelo comercial, probadas con fechas fijas:
// la alerta a 60 dias, y que el REGISTRO de la alerta es lo que determina quien asume el vencido.

const lote = (o: Partial<LoteEnCustodia> = {}): LoteEnCustodia => ({
  lotId: "l1",
  codigo: "L-001",
  nutraceuticalId: "n1",
  producto: "MULTICELL BASE",
  vence: "2026-12-31",
  unidades: 3,
  ...o,
});

describe("la ventana de alerta", () => {
  it("son los sesenta dias del modelo", () => {
    expect(DIAS_DE_ALERTA_POR_DEFECTO).toBe(60);
  });

  it("un lote fuera de la ventana esta vigente", () => {
    expect(clasificar("2026-12-31", "2026-10-01", 60)).toEqual({ estado: "vigente", diasRestantes: 91 });
  });

  it("entra a la ventana el dia exacto del umbral", () => {
    // 60 dias antes: ya alerta. 61: todavia no.
    expect(clasificar("2026-12-31", "2026-11-01", 60).estado).toBe("por_vencer");
    expect(clasificar("2026-12-31", "2026-10-31", 60).estado).toBe("vigente");
  });

  // EL DIA DEL VENCIMIENTO TODAVIA SE VENDE. Es la lectura literal del envase, y tomarlo como vencido le
  // quitaria a CNV un dia de venta por una convencion nuestra.
  it("el dia del vencimiento NO esta vencido", () => {
    expect(clasificar("2026-12-31", "2026-12-31", 60)).toEqual({ estado: "por_vencer", diasRestantes: 0 });
    expect(textoDelPlazo(clasificar("2026-12-31", "2026-12-31", 60))).toBe("vence hoy");
  });

  it("al dia siguiente si", () => {
    const c = clasificar("2026-12-31", "2027-01-01", 60);
    expect(c).toEqual({ estado: "vencido", diasRestantes: -1 });
    expect(textoDelPlazo(c)).toBe("venció hace 1 día");
  });

  it("la ventana es configurable, no fija en el codigo", () => {
    expect(clasificar("2026-12-31", "2026-10-01", 120).estado).toBe("por_vencer");
  });

  it("cuenta dias aunque cambie el mes y el año", () => {
    expect(diasEntre("2026-12-31", "2027-01-01")).toBe(1);
    expect(diasEntre("2026-02-28", "2026-03-01")).toBe(1); // 2026 no es bisiesto
  });
});

describe("los lotes que hay que alertar", () => {
  it("deja fuera los vigentes y los de saldo cero", () => {
    const r = lotesQueAlertar(
      [
        lote({ lotId: "vigente", vence: "2027-06-30" }),
        lote({ lotId: "sin-saldo", vence: "2026-10-05", unidades: 0 }),
        lote({ lotId: "por-vencer", vence: "2026-10-20" }),
        lote({ lotId: "vencido", vence: "2026-09-01" }),
      ],
      "2026-09-28",
      60,
    );
    expect(r.map((l) => l.lotId)).toEqual(["vencido", "por-vencer"]);
  });

  // EL MISMO ORDEN QUE EL DESPACHO (FEFO): lo que primero vence, primero se avisa y primero sale.
  it("ordena por vencimiento, lo mas urgente primero", () => {
    const r = lotesQueAlertar(
      [lote({ lotId: "b", vence: "2026-10-30" }), lote({ lotId: "a", vence: "2026-10-01" })],
      "2026-09-28",
      60,
    );
    expect(r.map((l) => l.lotId)).toEqual(["a", "b"]);
  });
});

describe("quien asume el vencido", () => {
  // LA REGLA POR DEFECTO ES QUE LO ASUME CNV, porque conserva la propiedad. El cargo al Integrante es la
  // EXCEPCION, y solo la abre el registro de la alerta.
  it("sin alerta lo asume CNV", () => {
    const p = quienAsumeElVencido({ vence: "2026-09-20", alerta: null });
    expect(p.asume).toBe("cnv");
    expect(p.diasQueTuvo).toBeNull();
    expect(p.razon).toContain("conserva la propiedad");
  });

  it("con alerta vista y unidades sin vender, lo asume el Integrante", () => {
    const p = quienAsumeElVencido({
      vence: "2026-09-20",
      alerta: { generadaEl: "2026-07-22", diasDeAnticipacion: 60, vistaEl: "2026-07-23" },
    });
    expect(p.asume).toBe("integrante");
    expect(p.diasQueTuvo).toBe(60);
    expect(p.alertaTardia).toBe(false);
    expect(p.razon).toContain("2026-07-23");
    expect(p.razon).toContain("precio de facturación");
  });

  // NO HABERLA VISTO NO EXIME, pero SE DICE: el modelo pide registrar si se vio, y es lo primero que el
  // Integrante va a alegar. La propuesta sale con ese hecho a la vista para que una persona lo pese.
  it("sin marcarla vista sigue siendo del Integrante, y la razon lo dice", () => {
    const p = quienAsumeElVencido({
      vence: "2026-09-20",
      alerta: { generadaEl: "2026-07-22", diasDeAnticipacion: 60, vistaEl: null },
    });
    expect(p.asume).toBe("integrante");
    expect(p.razon).toContain("NO la marcó vista");
  });

  // EL CASO DE BORDE QUE EL MODELO NO CUBRE: la alerta existio, pero con menos dias de los que promete,
  // porque el lote llego a su vitrina cuando ya le quedaba poco. No se resuelve solo: se marca.
  it("marca la alerta tardia en vez de decidirla sola", () => {
    const p = quienAsumeElVencido({
      vence: "2026-09-20",
      alerta: { generadaEl: "2026-09-09", diasDeAnticipacion: 60, vistaEl: "2026-09-09" },
    });
    expect(p.asume).toBe("integrante");
    expect(p.diasQueTuvo).toBe(11);
    expect(p.alertaTardia).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL PRODUCTO DE PRUEBA NO GENERA AVISO (Santiago, 2026-10-28)
//
// Reporto que el correo de lotes seguia llegando con DOCE lineas de "PRUEBA SMOKE BLOQUE 3". Medido contra
// produccion: las DOCE filas de `lot_expiry_alerts` que existen son productos de prueba, y 25 de las 66
// lineas de inventario con stock tambien. O sea que el correo era ruido al 100%, y un correo que es todo
// ruido se deja de leer, con lo que el primer lote REAL que venza pasa de largo.
//
// ESTE CANDADO MIRA EL SQL porque la regla vive en tres consultas y lo que hay que vigilar es una AUSENCIA:
// la cuarta consulta que alguien escriba. Es el mismo motivo del barrido de "paciente de prueba".
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("el aviso de vencimiento no habla de productos de prueba", () => {
  const REPO = readFileSync("src/modules/nutraceuticals/data/vencimientos-repository.ts", "utf8");

  it("las TRES lecturas que alimentan un aviso lo filtran", () => {
    // Dos de alertas abiertas (la del Integrante y la de CNV) comparten el fragmento, y el origen
    // (`custodiasConLotes`) lo lleva inline por estar dentro de su propio `where`.
    expect(REPO).toContain("const SIN_PRODUCTOS_DE_PRUEBA");
    expect(
      (REPO.match(/\$\{SIN_PRODUCTOS_DE_PRUEBA\}/g) ?? []).length,
      "una de las dos lecturas de alertas abiertas se quedo sin el filtro",
    ).toBe(2);
    expect(
      (REPO.match(/coalesce\(n\.is_test, false\) = false/g) ?? []).length,
      "el filtro de origen (custodiasConLotes) desaparecio",
    ).toBeGreaterThanOrEqual(2);
  });

  it("filtra el PRODUCTO, no la ubicacion ni el profesional", () => {
    // Si un profesional marcado de prueba tiene producto REAL en su vitrina, esas unidades son de CNV y SI
    // hay que recogerlas. La marca de prueba saca de las CIFRAS lo que no es operacion real; no convierte
    // en irreal un frasco que existe.
    expect(REPO, "se filtro por la ubicacion o por el profesional, no por el producto").not.toMatch(
      /and coalesce\((loc|pp|p)\.is_test, false\) = false/,
    );
  });

  it("y las filas YA ESCRITAS no se borran", () => {
    // Son el registro de que ese dia se aviso, y con el la cuenta de cuantos dias tuvo el Integrante para
    // actuar, que es justo lo que se le puede discutir. Lo que se deja de MOSTRAR es la alerta abierta.
    // El UNICO borrado de esta tabla sigue siendo el de una alerta cuyo correo no salio, por id y solo si
    // nadie la vio (`borrarAlertaNoEntregada`). Un borrado en bloque por `is_test` seria otra cosa.
    const borrados = REPO.match(/delete\s+from\s+lot_expiry_alerts[^`]*/gi) ?? [];
    expect(borrados.length, "aparecio un segundo borrado de alertas").toBe(1);
    expect(borrados[0]).toContain("seen_at is null");
    expect(borrados[0], "se borran alertas por ser de un producto de prueba").not.toContain("is_test");
  });
});
