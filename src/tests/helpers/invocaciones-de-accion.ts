import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Quita los comentarios CONSERVANDO los saltos de linea, para que el numero de linea que reporta el
 * candado siga apuntando al sitio real. `sinComentarios` colapsa los bloques y desplaza todo lo de abajo:
 * un candado que senala la linea equivocada hace perder el tiempo a quien lo lee.
 */
function sinComentariosPorLinea(src: string): string {
  const enBlanco = (m: string) => m.replace(/[^\n]/g, " ");
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, enBlanco)
    .replace(/\/\*[\s\S]*?\*\//g, enBlanco)
    .replace(/\/\/[^\n]*/g, enBlanco);
}

// ═══ QUE INVOCACIONES DE SERVER ACTION HAY, Y CUALES ARMAN EL GUARD DEL SCROLL ═══
//
// SE MIRA CADA LLAMADA, NO CADA ARCHIVO, y esa distincion ya nos costo dos rondas.
//
// El barrido del 2026-09-10 conto ARCHIVOS: "este archivo usa `enviarSinReset`, luego esta cubierto". Y
// `generate-diagnosis-panel.tsx` pasaba verde teniendo DOS caminos: el boton de reintentar (que va por
// `enviarSinReset`) y el DISPARO AUTOMATICO, que invoca la accion a pelo desde un efecto y no armaba nada.
// Justo el que Santiago reportaba.
//
// Es el mismo defecto que el primer candado del refresco, que tambien miraba el archivo entero y acusaba a
// quien no era. La forma correcta es la misma: emparejar cada USO con su guarda.
//
// ═══ Y HAY DOS FORMAS DE INVOCAR, NO UNA (Santiago, 2026-09-10, sexta ronda) ═══
//
// La primera version de esto solo miraba `useActionState`, y con eso no vio `bis-conditions-capture.tsx`,
// que llama a la accion DIRECTO dentro de un `useTransition`. Justo el formulario que Santiago reporto
// despues. Un detector con un hueco es peor que ninguno: da por barrido lo que no miro.
//
// Asi que se buscan las DOS:
//   1. El segundo elemento de `useActionState`, que es lo que invoca la accion del formulario.
//   2. Y las llamadas a cualquier `*Action` importada de un modulo `actions`, que es como se nombran
//      todas en Atlas (lo comprueba `check-cables`, que cuenta 101 por ese mismo criterio).

export type Invocacion = {
  archivo: string;
  /** El nombre con el que se invoca la accion (el segundo elemento de `useActionState`). */
  accion: string;
  /** Linea (1-indexada) de la invocacion. */
  linea: number;
  /** Por donde le llega el guard, o null si por ninguno. */
  via: "enviarSinReset" | "ejecutarAccion" | "preservarScroll" | null;
};

function archivos(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (!/node_modules|\.next/.test(p)) archivos(p, acc);
    } else if (/\.tsx?$/.test(e.name)) acc.push(p.split("\\").join("/"));
  }
  return acc;
}

/**
 * Todas las invocaciones de una server action de la app, con la via por la que se arma el guard.
 *
 * COMO SE RECONOCE UNA: el segundo elemento de `useActionState` es lo que INVOCA la accion. Se capturan
 * esos nombres por archivo y despues se buscan sus llamadas. Asi no hace falta una lista a mano de
 * acciones, que envejeceria a la primera que alguien agregue.
 */
export function invocacionesDeAccion(): Invocacion[] {
  const salida: Invocacion[] = [];
  for (const f of archivos("src")) {
    if (f.includes("/tests/")) continue;
    // SIN COMENTARIOS, o el detector se caza a si mismo: en el panel de tratamiento hay comentarios que
    // dicen "no hay nada que guardar (guardarlo la congelaria...)" y "guardar(" ahi parece una llamada.
    // Se conservan las lineas (se sustituye por vacio, no se colapsa) para que el numero siga sirviendo.
    const src = sinComentariosPorLinea(readFileSync(f, "utf8"));
    // `const [estado, INVOCAR, pendiente] = useActionState(...)`
    const nombres = [...src.matchAll(/const\s*\[[^,\]]*,\s*(\w+)[,\]][^=]*=\s*useActionState\(/g)].map(
      (m) => m[1],
    );

    const lineas = src.split("\n");
    // Las acciones importadas y llamadas directo (`await saveBisConditionsAction(...)`).
    const importadas = [...src.matchAll(/import \{([^}]*)\} from "[^"]*actions"/g)]
      .flatMap((m) => m[1].split(","))
      .map((x) => x.trim().split(" as ").pop()!.trim())
      .filter((x) => /Action$/.test(x));

    for (const nombre of [...nombres, ...importadas]) {
      for (let i = 0; i < lineas.length; i++) {
        const l = lineas[i];
        // La DECLARACION no es una invocacion.
        if (new RegExp(`\\[[^\\]]*\\b${nombre}\\b[^\\]]*\\]\\s*=\\s*useActionState`).test(l)) continue;
        if (!new RegExp(`\\b${nombre}\\s*\\(`).test(l)) continue;

        // Por donde le llega el guard: en la misma linea (las dos puertas lo arman dentro) o en las tres
        // anteriores (una llamada suelta precedida de `preservarScroll()`).
        const contexto = lineas.slice(Math.max(0, i - 3), i + 1).join("\n");
        const via = new RegExp(`enviarSinReset\\(\\s*${nombre}\\b`).test(l)
          ? ("enviarSinReset" as const)
          : new RegExp(`ejecutarAccion\\(\\s*${nombre}\\b`).test(l)
            ? ("ejecutarAccion" as const)
            : contexto.includes("preservarScroll()")
              ? ("preservarScroll" as const)
              : null;
        salida.push({ archivo: f, accion: nombre, linea: i + 1, via });
      }
    }
  }
  return salida;
}
