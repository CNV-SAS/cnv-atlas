import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ UN <form> DENTRO DE OTRO ES HTML INVALIDO, Y EL NAVEGADOR DESCARTA EL DE ADENTRO ═══
//
// EL BLOQUEO (Santiago, 2026-10-02): el botón "El paciente no los adquiere por ahora" abría su propio `<form>`,
// y ese bloque se monta DENTRO del formulario de la prescripción. Al construir el DOM, el navegador tira la
// etiqueta interna: sus campos y su botón pasan a ser del formulario de AFUERA.
//
// LOS DOS SINTOMAS, que es como se reporto: pulsar "Registrar" ejecutaba la accion de guardar la PRESCRIPCION
// (asi que no se registraba nada), y esa otra accion recargaba la seccion, con lo que la pantalla saltaba a
// otra pestaña. Dos cosas raras de un solo defecto, y ninguna apunta al anidamiento.
//
// POR QUE HACE FALTA UN CANDADO Y NO BASTA SABERLO: tsc compila, el lint calla y jsdom no reproduce el parseo
// del navegador. Es la misma familia que los seis hazards de formulario de CLAUDE.md (este entra como el
// septimo), y la unica forma de atraparlo sin un navegador es mirar el codigo.
//
// ── QUE MIRA, Y POR QUE ASI ──
//
// Un componente que abre `<form>` y se RENDERIZA dentro del `<form>` de otro. Como el anidamiento ocurre entre
// DOS ARCHIVOS (uno abre el form, el otro mete el componente), se busca el par: por cada archivo con `<form`,
// se miran los componentes que renderiza DENTRO de ese form, y se comprueba que ninguno abra uno a su vez.

const RAIZ = process.cwd();

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) {
      if (p.endsWith("/tests")) continue;
      out.push(...archivos(p));
    } else if (d.name.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

const FUENTES = archivos("src");

/** Los componentes (PascalCase) que `src` renderiza, con el archivo donde cada uno se define. */
const definidoEn = new Map<string, string>();
for (const f of FUENTES) {
  const src = readFileSync(join(RAIZ, f), "utf8");
  for (const m of src.matchAll(/export function ([A-Z][A-Za-z0-9_]*)/g)) definidoEn.set(m[1], f);
}

/** ¿El archivo abre un `<form>` propio? */
const abreForm = new Map<string, boolean>();
for (const f of FUENTES) {
  abreForm.set(f, /<form[\s>]/.test(sinComentarios(readFileSync(join(RAIZ, f), "utf8"))));
}

/** Los tramos de JSX que están DENTRO de un `<form ...>` ... `</form>` del archivo. */
function tramosDentroDeForm(src: string): string[] {
  const out: string[] = [];
  const re = /<form[\s>]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) != null) {
    const cierre = src.indexOf("</form>", m.index);
    out.push(src.slice(m.index, cierre === -1 ? src.length : cierre));
  }
  return out;
}

describe("ningun formulario de accion se anida dentro de otro", () => {
  it("hay archivos que barrer (si esto falla, el barrido no mira nada)", () => {
    // Sin este control, un recorrido que no encuentra nada dejaría el caso de abajo verde para siempre.
    expect(FUENTES.length).toBeGreaterThan(100);
    expect([...definidoEn.keys()].length).toBeGreaterThan(100);
    expect([...abreForm.values()].filter(Boolean).length).toBeGreaterThan(20);
  });

  it("ningun componente que abre <form> se renderiza dentro del <form> de otro", () => {
    const anidados: string[] = [];
    for (const f of FUENTES) {
      const src = sinComentarios(readFileSync(join(RAIZ, f), "utf8"));
      for (const tramo of tramosDentroDeForm(src)) {
        for (const m of tramo.matchAll(/<([A-Z][A-Za-z0-9_]*)[\s/>]/g)) {
          const hijo = definidoEn.get(m[1]);
          if (hijo && hijo !== f && abreForm.get(hijo)) {
            anidados.push(`${f} mete <${m[1]}> (de ${hijo}) dentro de su <form>`);
          }
        }
      }
    }
    expect(
      [...new Set(anidados)],
      "un <form> dentro de otro: el navegador descarta el de adentro, sus campos viajan en el envio de afuera " +
        "y su boton ejecuta la accion equivocada. El bloque de adentro va sin <form> (ver `ejecutarAccion`) o " +
        "fuera del formulario que lo contiene.",
    ).toEqual([]);
  });
});

// ═══ EL BLOQUE QUE FUE EL CASO, Y EL QUE OCUPO SU SITIO ═══
//
// EL CASO ORIGINAL fue "El paciente no los adquiere por ahora". Ese boton se retiro el 2026-10-10 (migracion
// 0214) y lo reemplaza "No prescribo nutraceuticos", que vive EN EL MISMO SITIO: dentro del formulario de la
// prescripcion. O sea que hereda el hazard entero.
//
// ES LA LECCION DEL SEGUNDO CONSTRUCTOR: cuando una pieza se reemplaza, la que llega empieza sin ninguno de
// los defectos resueltos de la anterior. Por eso el candado apunta al NUEVO, que es el que hoy puede romper,
// y de paso vigila que el viejo no vuelva a abrir un formulario mientras siga montado para leer el historico.
describe("el bloque que vive dentro del formulario de la prescripcion", () => {
  const leerSin = (rel: string) => sinComentarios(readFileSync(join(RAIZ, rel), "utf8"));
  const NUEVO = leerSin("src/modules/treatment/components/sin-prescripcion-form.tsx");
  const VIEJO = leerSin("src/modules/treatment/components/no-los-adquiere-form.tsx");

  it("no abre un <form> propio, ni el nuevo ni el viejo", () => {
    expect(NUEVO, "volvio el <form> anidado en el bloque nuevo").not.toMatch(/<form[\s>]/);
    expect(VIEJO, "volvio el <form> anidado en la nota vieja").not.toMatch(/<form[\s>]/);
  });

  it("y sus campos no llevan `name`: con nombre viajarian en el envio de afuera", () => {
    // La mitad del defecto que no se ve: aunque el boton no envie el formulario de afuera, un campo con
    // nombre seguiria colandose en ESE FormData y el servidor recibiria datos de un bloque que no pulso nadie.
    expect(NUEVO).not.toMatch(/name="(evaluationId|motivo)"/);
    expect(VIEJO).not.toMatch(/name="(evaluationId|decision|reason|note)"/);
  });

  it("el nuevo invoca la accion por el camino de los botones sin formulario", () => {
    expect(NUEVO).toMatch(/ejecutarAccion\s*\(/);
  });

  it("y sus botones son type=button: un submit enviaria la prescripcion", () => {
    // El otro sintoma del caso original: pulsar "Registrar" ejecutaba la accion de guardar la prescripcion.
    const botones = NUEVO.match(/<Button[\s\S]*?>/g) ?? [];
    expect(botones.length, "el bloque nuevo se quedo sin botones").toBeGreaterThan(0);
    for (const b of botones) {
      expect(b, `un <Button> del bloque nuevo no es type="button": ${b}`).toContain('type="button"');
    }
  });
});
