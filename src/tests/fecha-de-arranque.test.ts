import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { desdeElArranque, elMasTardio, hoyEnColombia, inicioDelMesEnBogota } from "@/modules/payments/arranque";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO DE LA FECHA DE ARRANQUE (0198) ═══
//
// LO QUE PROTEGE: que el corte llegue a TODAS las cifras de resumen, no a tres de cinco.
//
// Esta es la leccion que ya nos costo tres veces esta semana, y esta escrita antes de que vuelva a pasar:
// una regla aplicada caso por caso llega hasta donde llego quien la escribio. Paso con la RLS (tres tablas
// sin politica), con `z.uuid()` (dos archivos de seis) y con el submitter del formulario (un candado que
// cubria el helper y no el formulario que armaba su envio a mano). El sintoma aqui seria una tarjeta
// contando desde el arranque al lado de otra contando todo, y la diferencia leyendose como un defecto de
// una de las dos, igual que las 1.903 unidades contra las 1.820.
//
// Y LA SEGUNDA MITAD DEL CANDADO ES LA LINEA QUE EL CORTE NO PUEDE CRUZAR: la fecha recorta CIFRAS DE
// RESUMEN, nunca lo que se le DEBE a alguien. Una comision anterior al arranque se sigue liquidando. Por
// eso las exenciones no son una lista de pendientes: son la regla dicha por el otro lado, y cada una lleva
// su razon escrita.

/** Los lectores que alimentan una cifra de resumen. Todos tienen que aplicar el corte. */
const LECTORES_DE_CIFRAS = new Map<string, string>([
  ["src/modules/direccion/data/dashboard-reader.ts", "el bruto, el ingreso de CNV y las comisiones de Direccion"],
  ["src/modules/dashboard/data/tablero-reader.ts", "la comision y las ventas del mes en Inicio"],
  ["src/modules/direccion/data/insights-de-la-compra.ts", "lo prescrito contra lo comprado"],
  ["src/modules/direccion/data/lo-deshecho.ts", "cuanto de lo vendido se deshizo, y su tasa"],
]);

/**
 * Los que leen ingreso y NO llevan corte, con la razon por la que no.
 *
 * Se agrupan en dos familias, y la distincion importa mas que la lista:
 *
 *   · LO QUE SE DEBE. Liquidar, la cuenta del Integrante, su comision pendiente y su estado tributario
 *     responden "¿cuanto hay que pagarle?". Recortar eso por una fecha seria dejar de pagar una comision
 *     real, que no es limpiar cifras: es perder plata de alguien.
 *   · QUIEN ESCRIBE. Un writer inserta la fila de ingreso de la venta que esta creando; no cuenta nada.
 */
const SIN_CORTE = new Map<string, string>([
  ["src/modules/payments/data/liquidacion-writer.ts", "liquida lo que se debe, y lo anterior al arranque se debe igual"],
  ["src/modules/payments/data/integrante-reader.ts", "su cuenta por cobrar es dinero real, no una cifra de resumen"],
  ["src/modules/professionals/data/perfil-reader.ts", "su comision pendiente es lo que se le debe"],
  ["src/modules/professionals/data/tax-status-reader.ts", "su estado tributario se calcula sobre lo devengado de verdad"],
  ["src/modules/payments/data/payments-writer.ts", "escribe la fila de ingreso de la venta que crea"],
  ["src/modules/payments/data/retracto-writer.ts", "escribe la reversion del ingreso al retractarse"],
  ["src/modules/payments/data/reversas-writer.ts", "escribe la reversion del ingreso de una reversa"],
  ["src/modules/payments/data/venta-retroactiva-writer.ts", "escribe la fila de ingreso de una venta anterior"],
  ["src/modules/payments/types.ts", "solo declara tipos"],
]);

const RAICES = ["src/modules"];

async function archivosDeCodigo(): Promise<string[]> {
  const { readdirSync } = await import("node:fs");
  const { join } = await import("node:path");
  const out: string[] = [];
  const recorrer = (dir: string) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name).replace(/\\/g, "/");
      if (d.isDirectory()) recorrer(p);
      else if (/\.tsx?$/.test(d.name)) out.push(p);
    }
  };
  for (const r of RAICES) recorrer(r);
  return out;
}

