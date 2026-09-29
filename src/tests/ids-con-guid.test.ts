import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { z } from "zod";

// CANDADO DE LOS IDS: SIEMPRE `z.guid()`, NUNCA `.uuid()`.
//
// LO QUE PASO (smoke del 2026-09-29): la venta retroactiva se rechazaba SIEMPRE, con cualquier precio, y el
// mensaje culpaba al formato del numero. La causa era otra: Zod 4 valida en `.uuid()` los bits de version y
// variante del RFC 4122, y los UUID fijos del seed (77777777-7777-7777-7777-777777777708) NO los cumplen. El
// primer producto de la lista era uno de esos, asi que el formulario estaba muerto.
//
// Y LO QUE HACE ESTE CANDADO NECESARIO NO ES EL DEFECTO, ES SU HISTORIA: la regla ya estaba escrita en SEIS
// modulos (bis-intake, comodato, nutraceuticals, payments, referrals, treatment) y tenia un test en comodato.
// Dos archivos escritos despues no la aplicaron, y nadie se entero hasta que un formulario quedo inservible.
//
// UN HAZARD DOCUMENTADO SIGUE VIVO DONDE NADIE LO APLICO. Un comentario en seis archivos no alcanza a un
// septimo; un barrido si.

const RAICES = ["src/modules", "src/app", "src/lib", "src/core"];

function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, d.name).replace(/\\/g, "/");
    if (d.isDirectory()) out.push(...archivos(p));
    else if (/\.tsx?$/.test(d.name)) out.push(p);
  }
  return out;
}

/** Quita comentarios: la regla se EXPLICA citando `.uuid()`, y el candado no puede cazar su propia razon. */
function sinComentarios(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

describe("los ids se validan con z.guid()", () => {
  it("ningun archivo usa el validador estricto de Zod", () => {
    const culpables: string[] = [];
    for (const raiz of RAICES) {
      for (const f of archivos(raiz)) {
        const src = sinComentarios(readFileSync(f, "utf8"));
        if (/z\s*\.\s*string\s*\(\s*\)\s*\.\s*uuid\s*\(/.test(src) || /\bz\s*\.\s*uuid\s*\(/.test(src)) {
          culpables.push(f);
        }
      }
    }
    expect(culpables, "usan z.uuid()/z.string().uuid(), que rechaza los UUID fijos del seed. Usa z.guid().").toEqual([]);
  });

  // LA RAZON, MEDIDA Y NO AFIRMADA: si algun dia Zod cambiara y `.uuid()` aceptara estos ids, este caso
  // fallaria y el candado de arriba se podria retirar con conocimiento, no por corazonada.
  it("y la razon sigue siendo cierta: .uuid() rechaza los ids del seed y z.guid() los acepta", () => {
    const delSeed = "77777777-7777-7777-7777-777777777708";
    expect(z.string().uuid().safeParse(delSeed).success).toBe(false);
    expect(z.guid().safeParse(delSeed).success).toBe(true);
    // Y un UUID v4 normal pasa por los dos, para que el caso de arriba no sea un artefacto del id elegido.
    const normal = "4f378234-fd25-48a0-88c5-a9236cfa6979";
    expect(z.string().uuid().safeParse(normal).success).toBe(true);
    expect(z.guid().safeParse(normal).success).toBe(true);
  });
});
