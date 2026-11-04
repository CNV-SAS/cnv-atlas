import { beforeAll, describe, expect, it, vi } from "vitest";

import { FILTRO_VACIO, type FiltroDeCohorte } from "@/modules/obbia/services/filtro-de-la-cohorte";

// `server-only` no existe fuera del bundler de Next; el lector lo importa y aqui se neutraliza, igual que
// en los otros candados que corren sus consultas contra la base.
vi.mock("server-only", () => ({}));

// El lector abre su propia conexion con DATABASE_URL; fuera de Next hay que cargar el archivo a mano.
try {
  process.loadEnvFile(".env.local");
} catch {
  // sin .env.local no hay base contra la que correr; el lector fallara con un mensaje claro.
}

let leerCohorteDeInvestigacion: typeof import("@/modules/obbia/data/cohorte-reader").leerCohorteDeInvestigacion;

beforeAll(async () => {
  ({ leerCohorteDeInvestigacion } = await import("@/modules/obbia/data/cohorte-reader"));
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL FILTRO ENTRA EN TODAS LAS CONSULTAS, O EN NINGUNA  ·  2026-11-04
//
// ═══ EL DEFECTO QUE ESTE CANDADO EXISTE PARA IMPEDIR ═══
//
// El lector de /obbia hace SEIS idas a la base (totales, versiones, excluidas, meses, consolidados y las
// cifras de tarjeta). Si el predicado del filtro se escribiera en cada una, bastaria olvidarlo en UNA para
// que el panel mostrara cifras de DOS COHORTES DISTINTAS en la misma pantalla: la tarjeta diria 120
// consultas y el consolidado sumaria 316, y las dos pareceran ciertas.
//
// ESO ES PEOR QUE NO FILTRAR, porque nadie puede notarlo desde la pantalla: no hay nada roto, no hay
// error, y las dos cifras son ciertas cada una de su cohorte. Es la misma familia que *"si dos partes de
// la pantalla dicen cosas opuestas, es que LEEN FUENTES DISTINTAS"*, solo que aqui ni siquiera se
// contradicen de forma visible.
//
// ═══ COMO SE COMPRUEBA, Y POR QUE ASI ═══
//
// Con una INVARIANTE que no depende de los datos de la base: los cuatro consolidados (pais, ciudad, sexo,
// profesional) particionan la MISMA cohorte, asi que la suma de consultas de cada eje tiene que ser
// exactamente `conAutorizacion`, y los cuatro juntos, cuatro veces eso. Si una consulta se queda sin el
// filtro, esa igualdad se rompe.
//
// No se afirma ninguna cifra concreta (una cifra absoluta en un test contra la base envejece y falla por
// otra razon): se afirma la RELACION entre las cifras, que es lo que el defecto rompe.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

const FILTROS: ReadonlyArray<readonly [string, FiltroDeCohorte]> = [
  ["sin filtro", FILTRO_VACIO],
  ["sexo femenino", { ...FILTRO_VACIO, sexo: "F" }],
  ["sexo masculino", { ...FILTRO_VACIO, sexo: "M" }],
  ["un pais", { ...FILTRO_VACIO, pais: "Colombia" }],
  ["una ciudad", { ...FILTRO_VACIO, ciudad: "Guarne" }],
  ["rango de edad", { ...FILTRO_VACIO, edadDesde: 30, edadHasta: 50 }],
  ["desde una fecha", { ...FILTRO_VACIO, desde: "2026-09-01" }],
  ["hasta una fecha", { ...FILTRO_VACIO, hasta: "2026-09-30" }],
  ["solo con bioimpedancia", { ...FILTRO_VACIO, soloConBis: true }],
  ["solo con espectro", { ...FILTRO_VACIO, soloConEspectro: true }],
  // UN FILTRO QUE NO DEJA NADA: el caso que mas facil se rompe, porque un cero puede venir de que el
  // filtro funciono o de que la consulta fallo en silencio.
  ["uno que no deja nada", { ...FILTRO_VACIO, pais: "Narnia" }],
  // Y DOS EJES A LA VEZ, que es como se usa de verdad.
  ["dos ejes juntos", { ...FILTRO_VACIO, sexo: "F", soloConBis: true }],
];

describe("el filtro de la cohorte entra en todas las consultas del lector", () => {
  it.each(FILTROS)("con %s, los cuatro consolidados suman la cohorte", async (_nombre, filtro) => {
    const c = await leerCohorteDeInvestigacion(filtro);

    // Un eje por consolidado, los cuatro siempre presentes (aunque sea con una sola fila "Sin dato").
    expect(c.estratos.map((e) => e.eje).sort()).toEqual(["ciudad", "pais", "profesional", "sexo"]);

    for (const eje of c.estratos) {
      const consultas = eje.filas.reduce((n, f) => n + f.consultas, 0);
      expect(
        consultas,
        `el consolidado por ${eje.eje} suma ${consultas} y la cohorte tiene ${c.conAutorizacion}: alguna consulta del lector se quedo sin el filtro`,
      ).toBe(c.conAutorizacion);
    }

    // Y las cifras de tarjeta, que salen de OTRA consulta, tampoco pueden describir mas cohorte que la
    // que hay: son subconjuntos de las autorizadas.
    expect(c.cifrasDeLaCohorte.conEspectro).toBeLessThanOrEqual(c.conAutorizacion);
    expect(c.cifrasDeLaCohorte.conEncuestaCompleta).toBeLessThanOrEqual(c.conAutorizacion);
    expect(c.cifrasDeLaCohorte.conPlanNutricional).toBeLessThanOrEqual(c.conAutorizacion);
    expect(c.conDiagnostico).toBeLessThanOrEqual(c.conAutorizacion);
    // La cohorte nunca puede ser mayor que el universo del que sale.
    expect(c.conAutorizacion).toBeLessThanOrEqual(c.vigentes);
  });

  it("un filtro que no deja nada deja TODO en cero, no solo la tarjeta", async () => {
    const c = await leerCohorteDeInvestigacion({ ...FILTRO_VACIO, pais: "Narnia" });
    expect(c.conAutorizacion).toBe(0);
    expect(c.vigentes).toBe(0);
    expect(c.porMes).toEqual([]);
    expect(c.conDiagnostico).toBe(0);
    expect(c.cifrasDeLaCohorte.conEspectro).toBe(0);
    // Las versiones del motor salen de su propia consulta: con cero consultas no puede haber ninguna.
    expect(c.porVersionDelMotor).toEqual([]);
    expect(c.sinAutorizacionPorRazon).toEqual([]);
  });

  it("filtrar REDUCE: la cohorte filtrada nunca es mayor que la entera", async () => {
    const entera = await leerCohorteDeInvestigacion();
    for (const [nombre, filtro] of FILTROS) {
      const c = await leerCohorteDeInvestigacion(filtro);
      expect(c.conAutorizacion, `${nombre} devolvio mas consultas que la cohorte entera`).toBeLessThanOrEqual(
        entera.conAutorizacion,
      );
    }
  });

  it("el lector no puede volver a nombrar las vistas en una consulta suelta", async () => {
    // LA GARANTIA ESTRUCTURAL, que es la que de verdad sostiene lo de arriba: si una consulta nombra la
    // vista en vez de la CTE, el filtro no la alcanza y el candado de arriba solo lo nota si el caso
    // concreto lo delata. Las DOS unicas menciones permitidas son las de la propia CTE.
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/modules/obbia/data/cohorte-reader.ts", "utf8");
    const sinComentarios = src
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*|--)/.test(l))
      .join("\n");
    // SOLO EL CUERPO DEL LECTOR DE LA COHORTE. `leerOpcionesDelFiltro` lee las vistas SIN filtrar a
    // proposito (las opciones de los desplegables son las del universo completo, para que siempre se
    // pueda cambiar de ciudad), asi que mirar el archivo entero daria un falso rojo.
    const cuerpo = sinComentarios.slice(
      sinComentarios.indexOf("export async function leerCohorteDeInvestigacion"),
      sinComentarios.indexOf("export async function leerOpcionesDelFiltro"),
    );
    expect(cuerpo.length, "no se pudo aislar el cuerpo del lector").toBeGreaterThan(500);
    const menciones = cuerpo.match(/public\.evaluaciones_(para_investigacion|vigentes)/g) ?? [];
    expect(menciones.length, "una consulta volvio a nombrar la vista en vez de la CTE").toBe(2);
  });
// ═══ Y EL ARCHIVO QUE SE DESCARGA DESCRIBE LA MISMA COHORTE QUE LA PANTALLA ═══
  //
  // La descarga se pide desde una pantalla que puede estar filtrada. Si el alcance registrado no dijera el
  // recorte, el registro afirmaria "resumen agregado de la cohorte" sobre un recorte, y el registro existe
  // precisamente para poder responder que salio.
  it("el alcance registrado dice si la cohorte iba filtrada, y el nombre del archivo tambien", async () => {
    const { alcanceDelResumen, nombreDelResumen } = await import(
      "@/modules/obbia/services/exportar-la-cohorte"
    );
    const { descripcionDelFiltro } = await import("@/modules/obbia/services/filtro-de-la-cohorte");
    const c = await leerCohorteDeInvestigacion({ ...FILTRO_VACIO, sexo: "F", edadDesde: 40 });

    const conFiltro = alcanceDelResumen(c, "2026-11-04", descripcionDelFiltro({ ...FILTRO_VACIO, sexo: "F", edadDesde: 40 }));
    expect(conFiltro).toContain("FILTRADA");
    expect(conFiltro).toContain("sexo: femenino");
    expect(conFiltro).toContain("edad desde 40");

    const sinFiltro = alcanceDelResumen(c, "2026-11-04", []);
    expect(sinFiltro).toContain("Cohorte completa, sin filtros");

    expect(nombreDelResumen("2026-11-04", true)).toContain("-filtrada-");
    expect(nombreDelResumen("2026-11-04", false)).not.toContain("filtrada");
  });
});
