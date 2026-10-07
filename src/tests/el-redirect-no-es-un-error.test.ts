import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";

import { describe, expect, it } from "vitest";

// ═══ UN `redirect()` DENTRO DE UN try/catch NO ES UN FALLO (2026-10-07) ═══
//
// ── LA TRAMPA, Y ES INVISIBLE A TODO LO DEMAS ──────────────────────────────────────────────────────
//
// Next implementa `redirect()` LANZANDO una excepcion con un `digest` que empieza por "NEXT_REDIRECT". Un
// `catch` que la absorba convierte una navegacion DELIBERADA en un mensaje de error.
//
// Y EL DANO ES PEOR DE LO QUE PARECE en la encuesta del paciente: al completarla, `submitSurveyAnswersAction`
// redirige a /encuesta/gracias. Si el catch se la come, el paciente ve "no pudimos enviar tu encuesta"
// DESPUES DE QUE SE GUARDO BIEN, y lo mas probable es que vuelva a enviarla.
//
// No lo ve tsc (el tipo de retorno es `never`), no lo ve el lint, y en los tests unitarios el redirect suele
// estar mockeado, asi que tampoco se nota ahi: se ve en un navegador, con la encuesta ya guardada.
//
// ── LO QUE VIGILA ──────────────────────────────────────────────────────────────────────────────────
//
// Que toda accion que REDIRIGE dentro de un try tenga el re-lanzamiento del redirect en su catch. Se barre el
// arbol de acciones, no un archivo: el defecto aparece cada vez que alguien envuelve una accion existente.

const DIRS = ["src/modules", "src/app"];

function archivosDeAcciones(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) out.push(...archivosDeAcciones(p));
    else if (/actions\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const sinComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("ninguna accion se come su propio redirect", () => {
  const archivos = DIRS.flatMap(archivosDeAcciones);

  it("hay acciones que revisar", () => {
    expect(archivos.length).toBeGreaterThan(3);
  });

  // ── EL CRITERIO SE MIDE POR FUNCION, NO POR ARCHIVO ──
  //
  // La primera version miraba el archivo entero y dio un FALSO POSITIVO en `auth/mfa-actions.ts`: ahi el
  // `try/catch` esta en `startMfaEnroll` y el `redirect` en `verifyMfa`, dos funciones distintas que nunca se
  // cruzan. Un candado que acusa a codigo correcto se desactiva al segundo falso positivo, asi que vale mas
  // partir por funcion que ser estricto.
  //
  // SE PARTE POR `export async function`, que es la forma de toda server action del proyecto. Es una
  // aproximacion (no es un parser), y donde se equivoque lo hara por el lado seguro: un helper interno entre
  // dos acciones se le cuenta a la primera.
  it("si redirige dentro de un try, su catch lo re-lanza", () => {
    const culpables: string[] = [];
    for (const f of archivos) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      if (!/\bredirect\(/.test(src)) continue;
      const funciones = src.split(/(?=export async function )/);
      for (const fn of funciones) {
        if (!/\bredirect\(/.test(fn)) continue;
        if (!/\bcatch\b/.test(fn)) continue;
        const reconoce =
          /NEXT_REDIRECT/.test(fn) || /esRedirectDeNext/.test(fn) || /isRedirectError/.test(fn);
        const nombre = /export async function (\w+)/.exec(fn)?.[1] ?? "(sin nombre)";
        if (!reconoce) culpables.push(`${f} -> ${nombre}`);
      }
    }
    expect(
      culpables,
      "redirigen dentro de un try/catch sin re-lanzar el redirect de Next: una navegacion deliberada se va a ver como un error",
    ).toEqual([]);
  });

  // ── Y QUE EL CASO DE ARRIBA NO PASE EN VACIO ──
  //
  // Un barrido cuyo filtro no encuentra nada pasa siempre, y entonces afirma vigilar algo que nunca mira. Ya
  // me paso hoy con el candado de la via 3 de la facturacion. Asi que esto exige que de verdad exista al
  // menos una funcion con redirect Y catch: las dos de la encuesta del paciente.
  it("y hay al menos una funcion con redirect y catch, para que el caso no pase en vacio", () => {
    const conLasDos: string[] = [];
    for (const f of archivos) {
      const src = sinComentarios(readFileSync(f, "utf8"));
      for (const fn of src.split(/(?=export async function )/)) {
        if (/\bredirect\(/.test(fn) && /\bcatch\b/.test(fn)) {
          conLasDos.push(/export async function (\w+)/.exec(fn)?.[1] ?? "(sin nombre)");
        }
      }
    }
    expect(conLasDos, "ninguna funcion redirige dentro de un catch: el caso de arriba no mira nada").not.toEqual([]);
    expect(conLasDos).toContain("submitSurveyAnswersAction");
  });
});