describe("la fecha de arranque llega a todas las cifras de resumen", () => {
  it("cada lector de cifras la aplica", () => {
    for (const [f, que] of LECTORES_DE_CIFRAS) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      // SE EXIGE LA LLAMADA, no que el nombre aparezca: un import sin usar, o una variable que se le
      // parezca, dejarian pasar un lector que no corta nada. Comprobado revirtiendo el arreglo, que es
      // como se sabe que un candado sirve: la primera version de esta linea buscaba el nombre suelto y NO
      // atrapo el defecto que se le puso delante.
      expect(
        /fechaDeArranque\s*\(/.test(src),
        `${f} alimenta ${que} y no aplica la fecha de arranque`,
      ).toBe(true);
    }
  });

  // EL BARRIDO QUE DE VERDAD PROTEGE: `brutoReconocido` es el marcador exacto de "esto suma ventas para una
  // tarjeta". Una pantalla nueva que sume ventas va a usarlo (es lo unico que impide que dos pantallas
  // digan cifras distintas del mismo hecho), y en ese momento este barrido la obliga a declararse.
  it("nadie mas suma ventas para una tarjeta sin declararse", async () => {
    const culpables: string[] = [];
    for (const f of await archivosDeCodigo()) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      if (!/brutoReconocido/.test(src)) continue;
      if (f.endsWith("cobro-reconocido.ts")) continue; // es quien lo define
      if (LECTORES_DE_CIFRAS.has(f)) continue;
      culpables.push(f);
    }
    expect(
      culpables,
      "suman ventas para una cifra de pantalla y no estan en LECTORES_DE_CIFRAS: o aplican la fecha de arranque y se agregan ahi, o su cifra va a contar las pruebas el dia del arranque",
    ).toEqual([]);
  });

  // Y LA OTRA MITAD: quien lee ingreso o comision, o aplica el corte, o dice por que no. No se admite el
  // silencio, porque el silencio es indistinguible de un olvido.
  it("quien lee ingreso o comision, o corta o dice por que no", async () => {
    const culpables: string[] = [];
    for (const f of await archivosDeCodigo()) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      if (!/cnv_revenue|professional_revenue/.test(src)) continue;
      if (LECTORES_DE_CIFRAS.has(f) || SIN_CORTE.has(f)) continue;
      culpables.push(f);
    }
    expect(
      culpables,
      "leen ingreso o comision y no estan declarados: si alimentan una cifra de resumen van a LECTORES_DE_CIFRAS (y aplican el corte); si responden 'cuanto se le debe', van a SIN_CORTE con su razon",
    ).toEqual([]);
  });

  // LAS EXENCIONES SE VERIFICAN, no se creen: una lista escrita una vez protege para siempre archivos que ya
  // cambiaron. Si uno deja de leer ingreso, su exencion sobra y hay que quitarla.
  it("y las exenciones declaradas siguen siendo ciertas", () => {
    for (const [f, razon] of SIN_CORTE) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      expect(
        /cnv_revenue|professional_revenue/.test(src),
        `${f} ya no lee ingreso, asi que su exencion ("${razon}") sobra`,
      ).toBe(true);
    }
  });
});

describe("el corte se ancla a la hora de Bogota", () => {
  // SIN LA HORA, EL CORTE SE CORRE MEDIO DIA. `created_at` es un timestamp, y comparar contra "2026-10-15"
  // pelado lo lee como medianoche UTC, que en Bogota son las 7 de la tarde del 14: se colarian las ventas
  // de esa tarde, justo las del dia anterior al arranque.
  it("la fecha se convierte en la medianoche de Bogota", () => {
    expect(desdeElArranque("2026-10-15")).toBe("2026-10-15T00:00:00-05:00");
    expect(new Date(desdeElArranque("2026-10-15") as string).toISOString()).toBe("2026-10-15T05:00:00.000Z");
  });

  it("sin fecha fijada no hay corte", () => {
    expect(desdeElArranque(null)).toBeNull();
  });
});

