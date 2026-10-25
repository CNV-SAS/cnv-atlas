import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: EL BOTON DE IMPRIMIR ESTA EN TODAS LAS SUBPESTAÑAS, Y EN EL MISMO SITIO
//
// ── DE DONDE SALE ───────────────────────────────────────────────────────────────────────────────
//
// Gildardo, 2026-10-25: *"Gildardo lo pidio global. Santiago no ve el de Nutricionista: dile donde quedo.
// Ubicacion: arriba, debajo del menu de subpestañas, igual en todas. Hazlo ahora en TODAS las
// subpestañas, cada una con su hoja para papel (sin desplegables ni campos vacios)."*
//
// ── QUE DEFIENDE, Y POR QUE ESTA LISTA NO SE PUEDE DEJAR A LA MEMORIA ───────────────────────────
//
// Son nueve superficies. La forma en la que esto se rompe no es que alguien borre un boton: es que
// alguien AÑADA una subpestaña y no le ponga el suyo, y entonces "esta en todas" deja de ser cierto sin
// que nada falle. Por eso el candado enumera las superficies CON SU HOJA y exige que cada una exista.
//
// Y LA SEGUNDA MITAD IMPORTA IGUAL: que lo que sale sea un DOCUMENTO. La regla de impresion no quita los
// controles, asi que una pestaña de trabajo marcada imprimible pone en el papel los desplegables y los
// campos vacios. Cada superficie es de una de dos clases, y la clase decide que se exige:
//
//   · LECTURA (la pantalla ya es el documento): se imprime tal cual. Composicion, el read-out de la
//     encuesta, las rutas.
//   · TALLER (campos en vivo): su documento se arma aparte (`solo-impresion`) y el taller va `no-print`.
//     La prescripcion, la encuesta, la antropometria, el resumen y el seguimiento.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const leer = (f: string) => sinComentarios(readFileSync(f, "utf8"));

const PAGE = "src/app/(app)/ani-bis-e/[id]/page.tsx";
const DIAGNOSTICO = "src/modules/diagnoses/components/evaluation-results.tsx";
const ENTRADA = "src/modules/evaluations/components/entrada-evaluacion.tsx";

/** Las superficies con su hoja, y en que archivo se monta. */
const SUPERFICIES: { titulo: string; archivo: string }[] = [
  { titulo: "Encuesta del paciente", archivo: ENTRADA },
  { titulo: "Antropometría y bioimpedancia", archivo: ENTRADA },
  { titulo: "Composición corporal e índices", archivo: DIAGNOSTICO },
  { titulo: "Diagnóstico de la encuesta", archivo: DIAGNOSTICO },
  { titulo: "Resumen del diagnóstico", archivo: DIAGNOSTICO },
  { titulo: "Rutas de atención", archivo: PAGE },
  { titulo: "Seguimiento", archivo: PAGE },
];

