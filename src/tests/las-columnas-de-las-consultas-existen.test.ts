import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";

import * as esquema from "@/db/schema";

// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LAS COLUMNAS QUE PIDEN LAS CONSULTAS EXISTEN EN EL ESQUEMA  ·  2026-11-06
//
// ═══ EL CASO QUE LO PIDE (Sentry, 139 eventos, cada GET /ani-bis-e/[id]) ═══
//
//   reports-repository: conPlan: column treatments.protocol_snapshot does not exist
//
// La columna NUNCA existio. Las reales son `protocol_suggested` y `protocol_approved`. O sea que esa
// consulta fallo en TODAS las cargas desde que se escribio (2026-10-30), y lo unico que cambio el
// 2026-11-03 fue que su error se empezo a leer: antes el fallo era indistinguible de "no hay plan".
//
// ═══ POR QUE NINGUN TEST LO VIO, QUE ES LA PREGUNTA QUE IMPORTA ═══
//
// Si habia candado: `plan-paciente.test.ts` exige que la tarjeta ofrezca el enlace (`report.conPlan ?`) y
// que el correo adjunte segun lo mismo. Comprueba EL CABLE y no EL VALOR: ninguna de sus aserciones
// ejecuta la consulta ni mira el esquema, asi que el cable estaba bien atado a una fuente que devolvia
// siempre lo mismo. Y los 72 archivos de pruebas contra BD no tienen ni un caso de
// `getReportCardForEvaluation`.
//
// Un nombre de columna equivocado es invisible a tsc (el tipo de un `.select("...")` de PostgREST sale de
// una cadena), invisible a lint, e invisible a cualquier prueba que no toque la base. Quedaba un solo
// sitio donde se puede atrapar sin base de datos: el esquema Drizzle, que es la definicion de las tablas.
//
// ═══ QUE HACE ═══
//
// Lee las columnas REALES de las tablas desde `@/db/schema` con `getTableConfig` (no parsea SQL: usa la
// misma definicion con la que se generan las migraciones), recorre todo `src/` fuera de pruebas, y por
// cada cadena de PostgREST (`.from("tabla")`) comprueba los nombres de columna del `.select(...)`, de sus
// embeds anidados, y de los filtros y ordenes de la MISMA cadena. El defecto estaba en las dos mitades:
// en el `.select` y en un `.not("protocol_snapshot", "is", null)`.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

// ── EL ESQUEMA REAL ──────────────────────────────────────────────────────────────────────────────
const COLUMNAS = new Map<string, Set<string>>();
for (const valor of Object.values(esquema)) {
  if (is(valor, PgTable)) {
    const cfg = getTableConfig(valor);
    COLUMNAS.set(cfg.name, new Set(cfg.columns.map((c) => c.name)));
  }
}

/**
 * LO QUE NO ESTA EN DRIZZLE, declarado con su razon y su migracion. No es una lista para ir engordando:
 * cada entrada es un sitio donde este candado NO protege, y por eso tiene que doler escribirla.
 */
const FUERA_DEL_ESQUEMA: Record<string, string> = {
  // Vista (0228). Sus columnas las define el `create view`, no una tabla; comprobarlas pediria parsear el
  // SQL de la vista, que es otra cosa y con otra forma de envejecer.
  pacientes_del_roster: "vista creada en la migracion 0228",
  // TABLA REAL que nunca se agrego al esquema Drizzle: se creo con `CREATE TABLE` en SQL crudo (0147) y
  // el barrel no la declara. O sea que sus columnas no las vigila nada. Queda anotado aqui porque la
  // salida honesta es decirlo, no esconderlo: agregarla a Drizzle es trabajo propio (BACKLOG).
  sale_reversals: "tabla creada en SQL crudo en la migracion 0147, ausente del esquema Drizzle",
};

// ── LOS ARCHIVOS ─────────────────────────────────────────────────────────────────────────────────
function archivosDe(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const ruta = join(dir, entrada);
    if (statSync(ruta).isDirectory()) {
      if (entrada === "tests" || entrada === "node_modules") continue;
      salida.push(...archivosDe(ruta));
    } else if (/\.tsx?$/.test(entrada)) {
      // CON BARRAS NORMALES SIEMPRE: las rutas se nombran en las aserciones, y con el separador de
      // Windows el candado solo pasaria en esta maquina.
      salida.push(ruta.replace(/\\/g, "/"));
    }
  }
  return salida;
}