describe("la tarjeta del mes empieza en el mas tardio de los dos comienzos", () => {
  // EL MES DEL ARRANQUE ES EL UNICO QUE LO NOTA, y es justo el que se leeria mal: si el arranque cae el 15,
  // la tarjeta "de este mes" sumaria las pruebas del 1 al 14.
  it("el arranque a mitad de mes manda sobre el dia 1", () => {
    expect(elMasTardio("2026-10-01T00:00:00.000Z", "2026-10-15T00:00:00-05:00")).toBe(
      "2026-10-15T00:00:00-05:00",
    );
  });

  it("un arranque anterior no mueve el comienzo del mes", () => {
    expect(elMasTardio("2026-11-01T00:00:00.000Z", "2026-10-15T00:00:00-05:00")).toBe(
      "2026-11-01T00:00:00.000Z",
    );
  });

  it("sin arranque, el mes empieza donde siempre", () => {
    expect(elMasTardio("2026-11-01T00:00:00.000Z", null)).toBe("2026-11-01T00:00:00.000Z");
  });

  // EL CASO LIMITE QUE LO DECIDE TODO, y el que haria fallar una comparacion de TEXTOS: el 1 de octubre a
  // medianoche UTC es el 30 de septiembre a las 7 de la tarde en Bogota. Comparados como cadenas, el
  // arranque parece el mas tardio ('.' pesa mas que '-') y entrarian las ventas de esa tarde, que son
  // justo las del dia anterior al arranque.
  it("un arranque del mismo dia no se cuela por delante del comienzo del mes", () => {
    expect(elMasTardio("2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00-05:00")).toBe(
      "2026-10-01T00:00:00-05:00",
    );
    expect(elMasTardio("2026-10-01T06:00:00.000Z", "2026-10-01T00:00:00-05:00")).toBe(
      "2026-10-01T06:00:00.000Z",
    );
  });
});

describe("el mes empieza en Colombia, no en UTC", () => {
  // ═══ EL DEFECTO QUE SANTIAGO INTUYO ANTES QUE YO (2026-09-30) ═══
  //
  // El 30 de septiembre a las 7 p. m. de Bogota, su tablero decia "Tu comisión $0" y "Ventas $0". La ventana
  // se armaba con `getUTCMonth()`, y a esa hora en UTC ya era octubre: el mes saltaba CINCO HORAS ANTES.
  //
  // Y pasa TODOS los meses, entre las 7 p. m. y la medianoche del ultimo dia, que es exactamente cuando
  // alguien mira como le fue el mes. Un test con reloj fijo es lo unico que lo atrapa: en una corrida de la
  // mañana el codigo viejo tambien pasaba.
  it("a las 7 de la tarde del ultimo dia del mes, el mes sigue siendo el mismo", () => {
    // 2026-10-01T00:00:00Z == 2026-09-30 19:00 en Bogota.
    expect(inicioDelMesEnBogota(new Date("2026-10-01T00:00:00.000Z"))).toBe("2026-09-01T00:00:00-05:00");
  });

  it("y a la medianoche de Bogota ya es el mes siguiente", () => {
    // 2026-10-01T05:00:00Z == 2026-10-01 00:00 en Bogota.
    expect(inicioDelMesEnBogota(new Date("2026-10-01T05:00:00.000Z"))).toBe("2026-10-01T00:00:00-05:00");
  });

  it("y a mitad de mes devuelve su dia uno", () => {
    expect(inicioDelMesEnBogota(new Date("2026-09-15T18:00:00.000Z"))).toBe("2026-09-01T00:00:00-05:00");
  });

  // Y EL CORTE DEL MES SE COMBINA CON EL DEL ARRANQUE sin perder la zona: las dos cadenas llevan su offset,
  // asi que `elMasTardio` las compara como instantes y no como texto.
  it("convive con el arranque sin volver a la comparacion de textos", () => {
    expect(elMasTardio(inicioDelMesEnBogota(new Date("2026-10-15T18:00:00.000Z")), "2026-10-20T00:00:00-05:00")).toBe(
      "2026-10-20T00:00:00-05:00",
    );
  });
});

describe("y el dia de hoy tambien es el de Colombia", () => {
  // EL CASO DE AL LADO, encontrado el mismo dia: las "proximas consultas" del tablero comparaban contra la
  // fecha UTC, asi que despues de las 7 de la tarde las citas de HOY desaparecian de la lista justo al final
  // de la jornada, que es cuando se mira.
  it("a las 7 de la tarde del 30, hoy sigue siendo el 30", () => {
    expect(hoyEnColombia(new Date("2026-10-01T00:00:00.000Z"))).toBe("2026-09-30");
  });

  it("y a la medianoche de Bogota ya es el 1", () => {
    expect(hoyEnColombia(new Date("2026-10-01T05:00:00.000Z"))).toBe("2026-10-01");
  });
});
