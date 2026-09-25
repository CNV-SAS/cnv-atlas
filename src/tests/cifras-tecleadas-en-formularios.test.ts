import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { cantidadTecleada, importeTecleado, pesosDeTexto } from "@/core/pesos";
import { RANGO_CORREGIBLE } from "@/modules/bis-intake/services/medidas-corregibles";
import { confirmRemesaSchema, countLineSchema, declareRemesaSchema } from "@/modules/nutraceuticals/validations";
import { abrirContracargoSchema } from "@/modules/payments/validations";

// ═══ EL BARRIDO DE LAS CIFRAS TECLEADAS (Santiago, 2026-09-25) ═══
//
// Salió del defecto del precio en la venta retroactiva: `Number("11.900")` da 11,9. Santiago pidió barrer el
// resto, porque cualquier importe o cantidad que alguien teclee tiene el mismo problema. Lo que se encontró,
// y lo que este candado fija:
//
//   · el MONTO DEBITADO de un contracargo: "150.000" se guardaba como 150, y el aviso de conciliación decía
//     "difiere en 149.850", mandando a cuadrar una diferencia que no existía;
//   · el PRECIO DEL CATÁLOGO, que sella TODAS las ventas y el precio de un faltante: ahí un 11,9 no contamina
//     una venta, contamina todas. Solo lo tapaba el `step={1}` del campo, que es el navegador, no el lector;
//   · el CONTEO FÍSICO: contar "1.000" se leía como 1 (entero y positivo, así que pasaba) y abría un faltante
//     de 999 unidades con cargo económico al Integrante;
//   · y la ESTATURA: el schema tenía techo pero no piso, así que "1,75" (metros, como lo dice la gente) se
//     guardaba como una talla de 1,75 cm y entraba al motor.

describe("los lectores de Zod", () => {
  it("un importe se lee con puntos o con comas", () => {
    expect(importeTecleado().parse("11.900")).toBe(11900);
    expect(importeTecleado().parse("11,900")).toBe(11900);
    expect(importeTecleado().parse("150.000")).toBe(150000);
    expect(importeTecleado().safeParse("mil").success).toBe(false);
  });

  it("una cantidad exige entero, y '1.000' son mil, no uno", () => {
    expect(cantidadTecleada().parse("1.000")).toBe(1000);
    expect(cantidadTecleada(0).parse("0")).toBe(0);
    expect(cantidadTecleada().safeParse("2,5").success).toBe(false);
  });
});

