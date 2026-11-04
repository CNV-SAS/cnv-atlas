import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UN CATCH QUE ATRAPA TODO SE COME EL EXITO  ·  2026-11-04
//
// ═══ EL CASO (Sentry, 2026-11-03, 14 eventos, iPhone, /encuesta/:token) ═══
//
//   "An unexpected response was received from the server."
//   breadcrumbs: encuesta.enviar-sin-red fallo: NEXT_REDIRECT ... /encuesta/gracias
//                POST /encuesta/gracias [200]
//                encuesta.guardar-sin-red fallo
//
// El envio que SALE BIEN termina con un `redirect("/encuesta/gracias")`, y en Next un redirect se
// SENALIZA LANZANDO. Asi que el camino feliz entraba por el mismo `catch` que el fallo de red: la
// encuesta ya estaba enviada, y el envoltorio reportaba a Sentry y devolvia "parece que se cayo la
// conexion". A nosotros nos llenaba Sentry de fallos inexistentes; al paciente, en un telefono lento, le
// podia aparecer ese aviso encima de una encuesta YA entregada, y entonces lo razonable es volver a
// pulsar Enviar.
//
// ═══ POR QUE UN CANDADO Y NO SOLO EL ARREGLO ═══
//
// Los envoltorios de red nacieron de a varios (cuatro el 22 de octubre: encuesta, firma, codigo, QR) y
// van a volver a nacer: cada formulario que corra en el telefono de un paciente quiere uno. El defecto no
// es de uno de ellos, es de LA FORMA: un `catch` alrededor de una accion de servidor sin relanzar los
// errores de control de flujo de Next. Asi que se vigila la forma en todo el arbol de fuente, no los
// cuatro sitios de hoy.
//
// `unstable_rethrow` va PRIMERO en el catch, antes de cualquier manejo, que es como lo pide la
// documentacion de Next. Relanza sus errores (redirect, notFound) y no hace nada con los demas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const RAIZ = "src";
const VENTANA = 3; // lineas hacia atras donde tiene que estar el relanzamiento

function rutas(dir: string, acc: string[] = []): string[] {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) rutas(ruta, acc);
    else if (/\.(ts|tsx)$/.test(nombre)) acc.push(ruta);
  }
  return acc;
}

// En Windows las rutas vienen con "\": sin normalizar, excluir los tests no funciona y este archivo se
// contaria a si mismo (el defecto que ya cometio otro candado de esta casa).
const normal = (r: string) => r.split("\\").join("/");
const FUENTE = rutas(RAIZ).filter((r) => !normal(r).includes("/tests/"));

describe("un envoltorio de red no se come el redirect del exito", () => {
  it("todo reportClientError de un catch lleva unstable_rethrow justo antes", () => {
    const sinRelanzar: string[] = [];
    for (const f of FUENTE) {
      const lineas = readFileSync(f, "utf8").split("\n");
      lineas.forEach((l, i) => {
        if (!/^\s*reportClientError\(/.test(l)) return;
        const antes = lineas.slice(Math.max(0, i - VENTANA), i).join("\n");
        if (!/unstable_rethrow\(/.test(antes)) sinRelanzar.push(`${normal(f)}:${i + 1}`);
      });
    }
    expect(sinRelanzar, "estos catch se comerian el redirect del exito").toEqual([]);
  });

  it("y los envoltorios que existen hoy siguen vigilados (el candado no mira al vacio)", () => {
    // Si manana se renombra `reportClientError`, el caso de arriba pasaria a verde mirando cero sitios.
    // Esto fija el PISO: cuatro envoltorios, seis catch. Que baje es un cambio a mirar, no un arreglo.
    let n = 0;
    for (const f of FUENTE) {
      n += (readFileSync(f, "utf8").match(/^\s*reportClientError\(/gm) ?? []).length;
    }
    expect(n).toBeGreaterThanOrEqual(6);
  });

  it("el autoguardado en espera se cancela al enviar la encuesta", () => {
    // El otro error del mismo evento: el guardado diferido (1,2 s) disparaba DESPUES de que el envio
    // navegara, contra una pagina sin esa accion. No se pierde nada al cancelarlo, porque el envio manda
    // el formulario completo.
    const src = readFileSync("src/modules/evaluations/components/survey-phase-form.tsx", "utf8");
    const doSubmit = src.slice(src.indexOf("const doSubmit"), src.indexOf("const handleSubmit"));
    expect(doSubmit).toContain("clearTimeout(guardadoPendiente.current)");
  });
});
