import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA SUITE NO DEJA BASURA EN LA BASE  ·  2026-11-15  ·  CANDADO DE LA REGLA, NO DE UN ARCHIVO
//
// ═══ LO QUE COSTO, MEDIDO ═══
//
// **20.341 filas en `nutraceuticals`** contra 15 productos reales, acumuladas durante meses: una por caso
// y por corrida de la suite de BD. No era un test, eran SEIS:
//
//   TEST ANULAR      12.369  ·  TEST VENTA        6.544  ·  CATALOGO PRUEBA    652
//   CATALOGO REAL       326  ·  TABLERO PRUEBA      331  ·  BODEGA PRUEBA      119
//
// ═══ Y EL DAÑO APARECIO EN OTRO ARCHIVO, QUE ES LO QUE LO HIZO CARO ═══
//
// `getOwnInventory` armaba el catalogo con un `id.in.(...)` sin tope. Con veinte mil ids la URL de
// PostgREST se pasa de largo y responde `URI too long`, asi que **`saldo-por-lote-db` salia ROJO por una
// razon que no tiene nada que ver con lo que prueba**. Un rojo cuyo origen esta en otro archivo y en datos
// acumulados se diagnostica mal (parece un defecto del cambio que uno acaba de hacer), y encima TAPABA el
// defecto real, que era de produccion: ese `.in()` revienta con 200 a 400 productos con saldo y el
// catalogo real tiene 125.
//
// ═══ POR QUE UN CANDADO DE LA REGLA ═══
//
// Porque son ONCE archivos los que insertan en `nutraceuticals`, y la limpieza se olvida de a uno. Lo que
// este caso exige es la FORMA: quien inserta un producto, lo registra para borrarlo. No comprueba que la
// base quede limpia (eso lo dice la base, y un test que mire cifras de la base envejece): comprueba que
// nadie vuelva a insertar sin registrar.
//
// ═══ LA LISTA DE EXCEPCIONES ES EXPLICITA, Y CADA UNA CON SU RAZON ═══
//
// Un candado sin excepciones declaradas se desactiva entero el primer dia que estorba. Las que hay son
// tests que insertan UNA fila fija y determinista (siempre el mismo id, o un nombre que no se multiplica),
// asi que no acumulan: insertarla otra vez no crea una fila nueva.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const DIR = "src/tests";

/**
 * Los que insertan UNA fila que no se multiplica, con su razon. Si uno de estos empieza a dejar filas, se
 * saca de aqui, no se amplia la lista.
 */
const SIN_ACUMULAR: Record<string, string> = {
  "mapa-alegra.test.ts": "un id fijo, upsert: la segunda corrida no crea otra fila",
  "reparto-sellado.test.ts": "un id fijo por caso, reutilizado entre corridas",
  "la-anterior-es-la-que-ocurrio-db.test.ts": "inserta dentro de una transaccion que se deshace",
  "saldo-por-lote-db.test.ts": "un nombre fijo, se reutiliza; es el test que el acumulado ponia rojo",
  "devolucion-fisica-db.test.ts": "un nombre fijo, se reutiliza",
  "la-central-no-despacha-lo-que-no-tiene-db.test.ts": "dos nombres fijos, se reutilizan",
};

/** Lo que cuenta como "registra para borrar". */
const REGISTRA = /registrarFixtureDeNutraceutico\s*\(|limpiarFixturesDeNutraceuticos\s*[(,)]/;

const archivos = readdirSync(DIR).filter((n) => /\.test\.tsx?$/.test(n));

describe("todo test que crea productos de prueba los borra al terminar", () => {
  it("el barrido encuentra tests de verdad (control del propio barrido)", () => {
    // SIN ESTO, UN BARRIDO ROTO PASA VERDE, que es la forma que ya nos mordio dos veces: un detector que
    // no encuentra nada no se distingue de un repositorio limpio.
    const insertan = archivos.filter((n) =>
      sinComentarios(readFileSync(join(DIR, n), "utf8")).includes("insert into nutraceuticals"),
    );
    expect(insertan.length, "el barrido no encontro ningun test que inserte productos").toBeGreaterThan(5);
    // Y LOS DOS QUE MAS DEJABAN tienen que estar DENTRO de lo que se mira.
    expect(insertan).toContain("venta-inventario.test.ts");
    expect(insertan).toContain("venta-anulacion-y-revision-db.test.ts");
  });

  it("ninguno inserta sin registrar la limpieza", () => {
    const culpables: string[] = [];
    for (const nombre of archivos) {
      const src = sinComentarios(readFileSync(join(DIR, nombre), "utf8"));
      if (!src.includes("insert into nutraceuticals")) continue;
      if (nombre in SIN_ACUMULAR) continue;
      if (!REGISTRA.test(src)) culpables.push(nombre);
    }
    expect(
      culpables,
      "Estos tests insertan en `nutraceuticals` y no registran la limpieza. Cada corrida deja una fila " +
        "por caso, y el acumulado reventó `getOwnInventory` con `URI too long` poniendo rojo a OTRO test. " +
        "Llama a `registrarFixtureDeNutraceutico(id)` justo después de insertar, y a " +
        "`limpiarFixturesDeNutraceuticos()` desde un `afterAll` de nivel de archivo. Si el test inserta " +
        "una fila fija que NO se multiplica, agrégalo a SIN_ACUMULAR con su razón.",
    ).toEqual([]);
  });

  it("y las excepciones declaradas siguen existiendo", () => {
    // Una excepcion a un archivo que ya no existe deja la lista mintiendo, y la proxima persona la lee
    // como que el candado cubre menos de lo que cubre.
    for (const nombre of Object.keys(SIN_ACUMULAR)) {
      expect(archivos, `la excepcion ${nombre} apunta a un archivo que no existe`).toContain(nombre);
    }
  });
});

// ── Y EL `.in()` QUE EL ACUMULADO REVENTABA, CON SU TOPE ────────────────────────────────────────
describe("el catalogo del inventario no arma una URL sin tope", () => {
  const SRC = sinComentarios(
    readFileSync("src/modules/nutraceuticals/services/inventory-service.ts", "utf8"),
  );

  it("va por tandas y paginado, con un orden estable", () => {
    expect(SRC, "volvio el `in` con todos los ids pegados").not.toContain("idsConSaldo.join(");
    expect(SRC).toContain("IDS_POR_TANDA");
    expect(SRC).toContain("PAGINA_DEL_CATALOGO");
    // PAGINAR SIN UN ORDEN ESTABLE no define que trae cada pagina: el motor puede devolver la misma fila
    // dos veces y perder otra, y el total sale mal por los dos lados a la vez.
    expect(SRC).toContain('.order("id")');
    expect(SRC).toContain(".range(desde, hasta)");
  });

  it("y el tope de ids deja margen de sobra para la URL", () => {
    const m = /const IDS_POR_TANDA = (\d+);/.exec(SRC);
    expect(m, "desaparecio el tope").not.toBeNull();
    const tope = Number(m![1]);
    // Una uuid con su coma son 37 caracteres. El limite tipico de URL son 8 KB, asi que hasta ~215 ids
    // caben; se pide la MITAD de ese margen para que el dia que se agregue una columna al select no
    // quedemos al borde.
    expect(tope * 37).toBeLessThan(8 * 1024 * 0.75);
    expect(tope, "un tope tan bajo haria una consulta por producto").toBeGreaterThan(50);
  });
});
