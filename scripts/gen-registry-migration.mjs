// GENERA LA MIGRACION DEL REGISTRO DERIVADO DEL MOTOR CONGELADO.
//
// EL DEFECTO QUE CIERRA, y es la CUARTA vez con esta forma (2026-09-09). El registro son cuatro
// catalogos (`indicator_definitions`, `phenotypes`, `fr_sectors`, `efr_states`) que se GENERAN corriendo
// el motor congelado, y hasta hoy los escribia SOLO `supabase/seed.ts`, cuyo atajo lleva
// `--env-file=.env.local` dentro. O sea: no habia canal a la nube en absoluto.
//
// LO QUE COSTO, medido en la nube en solo lectura antes de escribir esto:
//   · `efr_states`: 17 estados sin mecanismo y 20 sin biomarcadores, mientras en local estaban los 81
//     completos. Ese texto es lo que el profesional LEE como diagnostico, y ademas se SELLA en el
//     snapshot al diagnosticar, asi que cada diagnostico nuevo heredaba el hueco.
//   · `fr_sectors`: 6 de los 9 nombres distintos, y no por matiz: el `1_1` de la nube decia "Alto
//     desempeño, riesgo oculto" y el del motor dice "Disfuncion con bajo riesgo". Lo contrario.
//   · `phenotypes` e `indicator_definitions` estaban al dia, pero por suerte: tampoco tenian canal.
//     (De hecho `indicator_definitions` ya se habia parcheado a mano una vez, con un script suelto.)
//
// POR QUE UN UPSERT Y NO UN INSERT ADITIVO, que es donde esto se separa del generador de condiciones
// BIS: alli cada version del catalogo son filas NUEVAS con ids derivados de la version. Aqui NO hay
// tabla de versiones propia: los cuatro catalogos cuelgan de un `model_version_id` FIJO y se corrigen
// EN SITIO por su clave natural. Desplegar un cambio del motor es un UPDATE, no un INSERT.
//
//   Y ESO LOS HACE IDEMPOTENTES POR CONSTRUCCION: `ON CONFLICT ... DO UPDATE` deja el mismo estado se
//   aplique una vez o tres, y no depende de que la fila exista antes.
//
// POR QUE NO SE BORRA Y SE VUELVE A INSERTAR, que es lo que hace el seed con `efr_states`: un DELETE en
// una migracion de produccion es una operacion destructiva sobre contenido clinico, y aqui no hace falta.
// El seed lo necesita porque re-siembra sobre una BD que puede venir de una RENUMERACION de estados; una
// migracion generada del motor de HOY no renumera nada (el numero sale de las mismas cuatro bandas).
//
// Como se corre:  node scripts/gen-registry-migration.mjs <numero> > drizzle/NNNN_registro_del_motor.sql
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createContext, runInContext } from "node:vm";

const require = createRequire(import.meta.url);

const numero = process.argv[2];
if (!/^\d+$/.test(numero ?? "")) {
  console.error("Uso: node scripts/gen-registry-migration.mjs <numero de migracion>");
  process.exit(2);
}

// ── EL MODEL_VERSION_ID SALE DEL SEED, no se escribe aqui: es la clave con la que las cuatro tablas
//    cuelgan del modelo, y tenerla en dos sitios es tenerla mal en uno. ──
const SEED = "supabase/seed.ts";
const S = readFileSync(SEED, "utf8").replace(/\r\n/g, "\n");
const mv = /^const MODEL_VERSION_ID = "([0-9a-f-]{36})";$/m.exec(S);
if (!mv) throw new Error(`no encuentro MODEL_VERSION_ID en ${SEED}`);
const MODEL_VERSION_ID = mv[1];

// La raya que su motor pone donde no hay texto. Se declara una vez y viaja al SQL: contarla es lo que
// permite decir en el ANTES y el DESPUES cuantos estados cambian de verdad.
const RAYA = "—";

