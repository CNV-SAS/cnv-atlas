import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// LA CAPA CLINICA SOLO PARA VEREDICTOS CLINICOS.
//
// LA REGLA, que ya esta escrita en `globals.css` junto al token y aqui se vuelve exigible: son DOS EJES.
// La escala `--clinical-*` es un VEREDICTO sobre el estado de una persona y sus hexadecimales salen de los
// clasificadores de Gildardo (el naranja de Moderado es el hex exacto de su `_DFI_SEVC`). `--attention` es
// un aviso sobre el TRABAJO: siete pacientes sin evaluar, una autorizacion que falta, un pago duplicado.
//
// EL COSTE DE MEZCLARLOS, textual del comentario del token: "el dia que la escala clinica cambie, los
// avisos operativos se moverian con ella sin que nadie lo decidiera, y al reves". El barrido del
// 2026-09-04 encontro TRECE archivos operativos leyendo los tokens clinicos. Ocho se cerraron en el acto
// (usaban solo `warning`, que tiene reemplazo directo en `attention`); los CINCO que quedan estan abajo,
// y no se cierran solos porque piden un rol operativo que la paleta todavia no tiene.
//
// Y HAY UN SEGUNDO COSTE, que es el que lo destapo (2026-09-04). En el aviso de preguntas sin responder
// de la encuesta, el texto decia "puedes enviarla asi y completarlas con tu profesional" y el contenedor
// estaba pintado con `clinical-warning`: **una pregunta en blanco no es una severidad clinica**. El
// contenedor afirmaba lo contrario del texto, y en un cuestionario que contesta un paciente eso es de la
// familia de los encabezados de categoria que retiramos el 2026-08-31, presion sobre la respuesta antes de
// darla. Ese sitio ya esta corregido a superficie neutra; este candado es para que no reaparezca.
//
// POR QUE EL ALCANCE ES ESTRECHO Y NO "TODO src": la clasificacion de las 47 superficies que usan estos
// tokens es un juicio caso por caso, y un candado ancho escrito a ojo se relaja al primer rojo legitimo.
// Lo que se vigila son los dominios donde NO CABE un veredicto clinico por definicion: pagos, inventario,
// remesas, comodato, remisiones y el cromo de la aplicacion. Ahi cualquier uso es un error, sin matices.

/** Dominios donde un veredicto clinico no cabe: nada de lo que pasa ahi es el estado de un paciente. */
const SUPERFICIES_OPERATIVAS = [
  "src/modules/payments",
  "src/modules/nutraceuticals",
  "src/modules/comodato",
  "src/modules/referrals",
  "src/components/layout",
  "src/app/(app)/pagos",
  "src/app/(app)/faltantes",
  "src/app/(app)/mi-inventario",
  "src/app/(app)/comodato",
];

/**
 * LO QUE HAY HOY, declarado uno por uno con la decision que le falta.
 *
 * NO es una lista de perdon: es el inventario del barrido del 2026-09-04, y cada entrada sale cuando se
 * repinte. Se deja escrito porque el arreglo completo NO es mecanico: el eje operativo tiene UN par de
 * tokens (`attention`) y el clinico tiene CINCO, asi que `clinical-warning` tiene reemplazo directo hoy,
 * pero `clinical-critical` y `clinical-optimal` no. Inventar dos tonos por nuestra cuenta seria estrenar
 * paleta sin decidirla (`BRAND.md`), asi que va como decision y no como arreglo silencioso.
 */
const PENDIENTES: Record<string, string> = {
  "src/app/(app)/pagos/page.tsx": "estados de pago (pendiente/pagado/fallido): necesita los TRES roles",
  "src/app/(app)/faltantes/page.tsx": "faltantes y reincidencia: necesita critical",
  "src/app/(app)/mi-inventario/page.tsx": "el delta de inventario: necesita optimal",
  "src/modules/comodato/components/status-meta.tsx":
    "estado del equipo (disponible/mantenimiento/perdido): necesita los TRES roles",
  "src/modules/nutraceuticals/components/remesas-cnv-section.tsx":
    "conteos y antiguedad de remesas: necesita critical",
};

const TOKEN = /(?:text|bg|border|stroke|fill|ring|from|to|via)-clinical-/;

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) out.push(...archivos(p));
    else if (/\.tsx?$/.test(d.name)) out.push(p);
  }
  return out;
}

const usanTokenClinico = SUPERFICIES_OPERATIVAS.flatMap(archivos).filter((f) =>
  TOKEN.test(readFileSync(f, "utf8")),
);

describe("las superficies operativas no usan la escala clinica", () => {
  it("ninguna aparece sin estar declarada", () => {
    const nuevas = usanTokenClinico.filter((f) => !(f in PENDIENTES));
    expect(
      nuevas,
      "usan `--clinical-*` para algo que no es un veredicto sobre un paciente. Usa `attention` (el ámbar " +
        "operativo) o una superficie neutra; si de verdad hace falta otro rol operativo, decídelo en BRAND.md",
    ).toEqual([]);
  });

  it("y la lista de pendientes no crece: hoy son cinco, y cada arreglo la achica", () => {
    // CONTROL EN LA OTRA DIRECCION. Sin esto, la lista podria engordar sola y el candado quedaria
    // certificando cualquier cosa con agregarle una entrada mas.
    expect(Object.keys(PENDIENTES)).toHaveLength(5);
    expect(usanTokenClinico.length).toBeLessThanOrEqual(5);
  });

  it("y las que ya se arreglaron salen de la lista", () => {
    // Cuando una se repinta deja de usar el token, y entonces su entrada aquí sobra. Esto lo dice en voz
    // alta en vez de dejar la lista llena de nombres que ya no significan nada.
    const sobran = Object.keys(PENDIENTES).filter((f) => !usanTokenClinico.includes(f));
    expect(sobran, "ya no usan tokens clínicos: quítalas de PENDIENTES").toEqual([]);
  });
});

describe("el aviso de la encuesta, que es el que destapó la regla", () => {
  const ENCUESTA = readFileSync(
    "src/modules/evaluations/components/survey-phase-form.tsx",
    "utf8",
  );

  it("no pinta con la escala clínica que al paciente le falten preguntas", () => {
    // Es el caso concreto: el texto dice "puedes enviarla así" y el contenedor decía "algo va mal".
    expect(ENCUESTA).not.toMatch(TOKEN);
  });

  it("y el texto que da el permiso sigue ahí, que es la mitad que importa", () => {
    // Sin esto, alguien podría "arreglar" el color quitando la frase, y el defecto se invertiría: una caja
    // neutra que no dice que puede enviarla igual no es mejor que una caja ámbar que sí lo dice.
    expect(ENCUESTA).toContain("Puedes enviarla así y completarlas con tu profesional");
    expect(ENCUESTA).toContain("Puedes dejar en blanco lo que no sepas");
  });
});
