import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO: NINGUN CAMINO CREA UNA VENTA SIN DECIR DE DONDE SALE ═══
//
// LO QUE PASO (Santiago, 2026-09-30): /pagos empezo a exigir la consulta el 29, y las VENTAS RETROACTIVAS
// se quedaron sin exigirla. Y no es el camino menor: es el que reconstruye la historia comercial entera, o
// sea el que mas ventas va a meter. Habria entrado toda sin el vinculo que acabamos de construir.
//
// ES LA MISMA LECCION DE LA SEMANA, por cuarta vez: una regla escrita caso por caso llega hasta donde llego
// quien la escribio. La RLS llego a tres tablas de seis, `z.uuid()` a dos archivos de seis, el candado del
// submitter cubria el helper y no el formulario, y la fecha de arranque necesito su barrido. Aqui el
// sintoma seria un hueco silencioso: la venta se registra, no falla nada, y meses despues los insights
// miden sobre un universo al que le falta la mitad.
//
// ── QUE SE VIGILA EXACTAMENTE ──
//
// Todo modulo que INSERTE en `transactions` tiene que exigir el origen (o declararse exento con su razon).
// No se vigila la pantalla: se vigila el servidor, porque es lo unico que no se puede saltar.

const RAICES = ["src/modules"];

/** La marca de que un camino exige el origen: el guard de /pagos, o la comprobacion equivalente. */
const EXIGE_EL_ORIGEN = /exigirOrigenDeLaCompra|!input\.treatmentId && !input\.ventaSueltaMotivo/;

/**
 * Los que insertan en `transactions` y NO tienen que pedir origen, con su razon.
 *
 * La distincion que importa: pedir el origen tiene sentido cuando NACE una venta. No lo tiene cuando se
 * reescribe o se deriva una que ya lo dijo, porque entonces el dato ya esta y preguntarlo otra vez seria
 * darle dos respuestas posibles al mismo hecho.
 */
const SIN_ORIGEN = new Map<string, string>([
  [
    "src/modules/payments/data/payments-writer.ts",
    "es el writer: recibe el origen ya exigido por el servicio, y no decide nada",
  ],
]);

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) out.push(...archivos(p));
    else if (/\.tsx?$/.test(d.name)) out.push(p);
  }
  return out;
}

describe("toda venta dice de qué consulta sale, o por qué de ninguna", () => {
  it("ningún camino que cree una venta se salta la exigencia", () => {
    const culpables: string[] = [];
    for (const raiz of RAICES) {
      for (const f of archivos(raiz)) {
        const src = sinComentarios(readFileSync(f, "utf8"));
        // Quien CREA una venta: un insert en `transactions`, por SQL o por Drizzle.
        const crea = /insert\s+into\s+transactions|insert\(transactions\)/.test(src);
        if (!crea) continue;
        if (SIN_ORIGEN.has(f)) continue;
        if (EXIGE_EL_ORIGEN.test(src)) continue;
        culpables.push(f);
      }
    }
    expect(
      culpables,
      "crean una venta y no exigen su origen: o llaman al guard (o hacen su comprobación equivalente), o van a SIN_ORIGEN con su razón. Sin esto, esas ventas entran sin vínculo y los insights miden sobre un universo incompleto",
    ).toEqual([]);
  });

  // LA EXENCION SE VERIFICA, no se cree: si el writer dejara de insertar ventas, su razon sobra y hay que
  // quitarla. Una excepcion escrita una vez protege para siempre algo que ya cambio.
  it("y la exención declarada sigue cumpliendo su razón", () => {
    for (const [f, razon] of SIN_ORIGEN) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      expect(
        /insert\s+into\s+transactions|insert\(transactions\)/.test(src),
        `${f} ya no crea ventas, así que su exención ("${razon}") sobra`,
      ).toBe(true);
    }
  });

  // Y LA REDACCION ES LA MISMA EN LOS DOS CAMINOS: dos mensajes distintos para la misma regla hacen creer que
  // son dos reglas, y el dia que una se corrija la otra se queda atras.
  it("los dos caminos piden lo mismo con las mismas palabras", () => {
    const servicio = readFileSync("src/modules/payments/services/payments-service.ts", "utf8");
    const retroactiva = readFileSync("src/modules/payments/data/venta-retroactiva-writer.ts", "utf8");
    const frase = "Elige de qué consulta sale esta compra, o di por qué no sale de ninguna.";
    expect(servicio).toContain(frase);
    expect(retroactiva).toContain(frase);
  });
});
