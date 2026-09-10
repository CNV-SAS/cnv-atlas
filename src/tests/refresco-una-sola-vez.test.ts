import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// UN SOLO CICLO DE REFRESCO POR GUARDADO. Candado de la REGLA, no de un archivo.
//
// LA REGLA: si una pantalla refresca con `useFormToastAndRefresh` o `useFormToastRefreshOnSuccess`, su
// server action NO puede llamar a `revalidatePath`. Uno de los dos, nunca los dos.
//
// POR QUE IMPORTA, y son dos razones distintas que apuntan al mismo sitio:
//
//   1. EL TOAST SE PIERDE. Es el motivo por el que los hooks existen y esta escrito en su propio archivo:
//      si la accion revalida, el formulario se DESMONTA antes de que el efecto dispare el toast.
//
//   2. Y EL SALTO AL INICIO, que es lo que trajo este candado (smoke de Santiago, 2026-09-09). Invocar
//      una server action navega con `ScrollBehavior.Default`, que scrollea al montar los segmentos
//      nuevos; `preservarScroll` lo deshace, pero se DESARMA en cuanto restaura la posicion entera. Con
//      revalidate + refresh hay DOS renders que montan segmentos, o sea DOS saltos separados en el
//      tiempo: el guard deshace el primero, se desarma, y el segundo llega sin nadie mirando. El sintoma
//      es exactamente el reportado, "me hizo scroll hacia arriba como un segundo despues".
//
// EL DATO QUE SEPARO LAS HIPOTESIS: saliendo del campo con TAB, sin tocar el raton, TAMBIEN saltaba. Eso
// descarta que el `mousedown` del guardado al salir del campo desarmara el guard, y deja el doble ciclo.
//
// POR QUE UN CANDADO DE REGLA Y NO OTRO DE UN ARCHIVO. Esto ya tenia candado en las acciones del
// tratamiento (`aplicar-cambios-menu.test.ts`, smoke del 2026-08-31) y volvio a entrar en OTRO modulo,
// arreglando otra cosa. Un candado que mira un archivo no puede ver eso: la regla vive en todos los
// sitios donde hay un formulario que refresca, asi que el candado tiene que barrerlos todos.

const HOOKS_QUE_REFRESCAN = ["useFormToastAndRefresh", "useFormToastRefreshOnSuccess"];

const SRC = "src";
function archivos(dir: string, out: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const p = join(dir, nombre);
    if (statSync(p).isDirectory()) archivos(p, out);
    else if (/\.tsx?$/.test(nombre)) out.push(p);
  }
  return out;
}

/** Resuelve un especificador (`@/...` o relativo) al archivo real. `null` si es un paquete externo. */
function resolverImport(desde: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = resolve(SRC, spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(desde), spec);
  else return null;
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(c)) return c;
  }
  return null;
}

/** De donde viene un identificador importado en un archivo. */
function moduloDe(src: string, archivo: string, nombre: string): string | null {
  const re = /import\s+(?:type\s+)?([^;'"]*?)\s+from\s+(['"])([^'"]+)\2/g;
  for (const m of src.matchAll(re)) {
    const clausula = m[1];
    if (!new RegExp(`\\b${nombre}\\b`).test(clausula)) continue;
    return resolverImport(archivo, m[3]);
  }
  return null;
}

/** El cuerpo de una funcion exportada, SIN comentarios: de su firma hasta el siguiente `export`. */
function cuerpoDeAccion(src: string, nombre: string): string | null {
  const i = src.indexOf(`export async function ${nombre}(`);
  if (i === -1) return null;
  const j = src.indexOf("\nexport ", i + 1);
  return sinComentarios(src.slice(i, j === -1 ? undefined : j));
}

/**
 * Cada par (pantalla que refresca, accion que consume).
 *
 * SE EMPAREJA POR LA VARIABLE DE ESTADO, no por el archivo, y hace falta: `antropometria-editable` tiene
 * los DOS hooks: las correcciones usan el que no refresca (y su accion SI revalida, que es correcto) y el
 * guardado de las medidas usa el que refresca. Mirando el archivo entero, las correcciones salian
 * acusadas de un defecto que no tienen. Un candado que acusa de mas se acaba desactivando.
 *
 * Y SE PARTE POR FUNCIONES antes de emparejar, porque el nombre `state` se repite en los dos componentes
 * del mismo archivo: fuera de su funcion, ese nombre no identifica nada.
 */
const pares: { pantalla: string; accion: string; modulo: string }[] = [];
for (const archivo of archivos(SRC)) {
  const src = readFileSync(archivo, "utf8");
  if (!HOOKS_QUE_REFRESCAN.some((h) => new RegExp(`${h}\\s*\\(`).test(src))) continue;
  const bloques = src.split(/\n(?=(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s)/);
  for (const bloque of bloques) {
    for (const m of bloque.matchAll(/const\s*\[\s*(\w+)[^\]]*\]\s*=\s*useActionState\(\s*(\w+)/g)) {
      const [, variable, accion] = m;
      const refresca = HOOKS_QUE_REFRESCAN.some((h) =>
        new RegExp(`${h}\\s*\\(\\s*${variable}\\b`).test(bloque),
      );
      if (!refresca) continue;
      const modulo = moduloDe(src, archivo, accion);
      if (modulo) pares.push({ pantalla: archivo, accion, modulo });
    }
  }
}

describe("un guardado refresca UNA vez: o la accion revalida, o la pantalla refresca", () => {
  it("el barrido encuentra pantallas de verdad (control del propio barrido)", () => {
    // SIN ESTO, UN BARRIDO ROTO PASA VERDE. Es la forma que ya nos mordio: un detector que no encuentra
    // nada no se distingue de un repositorio limpio. Se afirma la REGLA (que encuentra pares), no una
    // cifra: la cifra se relajaria sola en cuanto alguien añada o quite un formulario.
    expect(pares.length, "el barrido no encontro ninguna pantalla que refresque").toBeGreaterThan(0);
    // Y el sitio del defecto real tiene que estar DENTRO de lo que se mira. Si el barrido deja de
    // alcanzarlo, esto se pone rojo aunque el resto siga verde.
    expect(
      pares.some((p) => p.accion === "saveMedidasProfesionalAction"),
      "el guardado de las medidas del profesional se salio del barrido",
    ).toBe(true);
  });

  it("ninguna de esas acciones revalida", () => {
    const culpables: string[] = [];
    for (const { pantalla, accion, modulo } of pares) {
      const cuerpo = cuerpoDeAccion(readFileSync(modulo, "utf8"), accion);
      if (cuerpo === null) continue; // no es una accion exportada en ese modulo
      if (cuerpo.includes("revalidatePath(")) culpables.push(`${accion} (${modulo}) <- ${pantalla}`);
    }
    expect(
      culpables,
      "Estas acciones revalidan Y su pantalla refresca. Los dos ciclos montan segmentos dos veces, y " +
        "`preservarScroll` solo deshace el primero: la pagina salta al inicio un segundo despues del " +
        "toast. Ademas el formulario puede desmontarse antes de que se vea el toast. Deja el refresco en " +
        "la pantalla y quita el `revalidatePath` de la accion.",
    ).toEqual([]);
  });

  it("y el helper sigue diciendo por que", () => {
    // El comentario del helper es donde vive la razon. Si alguien lo borra, el candado queda sin
    // explicacion y el proximo lo lee como codigo que sobra, que es como volvio la vez pasada.
    const helper = readFileSync("src/components/shared/use-form-toast.ts", "utf8");
    expect(helper).toContain("la acción NO revalida");
  });
});
