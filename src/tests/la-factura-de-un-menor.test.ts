import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { elAdquirenteDeLaFactura } from "@/modules/payments/facturacion";

// ═══ QUIEN VA EN LA FACTURA DE UN PACIENTE MENOR (contabilidad, 2026-11-18, C1) ═══
//
// Textual de contabilidad: la factura de un menor va a nombre del REPRESENTANTE LEGAL, que es quien
// compra y quien paga, con su documento y su correo. Nunca los datos del menor en un documento
// tributario. Y nada de "consumidor final" por defecto: sin representante completo, la venta se registra
// y queda PENDIENTE DE FACTURAR.
//
// ── LAS DOS MITADES, Y LA SEGUNDA ES LA QUE SE PIERDE ───────────────────────────────────────────
//
// La que se prueba sola es el menor. La que falla callada es el ADULTO: un freno escrito de prisa que
// mire "tiene representante" en vez de "es menor" pararia la facturacion entera el dia del arranque, y
// nadie lo veria hasta que alguien intentara facturar.

const PACIENTE = {
  nombres: "Juan",
  apellidos: "Pérez",
  documento: "1122334455",
  tipoDocumento: "TI",
  correo: "juan@ejemplo.test",
};

const REPRESENTANTE_COMPLETO = {
  nombre: "Ana María López Gómez",
  documento: "1020304050",
  tipoDocumento: "CC",
  correo: "ana@ejemplo.test",
};

describe("quién va en la factura", () => {
  it("un ADULTO se factura exactamente igual que siempre: él mismo", () => {
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 45,
      paciente: PACIENTE,
      representante: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.adquirente.documento).toBe(PACIENTE.documento);
    expect(r.adquirente.tipoDocumento).toBe("TI");
    expect(r.adquirente.correo).toBe(PACIENTE.correo);
    expect(r.adquirente.esElRepresentante).toBe(false);
  });

  it("y tampoco cambia porque tenga un representante colgando de una firma vieja", () => {
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 30,
      paciente: PACIENTE,
      representante: REPRESENTANTE_COMPLETO,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.adquirente.documento, "a un adulto se le facturó a nombre de otro").toBe(
      PACIENTE.documento,
    );
  });

  it("un MENOR con representante completo: la factura va al REPRESENTANTE", () => {
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 10,
      paciente: PACIENTE,
      representante: REPRESENTANTE_COMPLETO,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.adquirente.documento).toBe("1020304050");
    expect(r.adquirente.tipoDocumento).toBe("CC");
    // EL CORREO ES EL DEL REPRESENTANTE: es a donde llega la factura. Mandarla al del menor seria
    // mandarle un documento tributario a nombre de otra persona.
    expect(r.adquirente.correo).toBe("ana@ejemplo.test");
    expect(r.adquirente.esElRepresentante).toBe(true);
  });

  it("y NINGÚN dato del menor viaja en esa factura", () => {
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 10,
      paciente: PACIENTE,
      representante: REPRESENTANTE_COMPLETO,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const viaja = JSON.stringify(r.adquirente);
    expect(viaja, "el documento del menor viaja a Alegra").not.toContain(PACIENTE.documento);
    expect(viaja, "el nombre del menor viaja a Alegra").not.toContain(PACIENTE.nombres);
    expect(viaja, "el correo del menor viaja a Alegra").not.toContain(PACIENTE.correo);
  });

  it("el nombre del representante NO se parte en nombres y apellidos", () => {
    // Partir "Ana Maria Lopez Gomez" de vuelta es imposible de hacer bien: no se sabe dónde termina el
    // nombre. El nombre entero va en `nombres` y en `apellidos` va su DOCUMENTO, que es verdadero,
    // visible y lo identifica. Es la misma regla que ya está escrita para el paciente.
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 10,
      paciente: PACIENTE,
      representante: REPRESENTANTE_COMPLETO,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.adquirente.nombres).toBe("Ana María López Gómez");
    expect(r.adquirente.apellidos).toBe("1020304050");
  });

  it("un MENOR SIN representante: no se factura, y el motivo dice qué completar", () => {
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 10,
      paciente: PACIENTE,
      representante: null,
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/falta el representante legal/i);
    // La salida tiene que estar en el propio mensaje: un freno sin salida detiene a una persona.
    expect(r.motivo).toMatch(/ficha del paciente/i);
    expect(r.motivo).toMatch(/sale sola/i);
  });

  it("un MENOR con representante SIN TIPO de documento: tampoco, y el motivo es OTRO", () => {
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 10,
      paciente: PACIENTE,
      representante: { ...REPRESENTANTE_COMPLETO, tipoDocumento: null },
    });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    // ES LA MITAD QUE SE PIERDE si los dos casos comparten mensaje: decirle "falta el representante" a
    // quien ya lo registró lo manda a buscar algo que está.
    expect(r.motivo).not.toMatch(/falta el representante legal/i);
    expect(r.motivo).toMatch(/tipo de documento/i);
  });

  it("y con el documento o el nombre en blanco cuenta como que NO está", () => {
    for (const parcial of [
      { ...REPRESENTANTE_COMPLETO, documento: "   " },
      { ...REPRESENTANTE_COMPLETO, documento: null },
      { ...REPRESENTANTE_COMPLETO, nombre: "" },
    ]) {
      const r = elAdquirenteDeLaFactura({
        edadALaFechaDeLaVenta: 10,
        paciente: PACIENTE,
        representante: parcial,
      });
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      expect(r.motivo).toMatch(/falta el representante legal/i);
    }
  });

  it("COMPLETAR EL DATO lo desbloquea, sin tocar nada más", () => {
    const sinTipo = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 10,
      paciente: PACIENTE,
      representante: { ...REPRESENTANTE_COMPLETO, tipoDocumento: null },
    });
    expect(sinTipo.ok).toBe(false);

    const conTipo = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 10,
      paciente: PACIENTE,
      representante: REPRESENTANTE_COMPLETO,
    });
    expect(conTipo.ok, "completar el tipo no desbloqueó la factura").toBe(true);
  });

  it("sin fecha de nacimiento se factura al paciente, y es deliberado", () => {
    // Hay pacientes reales sin fecha de nacimiento (hallazgo de la cohorte). Frenarlos a todos congelaría
    // la facturación de adultos reales, por una sospecha que nadie ha comprobado.
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: null,
      paciente: PACIENTE,
      representante: null,
    });
    expect(r.ok).toBe(true);
  });

  it("los 17 años son menor y los 18 son adulto, en el borde", () => {
    const a17 = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 17,
      paciente: PACIENTE,
      representante: null,
    });
    const a18 = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 18,
      paciente: PACIENTE,
      representante: null,
    });
    expect(a17.ok).toBe(false);
    expect(a18.ok).toBe(true);
  });

  it("un paciente sin nombre se factura igual, con un rótulo verdadero", () => {
    // La factura la exige la ley y el documento identifica al adquirente igual.
    const r = elAdquirenteDeLaFactura({
      edadALaFechaDeLaVenta: 40,
      paciente: { ...PACIENTE, nombres: null, apellidos: null },
      representante: null,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.adquirente.nombres).toBe("Paciente");
    expect(r.adquirente.apellidos).toBe(PACIENTE.documento);
  });

  it("la mayoría de edad no se escribe aquí: sale del módulo del consentimiento", () => {
    const src = readFileSync("src/modules/payments/facturacion.ts", "utf8");
    expect(src).toMatch(/isMinorAge as esMenorDeEdad/);
  });
});