// ── EL CONTENIDO SALE DEL MISMO MOTOR QUE USA EL SEED ────────────────────────────────────────────────
const core = require("../src/clinical-engine/frozen/engine.core.js");

/**
 * `registry-data.ts` y `types.ts` son TypeScript y este script es Node puro, asi que no se pueden
 * importar tal cual. En vez de re-implementar sus piezas (que seria la segunda fuente que esto viene a
 * cerrar), se EXTRAEN del propio archivo y se evaluan, igual que hace el generador de condiciones BIS
 * con `uuidFromKey`.
 */
function piezaDelArchivo(ruta, patron, nombre) {
  const src = readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
  const trozo = patron.exec(src)?.[0];
  if (!trozo) throw new Error(`no encuentro ${nombre} en ${ruta}`);
  return trozo;
}

/** Indice del cierre que empareja con el `abre` que hay en `i`. */
function cierreDe(fuente, i, abre, cierra) {
  let prof = 0;
  for (let j = i; j < fuente.length; j++) {
    if (fuente[j] === abre) prof++;
    else if (fuente[j] === cierra) {
      prof--;
      if (prof === 0) return j;
    }
  }
  throw new Error(`no cierra el ${abre} en la posicion ${i}`);
}

/**
 * Extrae una funcion COMPLETA de un archivo TypeScript, por su nombre, y la devuelve SIN TIPOS.
 *
 * POR QUE CONTANDO LLAVES Y NO CON UNA EXPRESION REGULAR, que fue el primer intento y salio mal en
 * silencio: `function NAME\([\s\S]*?\n\}` es NO CODICIOSA, asi que en `efrStateNumber(bands: { ifc:
 * number; ... })` corta en el cierre del TIPO del parametro y devuelve media funcion. Media funcion
 * evalua sin error y falla despues, al llamarla, que es el peor sitio para enterarse.
 *
 * La cabecera se reescribe con los NOMBRES de los parametros (los identificadores de nivel 1), en vez de
 * intentar borrar las anotaciones con otra expresion regular.
 */
function funcionSinTipos(ruta, nombre) {
  const src = readFileSync(ruta, "utf8").replace(/\r\n/g, "\n");
  const ini = src.indexOf(`function ${nombre}(`);
  if (ini < 0) throw new Error(`no encuentro function ${nombre}( en ${ruta}`);
  const abre = src.indexOf("(", ini);
  const cierra = cierreDe(src, abre, "(", ")");
  const cuerpoIni = src.indexOf("{", cierra);
  const fuente = src.slice(ini, cierreDe(src, cuerpoIni, "{", "}") + 1);
  const dentro = src.slice(abre + 1, cierra);
  const params = [];
  let nivel = 0;
  let actual = "";
  for (const ch of dentro) {
    if ("{[(<".includes(ch)) nivel++;
    else if ("}])>".includes(ch)) nivel--;
    if (ch === "," && nivel === 0) {
      params.push(actual);
      actual = "";
    } else actual += ch;
  }
  if (actual.trim()) params.push(actual);
  const nombres = params.map((x) => x.trim().split(/[:\s]/)[0]).filter(Boolean);
  // El cuerpo se toma de `fuente`, que ya esta recortada, asi que su indice es RELATIVO a `ini`.
  const cuerpo = fuente.slice(cuerpoIni - ini);
  // Y las anotaciones de las variables INTERNAS (`const c = (v: number) => ...`) tambien sobran.
  return `function ${nombre}(${nombres.join(", ")}) ${cuerpo}`.replace(/\(([a-z]+): [a-z]+\)/g, "($1)");
}

