import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { motivoSiElMenorNoSePuedeFacturar } from "@/modules/payments/facturacion";

// ═══ LA FACTURA DE UN MENOR NO SALE A NOMBRE DEL MENOR (contabilidad, 2026-11-18) ═══
//
// Textual de contabilidad: la factura va a nombre del REPRESENTANTE LEGAL, que es quien compra y quien
// paga, con su cedula y su correo. Nunca los datos del menor en un documento tributario. Y nada de
// "consumidor final" por defecto: sin representante, la venta se registra y queda PENDIENTE DE FACTURAR.
//
// LO QUE ESTE CANDADO VIGILA ES EL FRENO, que es lo que se construyo el 19. La factura a nombre del
// representante necesita el TIPO de documento del representante, que no existe en la base y que Alegra
// exige, asi que hasta entonces lo unico correcto es no emitir.
//
// Y VIGILA LAS DOS MITADES. La que falla sola es la del adulto: un freno escrito de prisa que mire "tiene
// representante" en vez de "es menor" frenaria a cualquiera, y el dia del arranque eso seria la
// facturacion entera parada por una regla que solo toca a unos pocos.

describe("la factura de un paciente menor", () => {
  const CON_REPRESENTANTE = { documento: "1020304050" };

  it("un ADULTO se factura exactamente igual que siempre", () => {
    expect(motivoSiElMenorNoSePuedeFacturar(18, null)).toBeNull();
    expect(motivoSiElMenorNoSePuedeFacturar(45, null)).toBeNull();
    // Y tampoco lo frena tener un representante colgando de una firma vieja.
    expect(motivoSiElMenorNoSePuedeFacturar(30, CON_REPRESENTANTE)).toBeNull();
  });

  it("un MENOR SIN representante no se factura, y el motivo dice qué completar", () => {
    const motivo = motivoSiElMenorNoSePuedeFacturar(10, null);
    expect(motivo).not.toBeNull();
    expect(motivo).toMatch(/falta el representante legal/i);
    // La salida tiene que estar en el propio mensaje: un freno sin salida detiene a una persona.
    expect(motivo).toMatch(/sale sola/i);
  });

  it("un MENOR CON representante tampoco se factura todavía, y el motivo es OTRO", () => {
    const motivo = motivoSiElMenorNoSePuedeFacturar(10, CON_REPRESENTANTE);
    expect(motivo).not.toBeNull();
    // ES LA MITAD QUE SE PIERDE si los dos casos comparten mensaje: decirle "completa el representante" a
    // quien ya lo completo lo manda a buscar algo que esta, y el defecto parece suyo.
    expect(motivo).not.toMatch(/falta el representante legal/i);
    expect(motivo).toMatch(/tipo de documento/i);
  });

  it("el representante con el documento en blanco cuenta como que NO está", () => {
    expect(motivoSiElMenorNoSePuedeFacturar(10, { documento: "   " })).toMatch(
      /falta el representante legal/i,
    );
    expect(motivoSiElMenorNoSePuedeFacturar(10, { documento: null })).toMatch(
      /falta el representante legal/i,
    );
  });

  it("sin fecha de nacimiento NO se frena, y es deliberado", () => {
    // Hay pacientes reales sin fecha de nacimiento (hallazgo de la cohorte). Frenarlos a todos congelaria
    // la facturacion de adultos reales el dia del arranque, por una sospecha que nadie ha comprobado.
    expect(motivoSiElMenorNoSePuedeFacturar(null, null)).toBeNull();
  });

  it("los 17 años son menor y los 18 son adulto, en el borde", () => {
    expect(motivoSiElMenorNoSePuedeFacturar(17, null)).not.toBeNull();
    expect(motivoSiElMenorNoSePuedeFacturar(18, null)).toBeNull();
  });

  it("la mayoría de edad no se escribe aquí: sale del módulo del consentimiento", () => {
    // Si alguien escribe un 18 en facturacion.ts, la regla pasa a vivir en dos sitios y un dia una
    // pantalla trata de menor a alguien a quien la otra trata de adulto.
    const src = readFileSync("src/modules/payments/facturacion.ts", "utf8");
    expect(src).toMatch(/isMinorAge as esMenorDeEdad/);
  });
});

describe("el freno del menor está cableado en el camino que emite", () => {
  it("la emisión lo evalúa, y antes del reclamo para no gastar intentos", () => {
    const src = readFileSync("src/modules/payments/services/facturacion-service.ts", "utf8");
    expect(src, "el servicio no llama al freno del menor").toMatch(
      /motivoSiElMenorNoSePuedeFacturar\(/,
    );
    const posFreno = src.indexOf("motivoSiElMenorNoSePuedeFacturar(menor.edadEnLaVenta");
    // LA LLAMADA, no la mencion: `reclamarParaFacturar` sale antes en un comentario que explica el
    // mecanismo, y buscar el nombre pelado encontraba ese comentario y daba el veredicto al reves.
    const posReclamo = src.indexOf("fr.reclamarParaFacturar(");
    expect(posFreno).toBeGreaterThan(-1);
    expect(posReclamo).toBeGreaterThan(-1);
    expect(
      posFreno < posReclamo,
      "el freno va DESPUES del reclamo: cada pulsación gastaría un intento de una venta que no puede cambiar de resultado",
    ).toBe(true);
  });
});
