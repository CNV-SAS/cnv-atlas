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
const BLOQUE = "src/modules/payments/components/bloque-tratamiento.tsx";

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

  // ═══ Y SE COMPRUEBA QUE EL BLOQUE SIGUE OFRECIENDO LA SALIDA ═══
  //
  // Si alguien quitara la casilla, el barrido de arriba dejaria de mirar este archivo y pasaria en verde sin
  // proteger nada. Un candado cuyo disparador se puede borrar sin que nadie se entere no es un candado.
  it("y el bloque de la consulta sigue teniendo su salida y su campo", () => {
    const src = sinComentarios(readFileSync(BLOQUE, "utf8"));
    expect(OFRECE_SALIDA.test(src), "el bloque dejó de ofrecer la salida").toBe(true);
    expect(src, "el bloque dejó de pedir el motivo al tomar la salida").toContain("valor.motivo");
  });
});

// ═══ Y DONDE SE EXIGE AHORA, QUE YA NO ES EL NAVEGADOR (Santiago, 2026-10-10) ═══
//
// ── QUE CAMBIO ──
//
// El bloque SALIO del formulario: vive en la tarjeta de cobro, encima, porque montarlo dentro de cada
// formulario es lo que producia los minibloques apilados que Santiago reporto tres dias seguidos. Y un
// control que no es campo de un formulario NO LO VALIDA EL NAVEGADOR: dejar ahi un obligatorio seria una
// bandera que nadie lee, que es peor que no tenerla (ver la memoria de la bandera ignorada).
//
// ── ASI QUE LA EXIGENCIA SE MUDO AL BOTON, Y ES MAS ESTRICTA ──
//
// `consultaRespondida` es UNA sola funcion, al lado del bloque, que define que cuenta como respondido (una
// consulta elegida, o la salida CON su motivo escrito), y los tres formularios que usan el bloque apagan su
// boton mientras no lo este. El navegador avisaba AL PULSAR; esto lo dice desde el principio.
//
// ── POR QUE ESTO ES LO QUE HAY QUE VIGILAR AHORA ──
//
// Porque es el mismo riesgo del bloqueo del 2026-09-30, girado: entonces la salida no se podia tomar; ahora,
// sin este gate, la salida se podria tomar SIN MOTIVO y la venta quedaria suelta sin que nadie lo diga, que es
// justo lo que el bloque existe para evitar.
describe("la exigencia vive en el botón, porque el bloque salió del formulario", () => {
  const CONSUMIDORES = [
    "src/modules/payments/components/register-cash-sale-form.tsx",
    "src/modules/payments/components/create-checkout-form.tsx",
    "src/modules/payments/components/venta-retroactiva-form.tsx",
  ];

  it("el bloque no deja un obligatorio inerte en sus controles", () => {
    const src = sinComentarios(readFileSync(BLOQUE, "utf8"));
    expect(
      src,
      "volvió un `required` al bloque: ya no es campo de ningún formulario, así que el navegador no lo valida y la bandera engaña",
    ).not.toMatch(/\brequired\b/);
  });

  it("y define UNA sola vez qué cuenta como respondido", () => {
    const src = readFileSync(BLOQUE, "utf8");
    expect(src).toMatch(/export function consultaRespondida/);
    // LA SALIDA EXIGE SU MOTIVO. Sin esta mitad, marcar la casilla bastaria y la venta quedaria suelta sin
    // que nadie dijera por que, que es el defecto que el bloque entero viene a cerrar.
    expect(src).toContain('c.suelta ? c.motivo.trim().length > 0 : c.treatmentId !== ""');
  });

  it.each(CONSUMIDORES)("%s apaga su botón mientras no esté respondido", (ruta) => {
    const src = sinComentarios(readFileSync(ruta, "utf8"));
    expect(src, ruta + " no mira si la consulta está respondida").toMatch(/consultaRespondida/);
    // Y LO MIRA EN EL `disabled`, no solo lo recibe: un valor calculado que no entra en el gate es la
    // bandera ignorada otra vez.
    const gates = src.match(/disabled=\{[^}]*\}/g) ?? [];
    expect(
      gates.some((g) => /falta != null|consultaRespondida/.test(g)),
      ruta + " calcula si falta la consulta pero no lo usa para apagar el botón",
    ).toBe(true);
  });

  it("y los tres dicen en el rótulo del botón que falta decirlo", () => {
    // UN BOTON MUERTO SIN EXPLICACION ES PEOR QUE UN ERROR CLARO, y lo dice este proyecto en el propio
    // formulario de ventas retroactivas. Apagar el boton sin decir por que repite el defecto que acabamos de
    // cerrar en la prescripcion: el profesional no sabe que le falta y prueba cosas.
    for (const ruta of CONSUMIDORES) {
      const src = sinComentarios(readFileSync(ruta, "utf8"));
      expect(src, ruta + " apaga el botón sin decir que falta la consulta").toContain(
        "Di de qué consulta sale",
      );
    }
  });
});