const TIPOS = "src/clinical-engine/types.ts";
const ctx = {};
createContext(ctx);
runInContext(
  piezaDelArchivo(
    "src/clinical-engine/registry-data.ts",
    /const INDICATOR_NAMES: Record<[^>]*> = \{[\s\S]*?\n\};/,
    "INDICATOR_NAMES",
  )
    .replace(/: Record<[^>]*>/, "")
    .replace(/^const /, "var "),
  ctx,
);
// EL ORDEN DE RIESGO Y SUS DOS FUNCIONES, del contrato del motor. `efrStateNumber` depende de
// `efrRiskRank`, y este de `EFR_RISK_ORDER`: se traen los tres, porque traer solo el de arriba deja una
// funcion que llama a algo que no existe y falla en el momento de generar, no antes.
runInContext(
  piezaDelArchivo(TIPOS, /const EFR_RISK_ORDER[\s\S]*?\n\];/, "EFR_RISK_ORDER")
    // La anotacion va entre el nombre y el `=`: se corta ahi, que es donde empieza el VALOR.
    .replace(/^const\s+EFR_RISK_ORDER[^=]*=/, "var EFR_RISK_ORDER =")
    .replace(/ as const/g, ""),
  ctx,
);
for (const nombre of ["bandToLetter", "efrRiskRank", "efrStateNumber"]) {
  runInContext(funcionSinTipos(TIPOS, nombre), ctx);
}
const { INDICATOR_NAMES, bandToLetter, efrStateNumber } = ctx;

// ── Los cuatro catalogos, del motor de HOY ──────────────────────────────────────────────────────────
const indicadores = Object.entries(INDICATOR_NAMES).map(([code, v]) => ({ code, name: v.name, unit: v.unit }));
const fenotipos = Object.entries(core.STRUCT_LABELS).map(([code, name]) => ({ code, name }));
const sectores = Object.entries(core.FYR_LABELS).map(([code, v]) => ({ code, name: v.l }));
const estados = [];
for (let ifc = 1; ifc <= 3; ifc++)
  for (let irc = 1; irc <= 3; irc++)
    for (let ffmi = 1; ffmi <= 3; ffmi++)
      for (let fmi = 1; fmi <= 3; fmi++) {
        const dx = core.getDX(ifc, irc, ffmi, fmi);
        estados.push({
          stateNumber: efrStateNumber({ ifc, irc, ffmi, fmi }),
          ifc,
          irc,
          ffmi,
          fmi,
          diagnosisName: String(dx.dx ?? dx.name ?? ""),
          mechanism: String(dx.mec ?? ""),
          biomarkers: String(dx.bio ?? ""),
          risks: String(dx.rsk ?? ""),
          suggestedNutraceuticals: String(dx.n ?? ""),
        });
      }

// CONTROL DE QUE EL MOTOR PRODUJO EL REGISTRO ENTERO. Sin esto, una extraccion rota emitiria un SQL
// corto que se aplicaria sin error y dejaria el catalogo a medias, que es peor que no aplicarlo.
if (indicadores.length !== 12 || fenotipos.length !== 9 || sectores.length !== 9 || estados.length !== 81) {
  throw new Error(
    `el motor no produjo el registro completo: ${indicadores.length}/12 indicadores, ` +
      `${fenotipos.length}/9 fenotipos, ${sectores.length}/9 sectores, ${estados.length}/81 estados`,
  );
}
if (new Set(estados.map((e) => e.stateNumber)).size !== 81) {
  throw new Error("los numeros de estado se repiten: la numeracion no es una permutacion de las bandas");
}

