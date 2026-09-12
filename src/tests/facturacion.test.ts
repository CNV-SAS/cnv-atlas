import { describe, expect, it } from "vitest";

import {
  armarFactura,
  centroDeCosto,
  cuentaDelPago,
  desgloseDeLaVenta,
  type LineaDeVenta,
  type MapaDeAlegra,
} from "@/modules/payments/facturacion";

// ═══ LO QUE SE RECHAZA ANTES DE LLAMAR A ALEGRA ═══
//
// Todo lo que este archivo prueba tiene la MISMA forma, y por eso vale la pena decirlo una vez: son cosas
// que Alegra ACEPTARIA. No hay error, no hay excepcion, no hay reintento. Sale un documento valido y
// equivocado, y se descubre semanas despues.
//
// Lo que falla en voz alta no necesita validacion previa. Esto si.

const MAPA: MapaDeAlegra = {
  env: "sandbox",
  ivaTaxId: "4",
  invoiceTemplateId: "16",
  creditNoteTemplateId: "17",
  costCenterPropioId: "1",
  costCenterTerceroId: "2",
  bankAccountEfectivoId: "5",
  bankAccountPasarelaId: "6",
};

const linea = (over: Partial<LineaDeVenta> = {}): LineaDeVenta => ({
  nutraceuticalId: "n-1",
  nombre: "MULTICELL BASE",
  cantidad: 1,
  precioUnitario: 107100,
  alegraItemId: "5",
  alegraEnv: "sandbox",
  ownership: "propio",
  ...over,
});

describe("la venta de VARIOS productos, que es el caso que nunca se ejerció", () => {
  it("tres productos distintos dan TRES líneas, cada una con su ítem y su cantidad", () => {
    // Hasta hoy toda factura llevaba UN item generico con cantidad 1 y el total como precio: el total
    // cuadraba y el documento no decia que se habia vendido. Es el caso mas comun en una consulta real.
    const r = armarFactura(
      [
        linea({ nombre: "MULTICELL BASE", alegraItemId: "5", cantidad: 2 }),
        linea({ nombre: "OMEGA COMPLEX", alegraItemId: "6", cantidad: 1 }),
        linea({ nombre: "D3-K2 OSTEO", alegraItemId: "3", cantidad: 3, precioUnitario: 166600 }),
      ],
      MAPA,
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lineas).toHaveLength(3);
    expect(r.lineas.map((l) => [l.id, l.quantity, l.price])).toEqual([
      [5, 2, 90000],
      [6, 1, 90000],
      [3, 3, 140000],
    ]);
    // Y todas con su impuesto: es lo unico que impide que la factura salga al 0%.
    expect(r.lineas.every((l) => l.tax[0]?.id === 4)).toBe(true);
  });

  it("el precio que viaja es la BASE unitaria, no el PVP ni el total de la línea", () => {
    // Mandar el PVP facturaria IVA sobre IVA; mandar el total de la linea y ademas la cantidad,
    // multiplicaria dos veces. Los dos cuadran en apariencia y ninguno de los dos falla.
    const r = armarFactura([linea({ cantidad: 4 })], MAPA);
    expect(r.ok && r.lineas[0].price).toBe(90000);
    expect(r.ok && r.lineas[0].quantity).toBe(4);
  });
});

