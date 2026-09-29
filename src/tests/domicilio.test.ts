import { describe, expect, it } from "vitest";

import {
  DIAS_DE_RETRACTO,
  TEXTO_DE_RETRACTO,
  estadoDelRetracto,
  ofertaDeDomicilio,
  procedeElRetracto,
  reintegroPorRetracto,
} from "@/modules/payments/domicilio";

// CANDADO DEL DOMICILIO Y EL RETRACTO (2026-09-29). Cada caso cita la regla que lo fija: modelo comercial §5
// y Ley 1480 de 2011, articulo 47.

const CIUDADES = [
  { city: "Medellín", department: "Antioquia", daneCode: "05001" },
  { city: "Bogotá", department: "Cundinamarca", daneCode: "11001" },
];

describe("la oferta de domicilio", () => {
  // §5.5: "es preferible NO ofrecer el domicilio a un destino que ofrecerlo y perder dinero en cada envio".
  // Por eso la ausencia de datos NIEGA.
  it("sin tarifa no se ofrece", () => {
    const r = ofertaDeDomicilio({ tarifa: null, ciudades: CIUDADES });
    expect(r.ofrece).toBe(false);
  });

  it("sin ciudades tampoco", () => {
    const r = ofertaDeDomicilio({ tarifa: 12_000, ciudades: [] });
    expect(r.ofrece).toBe(false);
  });

  it("con tarifa y cobertura, si", () => {
    const r = ofertaDeDomicilio({ tarifa: 12_000, ciudades: CIUDADES, ciudad: "Medellín" });
    expect(r).toEqual({ ofrece: true, tarifa: 12_000 });
  });

  it("no le importan las mayusculas ni los espacios", () => {
    expect(ofertaDeDomicilio({ tarifa: 12_000, ciudades: CIUDADES, ciudad: "  medellín " }).ofrece).toBe(true);
  });

  // UN "NO" SECO MANDA AL PACIENTE A OTRO LADO cuando el envio si era posible: §5.5 admite la cotizacion
  // caso a caso, y el mensaje tiene que decirlo.
  it("un destino sin cobertura se niega diciendo que se puede cotizar", () => {
    const r = ofertaDeDomicilio({ tarifa: 12_000, ciudades: CIUDADES, ciudad: "Leticia" });
    expect(r.ofrece).toBe(false);
    if (!r.ofrece) expect(r.motivo).toMatch(/cotizaci/i);
  });
});

describe("el derecho de retracto", () => {
  it("son cinco dias habiles", () => {
    expect(DIAS_DE_RETRACTO).toBe(5);
  });

  // §5.7: el envio a domicilio es lo que convierte la operacion en venta a distancia. Una venta entregada en
  // consulta no activa el retracto.
  it("no aplica a una venta entregada en consulta", () => {
    const e = estadoDelRetracto({
      deliveryMode: "en_consulta",
      modalidad: "comision",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-11",
    });
    expect(e.aplica).toBe(false);
  });

  // §5.7: bajo Distribucion el expendedor frente al paciente es el INTEGRANTE. Decir que CNV lo honra seria
  // prometer por otro.
  it("bajo Distribucion lo atiende el Integrante, no CNV", () => {
    const e = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "distribucion",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-11",
    });
    expect(e.aplica).toBe(false);
    expect(e.motivo).toMatch(/Integrante/);
  });

  // EL PLAZO CORRE DESDE LA ENTREGA, no desde el pago (articulo 47: "siguientes a la entrega").
  it("una venta pagada y no entregada aplica, pero sin reloj corriendo", () => {
    const e = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "comision",
      entregadaEl: null,
      hoy: "2026-09-11",
    });
    expect(e.aplica).toBe(true);
    expect(e.limite).toBeNull();
  });

  it("cuenta cinco dias HABILES desde la entrega", () => {
    // Entregada el jueves 10 de septiembre de 2026: cinco habiles caen el jueves 17.
    const e = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "comision",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-11",
    });
    expect(e.limite).toBe("2026-09-17");
    expect(e.vencido).toBe(false);
  });

  it("vencido despues del limite", () => {
    const e = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "comision",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-18",
    });
    expect(e.vencido).toBe(true);
    expect(e.diasHabilesRestantes).toBe(0);
  });
});

describe("si procede el retracto", () => {
  const dentro = estadoDelRetracto({
    deliveryMode: "domicilio",
    modalidad: "comision",
    entregadaEl: "2026-09-10",
    hoy: "2026-09-11",
  });

  // La tabla del modelo: sellado y sin abrir, PROCEDE.
  it("con el sello intacto y dentro del plazo, procede", () => {
    expect(procedeElRetracto({ estado: dentro, selloIntacto: true }).procede).toBe(true);
  });

  // Con el sello roto NO procede, por bien de uso personal (numeral 7). El sello es la evidencia que lo
  // acredita, y la doctrina exige acreditarlo, no afirmarlo.
  it("con el sello roto no procede, y se dice por que", () => {
    const r = procedeElRetracto({ estado: dentro, selloIntacto: false });
    expect(r.procede).toBe(false);
    expect(r.motivo).toMatch(/uso personal/i);
  });

  it("fuera del plazo no procede aunque este sellado", () => {
    const tarde = estadoDelRetracto({
      deliveryMode: "domicilio",
      modalidad: "comision",
      entregadaEl: "2026-09-10",
      hoy: "2026-09-30",
    });
    expect(procedeElRetracto({ estado: tarde, selloIntacto: true }).procede).toBe(false);
  });
});

describe("el reintegro", () => {
  // El articulo exige devolver "todas las sumas pagadas sin descuentos ni retenciones por concepto alguno",
  // y el modelo lo remata: CNV asume el envio de ida y no lo recupera.
  it("incluye el flete", () => {
    expect(reintegroPorRetracto({ montoDelProducto: 107_100, flete: 12_000 })).toBe(119_100);
  });
});

describe("el texto publicado", () => {
  // VA COMO CONSTANTE porque es texto legal: dos copias se separan, y una version suavizada del derecho es
  // una infraccion, no un matiz de redaccion.
  it("dice las tres cosas que no puede dejar de decir", () => {
    expect(TEXTO_DE_RETRACTO).toMatch(/cinco \(5\) días hábiles/);
    expect(TEXTO_DE_RETRACTO).toMatch(/sello original intacto/);
    expect(TEXTO_DE_RETRACTO).toMatch(/incluido el valor del envío/);
  });

  it("nombra la norma", () => {
    expect(TEXTO_DE_RETRACTO).toMatch(/artículo 47 de la Ley 1480 de 2011/);
  });
});