describe("los formularios que mueven dinero o inventario", () => {
  it("EL MONTO DEBITADO de un contracargo: 150.000 son ciento cincuenta mil", () => {
    const r = abrirContracargoSchema.safeParse({
      transactionId: "11111111-1111-1111-1111-111111111111",
      referencia: "DISPUTA-1",
      montoDebitado: "150.000",
      debitadoEn: "2026-09-20",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.montoDebitado).toBe(150000);
  });

  it("EL CONTEO FÍSICO: contar 1.000 no abre un faltante de 999", () => {
    const r = countLineSchema.safeParse({
      nutraceuticalId: "11111111-1111-1111-1111-111111111111",
      physicalQty: "1.000",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.physicalQty).toBe(1000);
  });

  it("y la confirmación de una remesa, igual", () => {
    const r = confirmRemesaSchema.safeParse({
      remesaId: "11111111-1111-1111-1111-111111111111",
      actualQuantity: "1.200",
      lote: "L-1",
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.actualQuantity).toBe(1200);
  });
});

describe("las medidas antropométricas corregibles", () => {
  it("la estatura tiene PISO, no solo techo: 1,75 no es una talla", () => {
    // Es lo que faltaba: el schema decía querer atrapar "el dedo gordo" y solo tenía el techo.
    expect(RANGO_CORREGIBLE.talla.min).toBeGreaterThan(1.75);
    expect(1.75 < RANGO_CORREGIBLE.talla.min).toBe(true);
    expect(RANGO_CORREGIBLE.talla.max).toBeLessThanOrEqual(400);
  });

  it("y las cuatro medidas tienen rango y unidad, no solo la talla", () => {
    for (const m of ["peso", "talla", "cintura", "cadera"] as const) {
      expect(RANGO_CORREGIBLE[m].min, `${m} sin piso`).toBeGreaterThan(0);
      expect(RANGO_CORREGIBLE[m].max).toBeGreaterThan(RANGO_CORREGIBLE[m].min);
      expect(RANGO_CORREGIBLE[m].unidad.length).toBeGreaterThan(0);
    }
  });
});

// ═══ Y LO QUE LA PANTALLA PROMETE TIENE QUE SER LO QUE LA BASE ACEPTA (2026-09-25) ═══
//
// No es una cifra tecleada, es el mismo defecto de fondo: la pantalla decía "Lote (opcional)" y el servicio
// rechazaba la remesa sin lote, porque el saldo se lleva por (ubicación, producto, lote) desde la 0121. El
// usuario lo veía como "puse todo y no me deja continuar", y el mensaje hablaba además de RECIBIR cuando quien
// estaba en la pantalla era CNV DECLARANDO.
describe("el lote de una remesa", () => {
  it("es obligatorio, porque el inventario se lleva por lote", () => {
    const base = {
      professionalId: "33333333-3333-3333-3333-333333333333",
      nutraceuticalId: "77777777-7777-7777-7777-777777777703",
      quantity: "10",
    };
    expect(declareRemesaSchema.safeParse({ ...base, lote: "" }).success).toBe(false);
    expect(declareRemesaSchema.safeParse({ ...base, lote: "   " }).success).toBe(false);
    // Y sin la clave siquiera: era `.optional()`, así que pasaba y el rechazo llegaba después de enviar.
    expect(declareRemesaSchema.safeParse(base).success).toBe(false);
    const ok = declareRemesaSchema.safeParse({ ...base, lote: " 19826 " });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.lote).toBe("19826");
  });

  it("y el mensaje dice qué escribir, no solo que falta", () => {
    const r = declareRemesaSchema.safeParse({
      professionalId: "33333333-3333-3333-3333-333333333333",
      nutraceuticalId: "77777777-7777-7777-7777-777777777703",
      quantity: "10",
      lote: "",
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.some((i) => /caja/i.test(i.message))).toBe(true);
  });
});

// ═══ LA FRONTERA DEL BARRIDO: LA REGLA DE LA PLATA NO SE EXPORTA A LO CLINICO (2026-09-25) ═══
//
// Este candado existe para el PROXIMO barrido, no para el de hoy. Al revisar los lectores de la prescripción
// quedó claro que aplicarles `pesosDeTexto` sería un daño, no un arreglo: su regla ("último grupo de tres
// dígitos = miles") es cierta para el dinero y falsa para un factor clínico. El PAL del modelo es 1.375 y una
// proteína son 1.6 g/kg; leídos como plata serían 1375 y 16.
//
// Y los ajustes NO lo necesitan: sus campos son `type="number"`, cuyo `value` por especificación es cadena
// vacía o un número con punto, así que el navegador normaliza antes de que el lector corra. No hay coma ni
// separador de miles que desambiguar.
describe("la frontera entre leer plata y leer una cifra clínica", () => {
  it("el lector de pesos leería mal los factores del modelo, y por eso la prescripción no lo usa", () => {
    // El PAL de "Ligera" es 1.375. Como plata, son mil trescientos setenta y cinco pesos.
    expect(pesosDeTexto("1.375")).toBe(1375);
    // Y una proteína de 1.600 g/kg pasaría a ser 1600.
    expect(pesosDeTexto("1.600")).toBe(1600);
    // Lo correcto para esos campos es lo que ya hacen: el valor normalizado por el navegador.
    expect(Number("1.375")).toBe(1.375);
  });

  it("y para la plata sigue siendo al revés, que es la razón de que exista", () => {
    expect(pesosDeTexto("11.900")).toBe(11900);
    expect(Number("11.900")).toBe(11.9);
  });
});
