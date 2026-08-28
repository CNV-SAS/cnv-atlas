import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// CANDADO DE LA FRONTERA ENTRE LAS DOS CAPAS DE COLOR (rediseño global 2026-08-28).
//
// Atlas tiene DOS sistemas de color y la separacion es de AUTORIDAD, no de gusto:
//
//   - CAPA CLINICA (`clinical-*`): codifica VEREDICTO. Sus hexadecimales salen de los clasificadores de
//     Gildardo (el naranja de Moderado es el hex exacto de su `_DFI_SEVC`; el sky de `excellent` es la
//     banda mejor de su escala de 4). Que el verde signifique optimo y el rojo critico no es preferencia
//     nuestra: es su semaforo. NO SE TOCA.
//   - CAPA DE INTERFAZ (`nav-accent`, `surface-sunken`, `primary`): es nuestra y es libre.
//
// LO QUE ESTE CANDADO IMPIDE: que el acento de NAVEGACION se cuele en un componente que pinta veredicto.
// Ese es el modo de fallo concreto que hemos visto cuatro veces esta semana (el azul del desnutrido, la
// capacitancia, el aviso de version, el chip de revocacion): un tono que el usuario ya aprendio a leer
// como significado clinico, usado para otra cosa. Si el acento de navegacion aparece junto a una
// severidad, el profesional no tiene forma de saber cual de los dos codigos esta leyendo.
//
// Se comprueba sobre el CODIGO FUENTE y no sobre el render: la regla es "estos dos vocabularios no se
// mezclan en un archivo", y eso se ve en el archivo. Un test de render solo cubriria los casos que se
// renderizan en el test.

const CLINICO = /\bclinical-(excellent|optimal|warning|moderate|critical)\b/;
const NAV = /\bnav-accent(-bg)?\b/;

// El shell es el DUEÑO del acento de navegacion: es el unico sitio donde debe aparecer.
const DUENOS_DEL_ACENTO = ["src/components/layout/app-shell.tsx"];

// SE MIRA EL CODIGO SIN COMENTARIOS. La regla es sobre lo que un archivo PINTA, no sobre lo que MENCIONA:
// la primera version del candado se puso roja por un comentario del propio shell que explicaba por que el
// acento no es el azul clinico. Un candado que castiga explicar la regla empuja a borrar la explicacion.
function sinComentarios(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function archivosFuente(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) {
      if (nombre === "node_modules" || nombre === "tests") continue;
      archivosFuente(ruta, acc);
    } else if (/\.(ts|tsx|css)$/.test(nombre)) {
      acc.push(ruta.replace(/\\/g, "/"));
    }
  }
  return acc;
}

describe("frontera entre la capa de interfaz y la capa clinica", () => {
  const fuentes = archivosFuente("src");

  it("el acento de navegacion NO aparece en ningun archivo que pinte veredicto clinico", () => {
    const mezclados = fuentes.filter((f) => {
      if (f.endsWith("globals.css")) return false; // ahi se DECLARAN las dos capas, no se mezclan
      const src = sinComentarios(readFileSync(f, "utf8"));
      return NAV.test(src) && CLINICO.test(src);
    });
    expect(mezclados).toEqual([]);
  });

  it("el acento de navegacion vive SOLO donde le corresponde: el shell", () => {
    const usuarios = fuentes.filter(
      (f) => !f.endsWith("globals.css") && NAV.test(sinComentarios(readFileSync(f, "utf8"))),
    );
    expect(usuarios.sort()).toEqual(DUENOS_DEL_ACENTO);
  });

  it("los tokens clinicos siguen declarados con SU hexadecimal, no con uno de interfaz", () => {
    // El de Moderado es el unico del que tenemos el hex EXACTO de su archivo (`_DFI_SEVC`), asi que es el
    // que se ancla byte a byte: si alguien "armoniza" la paleta clinica con la de interfaz, esto cae.
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(css).toContain("--clinical-moderate: #ea580c");
    expect(css).toContain("--clinical-critical: #dc2626");
    expect(css).toContain("--clinical-optimal: #10b981");
    expect(css).toContain("--clinical-excellent: #0ea5e9");
  });

  it("el acento de navegacion NO es ninguno de los azules que ya significan algo", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    const nav = /--nav-accent:\s*([^;]+);/.exec(css)?.[1].trim();
    expect(nav).toBeDefined();
    expect(nav).not.toBe("#205dfd"); // azul de ACCION (botones, focus)
    expect(nav).not.toBe("#0ea5e9"); // azul CLINICO (banda mejor del DFI)
  });
});
