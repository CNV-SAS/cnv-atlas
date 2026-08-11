import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/core/http/public-paths";

// El proxy rebotaba /forgot-password a /login porque no estaba en la lista de rutas publicas: una pagina de
// recuperacion accesible solo con sesion es inutil (el que la necesita no puede entrar). Ningun test lo
// atrapaba (la pagina estaba bien, el enrutamiento no). Este ancla que TODA ruta accesible sin sesion siga
// siendolo: si alguien la quita de la lista, truena aqui.

describe("isPublicPath: rutas accesibles sin sesion", () => {
  it("las de autenticacion y recuperacion son publicas", () => {
    for (const p of ["/login", "/forgot-password", "/set-password", "/mfa-challenge", "/mfa-setup"]) {
      expect(isPublicPath(p), `${p} debe ser accesible sin sesion`).toBe(true);
    }
  });

  it("las publicas de paciente/comercio/legales son publicas", () => {
    for (const p of [
      "/encuesta/tok123",
      "/encuesta/gracias",
      // Reanudacion del intake (fase 2 sin sesion): el enlace del correo tiene que abrir sin rebote.
      "/encuesta/reanudar/tok123",
      "/checkout/tok123",
      "/privacy",
      "/terms",
    ]) {
      expect(isPublicPath(p), `${p} debe ser publica`).toBe(true);
    }
  });

  it("las de la app NO son publicas (requieren sesion)", () => {
    for (const p of [
      "/dashboard",
      "/pacientes",
      "/faltantes",
      "/mi-inventario",
      "/evaluaciones/x",
      // El RUT (documento de identidad tributaria) y el PDF del reporte se sirven por rutas protegidas: el
      // acceso sin sesion tiene que fallar (rebote a login). Nunca por URL firmada compartible.
      "/rut/abc",
      "/verificaciones",
      "/reportes/x/pdf",
    ]) {
      expect(isPublicPath(p), `${p} NO debe ser publica`).toBe(false);
    }
  });
});
