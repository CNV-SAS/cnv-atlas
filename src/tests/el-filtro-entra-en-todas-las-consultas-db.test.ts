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
      // UN EJE NO PUBLICABLE NO SUMA, Y ESO ES CORRECTO: ni reuniendo todas sus categorias llega a cinco
      // pacientes, asi que no se publica ninguna (ver `tablaConSupresion`). La invariante de particion
      // solo se le puede exigir a una tabla que si se publica.
      if (eje.noPublicable) {
        expect(eje.filas, `el eje ${eje.eje} no es publicable y aun asi trae filas`).toEqual([]);
        continue;
      }
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

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// NINGUNA CELDA QUE SALGA DEL LECTOR DESCRIBE A MENOS DE CINCO PERSONAS  ·  2026-11-05
//
// ═══ EL CASO ═══
//
// Santiago, mirando /obbia: *"el archivo ya se puede descargar con celdas de una persona (Maracaibo, 51
// años)"*. El CSV ya las suprimia desde el 2026-11-03; la PANTALLA no, porque la supresion vivia en el
// modulo del export. Asi que la fila que el archivo no deja salir se veia en pantalla, y una captura
// viaja igual que un archivo: acaba en un articulo, en un correo o en un chat.
//
// ═══ POR QUE EL CANDADO VA SOBRE EL LECTOR Y NO SOBRE LA PANTALLA ═══
//
// Comprobar el texto de la pantalla probaria LA PANTALLA DE HOY. Lo que de verdad protege es que el dato
// no exista: si el lector no entrega celdas pequeñas, ninguna superficie futura puede ensenarlas, ni la
// pantalla, ni el CSV, ni una que no se haya escrito. El control entra una vez, donde nace el dato, igual
// que el filtro por CTE.
//
// Y SE CORRE CON FILTROS PUESTOS, que es cuando aparecen de verdad: la cohorte entera tiene ciudades con
// decenas de pacientes, y al filtrar por sexo o por rango de edad esas mismas ciudades bajan de cinco.
// Filtrar FABRICA celdas pequenas, asi que un candado que solo mirara la cohorte entera pasaria verde
// sobre el caso que importa.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("el lector no entrega celdas de menos de cinco pacientes", () => {
  it.each(FILTROS)("con %s, ninguna fila de ningun eje baja del umbral", async (_nombre, filtro) => {
    const { K_ANONIMATO, ROTULO_SUPRIMIDO } = await import(
      "@/modules/obbia/services/supresion-de-celdas"
    );
    const c = await leerCohorteDeInvestigacion(filtro);
    for (const eje of c.estratos) {
      for (const fila of eje.filas) {
        expect(
          fila.pacientes,
          `el eje ${eje.eje} entrega "${fila.grupo}" con ${fila.pacientes} paciente(s)`,
        ).toBeGreaterThanOrEqual(K_ANONIMATO);
      }
      // Y si hubo supresion, se DICE cuantas y la fila reunida esta rotulada: un hueco mudo se lee como
      // tabla completa.
      const reunida = eje.filas.find((f) => f.grupo === ROTULO_SUPRIMIDO);
      if (eje.noPublicable) {
        // Sin tabla no hay fila reunida que mirar, y `suprimidas` dice cuantas se intentaron reunir.
        expect(eje.filas).toEqual([]);
        continue;
      }
      if (eje.suprimidas > 0) {
        expect(reunida, `el eje ${eje.eje} dice ${eje.suprimidas} suprimidas y no trae la fila`).toBeDefined();
        // La edad media de la reunida NO se calcula: seria un promedio de promedios sobre las personas
        // que precisamente se estan protegiendo.
        expect(reunida?.edadMedia).toBeNull();
      } else {
        expect(reunida, `el eje ${eje.eje} trae la fila reunida sin haber suprimido nada`).toBeUndefined();
      }
    }
  });

  it("la fila reunida conserva las cifras: las columnas siguen sumando el total", async () => {
    // Es la propiedad que hace util una tabla de caracterizacion. Si al suprimir se perdieran consultas,
    // un revisor que no cuadra la tabla no sabria si falta una categoria o si el dato esta mal.
    const c = await leerCohorteDeInvestigacion({ ...FILTRO_VACIO, sexo: "F" });
    for (const eje of c.estratos.filter((e) => !e.noPublicable)) {
      const consultas = eje.filas.reduce((n, f) => n + f.consultas, 0);
      expect(consultas, `el eje ${eje.eje} perdio consultas al suprimir`).toBe(c.conAutorizacion);
    }
  });
});

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// UNA COHORTE DE UNA PERSONA NO TIENE CIFRAS QUE MOSTRAR  ·  2026-11-05
//
// ═══ EL AGUJERO QUE ABRIMOS NOSOTROS AL CONSTRUIR LOS FILTROS (2026-11-04) ═══
//
// La supresion de celdas protege las CATEGORIAS de una tabla. Pero un filtro estrecho (sexo mas rango de
// edad mas ciudad) deja la COHORTE ENTERA en una persona, y entonces no hay categoria que suprimir: la
// tarjeta "1 consulta autorizada · edad media 64,0" ES esa persona. Es la forma clasica del ataque por
// consultas sucesivas, y la abrimos al construir los filtros, no antes.
//
// LOS CONTEOS SE PUEDEN DECIR (cuantas consultas hay no describe a nadie); LAS CIFRAS DE EDAD NO: la edad
// media de una cohorte de una persona es la edad de esa persona, y su minimo y su maximo tambien. Se
// anulan en el LECTOR, asi que no hay superficie que pueda ensenarlas.
// ══════════════════════════════════════════════════════════════════════════════════════════════════
describe("una cohorte bajo el umbral no entrega cifras que describan a una persona", () => {
  it("con una cohorte de menos de cinco pacientes, la edad no sale", async () => {
    const { K_ANONIMATO } = await import("@/modules/obbia/services/supresion-de-celdas");
    // Se busca un filtro que de verdad deje pocos: el eje de edad es el que mas estrecha.
    let estrecha = null;
    for (const [desde, hasta] of [[64, 64], [63, 65], [20, 21], [70, 72]]) {
      const c = await leerCohorteDeInvestigacion({ ...FILTRO_VACIO, edadDesde: desde, edadHasta: hasta });
      if (c.pacientesAutorizados > 0 && c.pacientesAutorizados < K_ANONIMATO) {
        estrecha = c;
        break;
      }
    }
    if (estrecha === null) return; // la base de pruebas no tiene un rango asi; no se inventa uno

    expect(estrecha.cohorteBajoElUmbral).toBe(true);
    expect(estrecha.cifrasDeLaCohorte.edadMedia, "la edad media ES la edad de esa persona").toBeNull();
    expect(estrecha.cifrasDeLaCohorte.edadMinima).toBeNull();
    expect(estrecha.cifrasDeLaCohorte.edadMaxima).toBeNull();
    // Y ninguna tabla de esa cohorte se publica.
    for (const eje of estrecha.estratos) {
      expect(eje.noPublicable, `el eje ${eje.eje} se publica con una cohorte de ${estrecha.pacientesAutorizados}`).toBe(true);
    }
  });

  it("una cohorte VACIA no esta bajo el umbral: cero personas no identifica a nadie", async () => {
    const c = await leerCohorteDeInvestigacion({ ...FILTRO_VACIO, pais: "Narnia" });
    expect(c.pacientesAutorizados).toBe(0);
    expect(c.cohorteBajoElUmbral, "'sin resultados' es una respuesta legitima, no un dato a esconder").toBe(
      false,
    );
  });

  // LA REGLA, SIN DEPENDER DEL VOLUMEN DE LA BASE. La base de pruebas local tiene UN paciente
  // autorizado, asi que ahi la cohorte completa ya esta bajo el umbral: un caso que afirmara "la cohorte
  // entera si entrega su edad" seria rojo en local y verde en produccion por el tamaño del seed, que es
  // justo la clase de candado que envejece. Se afirma la REGLA (la funcion pura) y, aparte, que el lector
  // la aplica en la direccion que le toque.
  it("la regla del umbral es la misma en los dos sentidos", async () => {
    const { cohorteBajoElUmbral, K_ANONIMATO } = await import(
      "@/modules/obbia/services/supresion-de-celdas"
    );
    expect(cohorteBajoElUmbral(0), "cero personas no identifica a nadie").toBe(false);
    expect(cohorteBajoElUmbral(1)).toBe(true);
    expect(cohorteBajoElUmbral(K_ANONIMATO - 1)).toBe(true);
    expect(cohorteBajoElUmbral(K_ANONIMATO), "en el umbral ya se puede").toBe(false);

    const c = await leerCohorteDeInvestigacion();
    expect(c.cohorteBajoElUmbral).toBe(cohorteBajoElUmbral(c.pacientesAutorizados));
    // Y la consecuencia: con la cohorte bajo el umbral la edad no sale; por encima, si (cuando hay dato).
    if (c.cohorteBajoElUmbral) expect(c.cifrasDeLaCohorte.edadMedia).toBeNull();
  });
});