const ARCHIVOS = archivosDe("src");

// ── EL ANALISIS DE UNA CADENA DE POSTGREST ───────────────────────────────────────────────────────

/** Parte una lista de PostgREST por las comas de PRIMER nivel: los embeds llevan sus propias comas. */
function partirPorComas(texto: string): string[] {
  const partes: string[] = [];
  let nivel = 0;
  let actual = "";
  for (const c of texto) {
    if (c === "(") nivel += 1;
    if (c === ")") nivel -= 1;
    if (c === "," && nivel === 0) {
      partes.push(actual);
      actual = "";
    } else {
      actual += c;
    }
  }
  if (actual.trim()) partes.push(actual);
  return partes;
}

/** `cerrada:profiles!closed_by` -> tabla `profiles`. `alias:columna` -> columna `columna`. */
function sinAlias(nombre: string): string {
  const i = nombre.indexOf(":");
  return i === -1 ? nombre : nombre.slice(i + 1);
}

/** `col->>clave`, `col->clave`, `col::text` -> `col`. */
function soloLaColumna(nombre: string): string {
  return nombre.split("->")[0].split("::")[0].trim();
}

const NO_SON_COLUMNAS = new Set(["*", "count", ""]);

type Falla = { archivo: string; detalle: string };

/** Comprueba una lista de seleccion contra una tabla, entrando en los embeds. */
function revisarSeleccion(lista: string, tabla: string, archivo: string, fallas: Falla[]): void {
  const cols = COLUMNAS.get(tabla);
  if (!cols) return; // tabla declarada fuera del esquema: ya lo cubre su propio caso
  for (const parte of partirPorComas(lista)) {
    const t = parte.trim();
    if (!t) continue;
    const abre = t.indexOf("(");
    if (abre !== -1) {
      // ── UN EMBED: `alias:tabla!pista!inner(columnas)` ──
      const cabeza = sinAlias(t.slice(0, abre).trim());
      const cierra = t.lastIndexOf(")");
      const dentro = t.slice(abre + 1, cierra === -1 ? undefined : cierra);
      const trozos = cabeza.split("!");
      const tablaEmbed = trozos[0].replace(/^\.\.\./, "");
      // LAS PISTAS TAMBIEN SE COMPRUEBAN, con tolerancia: una pista es `inner`/`left`, o la COLUMNA por
      // la que se desambigua (que vive en una de las dos tablas), o el nombre de una restriccion. Solo se
      // acusa la que no es ninguna de las tres cosas, que es la que esta mal escrita.
      for (const pista of trozos.slice(1)) {
        if (pista === "inner" || pista === "left") continue;
        const colsEmbed = COLUMNAS.get(tablaEmbed);
        const enAlguna = cols.has(pista) || (colsEmbed?.has(pista) ?? false);
        const pareceRestriccion = /_fkey$|_fk$/.test(pista);
        if (!enAlguna && !pareceRestriccion && COLUMNAS.has(tablaEmbed)) {
          fallas.push({
            archivo,
            detalle: `la pista "${pista}" del embed ${tablaEmbed} no es columna de ${tabla} ni de ${tablaEmbed}`,
          });
        }
      }
      if (COLUMNAS.has(tablaEmbed)) revisarSeleccion(dentro, tablaEmbed, archivo, fallas);
      else if (!(tablaEmbed in FUERA_DEL_ESQUEMA)) {
        fallas.push({ archivo, detalle: `el embed "${tablaEmbed}" no es ninguna tabla del esquema` });
      }
      continue;
    }
    const col = soloLaColumna(sinAlias(t));
    if (NO_SON_COLUMNAS.has(col) || col.includes("${")) continue;
    if (!cols.has(col)) {
      fallas.push({ archivo, detalle: `la columna ${tabla}.${col} no existe` });
    }
  }
}

