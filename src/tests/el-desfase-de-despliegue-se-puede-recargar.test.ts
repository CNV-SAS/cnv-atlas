import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ EL UNICO ERROR QUE LE LLEGA A UN PACIENTE TIENE QUE TENER SALIDA (2026-10-07) ═══
//
// ── LA CADENA, VERIFICADA EN EL CODIGO DE NEXT 16 ──────────────────────────────────────────────────
//
// Los logs de Vercel traian este warning al lado del 500 que se le fue a una paciente respondiendo la encuesta
// en su celular:
//
//   "Failed to find Server Action <id>. This request might be from an older or newer deployment."
//
// Es el navegador con la pagina de un despliegue viejo pidiendo una accion que el nuevo ya no tiene. Y encaja:
// una encuesta larga en un celular puede estar abierta una hora, y se despliega varias veces al dia.
//
//   1. El servidor lanza un Error PELADO dentro del handler, asi que en produccion Next responde 500 y no
//      manda el mensaje en el cuerpo.
//   2. El cliente solo usa el texto del servidor si la respuesta es `text/plain` (`server-action-reducer.js`:
//      `res.status >= 400 && contentType === 'text/plain'`). Si no, lanza el generico "An unexpected response
//      was received from the server." --> que es EXACTAMENTE lo que Sentry registro.
//   3. Asi que la rama `isStaleDeployment` de `error.tsx`, escrita para este caso, NO SE CUMPLE NUNCA en
//      produccion: la paciente vio "Algo salio mal".
//   4. Y el boton era `reset()`, que vuelve a rendir la pagina VIEJA: pulsar reintentar volvia a fallar.
//
// ── LO QUE ESTE CANDADO FIJA ──────────────────────────────────────────────────────────────────────
//
// Que la salida exista y sea la que funciona. No fija la DETECCION, que es la que resulto indetectable: fija
// que la rama generica ofrezca RECARGAR, porque recargar resuelve el desfase Y el fallo pasajero. Devolver un
// unico `reset()` dejaria otra vez al paciente pulsando un boton que no puede funcionar.

const raiz = process.cwd();
const src = readFileSync(join(raiz, "src/app/error.tsx"), "utf8");

describe("la pagina de error le da al paciente la salida que funciona", () => {
  it("ofrece recargar, no solo reintentar", () => {
    expect(src, "sin recarga, un desfase de despliegue no tiene salida alcanzable").toContain(
      "window.location.reload()",
    );
    expect(src).toContain("Recargar la página");
  });

  it("y recargar va delante de reintentar", () => {
    // EL ORDEN IMPORTA porque `reset()` re-rinde la pagina vieja: si queda primero, el paciente pulsa el que
    // no puede funcionar. (`reset` aparece antes en el archivo como PROP del componente; lo que se compara es
    // la posicion de los dos BOTONES.)
    const recargar = src.indexOf("Recargar la página");
    const reintentar = src.indexOf("Reintentar sin recargar");
    expect(recargar).toBeGreaterThan(-1);
    expect(reintentar).toBeGreaterThan(-1);
    expect(recargar, "reintentar quedo delante de recargar").toBeLessThan(reintentar);
  });

  it("y el texto no afirma una causa que en produccion no se puede distinguir", () => {
    // La rama generica cubre el desfase Y un 500 pasajero, y desde el cliente no se separan. Decir "Atlas se
    // actualizo" ahi seria adivinar, y es la clase de mensaje que manda a diagnosticar la cosa equivocada.
    const generica = src.slice(src.indexOf("Error inesperado"));
    expect(generica).not.toContain("Atlas se actualizó mientras");
    expect(generica).toContain("Recarga la página para seguir");
  });

  it("y queda escrito que la deteccion por mensaje es codigo muerto en produccion", () => {
    // Sin esta nota, el siguiente que lea `isStaleDeployment` va a creer que ese caso ya esta cubierto, que es
    // justo lo que yo crei al escribirla.
    expect(src).toContain("AQUI HABIA UNA AFIRMACION FALSA");
    expect(src).toContain("text/plain");
  });
});
