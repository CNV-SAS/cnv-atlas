import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// UN SOLO CICLO DE REFRESCO POR GUARDADO. Candado de la REGLA, no de un archivo.
//
// LA REGLA: si una pantalla refresca tras una server action, esa accion NO puede llamar a
// `revalidatePath`. Uno de los dos, nunca los dos. Y "refrescar" son LAS DOS FORMAS:
//
//   · con los hooks `useFormToastAndRefresh` / `useFormToastRefreshOnSuccess`;
//   · O A MANO, con un `useEffect` que llama a `router.refresh()` al ver el estado de la accion.
//
// ═══ LA SEGUNDA FORMA SE AÑADIO EL 2026-11-15, Y LA PAGO UN SMOKE ═══
//
// Textual de Santiago: *"«El diagnóstico ya está generado, pero la pantalla no terminó de cargarlo»:
// pasa casi siempre y tarda unos 3 s. Mismo patrón del router.refresh"*. El panel del diagnostico usa
// `useFormToast` (el que NO refresca) y escribia el refresco a mano, asi que este candado no lo veia; y
// `runPipelineAction` revalida. Dos ciclos compitiendo, y el payload que acaba aplicandose puede ser el
// de antes: de ahi el "casi siempre". Al barrer la forma nueva aparecio un SEGUNDO sitio con el mismo
// defecto, la confirmacion de identidad, que nadie habia reportado. Es la razon por la que este archivo
// es un candado de REGLA: un hazard documentado sigue vivo donde nadie lo aplico.
//
// ═══ Y UN REFRESCO **TEMPORIZADO** NO ES EL SEGUNDO CICLO: ES UNA RED ═══
//
// El mismo panel conserva un efecto que refresca al volver a la pestaña y una vez a mitad de la espera,
// porque un payload se puede perder de verdad (pestaña en segundo plano, red que se cae). Eso no corre
// en el camino feliz: corre cuando el camino feliz ya fallo. Un candado que lo acusara obligaria a
// quitar la red, y un candado que acusa de mas se acaba desactivando. Asi que la frontera es explicita:
// un efecto con `setTimeout` o `addEventListener` es una red; uno que refresca y nada mas es el ciclo
// que sobra.
//
// POR QUE IMPORTA, y son dos razones distintas que apuntan al mismo sitio:
//
//   1. EL TOAST SE PIERDE. Es el motivo por el que los hooks existen y esta escrito en su propio archivo:
//      si la accion revalida, el formulario se DESMONTA antes de que el efecto dispare el toast.
//
//   2. Y EL SALTO AL INICIO, que es lo que trajo este candado (smoke de Santiago, 2026-09-09). Invocar
//      una server action navega con `ScrollBehavior.Default`, que scrollea al montar los segmentos
//      nuevos. Con revalidate + refresh hay DOS renders que montan segmentos, o sea DOS saltos separados
//      en el tiempo, y el sintoma es exactamente el reportado: "me hizo scroll hacia arriba como un
//      segundo despues".
//
//      DESDE EL 2026-09-10 `preservarScroll` YA SOBREVIVE al segundo salto (su ventana se reinicia
//      mientras la pagina se mueva, en vez de desarmarse al primer arreglo), asi que esta regla dejo de
//      ser lo unico que separa al profesional del defecto. **Se queda igual, y por su primera razon**:
//      dos ciclos siguen pudiendo desmontar el formulario antes de que se vea el toast, y un salto que se
//      deshace sigue siendo un salto que no tenia que ocurrir. Ahora hay dos capas donde habia una, que
//      es el orden correcto: la regla evita el movimiento, el guard cubre el que no se puede evitar.
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
/**
 * LOS CUERPOS DE CADA `useEffect` de un bloque, por conteo de llaves.
 *
 * Hace falta mirar DENTRO del efecto y no el archivo entero: el panel del diagnostico tiene un
 * `router.refresh()` en el `onClick` de su boton de ultima red ("Cargar los resultados"), que es
 * deliberado y lo pulsa una persona. Mirando el archivo, ese boton saldria acusado.
 */