describe("el boton de imprimir esta en todas las subpestañas", () => {
  it("cada superficie tiene su hoja, con su titulo", () => {
    // SE BUSCA EL TITULO, no el atributo: dos de las hojas eligen el suyo con un ternario (las dos
    // pestañas de entrada comparten un componente), y anclar a `titulo="..."` habria exigido una forma de
    // escribirlo en vez del hecho.
    for (const s of SUPERFICIES) {
      expect(
        leer(s.archivo).includes(`"${s.titulo}"`),
        `la hoja "${s.titulo}" desaparecio de ${s.archivo}`,
      ).toBe(true);
    }
  });

  it("y cada archivo con hojas DICE que imprime cada una", () => {
    // Sin esa linea, "Imprimir" en Encuesta y "Imprimir" en Composicion se leen igual, y quien pulsa no
    // sabe que va a salir. Es la razon por la que `queSale` es obligatorio en `HojaImprimible` y no
    // opcional: una hoja nueva no compila sin decir que lleva.
    const archivos = [...new Set(SUPERFICIES.map((s) => s.archivo))];
    for (const archivo of archivos) {
      const src = leer(archivo);
      const hojas = (src.match(/<HojaImprimible/g) ?? []).length;
      const dicen = (src.match(/queSale[=:]/g) ?? []).length;
      expect(hojas, `${archivo} dejo de montar hojas`).toBeGreaterThan(0);
      expect(dicen, `${archivo} tiene ${hojas} hojas y solo ${dicen} dicen que imprimen`).toBe(hojas);
    }
  });

  it("las DOS hojas de la prescripcion y las dos del diagnostico funcional siguen en pie", () => {
    // Estas dos no pasan por `HojaImprimible` porque su documento es un componente propio; se cuentan
    // aparte para que la lista de arriba no las de por cubiertas.
    expect(leer("src/modules/treatment/components/subpestana-del-profesional.tsx")).toContain(
      "<BarraDeImpresion",
    );
    const funcional = leer("src/modules/diagnoses/components/hoja-diagnostico-funcional.tsx");
    expect(funcional).toContain("<BarraDeImpresion");
    expect(funcional, "el documento del paciente dejo de existir solo en papel").toContain("solo-impresion");
    expect(leer("src/modules/reports/components/hc-imprimir.tsx")).toContain("imprimirHoja");
  });

  it("TODA hoja de un taller lleva su documento aparte y su taller apagado", () => {
    // La regla que esto fija: donde la pantalla NO es el documento, tiene que haber un `solo-impresion`
    // (el papel) y un `no-print` (el taller). Si falta el primero, el papel sale con los campos; si falta
    // el segundo, sale con los campos TAMBIEN.
    // CADA TALLER CON SU PAR: donde esta el `no-print` (el taller) y donde el `solo-impresion` (el
    // papel). En la prescripcion son dos archivos a proposito, porque el documento es un componente de
    // servidor y el envoltorio es de cliente.
    const talleres: { taller: string; papel: string }[] = [
      { taller: ENTRADA, papel: ENTRADA },
      {
        taller: "src/modules/treatment/components/subpestana-del-profesional.tsx",
        papel: "src/modules/treatment/components/hoja-del-protocolo.tsx",
      },
      // LA HOJA DEL DIAGNOSTICO FUNCIONAL NO TIENE PAR, y es correcto: su `.imprimible` contiene SOLO la
      // barra y el documento, asi que todo lo demas de la subpestaña (los mapas, la tabla de indices, el
      // cierre) queda FUERA de la hoja y la regla del CSS ya lo esconde. No hace falta apagarlo: nunca
      // estuvo encendido. Su papel se comprueba abajo, con los demas.
    ];
    for (const t of talleres) {
      expect(leer(t.papel), `${t.papel} no arma su documento aparte`).toContain("solo-impresion");
      expect(leer(t.taller), `${t.taller} imprimiria su taller`).toContain("no-print");
    }
  });

  it("los formularios del seguimiento no salen en el papel, y la cita SI", () => {
    // El caso que lo pide: la fecha del proximo control vivia SOLO dentro del input del formulario, asi
    // que apagar el formulario la habria dejado fuera del documento. Un seguimiento impreso sin la
    // proxima cita no es el seguimiento.
    const proximo = leer("src/modules/followups/components/proximo-control.tsx");
    expect(proximo).toContain('className="no-print flex flex-col gap-3"');
    expect(proximo, "la cita no llega al papel").toContain('className="solo-impresion');
    expect(proximo).toContain("Próximo control sin agendar");

    const obs = leer("src/modules/followups/components/observaciones-consulta.tsx");
    expect(obs, "el campo de escribir una observacion nueva saldria impreso vacio").toContain(
      'className="no-print flex flex-col gap-2 border-t border-border pt-4"',
    );
  });

  it("el boton de generar el resumen no sale impreso", () => {
    const resumen = leer("src/modules/diagnoses/components/resumen-diagnostico.tsx");
    const i = resumen.indexOf("<Button");
    expect(resumen.slice(i, i + 300)).toContain('className="no-print"');
  });

  it("la antropometria no imprime su formulario de import ni su desplegable de reemplazo", () => {
    const entrada = leer(ENTRADA);
    // El cuerpo entero de la pestaña va `no-print` dentro de la hoja, y el `details` del reemplazo lleva
    // el suyo: un desplegable impreso es justo el ejemplo que traia el aviso del dimensionado.
    expect(entrada).toContain('<div className="no-print">{cuerpo}</div>');
    expect(entrada).toContain('className="no-print group -mt-1"');
  });

  it("y sin encabezado no se ofrece el boton: una hoja sin firma no es un documento", () => {
    const entrada = leer(ENTRADA);
    expect(entrada).toContain("if (!encabezado || !hoja) return cuerpo;");
  });
});
