import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// CANDADO: UN FORMULARIO CON CAMPOS NO ARMA SU FormData A MANO.
//
// ═══ LO QUE PASO (smoke del 2026-09-29) ═══
//
// "Registrar una venta ya cobrada" armaba su envio con `new FormData()` VACIO y tres `fd.set`, asi que NADA de
// lo que estaba en el JSX viajaba. Tres campos se perdian y SOLO UNO SE QUEJABA:
//
//   · `treatmentId`: la venta se rechazaba con "elige de qué consulta sale esta compra" DESPUES de haberla
//     elegido. Ese bloqueo el smoke, y fue el unico que aviso.
//   · Los campos del DOMICILIO: se llenaban y la venta se creaba sin envio. EN SILENCIO.
//   · Y `canal`: TODA venta se registraba como EFECTIVO aunque se eligiera transferencia. En silencio, y con
//     consecuencia contable (el medio viaja a la factura y decide la cuenta del pago).
//
// ═══ POR QUE ES UN CANDADO Y NO SOLO UN ARREGLO ═══
//
// Es la misma familia del hazard 5 de CLAUDE.md (el `name` del boton no viaja en `new FormData(form)`), llevada
// al extremo: un FormData armado a mano no lleva NADA del formulario, y CADA CAMPO QUE ALGUIEN AGREGUE EN EL
// FUTURO NACE ROTO. El defecto no esta en los tres campos: esta en la forma de enviar.
//
// Y ES INVISIBLE A TODO LO DEMAS: tsc ve un FormData valido, lint no tiene nada que decir, y los tests de
// servicio reciben el objeto ya armado. Solo se ve en un navegador, o con este barrido.

const RAICES = ["src/modules", "src/app"];

/**
 * Componentes que SI arman su FormData a mano a proposito, con su razon.
 *
 * `venta-en-consulta-form` lo hace porque NO TIENE CAMPOS: su formulario son botones y su estado vive entero
 * en React (paciente y lineas vienen del tratamiento, no de inputs). Un FormData desde el elemento no
 * recogeria nada distinto, y el dia que le agreguen un campo este candado lo va a atrapar, porque entonces
 * dejara de cumplir la condicion de la excepcion.
 */
const A_MANO_A_PROPOSITO = new Map<string, string>([
  [
    "src/modules/treatment/components/venta-en-consulta-form.tsx",
    "no tiene campos con name: su formulario son botones y el estado vive en React",
  ],
]);

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) out.push(...archivos(p));
    else if (/\.tsx$/.test(d.name)) out.push(p);
  }
  return out;
}

describe("el FormData de un formulario con campos sale del formulario", () => {
  it("ningun componente con campos lo arma a mano", () => {
    const culpables: string[] = [];

    for (const raiz of RAICES) {
      for (const f of archivos(raiz)) {
        const src = sinComentarios(readFileSync(f, "utf8"));
        // `new FormData()` VACIO: el que no recoge nada.
        const aMano = /new\s+FormData\s*\(\s*\)/.test(src);
        if (!aMano) continue;
        // Y que el componente TENGA campos: un formulario de solo botones no pierde nada armandolo a mano.
        const tieneCampos = /\sname=\{?"/.test(src);
        if (!tieneCampos) continue;
        // ── LO QUE SE VIGILA ES EL ENVIO DEL FORMULARIO, NO CUALQUIER ENVIO ──
        //
        // Un componente puede tener, ADEMAS de su envio, acciones laterales con payload MINIMO a proposito:
        // el disparo automatico del diagnostico manda solo la evaluacion, y el codigo de verificacion de la
        // firma manda solo la sesion y el codigo. Mandarles el formulario entero seria lo incorrecto.
        //
        // Asi que la condicion es que el componente recoja el formulario EN ALGUN SITIO: con
        // `enviarSinReset` (que hace `new FormData(form, submitter)`) o con un `new FormData(algo)`. Si no
        // lo hace en ninguno, sus campos no viajan por ningun camino, y ese es el defecto.
        const recogeElFormulario =
          /enviarSinReset/.test(src) || /new\s+FormData\s*\(\s*[^)\s]/.test(src);
        if (recogeElFormulario) continue;
        if (A_MANO_A_PROPOSITO.has(f)) continue;
        culpables.push(f);
      }
    }

    expect(
      culpables,
      'arman su FormData con `new FormData()` vacio teniendo campos con `name`: esos campos NO VIAJAN, y cada uno que se agregue despues nacera roto. Parte de `new FormData(form)` y añade encima lo que no es un campo.',
    ).toEqual([]);
  });

  // LA EXCEPCION SE VERIFICA, no se cree: si `venta-en-consulta-form` gana un campo con `name`, su razon deja
  // de ser cierta y hay que sacarla de la lista. Sin esto, una excepcion escrita una vez protege para siempre
  // algo que ya cambio.
  it("y la excepcion declarada sigue cumpliendo su razon: no tiene campos", () => {
    for (const [f, razon] of A_MANO_A_PROPOSITO) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      expect(/\sname=\{?"/.test(src), `${f} ya tiene campos, asi que su excepcion ("${razon}") dejo de valer`).toBe(
        false,
      );
    }
  });
});

// ═══ Y EL BOTON QUE ENVIA TIENE QUE VIAJAR CON EL FORMULARIO ═══
//
// EL BLOQUEO DEL 2026-09-30, y es la segunda cara del mismo defecto: `new FormData(form)` NO incluye el
// `name`/`value` del boton que disparo el envio. Eso solo lo hace el envio nativo, o `new FormData(form,
// submitter)`.
//
// El sintoma fue el peor posible: pulsar "Registrarlo así" NO HACIA NADA. El servidor no recibia la
// confirmacion, volvia a calcular el mismo aviso y lo devolvia, asi que la pantalla mostraba lo mismo que ya
// mostraba. Ni error ni venta.
//
// YA HABIA UN CANDADO PARA ESTO (`enviar-sin-reset-submitter`), y no sirvio: cubre el HELPER, y este
// formulario arma su envio a mano. Es la misma leccion de toda la semana, por tercera vez: UN CANDADO POR
// CASO NO PROTEGE UNA REGLA. Por eso este barre.
describe("el boton que envia viaja con el formulario", () => {
  it("ningun componente que arme el FormData olvida el submitter teniendo botones con name", () => {
    const culpables: string[] = [];

    for (const raiz of RAICES) {
      for (const f of archivos(raiz)) {
        const src = sinComentarios(readFileSync(f, "utf8"));
        // Solo los que arman el FormData ELLOS MISMOS desde el formulario: `enviarSinReset` ya pasa el boton
        // y tiene su propio candado.
        const armaDesdeElForm = /new\s+FormData\s*\(\s*[^)\s]/.test(src);
        if (!armaDesdeElForm) continue;
        // Y que tengan un boton de ENVIO que lleve su dato en el `name`: si ninguno lo lleva, no hay nada que
        // perder.
        const botonConNombre = /type="submit"[\s\S]{0,200}?\sname="/.test(src);
        if (!botonConNombre) continue;
        if (!/submitter/.test(src)) culpables.push(f);
      }
    }

    expect(
      culpables,
      "arman el FormData desde el formulario y tienen botones de envio con `name`, pero no pasan el submitter: ese dato NO VIAJA y el boton parece no hacer nada. Usa `new FormData(form, submitter)`.",
    ).toEqual([]);
  });
});