/** Una ruta de filtro: `columna` o `tabla.columna` (sobre un embed). */
function revisarRutaDeFiltro(ruta: string, tabla: string, archivo: string, fallas: Falla[]): void {
  if (ruta.includes("${")) return; // armada en tiempo de ejecucion: aqui no se puede resolver
  const trozos = ruta.split(".");
  if (trozos.length === 1) {
    const cols = COLUMNAS.get(tabla);
    const col = soloLaColumna(trozos[0]);
    if (cols && !NO_SON_COLUMNAS.has(col) && !cols.has(col)) {
      fallas.push({ archivo, detalle: `el filtro sobre ${tabla}.${col} usa una columna que no existe` });
    }
    return;
  }
  // `diagnoses.evaluation_id`: los trozos de delante nombran los embeds que se atraviesan, y PUEDEN SER
  // VARIOS (`bis_measurements.evaluations.patient_id` baja dos niveles). Se camina la ruta tabla a tabla.
  // Si un trozo no es una tabla conocida es un ALIAS del select, y por un alias no se puede resolver la
  // columna: se deja pasar en silencio a proposito, que es mejor que acusar en falso.
  let actual = tabla;
  for (let i = 0; i < trozos.length - 1; i += 1) {
    if (!COLUMNAS.has(trozos[i])) return;
    actual = trozos[i];
  }
  const cols = COLUMNAS.get(actual);
  if (!cols) return;
  const col = soloLaColumna(trozos[trozos.length - 1]);
  if (!NO_SON_COLUMNAS.has(col) && !cols.has(col)) {
    fallas.push({ archivo, detalle: `el filtro sobre ${actual}.${col} usa una columna que no existe` });
  }
}

const FILTROS =
  /\.(eq|neq|gt|gte|lt|lte|like|ilike|is|in|contains|containedBy|overlaps|filter|order|not)\(\s*"([^"]+)"/g;

const todasLasFallas: Falla[] = [];
const tablasConsultadas = new Set<string>();
const seleccionesDinamicas: string[] = [];