function efectosDe(bloque: string): string[] {
  const out: string[] = [];
  let i = 0;
  while ((i = bloque.indexOf("useEffect(", i)) !== -1) {
    const abre = bloque.indexOf("{", i);
    if (abre === -1) break;
    let prof = 0;
    let k = abre;
    for (; k < bloque.length; k++) {
      if (bloque[k] === "{") prof++;
      else if (bloque[k] === "}" && --prof === 0) break;
    }
    out.push(bloque.slice(abre, k + 1));
    i = k + 1;
  }
  return out;
}

const pares: { pantalla: string; accion: string; modulo: string; forma: string }[] = [];
for (const archivo of archivos(SRC)) {
  const src = readFileSync(archivo, "utf8");
  const conHook = HOOKS_QUE_REFRESCAN.some((h) => new RegExp(`${h}\\s*\\(`).test(src));
  const conMano = src.includes("router.refresh()");
  if (!conHook && !conMano) continue;
  const bloques = sinComentarios(src).split(/\n(?=(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s)/);
  for (const bloque of bloques) {
    for (const m of bloque.matchAll(/const\s*\[\s*(\w+)[^\]]*\]\s*=\s*useActionState\(\s*(\w+)/g)) {
      const [, variable, accion] = m;
      const porHook = HOOKS_QUE_REFRESCAN.some((h) =>
        new RegExp(`${h}\\s*\\(\\s*${variable}\\b`).test(bloque),
      );
      // A MANO Y SIN TEMPORIZAR: el efecto refresca en cuanto ve el estado de la accion. Con
      // `setTimeout` o `addEventListener` dentro es una red y no cuenta (ver la cabecera).
      const porMano = efectosDe(bloque).some(
        (e) =>
          e.includes("router.refresh()") &&
          new RegExp(`\\b${variable}\\b`).test(e) &&
          !/setTimeout|addEventListener/.test(e),
      );
      if (!porHook && !porMano) continue;
      const modulo = moduloDe(src, archivo, accion);
      if (modulo) {
        pares.push({ pantalla: archivo, accion, modulo, forma: porHook ? "hook" : "router.refresh a mano" });
      }
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
    // Y LA FORMA A MANO TIENE QUE ESTAR DENTRO DE LO QUE SE MIRA. Sin esto, el barrido ampliado podria
    // dejar de alcanzar los refrescos escritos a mano y volveria a pasar verde con el defecto vivo. Se
    // comprueba contra el `survey-edit-form`, que refresca a mano y cuya accion NO revalida (o sea que
    // cumple la regla): un par correcto sirve igual de testigo de que el detector llega.
    expect(
      pares.some((p) => p.forma === "router.refresh a mano"),
      "el barrido dejo de ver los refrescos escritos a mano",
    ).toBe(true);
  });

  it("ninguna de esas acciones revalida", () => {
    const culpables: string[] = [];
    for (const { pantalla, accion, modulo, forma } of pares) {
      const cuerpo = cuerpoDeAccion(readFileSync(modulo, "utf8"), accion);
      if (cuerpo === null) continue; // no es una accion exportada en ese modulo
      if (cuerpo.includes("revalidatePath(")) {
        culpables.push(`${accion} (${modulo}) <- ${pantalla} [${forma}]`);
      }
    }
    expect(
      culpables,
      "Estas acciones revalidan Y su pantalla refresca. Los dos ciclos montan segmentos dos veces, o " +
        "sea que la pagina salta al inicio dos veces. Y compiten: el payload que acaba aplicandose puede " +
        "ser el de ANTES de la escritura, que es el defecto del 2026-11-15 («pasa casi siempre y tarda " +
        "unos 3 s»). Ademas el formulario puede desmontarse antes de que se vea el toast, que es la " +
        "razon original del helper. Deja UNO: o el refresco en la pantalla sin `revalidatePath`, o el " +
        "`revalidatePath` de la accion sin refresco en la pantalla.",
    ).toEqual([]);
  });

  it("y el helper sigue diciendo por que", () => {
    // El comentario del helper es donde vive la razon. Si alguien lo borra, el candado queda sin
    // explicacion y el proximo lo lee como codigo que sobra, que es como volvio la vez pasada.
    const helper = readFileSync("src/components/shared/use-form-toast.ts", "utf8");
    expect(helper).toContain("la acción NO revalida");
  });
});