describe("el adquirente está cableado en el camino que emite", () => {
  const src = () => readFileSync("src/modules/payments/services/facturacion-service.ts", "utf8");

  it("la emisión lo resuelve antes del reclamo, para no gastar intentos", () => {
    const s = src();
    expect(s).toMatch(/resolverAdquirente\(/);
    const posFreno = s.indexOf("const quienVaEnLaFactura = await resolverAdquirente(");
    // LA LLAMADA, no la mención: `reclamarParaFacturar` sale antes en un comentario que explica el
    // mecanismo, y buscar el nombre pelado encontraba ese comentario y daba el veredicto al revés.
    const posReclamo = s.indexOf("fr.reclamarParaFacturar(");
    expect(posFreno).toBeGreaterThan(-1);
    expect(posReclamo).toBeGreaterThan(-1);
    expect(
      posFreno < posReclamo,
      "el freno va DESPUÉS del reclamo: cada pulsación gastaría un intento de una venta que no puede cambiar de resultado",
    ).toBe(true);
  });

  it("el contacto del representante NO se cachea en el paciente", () => {
    // `patients.alegra_contact_id` guarda el contacto DEL PACIENTE. Guardar ahí el del representante
    // haría que, el día que ese menor cumpla 18, su factura siguiera saliendo a nombre del representante:
    // el id cacheado se devuelve antes de mirar la edad.
    const s = src();
    expect(s).toMatch(/const cacheable = !adquirente\.esElRepresentante;/);
    // Y las tres escrituras del caché van detrás de esa condición.
    const guardados = s.match(/fr\.setContactoDeAlegra\(/g) ?? [];
    const condicionadas = s.match(/if \(cacheable\) await fr\.setContactoDeAlegra\(/g) ?? [];
    expect(
      condicionadas.length,
      "hay una escritura del caché del contacto que no mira si es el representante",
    ).toBe(guardados.length);
  });
});