describe("lo que NO se emite, y el motivo dice por qué", () => {
  it("un producto sin ítem en Alegra bloquea la factura entera", () => {
    // Con el item generico como respaldo, esa linea diria "PRUEBA" donde deberia decir el producto.
    const r = armarFactura([linea(), linea({ nombre: "LUVIA", alegraItemId: null })], MAPA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toContain("LUVIA");
  });

  it("un ítem de OTRO ambiente bloquea, aunque exista", () => {
    // Es el error que el modelo llama la causa numero uno de facturas mal emitidas: estrenar produccion
    // con identificadores de sandbox. Aqui no depende de que alguien lo recuerde el dia del cambio.
    const r = armarFactura([linea({ alegraEnv: "produccion" })], MAPA);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/ambiente/i);
  });

  it("una cantidad de cero o fraccionaria bloquea", () => {
    expect(armarFactura([linea({ cantidad: 0 })], MAPA).ok).toBe(false);
    expect(armarFactura([linea({ cantidad: 1.5 })], MAPA).ok).toBe(false);
  });

  it("y sin id de IVA en el mapa NO se emite, en vez de emitir sin impuesto", () => {
    // Es la diferencia entre parar y hacer daño: sin `tax`, Alegra factura al 0%, la DIAN lo valida, y el
    // IVA no cobrado lo asume CNV. El fallo silencioso se convierte aquí en un fallo ruidoso.
    const r = armarFactura([linea()], { ...MAPA, ivaTaxId: "" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/IVA/);
  });

  it("una venta sin líneas no produce una factura vacía", () => {
    expect(armarFactura([], MAPA).ok).toBe(false);
  });
});

describe("el centro de costo sale de la PROPIEDAD del producto", () => {
  it("propio va a Vitacellebis y tercero a Productos de Terceros", () => {
    expect(centroDeCosto([linea({ ownership: "propio" })], MAPA)).toBe(1);
    expect(centroDeCosto([linea({ ownership: "tercero" })], MAPA)).toBe(2);
  });

  it("y una venta MIXTA se queda sin centro, a propósito", () => {
    // El centro es del DOCUMENTO, no de la linea, asi que una venta mixta no se puede clasificar sin
    // mentir. Sin centro es visible y corregible; repartirlo por mayoria seria inventar un dato contable
    // y contaminaria justo el reporte para el que se crearon los centros.
    expect(centroDeCosto([linea({ ownership: "propio" }), linea({ ownership: "tercero" })], MAPA)).toBeNull();
  });

  it("un producto sin propiedad declarada cuenta como propio, no como desconocido", () => {
    // Los cuatro de la linea propia son lo normal; `tercero` es la excepcion y se declara.
    expect(centroDeCosto([linea({ ownership: null })], MAPA)).toBe(1);
  });
});

describe("el pago va contra la cuenta PUENTE del canal, nunca contra el banco", () => {
  it("efectivo y pasarela caen en cuentas distintas", () => {
    // Que sean distintas es lo que permite las dos conciliaciones independientes: el saldo de cada cuenta
    // en Alegra contra lo que Atlas dice pendiente.
    expect(cuentaDelPago("efectivo", MAPA)).toBe(5);
    expect(cuentaDelPago("wompi", MAPA)).toBe(6);
  });

  it("y la quincenal al Integrante NO registra pago: queda por cobrar de verdad", () => {
    expect(cuentaDelPago("quincenal_integrante", MAPA)).toBeNull();
  });
});

describe("el desglose de la venta cuadra con lo que se cobra", () => {
  it("base + IVA da exactamente el total cobrado, con varias líneas y cantidades", () => {
    // Si no cuadrara, el pago registrado no coincidiria con la factura y el descuadre aparece en el
    // cierre, no en la venta.
    const lineas = [
      linea({ cantidad: 2, precioUnitario: 107100 }),
      linea({ cantidad: 3, precioUnitario: 166600 }),
      linea({ cantidad: 1, precioUnitario: 90000 }), // LUVIA, el del redondeo
    ];
    const d = desgloseDeLaVenta(lineas);
    expect(d.total).toBe(107100 * 2 + 166600 * 3 + 90000);
    expect(d.base + d.iva).toBe(d.total);
    // LUVIA aporta 75.630 de base y 14.370 de IVA: los 0,30 del redondeo caen en el IVA, no en el total.
    expect(d.base).toBe(90000 * 2 + 140000 * 3 + 75630);
    expect(d.iva).toBe(17100 * 2 + 26600 * 3 + 14370);
  });
});