/** Revisa el texto de UN archivo. Se saca aparte para poder probar el detector con el defecto real. */
function revisarArchivo(
  archivo: string,
  texto: string,
  fallas: Falla[],
  tablas: Set<string>,
  dinamicas: string[],
): void {
  const desde = /\.from\(\s*"([a-z_]+)"\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = desde.exec(texto)) !== null) {
    const tabla = m[1];
    tablas.add(tabla);
    if (!COLUMNAS.has(tabla) && !(tabla in FUERA_DEL_ESQUEMA)) {
      fallas.push({ archivo, detalle: `la tabla "${tabla}" no existe en el esquema` });
      continue;
    }
    // ── DONDE ACABA LA CADENA ──
    //
    // Hasta el `;` que cierra la sentencia, Y hasta el siguiente `.from("...")`, lo que llegue primero.
    // Las dos cosas, porque un `Promise.all([...])` mete VARIAS consultas en UNA sola sentencia: sin el
    // segundo corte, los filtros de la segunda consulta se le atribuyen a la tabla de la primera y el
    // candado acusa columnas que si existen, pero en otra tabla. (Se vio al estrenarlo: daba por
    // inexistente `bis_raw_values.evaluation_id`, que es un filtro de la consulta de al lado.)
    const resto = texto.slice(m.index + m[0].length);
    const corte = (i: number) => (i === -1 ? resto.length : i);
    const cadena = resto.slice(0, Math.min(corte(resto.indexOf(";")), corte(resto.indexOf('.from("')), 2000));

    // EL SELECT. Se aceptan literales concatenados (`"a," + "b"`), que es como se parten los largos.
    const sel = /\.select\(\s*((?:"[^"]*"\s*\+?\s*)+)/.exec(cadena);
    if (sel) {
      const lista = [...sel[1].matchAll(/"([^"]*)"/g)].map((x) => x[1]).join("");
      revisarSeleccion(lista, tabla, archivo, fallas);
    } else if (/\.select\(\s*[`$]/.test(cadena)) {
      // Armado con plantilla: no se puede comprobar aqui. Se deja constancia en vez de pasar de largo.
      dinamicas.push(`${archivo}: ${tabla}`);
    }

    // LOS FILTROS Y EL ORDEN de la misma cadena.
    FILTROS.lastIndex = 0;
    let f: RegExpExecArray | null;
    while ((f = FILTROS.exec(cadena)) !== null) revisarRutaDeFiltro(f[2], tabla, archivo, fallas);
  }
}

for (const archivo of ARCHIVOS) {
  revisarArchivo(
    archivo,
    readFileSync(archivo, "utf8"),
    todasLasFallas,
    tablasConsultadas,
    seleccionesDinamicas,
  );
}

describe("las columnas que piden las consultas existen en el esquema", () => {
  it("el esquema se pudo leer, y trae las tablas que debe", () => {
    // Si este numero baja mucho es que el barrel dejo de exportar un grupo, y entonces el candado
    // entero pasaria en verde sin comprobar nada: por eso se afirma el PISO antes de usarlo.
    expect(COLUMNAS.size).toBeGreaterThanOrEqual(100);
    expect(COLUMNAS.get("treatments")).toBeDefined();
    // Y LAS DOS COLUMNAS DEL CASO, por su nombre: las reales existen y la inventada no.
    expect(COLUMNAS.get("treatments")!.has("protocol_suggested")).toBe(true);
    expect(COLUMNAS.get("treatments")!.has("protocol_approved")).toBe(true);
    expect(COLUMNAS.get("treatments")!.has("protocol_snapshot")).toBe(false);
  });

  it("se revisaron consultas de verdad (si no, el candado estaria vacio)", () => {
    expect(tablasConsultadas.size).toBeGreaterThanOrEqual(50);
  });

  it("y ATRAPA el defecto que lo motivo, con la consulta tal como estaba escrita", () => {
    // UN CANDADO QUE NUNCA VIO SU DEFECTO NO ESTA PROBADO. Esta es la consulta exacta que estuvo en
    // produccion siete dias, copiada del archivo antes del arreglo: la columna inventada aparece en las
    // DOS mitades (el `select` y el `not`), y las dos tienen que salir acusadas.
    const fallas: Falla[] = [];
    revisarArchivo(
      "el-defecto-de-la-tarjeta.ts",
      `const { data: conProtocolo, error: errProtocolo } = await supabase
        .from("treatments")
        .select("protocol_snapshot, diagnoses!inner(evaluation_id)")
        .eq("diagnoses.evaluation_id", evaluationId)
        .not("protocol_snapshot", "is", null)
        .limit(1)
        .maybeSingle();`,
      fallas,
      new Set(),
      [],
    );
    expect(fallas.map((f) => f.detalle)).toEqual([
      "la columna treatments.protocol_snapshot no existe",
      "el filtro sobre treatments.protocol_snapshot usa una columna que no existe",
    ]);
  });

  it("y NO acusa en falso la consulta que la reemplazo", () => {
    // La otra mitad del candado: que lo bueno pase. Si esto fallara, el candado no se podria dejar
    // encendido y se volveria una lista de excepciones.
    const fallas: Falla[] = [];
    revisarArchivo(
      "el-arreglo.ts",
      `const { data, error } = await supabase
        .from("treatments")
        .select("protocol_suggested, diagnoses!inner(evaluation_id)")
        .eq("diagnoses.evaluation_id", evaluationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();`,
      fallas,
      new Set(),
      [],
    );
    expect(fallas).toEqual([]);
  });

  it("ninguna consulta de src/ pide una columna o una tabla que no existe", () => {
    const mensaje = todasLasFallas.map((f) => `  ${f.archivo}\n    ${f.detalle}`).join("\n");
    expect(todasLasFallas, `consultas contra columnas inexistentes:\n${mensaje}`).toEqual([]);
  });

  it("y las selecciones armadas con plantilla quedan nombradas, no escondidas", () => {
    // Una lista de columnas construida en tiempo de ejecucion no se puede comprobar aqui. Lo que no puede
    // pasar es que crezcan sin que nadie lo note: se declaran, y si aparece una nueva, esto falla y hay
    // que decidir si se puede comprobar de otra forma.
    //
    // Las dos de hoy son el mismo caso: el tablero y el panel de direccion arman la lista de columnas del
    // inventario con una plantilla para pedir las mismas columnas en dos sitios.
    expect(seleccionesDinamicas.sort()).toEqual([
      "src/modules/dashboard/data/tablero-reader.ts: nutraceutical_inventory",
      "src/modules/direccion/data/dashboard-reader.ts: nutraceutical_inventory",
    ]);
  });
});
