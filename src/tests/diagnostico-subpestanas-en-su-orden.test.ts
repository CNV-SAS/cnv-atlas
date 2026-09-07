import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { HTML_VIGENTE } from "./fixtures/html-vigente";
import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO DE LAS SUBPESTAÑAS DE DIAGNOSTICO · SON CUATRO Y VAN EN SU ORDEN (2026-09-07).
//
// EL DEFECTO: teniamos TRES (Funcional, Composicion, Encuesta) y su archivo tiene CUATRO, en el orden
// contrario. Nos lo devolvio en dos puntos de su cotejo:
//   · 7  — "en diagnostico, diagnostico encuesta debe ir primero".
//   · 11 — "el resumen del diagnostico generado por IA es aparte, no va dentro de ninguno de los 3 que
//          tienen, y va de ultimo. INSISTO, DEBE IR IGUAL A COMO ESTA EN el HTML".
//
// Y NO HABIA NINGUN CANDADO SOBRE ESTO. Al reordenar, la suite entera paso verde: 215 archivos, 2131
// pruebas, y ninguna miraba la estructura de subpestañas. Un orden que es instruccion suya sin nada que
// lo fije es exactamente lo que se vuelve a mover sin que nadie se entere.
//
// SE DERIVA DE SU ARCHIVO, NO SE ESCRIBE A MANO. Una lista escrita aqui seria una copia mas que envejece
// en silencio cuando el mande otra entrega, que es la familia de defectos que ya nos costo varias veces.
// El ancla es `HTML_VIGENTE`, que a su vez deriva la entrega mas reciente del directorio.

const NUESTRO = sinComentarios(
  readFileSync("src/modules/diagnoses/components/diagnosis-subtabs.tsx", "utf8"),
);
const RESULTADOS = sinComentarios(
  readFileSync("src/modules/diagnoses/components/evaluation-results.tsx", "utf8"),
);

/**
 * Los ids de SU array de subpestañas de diagnostico, en su orden.
 *
 * Su archivo tiene VARIOS arrays llamados TABS (el de Antrop&BIS, el del panel del profesional, el de
 * administracion). Se desambigua por CONTENIDO, no por posicion: el suyo es el unico que declara a la vez
 * `composicion` y `prof`. Anclar por linea seria una posicion, y una posicion se desincroniza sola en
 * cuanto el inserta algo mas arriba.
 */
function subpestanasDeSuArchivo(): string[] {
  const src = readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
  for (const m of src.matchAll(/const TABS = \[([\s\S]{0,600}?)\];/g)) {
    const ids = [...m[1].matchAll(/id\s*:\s*"([a-z]+)"/g)].map((x) => x[1]);
    if (ids.includes("composicion") && ids.includes("prof")) return ids;
  }
  throw new Error("no aparece el array de subpestañas de diagnostico en " + HTML_VIGENTE);
}

// SU id -> el nuestro. Es la unica traduccion escrita a mano, y tiene que serlo: son dos vocabularios.
// Su "prof" es nuestro "resumen" (el mismo panel: en el suyo lo escribe la IA, en el nuestro el
// profesional escribe encima del borrador).
const SU_ID_A_NUESTRO: Record<string, string> = {
  encuesta: "encuesta",
  composicion: "composicion",
  funcional: "funcional",
  prof: "resumen",
};

describe("las subpestañas de Diagnóstico salen de su archivo", () => {
  const suyas = subpestanasDeSuArchivo();

  it("el control: su archivo declara las cuatro", () => {
    // Sin este control, un cambio de forma en su archivo daria una lista vacia y todo lo de abajo pasaria
    // comparando nada contra nada.
    expect(suyas, `no se extrajeron sus subpestañas de ${HTML_VIGENTE}`).toHaveLength(4);
    expect(suyas.every((id) => SU_ID_A_NUESTRO[id]), `id suyo sin traducir: ${suyas.join(", ")}`).toBe(
      true,
    );
  });

  it("son las mismas cuatro, en el MISMO orden", () => {
    const esperado = suyas.map((id) => SU_ID_A_NUESTRO[id]);
    // El orden se lee del arreglo nuestro tal como se declara, que es el que pinta la fila de pestañas.
    const bloque = NUESTRO.slice(
      NUESTRO.indexOf("const SUBTABS"),
      NUESTRO.indexOf("];", NUESTRO.indexOf("const SUBTABS")),
    );
    const nuestras = [...bloque.matchAll(/id:\s*"([a-z]+)"/g)].map((m) => m[1]);
    expect(nuestras, "el orden de las subpestañas dejó de ser el de su archivo").toEqual(esperado);
  });

  it("y la cuarta tiene contenido, no es una pestaña vacía", () => {
    // Una pestaña que existe y no muestra nada es peor que no tenerla: cumple el cotejo por fuera y no
    // por dentro.
    expect(NUESTRO).toContain("resumen: ReactNode");
    expect(RESULTADOS).toContain("resumen={");
  });
});

describe("el criterio del profesional vive en la cuarta, no en Funcional (punto 11)", () => {
  it("se rinde dentro del slot `resumen`", () => {
    const iResumen = RESULTADOS.indexOf("resumen={");
    const iCriterio = RESULTADOS.indexOf("{criterio", iResumen);
    expect(iResumen, "desapareció el slot de la cuarta subpestaña").toBeGreaterThan(-1);
    expect(iCriterio, "el criterio no está dentro del slot `resumen`").toBeGreaterThan(iResumen);
  });

  it("y el par confirmar/corregir se queda en Funcional, que es otra cosa", () => {
    // LA DISTINCION, y por eso este caso existe: confirmar o corregir es un acto sobre la EVIDENCIA del
    // modelo, que es lo que muestra Funcional. El criterio es lo que el profesional escribe ENCIMA.
    // Mandar los dos a la cuarta habria dejado Funcional siendo una lectura sin salida.
    const iFuncional = RESULTADOS.indexOf("funcional={");
    const iComposicion = RESULTADOS.indexOf("composicion={");
    const iConfirm = RESULTADOS.indexOf("{confirmCorrect}");
    expect(iConfirm).toBeGreaterThan(iFuncional);
    expect(iConfirm, "el par confirmar/corregir se salió de Funcional").toBeLessThan(iComposicion);
  });
});
