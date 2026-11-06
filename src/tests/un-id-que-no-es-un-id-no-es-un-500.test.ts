import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN ID DE RUTA QUE NO ES UN ID SE CONTESTA CON 404  ·  2026-11-06
//
// ═══ EL CASO (Sentry, 2026-11-05, Unhandled) ═══
//
//   supersession-reader: invalid input syntax for type uuid: "ed83ff97-...-7081761594f7%7D"
//   GET /ani-bis-e/[id]
//
// Un `}` pegado al final del id (enlace mal copiado; Atlas no genera ninguno asi). Ninguna de las veinte
// rutas dinamicas comprobaba su parametro, asi que el texto llegaba a Postgres, el lector relanzaba su
// 22P02 y la pagina se caia con un 500.
//
// ═══ POR QUE ES UN CANDADO Y NO UN ARREGLO DE UN SITIO ═══
//
// Porque esto no vive en un sitio: vive en CADA ruta dinamica, y cada ruta nueva nace sin la guardia. Es la
// forma de defecto que el proyecto ya conoce ("una regla tambien vive en varios sitios"): se arregla donde
// salio, y vuelve donde nadie lo aplico. Asi que lo que se exige aqui es la REGLA en las veinte, con sus
// excepciones declaradas una por una.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * LAS RUTAS DINAMICAS QUE NO LLEVAN GUARDIA, cada una con la razon por la que no la necesita. Si una ruta
 * nueva aparece sin guardia y sin estar aqui, este candado falla: la lista obliga a decidir, no a olvidar.
 */
const SIN_GUARDIA: Record<string, string> = {
  // LOS TOKENS SON `text` EN LA BASE (`survey_links.token`, `patient_external_consents.token`,
  // `evaluations.resume_token`), no uuid. Un token con basura pegada no revienta: no encuentra fila, y esa
  // es la respuesta correcta ("este link no sirve"). Verificado en el esquema el 2026-11-06.
  "src/app/(public)/consentimiento/[token]/page.tsx": "el token es text, no uuid: un token malo no encuentra fila",
  "src/app/(public)/encuesta/[token]/page.tsx": "el token es text, no uuid",
  "src/app/(public)/encuesta/reanudar/[token]/page.tsx": "el token es text, no uuid",
  // La franja es una palabra de un vocabulario cerrado ("manana"/"tarde"), no un id.
  "src/app/api/cron/avisos/[franja]/route.ts": "la franja es una palabra de un vocabulario, no un id",
  // Esta pagina no lee su parametro: es el mensaje de retorno de Wompi, sin consulta.
  "src/app/checkout/[token]/resultado/page.tsx": "no lee el parametro: es un mensaje fijo",
  // EL CHECKOUT YA ESTABA PROTEGIDO, y en mejor sitio: su LECTOR comprueba la forma antes de preguntar
  // (`checkout-reader.ts`, `if (!UUID_RE.test(token)) return null`), asi que un token con basura pegada
  // sale por "Link no disponible" y nunca llego a ser un 500. Se le puso la guardia tambien en la pagina
  // el 2026-11-06 y se RETIRO: era proteccion duplicada, y ademas tapaba las pruebas que usan tokens
  // raros a proposito para comprobar el escapado del enlace de reintento. La leccion del proyecto es
  // literal: comprobar que el fallo es ALCANZABLE antes de construirle la salida.
  "src/app/checkout/[token]/page.tsx": "su lector ya comprueba la forma del token antes de preguntar",
};

function archivosDe(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) salida.push(...archivosDe(ruta));
    else if (/^(page|route)\.tsx?$/.test(entrada)) salida.push(ruta.replace(/\\/g, "/"));
  }
  return salida;
}

/** Los archivos que viven bajo un segmento dinamico (`[algo]`), que son los que reciben un parametro. */
const DINAMICOS = archivosDe("src/app").filter((r) => /\[[^\]]+\]/.test(r));

describe("un id de ruta que no es un id se contesta con 404, no con un 500", () => {
  it("se encontraron las rutas dinamicas (si no, el candado estaria vacio)", () => {
    expect(DINAMICOS.length).toBeGreaterThanOrEqual(15);
  });

  it("todas comprueban la forma de su parametro, o estan declaradas con su razon", () => {
    const sinComprobar: string[] = [];
    for (const archivo of DINAMICOS) {
      const texto = readFileSync(archivo, "utf8");
      const tieneGuardia = /\b(idDeRuta|esUnId)\(/.test(texto);
      if (tieneGuardia) continue;
      if (archivo in SIN_GUARDIA) continue;
      sinComprobar.push(archivo);
    }
    expect(
      sinComprobar,
      `estas rutas dinamicas pasan su parametro a la base sin comprobar su forma (un texto raro las tumba con un 500):\n  ${sinComprobar.join("\n  ")}`,
    ).toEqual([]);
  });

  it("y ninguna excepcion declarada sobra", () => {
    // Una excepcion que ya no corresponde a ningun archivo es una regla que parece viva y no vigila nada:
    // la lista tiene que envejecer con el codigo, no al lado.
    const sobrantes = Object.keys(SIN_GUARDIA).filter((r) => !DINAMICOS.includes(r));
    expect(sobrantes, "excepciones declaradas que ya no existen").toEqual([]);
    // Y ninguna que SI tenga guardia: si alguien se la pone, la excepcion se borra, no se acumula.
    const conGuardiaYExcepcion = Object.keys(SIN_GUARDIA).filter((r) =>
      /\b(idDeRuta|esUnId)\(/.test(readFileSync(r, "utf8")),
    );
    expect(conGuardiaYExcepcion, "tienen guardia y siguen declaradas como excepcion").toEqual([]);
  });

  it("la guardia contesta 404 y NO lanza desde una accion", () => {
    const HELPER = readFileSync("src/lib/routing/id-de-ruta.ts", "utf8");
    expect(HELPER).toContain("notFound()");
    // `z.guid()` y no `z.uuid()`: Zod 4 rechaza con `.uuid()` los ids fijos de la semilla (memoria del
    // proyecto, y ya bloqueo un smoke una vez). Aqui hace falta la FORMA, que es lo que Postgres convierte.
    // Se mira la FORMA del codigo y no la prosa: el comentario del helper nombra las dos a proposito,
    // para explicar por que se eligio una.
    expect(HELPER).toContain("const ID = z.guid();");
    expect(HELPER).not.toMatch(/=\s*z\.uuid\(/);
    // Y queda escrito que esto no se usa desde una server action, donde un lanzamiento es un 500.
    expect(HELPER).toContain("server action");
  });

  it("y el checkout del paciente ya comprobaba la forma, en su lector", () => {
    // La superficie publica que un paciente abre desde un QR es la que mas importa de todas, y resulta que
    // ya estaba cubierta: su LECTOR comprueba la forma antes de preguntarle a la base, asi que un token con
    // basura pegada sale por "Link no disponible" y nunca fue un 500. Se deja escrito aqui para que la
    // proteccion no se retire creyendo que la cubre la guardia de la ruta, que NO esta en esa pagina.
    const LECTOR = readFileSync("src/modules/payments/data/checkout-reader.ts", "utf8");
    expect(LECTOR).toContain("if (!UUID_RE.test(token)) return null;");
  });
});
