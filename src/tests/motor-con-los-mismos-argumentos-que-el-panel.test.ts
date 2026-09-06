import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sinComentarios } from "./helpers/sin-comentarios";

/**
 * LA HISTORIA CLINICA NO PUEDE LLAMAR AL MOTOR CON MENOS ARGUMENTOS QUE EL PANEL.
 *
 * Tres veces en el mismo archivo, y las tres del mismo tamaño:
 *   1. 2026-09-01 · `getPrescripcionNutricional` sin el objetivo ni el PAL efectivos: el tipo de dieta
 *      del titulo se computaba con el objetivo INTERNO del motor. Se arreglo en el panel.
 *   2. 2026-09-06 (punto 29 del cotejo) · el MISMO defecto, vivo en el lector de la historia clinica:
 *      el panel se habia arreglado y el documento probatorio se quedo con los dos nulls.
 *   3. 2026-09-06 (este barrido) · el tercer argumento, `bis`, iba en `{}`. El motor no falla sin los
 *      indicadores: lee FMI, FFMI, ASMI, IEHH, AEC y ACT en CERO, y sus guardas ("sin bioimpedancia no
 *      se activa ninguna rama") apagaban desnutricion, sarcopenia, la obesidad por composicion y la
 *      rama de hidratacion en un paciente al que SI se le habia medido.
 *
 * QUE AFIRMA ESTE CANDADO, y por que sobre el SITIO DE LLAMADA y no sobre la funcion: la funcion esta
 * bien, y sus parametros son obligatorios desde que se escribio esa regla. Lo que fallaba es que un
 * caller le pasara un relleno que TYPESCRIPT ACEPTA (un objeto vacio, un null) y que el motor consume
 * sin protestar. Eso no lo ve ningun tipo: solo se puede afirmar leyendo los callers.
 */

const RAIZ = path.join(process.cwd(), "src");

function archivosTs(dir: string): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "tests" || e.name === "frozen") continue;
      out.push(...archivosTs(p));
    } else if (/.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Los argumentos de la primera llamada a `fn` en `src`, ya sin comentarios, separados por comas de
 *  primer nivel. Se hace a mano y no con un parser porque lo unico que hay que mirar es la FORMA de
 *  cada argumento (un `{}`, un `null`), y para eso el texto basta. */
function argumentosDe(src: string, fn: string): string[] | null {
  const i = src.indexOf(fn + "(");
  if (i < 0) return null;
  let j = i + fn.length + 1;
  let prof = 0;
  let dentro = "";
  while (j < src.length) {
    const c = src[j];
    if (c === ")" && prof === 0) break;
    if (c === "(" || c === "{" || c === "[") prof++;
    if (c === ")" || c === "}" || c === "]") prof--;
    dentro += c;
    j++;
  }
  // LOS GENERICOS SE QUITAN ANTES DE PARTIR, y esto no es un detalle: `Record<string, unknown>` lleva una
  // coma que NO separa argumentos, y con ella el candado contaba siete donde hay seis. Un candado que
  // cuenta mal se pone rojo por el PARSEO y no por la regla, que es como mueren los candados.
  let anterior = "";
  while (anterior !== dentro) {
    anterior = dentro;
    dentro = dentro.replace(/<[^<>]*>/g, "");
  }
  const args: string[] = [];
  let actual = "";
  prof = 0;
  for (const c of dentro) {
    if (c === "(" || c === "{" || c === "[") prof++;
    if (c === ")" || c === "}" || c === "]") prof--;
    if (c === "," && prof === 0) {
      args.push(actual.trim());
      actual = "";
    } else {
      actual += c;
    }
  }
  if (actual.trim() !== "") args.push(actual.trim());
  return args;
}

describe("la historia clinica llama al motor con lo mismo que el panel", () => {
  const archivos = archivosTs(RAIZ);

  it("ningun caller de getPrescripcionNutricional le pasa un bis VACIO", () => {
    const callers = archivos.filter((f) =>
      sinComentarios(fs.readFileSync(f, "utf8")).includes("getPrescripcionNutricional("),
    );
    // Control de la asercion negativa: si no hay callers, el test pasa sin mirar nada.
    expect(callers.length, "nadie llama a getPrescripcionNutricional").toBeGreaterThanOrEqual(3);
    for (const f of callers) {
      const src = sinComentarios(fs.readFileSync(f, "utf8"));
      if (src.includes("export async function getPrescripcionNutricional")) continue;
      const args = argumentosDe(src, "getPrescripcionNutricional");
      expect(args, `${path.relative(RAIZ, f)}: no pude leer los argumentos`).not.toBeNull();
      expect(args!.length, `${path.relative(RAIZ, f)}: la prescripcion lleva SEIS argumentos`).toBe(6);
      // El tercero es el `bis`. Un `{}` es el defecto de la historia clinica: el motor contesta como si
      // no hubiera bioimpedancia.
      expect(
        args![2].replace(/s/g, ""),
        `${path.relative(RAIZ, f)}: le pasa un bis vacio a la prescripcion`,
      ).not.toBe("{}");
    }
  });

  it("en el SERVIDOR, toda cadena efectiva lleva sus opciones (protKgVigente)", () => {
    // ALCANCE: solo servidor. En el panel (cliente) hay dos llamadas sin opciones que leen unicamente
    // `calorico.kcalObj`, y ese valor NO depende de `protPrescrita` (protocolo-calorico.ts: kcalObj se
    // resuelve antes que la proteina). En el servidor la opcion siempre se puede resolver, y su ausencia
    // cambia en silencio los gramos de proteina que se archivan o que viajan al modelo.
    const servidor = archivos.filter(
      (f) =>
        (f.includes(path.join("data", "")) || f.includes(path.join("services", "")) || f.endsWith("page.tsx")) &&
        !sinComentarios(fs.readFileSync(f, "utf8")).includes('"use client"'),
    );
    const callers = servidor.filter((f) =>
      sinComentarios(fs.readFileSync(f, "utf8")).includes("computeProtocoloEfectivo("),
    );
    expect(callers.length, "nadie computa la cadena en el servidor").toBeGreaterThanOrEqual(4);
    for (const f of callers) {
      const src = sinComentarios(fs.readFileSync(f, "utf8"));
      const args = argumentosDe(src, "computeProtocoloEfectivo");
      expect(args, `${path.relative(RAIZ, f)}: no pude leer los argumentos`).not.toBeNull();
      expect(
        args!.length,
        `${path.relative(RAIZ, f)}: la cadena va sin opciones, asi que la proteina cae a protMin`,
      ).toBe(3);
    }
  });
});
