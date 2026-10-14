import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ═══ CANDADO: ADMIN PUEDE DECIR QUE LA UNIDAD SALIO DE LA BODEGA, Y SU RESPUESTA VIAJA ═══
//
// EL CASO (Santiago, 2026-10-14): *"hay que revisar los casos en que un profesional hizo venta de productos
// que ya se le habian acabado en el consultorio, entonces que exista la opcion en admin de poner que esa
// venta salio desde la bodega y no desde el integrante"*.
//
// ── POR QUE ESTE CANDADO ES ESTATICO, Y NO UN TEST DEL SERVICIO ─────────────────────────────────
//
// Porque el servicio YA FUNCIONABA. El camino entero existia desde el 2026-09-26: la accion lee
// `desdeLaBodega` del formulario, el escritor se lo pasa a `ubicacionDeLaVenta`, y la venta cae en el aviso
// de "pagada y sin entregar". Lo unico que faltaba era la PREGUNTA en /pagos, y una pregunta que no se hace
// es invisible a cualquier test de servicio: el objeto llega sin el campo y todo pasa en verde.
//
// Es la misma familia de [[pieza-terminada-sin-el-ultimo-cable]] y de [[guard-sin-superficie-que-lo-alcance]]:
// la maquinaria completa y nadie que pueda accionarla.
//
// ── LAS TRES COSAS QUE SOSTIENE ─────────────────────────────────────────────────────────────────
//
//   1. QUE EL VALOR VIAJE EN UN CAMPO OCULTO, dentro del formulario. Un `name` en la casilla no bastaria:
//      este formulario se envia a mano (`ejecutarAccion`), y en un envio propio el `name` del control de
//      envio no viaja (hazard 5). Y una casilla sin marcar no manda nada, asi que el campo oculto es lo que
//      hace que "no, sale de su vitrina" sea una respuesta explicita y no una ausencia.
//   2. QUE SOLO SE LE OFREZCA A ADMIN. Al Integrante la pregunta correcta ya existe y vive en la consulta,
//      donde aparece sola si su vitrina esta en cero. Ofrecersela aqui seria invitarlo a descontar de una
//      bodega que no es suya.
//   3. QUE LA ACCION LO LEA. Si la accion dejara de leerlo, la casilla seguiria marcandose y la venta
//      seguiria saliendo de la vitrina, sin que nada falle.

const FORMULARIO = "src/modules/payments/components/register-cash-sale-form.tsx";
const TARJETA = "src/modules/payments/components/tarjeta-de-cobro.tsx";
const PAGINA = "src/app/(app)/pagos/page.tsx";
const ACCIONES = "src/modules/payments/actions.ts";
const UBICACION = "src/modules/payments/data/inventario-de-venta.ts";

const leer = (p: string): string => sinComentarios(readFileSync(p, "utf8"));

describe("la venta puede salir de la bodega, y admin lo dice en /pagos", () => {
  it("el valor viaja en un campo oculto DENTRO del formulario", () => {
    const src = leer(FORMULARIO);
    expect(
      src,
      "sin el campo oculto, una casilla sin marcar no manda nada y el servidor no distingue " +
        '"sale de su vitrina" de "no me preguntaron"',
    ).toMatch(/<input\s+type="hidden"\s+name="desdeLaBodega"/);
    // Y LA CASILLA NO LLEVA `name`: el valor lo manda el oculto, no ella.
    const casilla = src.slice(src.indexOf('name="desdeLaBodega"'));
    const hastaElCierre = casilla.slice(0, casilla.indexOf("</label>"));
    expect(hastaElCierre).toMatch(/type="checkbox"/);
    expect(
      hastaElCierre,
      "dos fuentes del mismo dato en el mismo envio: la que gane depende del orden",
    ).not.toMatch(/type="checkbox"[\s\S]{0,400}?name=/);
  });

  it("solo se le ofrece a admin, y la pagina le pasa quien mira", () => {
    const form = leer(FORMULARIO);
    expect(form, "la pregunta tiene que estar detras de la condicion de admin").toMatch(
      /esAdmin\s*\?[\s\S]{0,200}name="desdeLaBodega"/,
    );
    expect(leer(TARJETA), "la tarjeta tiene que reenviarlo al formulario").toMatch(/esAdmin=\{esAdmin\}/);
    expect(leer(PAGINA), "y la pagina tiene que pasarlo, que es el cable que suele faltar").toMatch(
      /esAdmin=\{esAdmin\}/,
    );
  });

  it("la accion lo lee, y la ubicacion de la venta lo usa", () => {
    expect(leer(ACCIONES)).toMatch(/formData\.get\("desdeLaBodega"\)/);
    expect(
      leer(UBICACION),
      "si la ubicacion dejara de mirarlo, la casilla quedaria de adorno y la venta saldria igual de la vitrina",
    ).toMatch(/desdeLaBodega/);
  });
});