const esc = (v) => (v == null ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const out = [];
const p = (l = "") => out.push(l);

// El bloque que cuenta lo que hay, para el ANTES y el DESPUES. Se emite dos veces con el mismo cuerpo:
// escribirlo dos veces a mano es como se consigue que el ANTES y el DESPUES cuenten cosas distintas.
const conteos = (rotulo, extra) => {
  p(`DO $$`);
  p(`DECLARE`);
  p(`  v_modelo uuid := '${MODEL_VERSION_ID}';`);
  p(`  v_estados int; v_sin_mec int; v_sin_bio int; v_indic int; v_feno int; v_sect int;`);
  p(`BEGIN`);
  if (rotulo === "ANTES") {
    p(`  IF NOT EXISTS (SELECT 1 FROM model_versions WHERE id = v_modelo) THEN`);
    p(
      `    RAISE EXCEPTION 'No existe la version del modelo %. Esta migracion actualiza SU registro; sin ella no hay nada que actualizar.', v_modelo;`,
    );
    p(`  END IF;`);
  }
  p(`  SELECT count(*) INTO v_estados FROM efr_states WHERE model_version_id = v_modelo;`);
  p(
    `  SELECT count(*) INTO v_sin_mec FROM efr_states WHERE model_version_id = v_modelo AND coalesce(btrim(mechanism), '') IN ('', '${RAYA}');`,
  );
  p(
    `  SELECT count(*) INTO v_sin_bio FROM efr_states WHERE model_version_id = v_modelo AND coalesce(btrim(biomarkers), '') IN ('', '${RAYA}');`,
  );
  p(`  SELECT count(*) INTO v_indic FROM indicator_definitions WHERE model_version_id = v_modelo;`);
  p(`  SELECT count(*) INTO v_feno FROM phenotypes WHERE model_version_id = v_modelo;`);
  p(`  SELECT count(*) INTO v_sect FROM fr_sectors WHERE model_version_id = v_modelo;`);
  p(
    `  RAISE NOTICE '${rotulo} · efr_states: % de 81 (% sin mecanismo, % sin biomarcadores) | indicadores: % de 12 | fenotipos: % de 9 | sectores: % de 9', v_estados, v_sin_mec, v_sin_bio, v_indic, v_feno, v_sect;`,
  );
  if (extra) extra();
  p(`END $$;`);
};

p(`-- REGISTRO DERIVADO DEL MOTOR CONGELADO: los cuatro catalogos, al dia.`);
p(`--`);
p(`-- GENERADO por scripts/gen-registry-migration.mjs desde el motor congelado. NO editar a mano: el`);
p(`-- motor es la fuente unica y esto se deriva de el. Editarlo aqui hace que los dos canales (local por`);
p(`-- seed, nube por migracion) digan cosas distintas sin que nada de error, que es exactamente el`);
p(`-- defecto que esta migracion viene a cerrar.`);
p(`--`);
p(`-- POR QUE EXISTE: hasta hoy estos cuatro catalogos SOLO los escribia supabase/seed.ts, cuyo atajo`);
p(`-- lleva --env-file=.env.local dentro. Nunca hubo canal a la nube. Medido en la nube, en solo lectura,`);
p(`-- antes de generar esto: 17 estados sin mecanismo y 20 sin biomarcadores (0 en local), y 6 de los 9`);
p(`-- nombres de fr_sectors distintos, con el 1_1 diciendo lo CONTRARIO que el motor.`);
p(`--`);
p(`-- IDEMPOTENTE: todo es ON CONFLICT ... DO UPDATE sobre la clave natural. Aplicarla dos veces deja`);
p(`-- exactamente lo mismo, y no borra ninguna fila.`);
p(`--`);
p(`-- NO TOCA NINGUN DIAGNOSTICO YA EMITIDO. El contenido del estado se SELLA en el snapshot al`);
p(`-- diagnosticar (efrContent), y el snapshot es inmutable a proposito: corregir el catalogo no puede`);
p(`-- reescribir lo que un profesional ya leyo. Los diagnosticos anteriores conservan su texto; los`);
p(`-- nuevos salen del catalogo corregido.`);
p();
p(`-- ═══ ANTES ═══ Sale como NOTICE: visible en el editor SQL de Supabase (pestaña "Notices") y en psql.`);
p(`-- Es contenido clinico, asi que hay que poder decir que habia y que quedo.`);
conteos("ANTES");
p();

p(`-- ── 1. indicator_definitions (12): los nombres que Gildardo fijo, uno por indicador. ──`);
p(`INSERT INTO indicator_definitions (model_version_id, code, name, unit) VALUES`);
p(indicadores.map((d) => `  ('${MODEL_VERSION_ID}', ${esc(d.code)}, ${esc(d.name)}, ${esc(d.unit)})`).join(",\n"));
p(`ON CONFLICT (model_version_id, code) DO UPDATE SET name = EXCLUDED.name, unit = EXCLUDED.unit;`);
p();

p(`-- ── 2. phenotypes (9): fenotipo estructural FFMI x FMI, por clave de banda "A_B". ──`);
p(`INSERT INTO phenotypes (model_version_id, code, name) VALUES`);
p(fenotipos.map((f) => `  ('${MODEL_VERSION_ID}', ${esc(f.code)}, ${esc(f.name)})`).join(",\n"));
p(`ON CONFLICT (model_version_id, code) DO UPDATE SET name = EXCLUDED.name;`);
p();

p(`-- ── 3. fr_sectors (9): sector funcional IFC x IRC. Es el catalogo que decia lo contrario. ──`);
p(`INSERT INTO fr_sectors (model_version_id, code, name) VALUES`);
p(sectores.map((s) => `  ('${MODEL_VERSION_ID}', ${esc(s.code)}, ${esc(s.name)})`).join(",\n"));
p(`ON CONFLICT (model_version_id, code) DO UPDATE SET name = EXCLUDED.name;`);
p();

p(`-- ── 4. efr_states (81): los cinco campos clinicos de cada estado de la Diana. ──`);
p(`-- LA CLAVE DEL UPSERT ES (model_version_id, state_number), que es como el seed y el lector los`);
p(`-- identifican. Las bandas van en el SET y no en la clave porque son parte de la fila.`);
p(
  `INSERT INTO efr_states (model_version_id, state_number, ifc_band, irc_band, ffmi_band, fmi_band, diagnosis_name, mechanism, biomarkers, risks, suggested_nutraceuticals) VALUES`,
);
p(
  estados
    .slice()
    .sort((a, b) => a.stateNumber - b.stateNumber)
    .map(
      (e) =>
        `  ('${MODEL_VERSION_ID}', ${e.stateNumber}, ${e.ifc}, ${e.irc}, ${e.ffmi}, ${e.fmi}, ` +
        `${esc(e.diagnosisName)}, ${esc(e.mechanism)}, ${esc(e.biomarkers)}, ${esc(e.risks)}, ` +
        `${esc(e.suggestedNutraceuticals)})`,
    )
    .join(",\n"),
);
p(`ON CONFLICT (model_version_id, state_number) DO UPDATE SET`);
p(`  ifc_band = EXCLUDED.ifc_band, irc_band = EXCLUDED.irc_band,`);
p(`  ffmi_band = EXCLUDED.ffmi_band, fmi_band = EXCLUDED.fmi_band,`);
p(`  diagnosis_name = EXCLUDED.diagnosis_name, mechanism = EXCLUDED.mechanism,`);
p(`  biomarkers = EXCLUDED.biomarkers, risks = EXCLUDED.risks,`);
p(`  suggested_nutraceuticals = EXCLUDED.suggested_nutraceuticals;`);
p();

p(`-- ═══ DESPUES ═══`);
conteos("DESPUES", () => {
  p(`  IF v_estados <> 81 OR v_indic <> 12 OR v_feno <> 9 OR v_sect <> 9 THEN`);
  p(
    `    RAISE EXCEPTION 'El registro quedo incompleto: % estados, % indicadores, % fenotipos, % sectores.', v_estados, v_indic, v_feno, v_sect;`,
  );
  p(`  END IF;`);
  p(`  IF v_sin_mec > 0 OR v_sin_bio > 0 THEN`);
  p(
    `    RAISE NOTICE 'Quedan % estados sin mecanismo y % sin biomarcadores. Si el motor los trae vacios eso es SU contenido, no un fallo de esta migracion.', v_sin_mec, v_sin_bio;`,
  );
  p(`  END IF;`);
});
p();
p(
  `-- ${estados.length} estados, ${indicadores.length} indicadores, ${fenotipos.length} fenotipos, ${sectores.length} sectores.`,
);

console.log(out.join("\n"));
