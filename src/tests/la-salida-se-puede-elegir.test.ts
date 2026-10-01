import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO: UN CAMPO OBLIGATORIO NO PUEDE TAPAR SU PROPIA SALIDA ═══
//
// EL BLOQUEO DEL 2026-09-30, y es el hazard 6 de CLAUDE.md. El bloque de "de qué consulta sale esta compra"
// tenia el desplegable con `required` A SECAS y, al lado, la casilla "No sale de ninguna consulta". Al
// marcarla, el desplegable vuelve a vacio y el NAVEGADOR bloquea el envio ("Selecciona un elemento de la
// lista"). O sea: la salida que construimos NO SE PODIA USAR.
//
// Y LA CONSECUENCIA NO ES QUE LA VENTA NO SE REGISTRE, es peor: el profesional elige la ultima consulta para
// poder cobrar, y un dato inventado se ve igual que uno bueno. Es justo el caso que el bloque dice evitar en
// su propio comentario ("el caso que hay que evitar NO es que la venta quede suelta: es que el profesional
// elija cualquiera para poder cobrar").
//
// POR QUE ES ESTATICO: la validacion la hace el navegador, no el codigo. tsc la compila, lint no tiene nada
// que decir, y un test de servicio recibe el objeto ya armado. Solo se ve en un navegador real, o con esto.

const RAICES = ["src/modules", "src/app"];

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) out.push(...archivos(p));
    else if (/\.tsx$/.test(d.name)) out.push(p);
  }
  return out;
}

/** Las palabras con las que un componente ofrece una salida al campo obligatorio de al lado. */
const OFRECE_SALIDA = /No sale de ninguna consulta|no sale de ninguna/i;

describe("la salida de un campo obligatorio se puede elegir de verdad", () => {
  it("ningún componente que ofrezca una salida deja un obligatorio incondicional", () => {
    const culpables: string[] = [];
    for (const raiz of RAICES) {
      for (const f of archivos(raiz)) {
        const src = sinComentarios(readFileSync(f, "utf8"));
        if (!OFRECE_SALIDA.test(src)) continue;
        // ── SE MIRA EL DESPLEGABLE, NO TODO EL ARCHIVO ──
        //
        // La primera version buscaba cualquier `required` suelto y culpaba a este mismo bloque por el campo
        // del MOTIVO, que solo se renderiza cuando la salida esta marcada: ahi `required` es correcto. Lo que
        // no puede ser incondicional es el campo QUE LA SALIDA SUSTITUYE, y ese es el `<select>`.
        for (const tag of src.match(/<select[\s\S]*?>/g) ?? []) {
          if (/^\s*required\s*$/m.test(tag)) culpables.push(f);
        }
      }
    }
    expect(
      culpables,
      'ofrecen una salida ("no sale de ninguna consulta") y tienen un campo con `required` incondicional: el navegador bloquea el envío al tomar la salida, así que la salida no es alcanzable. Hazlo condicional (`required={!suelta}`)',
    ).toEqual([]);
  });

  // Y SE COMPRUEBA QUE EL BLOQUE SIGUE OFRECIENDO LAS DOS COSAS: si alguien quitara la casilla, el barrido de
  // arriba dejaria de mirar este archivo y pasaria en verde sin proteger nada. Un candado cuyo disparador se
  // puede borrar sin que nadie se entere no es un candado.
  it("y el bloque de la consulta sigue teniendo su salida y su campo", () => {
    const src = sinComentarios(
      readFileSync("src/modules/payments/components/bloque-tratamiento.tsx", "utf8"),
    );
    expect(OFRECE_SALIDA.test(src), "el bloque dejó de ofrecer la salida").toBe(true);
    expect(src).toMatch(/required=\{!suelta\}/);
    // Y NO SE RESUELVE CON `disabled`: un campo deshabilitado no viaja en el FormData (hazard 4), y el
    // servidor necesita recibirlo vacio para saber que la compra va suelta.
    // El `\s` NO es cosmetico: sin el, el patron tambien casa dentro de `aria-disabled={suelta}`, que es
    // justo lo que SI queremos. Lo descubrio este caso fallando contra el arreglo correcto.
    expect(src).not.toMatch(/\sdisabled=\{suelta\}/);
  });
});
