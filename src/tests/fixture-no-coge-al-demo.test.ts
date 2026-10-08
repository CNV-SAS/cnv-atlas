import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// ═══ UN FIXTURE QUE MARCA UN PROFESIONAL NO PUEDE COGER AL DEMO (2026-10-07) ═══
//
// ── LA FORMA, QUE YA APARECIO CUATRO VECES ──
//
// Marcar un `professional_profiles.is_test` dispara el trigger de la 0203 y RECALCULA TODAS las ventas de ese
// profesional. En la base local el profesional mas antiguo es "Profesional Demo", con ~16.000 transacciones, asi
// que un fixture que escribe `order by created_at limit 1` cae siempre en el peor caso posible y el test se pasa
// de los 30 s.
//
// ── POR QUE ESTO ES UN CANDADO Y NO CUATRO ARREGLOS ──
//
// Porque ya se arreglo tres veces, de una en una, y la cuarta copia siguio ahi hasta hoy. Y la forma en que se
// descubrio es la peor: el archivo tardaba 85 s, estaba justo en el limite, y la base crecio hasta pasarlo. O
// sea que aparecio como una ROJA QUE PARECE INTERMITENTE y no lo era, en medio de un smoke. Un hazard
// documentado sigue vivo donde nadie lo aplico, y la unica forma de que no vuelva es que algo lo barra.
//
// LO QUE EXIGE: todo test de BD que marque un profesional como de prueba elige por CANTIDAD DE VENTAS, no por
// antiguedad. No mide tiempos (un test que mide tiempos es un test que falla por la maquina de otro): mira la
// consulta del fixture, que es lo que decide.

const raiz = process.cwd();
const DIR = "src/tests";

/** Los tests que marcan un `professional_profiles.is_test`, que son los que disparan el recalculo. */
function testsQueMarcanUnProfesional(): { ruta: string; src: string }[] {
  const salida: { ruta: string; src: string }[] = [];
  for (const nombre of readdirSync(join(raiz, DIR))) {
    if (!nombre.endsWith(".test.ts")) continue;
    // SE EXCLUYE A SI MISMO: este archivo CITA el patron que busca (en su regex y en sus mensajes), asi que sin
    // esto se acusaria a si mismo, que es la version mas tonta del falso positivo.
    if (nombre === "fixture-no-coge-al-demo.test.ts") continue;
    const ruta = `${DIR}/${nombre}`;
    const src = readFileSync(join(raiz, ruta), "utf8");
    if (/professional_profiles\s+set\s+is_test|marcarProfesionalDePrueba/.test(src)) salida.push({ ruta, src });
  }
  return salida;
}

/**
 * Los trozos de SQL que ELIGEN un profesional: de `from professional_profiles` a su `limit`.
 *
 * Acotar importa: un `order by created_at limit 1` de otra tabla del mismo archivo no dice nada de esto, y
 * acusarlo es como se consigue que alguien desactive el candado.
 */
function consultasDeProfesional(src: string): string[] {
  const trozos: string[] = [];
  const re = /from\s+professional_profiles[\s\S]{0,600}?limit\s+\d+/g;
  for (const m of src.matchAll(re)) trozos.push(m[0]);
  return trozos;
}

describe("ningun fixture marca al profesional con mas ventas", () => {
  const encontrados = testsQueMarcanUnProfesional();

  it("el barrido encuentra los fixtures que marcan un profesional", () => {
    // Si esto baja a cero, el barrido dejo de mirar donde debia (cambiaron los nombres o la forma de marcar) y
    // los casos de abajo pasarian verdes sin comprobar nada.
    expect(
      encontrados.length,
      "el barrido no encontro ningun fixture que marque un profesional: cambio la forma de marcar",
    ).toBeGreaterThanOrEqual(4);
  });

  it.each(encontrados.map((e) => e.ruta))("%s elige por cantidad de ventas, no por antiguedad", (ruta) => {
    const src = encontrados.find((e) => e.ruta === ruta)!.src;
    // ── SE MIRA SOLO LA CONSULTA DEL PROFESIONAL, Y ESTO NO ES UN DETALLE ──────────────────────────
    //
    // La primera version buscaba `order by created_at limit` en TODO el archivo y acuso a `lo-deshecho-db` por
    // una consulta de LOTES (`select id from lots ... order by created_at limit 1`), que no tiene nada que ver.
    // Un candado que acusa codigo correcto se desactiva a la segunda vez, asi que el barrido se acota al trozo
    // que de verdad decide: desde `from professional_profiles` hasta su `limit`.
    for (const trozo of consultasDeProfesional(src)) {
      expect(
        /order by\s+(pp\.)?created_at/.test(trozo),
        `${ruta} elige el profesional por antiguedad. En la base local eso es "Profesional Demo" con ~16.000 ` +
          `ventas, y marcarlo recalcula las 16.000 por el trigger de la 0203: el test se pasa de los 30 s. ` +
          `Ordena primero por \`(select count(*) from transactions t where t.professional_id = pp.id)\`.`,
      ).toBe(false);
      expect(
        trozo,
        `${ruta} no ordena por cantidad de ventas: es la cuarta vez que esta forma nos cuesta una roja.`,
      ).toContain("from transactions t where t.professional_id = pp.id");
    }
  });
});
