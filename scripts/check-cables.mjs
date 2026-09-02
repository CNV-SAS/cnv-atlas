#!/usr/bin/env node
// CHECK DE CABLES: ninguna server action puede quedarse sin pantalla que la invoque.
//
// POR QUE EXISTE. En una semana aparecieron seis piezas terminadas a las que les faltaba el ultimo cable:
// `motorTratNutri` portado y sin llamar, la dinamometria capturada y sin cablear, el peso meta escrito sin
// lector, `limpiarMarcadores` importado y nunca invocado, y la peor, TODA la vertical de aprobar un
// tratamiento (policy, servicio, writer, trigger y dos suites de tests) sin un boton que la llamara.
//
// LA OBSERVACION QUE LO HACE POSIBLE, y es de Santiago: cuando el cable es un IMPORT, lint lo ve; cuando
// es una llamada o un argumento, no lo ve nadie. Hay una tercera forma que si es detectable y cubre los
// cinco casos: DECLARADO Y SIN IMPORTADOR. Este check la comprueba donde es exacta.
//
// POR QUE SOLO LAS SERVER ACTIONS, y no todo export sin importador. Una server action es POR DEFINICION el
// extremo de un cable que empieza en un boton: si nadie la nombra, no hay boton. Esa precision es lo que
// hace el check util. Sobre todos los exports daria decenas de falsos (barriles, tipos, prompts
// versionados, tablas del schema) y un check con ruido se aprende a ignorar, que es peor que no tenerlo.
//
// DOS COSAS QUE HUBO QUE APRENDER MIDIENDO, y sin ellas el check miente:
//   1. Una action puede llamarse desde un ENVOLTORIO de su propio archivo (comodato lo hace: el formulario
//      usa `createDeviceFormAction` y esa llama a `createDeviceAction`). Contando solo fuera del archivo,
//      nueve actions vivas salian muertas.
//   2. Y hay que descontar la propia declaracion, o cualquiera se salva a si misma.
//
// Sin dependencia nueva, en la misma familia que check-rsc-boundaries y check-migrations.

import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const RAICES = ["src", "supabase", "scripts"];

// EXCEPCIONES, cada una con su razon y su fuente. Una excepcion sin razon escrita es un agujero.
const SIN_PANTALLA_A_PROPOSITO = new Map([
  [
    "acknowledgeRestrictionsAction",
    "ARCHITECTURE.md linea 237 lo declara explicitamente: `restrictions_ack_*` NO gatea nada hoy, " +
      "'maquinaria construida y sin cablear, a proposito y no por olvido'. Desde menu.v2 las " +
      "restricciones del modelo ya llegan al prompt, asi que el reconocimiento seria constancia, no " +
      "proteccion. Si algun dia se cablea, se borra esta linea.",
  ],
  [
    "registerUsageAction",
    "MVP.md, tabla de modulos: el modulo nutraceuticals es 'Importante' y NO entra al MVP; el 'registro " +
      "de uso/recomendacion' es parte de su alcance futuro. La action se escribio adelantada a su " +
      "pantalla. A diferencia de la aprobacion del tratamiento, aqui SI hay un documento que dice que la " +
      "superficie no existe todavia, y esa es toda la diferencia entre un pendiente y un hueco.",
  ],
]);

function listar(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name).replace(/\\/g, "/");
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      listar(p, out);
    } else if (/\.(ts|tsx)$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const esTest = (p) => p.includes("/tests/") || p.includes("__tests__") || p.includes(".test.");
const PALABRA = /[A-Za-z0-9_$]/;

/** ¿Aparece `k` como palabra completa? Frontera a mano: un `\b` mal escapado convierte el check en ruido. */
function contiene(s, k) {
  let i = -1;
  while ((i = s.indexOf(k, i + 1)) !== -1) {
    const a = i > 0 ? s[i - 1] : "";
    const b = s[i + k.length] || "";
    if (!PALABRA.test(a) && !PALABRA.test(b)) return true;
  }
  return false;
}

const archivos = RAICES.flatMap((r) => listar(r))
  .filter((p) => !esTest(p))
  .map((p) => ({ p, s: readFileSync(p, "utf8") }));

// Lista 1: las declaradas. Una server action vive en un archivo con la directiva "use server".
const declaradas = [];
for (const a of archivos) {
  if (!/^\s*["']use server["']/m.test(a.s)) continue;
  for (const m of a.s.matchAll(/export\s+async\s+function\s+([A-Za-z_$][\w$]*)/g)) {
    declaradas.push({ n: m[1], en: a.p });
  }
}

// Lista 2: las invocadas desde otro archivo, o desde un envoltorio del suyo.
const porRuta = new Map(archivos.map((a) => [a.p, a]));
const huerfanas = [];
for (const d of declaradas) {
  const fuera = archivos.some((a) => a.p !== d.en && contiene(a.s, d.n));
  if (fuera) continue;
  // Dentro de su archivo: la declaracion cuenta una vez; mas de una es un envoltorio que la llama.
  const propio = porRuta.get(d.en).s;
  if (propio.split(d.n).length - 1 > 1) continue;
  huerfanas.push(d);
}

// CONTROL. Sin esto, "cero huerfanas" pasa verde tambien con el detector roto, que es como se reporta un
// hallazgo enorme y falso (o peor: como se da por limpio algo que no se miro).
if (declaradas.length < 50) {
  console.error(
    `Cables: el detector encontro solo ${declaradas.length} server actions. Deberian ser ~99. ` +
      `Revisa la deteccion de "use server" antes de confiar en el resultado.`,
  );
  process.exit(1);
}

const reales = huerfanas.filter((d) => !SIN_PANTALLA_A_PROPOSITO.has(d.n));

if (reales.length === 0) {
  const exc = declaradas.filter((d) => SIN_PANTALLA_A_PROPOSITO.has(d.n)).length;
  console.log(
    `Cables: limpio (${declaradas.length} server actions, todas con pantalla` +
      (exc ? `; ${exc} declarada${exc > 1 ? "s" : ""} sin pantalla a proposito` : "") +
      ").",
  );
  process.exit(0);
}

console.error(`\nCables: ${reales.length} server action(es) que ninguna pantalla invoca.\n`);
for (const d of reales) {
  console.error(`  ${d.n}`);
  console.error(`     ${d.en}`);
}
console.error(
  "\nUna server action sin pantalla es una vertical construida y muerta: la policy, el servicio, el\n" +
    "writer y sus tests pasan verdes con el hueco abierto, porque lo que falta es el boton.\n" +
    "Si la ausencia es deliberada, decláralo en SIN_PANTALLA_A_PROPOSITO de este archivo, con la razon\n" +
    "y su fuente. Si no lo es, falta cablearla.\n",
);
process.exit(1);
