import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { esElTunelDeErrores, RUTA_DEL_TUNEL_DE_ERRORES } from "@/core/http/tunel-de-errores";
import { isPublicPath } from "@/core/http/public-paths";

import { sinComentarios } from "./helpers/sin-comentarios";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// CANDADO: LOS ERRORES DE UN USUARIO REAL TIENEN QUE LLEGAR  ·  2026-11-03
//
// ═══ EL CASO ═══
//
// Una integrante ve "Esta pestaña no se pudo mostrar" en Antrop. & BIS, refresca y sigue igual. Admin
// entra a la MISMA consulta y la ve bien. **Y Sentry no tiene ni un evento.**
//
// La causa de que no haya evento es independiente de cuál sea el fallo: el SDK del navegador hace POST
// directo al host de ingest de Sentry, que los bloqueadores de anuncios y muchas redes corporativas
// filtran. El evento se pierde en silencio, y la pantalla le PROMETE al profesional que se registró.
//
// ═══ POR QUE ESTE CANDADO Y NO UNA LINEA DE CONFIGURACION ═══
//
// Porque la ruta la necesitan TRES sitios (el build que la crea, el proxy que la deja pasar y la CSP), y
// escrita tres veces el día que cambie una el túnel deja de funcionar EN SILENCIO, que es el mismo modo de
// fallo que vino a arreglar. El candado exige que los tres la lean del módulo.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const CONFIG = readFileSync("next.config.ts", "utf8");
const PROXY = readFileSync("src/proxy.ts", "utf8");
const PANEL = readFileSync("src/modules/diagnoses/components/panel-con-red.tsx", "utf8");

describe("el túnel de errores", () => {
  it("el build crea la ruta, y la lee del módulo", () => {
    const codigo = sinComentarios(CONFIG);
    expect(codigo, "sin tunnelRoute, los eventos del navegador vuelven a ir directo al ingest").toContain(
      "tunnelRoute: RUTA_DEL_TUNEL_DE_ERRORES",
    );
    expect(codigo, "la ruta se escribió a mano en vez de leerla de su módulo").not.toMatch(
      /tunnelRoute:\s*"/,
    );
  });

  it("el proxy la deja pasar SIN sesión, como a los webhooks", () => {
    // Los errores que más falta hacen son los de las pantallas PÚBLICAS (la encuesta del paciente, el
    // consentimiento por QR, el checkout), donde por definición no hay sesión. Si el proxy mandara el
    // túnel a /login, se perderían justo esos.
    const codigo = sinComentarios(PROXY);
    expect(codigo).toContain("esElTunelDeErrores(path)");
    const iTunel = codigo.indexOf("esElTunelDeErrores(path)");
    const iLogin = codigo.indexOf("isPublicPath(path)");
    expect(iTunel, "el túnel quedó DESPUÉS del rebote a /login").toBeLessThan(iLogin);
  });

  it("y no depende de la lista de rutas públicas, que es otra cosa", () => {
    // `isPublicPath` describe PANTALLAS que se abren sin sesión. El túnel no es una pantalla: es
    // transporte. Meterlo ahí lo volvería una ruta pública más y se mezclarían dos listas con dos reglas.
    expect(isPublicPath(RUTA_DEL_TUNEL_DE_ERRORES)).toBe(false);
    expect(esElTunelDeErrores(RUTA_DEL_TUNEL_DE_ERRORES)).toBe(true);
    expect(esElTunelDeErrores(`${RUTA_DEL_TUNEL_DE_ERRORES}/123`)).toBe(true);
    expect(esElTunelDeErrores("/monitoreo-de-otra-cosa"), "prefijo suelto").toBe(false);
    expect(esElTunelDeErrores("/pacientes")).toBe(false);
  });

  it("la ruta no se llama como lo que lleva", () => {
    // Una ruta llamada `/sentry` o `/errors` vuelve a ser reconocible para una lista de bloqueo, que es
    // exactamente el problema que esto resuelve.
    expect(RUTA_DEL_TUNEL_DE_ERRORES.toLowerCase()).not.toContain("sentry");
    expect(RUTA_DEL_TUNEL_DE_ERRORES.toLowerCase()).not.toContain("error");
  });
});

describe("el aviso de pestaña caída dice lo que de verdad pasó", () => {
  it("muestra el código del error, que es lo único que lo hace encontrable", () => {
    // En producción un error del SERVIDOR llega al navegador sin mensaje, reducido a un `digest`. Este
    // aviso lo tiraba, así que una captura de pantalla no servía para encontrar nada.
    const codigo = sinComentarios(PANEL);
    expect(codigo).toContain('"digest" in error');
    expect(codigo).toContain("pásale este código a soporte");
    // Y VIAJA AL EVENTO como etiqueta: sin eso, lo que ve el profesional y lo que registra el servidor son
    // dos registros sueltos y hay que adivinar cuál va con cuál.
    expect(codigo).toContain('scope.setTag("digest"');
  });

  it("y ya no promete un registro que puede no haber ocurrido", () => {
    expect(
      sinComentarios(PANEL),
      "volvió a afirmar que el problema quedó registrado, que es justo lo que fallaba",
    ).not.toContain("Ya registramos el problema");
  });
});
