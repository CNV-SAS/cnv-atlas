import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

import { describe, expect, it } from "vitest";

import {
  computeIntercambio,
  INTER_GRUPOS,
  INTER_TABLA_A,
} from "@/clinical-engine/intercambio";
import { INTER_TABLA_B } from "@/clinical-engine/intercambio-alimentos";
import {
  ALIMENTOS_NUCLEO,
  ALIMENTOS_REGION,
  listaIntercambioPaciente,
  REGION_CIUDADES,
  REGION_NOMBRE,
  regionDe,
  type RegionKey,
} from "@/clinical-engine/intercambio-region";

import { HTML_VIGENTE } from "./fixtures/html-vigente";

// CANDADO DE LA LISTA DE INTERCAMBIO RECORTADA POR REGION (su entrega del 2026-09-03).
//
// POR QUE NO BASTA COMPARAR NUESTRA COPIA CON LA SUYA: dos copias del mismo error coinciden y pasan verde.
// Si el nombre de un alimento viene con otra tilde en su lista de region, nuestra copia lo trae con la
// misma tilde, las dos coinciden, y el alimento simplemente DESAPARECE de la lista del paciente sin que
// nada de error. Por eso el candado tiene cuatro capas y solo la primera es una comparacion de copias:
//
//   1. PROCEDENCIA. Cada linea nuestra esta verbatim en su archivo, salvo ocho que son de tipado y estan
//      declaradas una por una. Si alguien toca un dato, esa linea deja de estar en su archivo y sale roja.
//   2. EQUIVALENCIA CON SU ARCHIVO. Las diez ciudades con su conteo, obtenidas EJECUTANDO su propio
//      `listaIntercambioPaciente` sobre su `INTER_TABLA_B`. Hasta el 3-sep esta capa era un ORACULO
//      EXTERNO (las diez cifras que el publico en prosa, RESPUESTA_GILDARDO_2026-09-03 §2), que es mas
//      fuerte: podia decir que el CONTENIDO es el que EL verifico. Su entrega del 4 sube los conteos y no
//      publica los nuevos, asi que la capa baja de grado. Ver el comentario de SU_TABLA.
//   3. INTEGRIDAD REFERENCIAL contra INTER_TABLA_B. Es la que ataca el fallo silencioso de arriba.
//   4. COHERENCIA INTERNA. Conteos, cobertura por grupo y la regla del homonimo que el mismo señalo.

const suyo = () => readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
const nuestro = () =>
  readFileSync("src/clinical-engine/intercambio-region.ts", "utf8").replace(
    /\r\n/g,
    "\n",
  );

/**
 * Las UNICAS lineas nuestras que no estan verbatim en su archivo, cada una con su motivo.
 *
 * Son todas de TIPADO o de ITERACION. Ninguna toca un dato: ni un municipio, ni un alimento, ni un umbral.
 * Esa es justamente la afirmacion que este candado sostiene, y por eso la lista va cerrada y no como
 * patron ancho: si mañana aparece una novena, alguien edito algo que no era tipado.
 */
const ADAPTADAS: { linea: string; porque: string }[] = [
  {
    linea: "export const REGION_CIUDADES: Record<RegionKey, string[]> = {",
    porque: "tipo del mapa; en su archivo es un objeto suelto sin anotar",
  },
  {
    linea:
      "export function regionDe(ciudad: string | null | undefined): RegionKey | null {",
    porque: "firma tipada; el cuerpo es suyo byte a byte",
  },
  {
    linea: "  for (const r of Object.keys(REGION_CIUDADES) as RegionKey[]) {",
    porque:
      "`for...in` sobre un Record no estrecha la clave en TypeScript strict",
  },
  {
    linea:
      "export function listaIntercambioPaciente(ciudad: string | null | undefined): AlimentoConcreto[] {",
    porque: "firma tipada; el cuerpo es suyo byte a byte",
  },
  {
    linea: "  const mas: Record<RegionKey, string[]> = {",
    porque: "tipo del mapa de la ampliacion",
  },
  {
    linea: "  for (const r of Object.keys(mas) as RegionKey[]) {",
    porque: "mismo motivo que el de arriba",
  },
  {
    linea: "    mas[r].forEach(function (c) {",
    porque: "solo el formato del formateador (un espacio)",
  },
  {
    linea:
      "      if (REGION_CIUDADES[r].indexOf(c) < 0) REGION_CIUDADES[r].push(c);",
    porque:
      "solo el formato: su linea es la misma en una sola linea con el forEach",
  },
];

/**
 * Las diez ciudades con su conteo, DERIVADAS DE SU ENTREGA VIGENTE, no escritas a mano.
 *
 * CAMBIO DE FUENTE EL 2026-09-04, y el motivo importa. Hasta el 3 de septiembre esta tabla eran las diez
 * cifras que el PUBLICO en prosa, o sea un oraculo externo: podia afirmar que el contenido es el que EL
 * verifico, no solo que lo copiamos bien. Su entrega del 4 mete diez alimentos al nucleo (su punto 7) y
 * los diez conteos suben, pero NO publico los nuevos.
 *
 * Escribirlos a mano leyendo NUESTRA salida convertiria el candado en "el codigo hace lo que hace". Asi
 * que se derivan de SU archivo, ejecutando su `listaIntercambioPaciente` sobre su `INTER_TABLA_B`: la
 * comparacion sigue siendo contra el, y lo que se afirma es que nuestro porte reproduce SU resultado.
 *
 * SE PIERDE UNA CAPA Y HAY QUE DECIRLO: ya no hay una cifra suya en prosa contra la que contrastar. Quedan
 * las otras tres (procedencia, integridad referencial, coherencia interna) mas esta, que ahora prueba
 * equivalencia con su ARCHIVO en vez de con su DOCUMENTO.
 */
const SU_TABLA: [string, RegionKey, number][] = (
  [
    ["Barranquilla", "caribe"],
    ["Bogotá", "andina_cundiboyacense"],
    ["Medellín", "andina_antioquia"],
    ["Quibdó", "pacifica"],
    ["Cali", "andina_valle"],
    ["Pasto", "andina_narino"],
    ["San Andrés", "insular"],
    ["Cúcuta", "andina_santanderes"],
    ["Leticia", "amazonia"],
    ["Villavicencio", "orinoquia"],
  ] as [string, RegionKey][]
).map(([c, r]) => [c, r, conteoDeSuArchivo(c)]);

/** Ejecuta SU `listaIntercambioPaciente` sobre SU `INTER_TABLA_B`, los dos de la entrega vigente. */
function conteoDeSuArchivo(ciudad: string): number {
  const L = suyo().split("\n");
  const a = L.findIndex((l) => /^\s*const INTER_TABLA_B\s*=/.test(l));
  let b = a;
  let prof = 0;
  do {
    prof += (L[b].match(/\[/g) ?? []).length - (L[b].match(/\]/g) ?? []).length;
    b++;
  } while (prof > 0 && b < L.length);
  const i = L.findIndex((l) => /^const REGION_NOMBRE = \{/.test(l));
  const j = L.findIndex((l, k) => k > i && /^const _CNV_LOGO_B64/.test(l));
  const ctx: Record<string, unknown> = {};
  createContext(ctx);
  const tablaB = L.slice(a, b)
    .join("\n")
    .replace(/^\s*const /, "var ");
  const mapa = L.slice(i, j)
    .join("\n")
    .replace(/^const /gm, "var ");
  runInContext(tablaB + "\n" + mapa, ctx);
  return (ctx.listaIntercambioPaciente as (c: string) => unknown[])(ciudad)
    .length;
}

describe("1 · procedencia: el port viene de su archivo, no de una transcripcion", () => {
  it("cada linea del cuerpo esta verbatim en su entrega vigente, salvo las ocho declaradas", () => {
    const html = suyo();
    const cuerpo = nuestro()
      .split("\n")
      .slice(
        nuestro()
          .split("\n")
          .findIndex((l) => l.startsWith("export const REGION_NOMBRE")),
      );
    const declaradas = new Set(ADAPTADAS.map((a) => a.linea));
    const fuera = cuerpo.filter(
      (l) =>
        l.trim() &&
        !declaradas.has(l) &&
        !html.includes(l.replace(/^export /, "")),
    );
    expect(
      fuera,
      "lineas nuestras que su archivo no tiene (¿se transcribio un dato a mano?)",
    ).toEqual([]);
  });

  it("y las ocho declaradas siguen siendo necesarias: ninguna sobra", () => {
    // CONTROL EN LA OTRA DIRECCION. Sin esto, la lista de arriba podria crecer sin limite y el candado
    // quedaria certificando cualquier cosa con solo agregarle una excepcion mas.
    const texto = nuestro();
    for (const { linea, porque } of ADAPTADAS) {
      expect(
        texto,
        `sobra la excepcion "${porque}": esa linea ya no esta en el port`,
      ).toContain(linea);
    }
  });
});

describe("2 · oraculo externo: las diez ciudades que el publico, con su conteo", () => {
  it.each(SU_TABLA)(
    "%s resuelve a %s y recibe %i alimentos",
    (ciudad, region, n) => {
      expect(regionDe(ciudad)).toBe(region);
      expect(listaIntercambioPaciente(ciudad)).toHaveLength(n);
    },
  );

  it("y el recorte es real: ninguna region entrega la tabla nacional entera", () => {
    // CONTROL. Los diez conteos de arriba pasarian igual si el filtro devolviera siempre lo mismo por otra
    // via; esto afirma que lo que hace es RECORTAR, que es el proposito del bloque.
    for (const [ciudad] of SU_TABLA) {
      expect(listaIntercambioPaciente(ciudad).length).toBeLessThan(
        INTER_TABLA_B.length,
      );
    }
  });
});

describe("3 · integridad referencial: un nombre con otra tilde no rompe, DESAPARECE", () => {
  it("todo alimento del nucleo y de las regiones existe en INTER_TABLA_B", () => {
    const enTabla = new Set(INTER_TABLA_B.map((f) => f.al));
    const huerfanos: string[] = [];
    for (const n of ALIMENTOS_NUCLEO)
      if (!enTabla.has(n)) huerfanos.push(`NUCLEO: ${n}`);
    for (const [r, lista] of Object.entries(ALIMENTOS_REGION))
      for (const n of lista) if (!enTabla.has(n)) huerfanos.push(`${r}: ${n}`);
    expect(
      huerfanos,
      "nombran un alimento que INTER_TABLA_B no tiene: se cae de la lista en silencio",
    ).toEqual([]);
  });
});

describe("4 · coherencia interna", () => {
  it("diez regiones, 66 alimentos de nucleo, 222 municipios", () => {
    // EL NUCLEO SUBE DE 56 A 66 (su punto 7 del 2026-09-04): entran seis azucares y cuatro nueces, para
    // que ningun grupo que el reparto prescribe quede sin lista en ninguna region. El 66 SI es cifra suya,
    // publicada en prosa, asi que en esta linea el oraculo externo se conserva.
    //
    // Y LOS MUNICIPIOS BAJAN DE 224 A 222 sin que se retire ninguno: eran los dos DUPLICADOS.
    expect(Object.keys(REGION_NOMBRE)).toHaveLength(10);
    expect(Object.keys(ALIMENTOS_REGION)).toHaveLength(10);
    expect(ALIMENTOS_NUCLEO).toHaveLength(66);
    expect(Object.values(REGION_CIUDADES).flat()).toHaveLength(222);
  });

  it("NINGUN municipio esta en dos regiones (P-100 respondida el 2026-09-04)", () => {
    // ESTE CASO SE DIO LA VUELTA, y el giro es lo que hay que leer. Hasta el 3-sep afirmaba lo contrario:
    // que Tumaco estaba en `pacifica` Y en `andina_narino`, y Cartago en `andina_antioquia` Y en
    // `andina_valle`. Se escribio asi a proposito, fijando el COMPORTAMIENTO REAL en vez del deseado y
    // citando la pregunta al lado, porque asignar un municipio a una region es contenido suyo (Regla 0).
    //
    // Respondio (su punto 6 del 4-sep): Tumaco queda solo en `pacifica` y Cartago solo en
    // `andina_antioquia`. Y aclaro que la agrupacion es ALIMENTARIA, no administrativa, asi que Cartago
    // fuera del Valle del Cauca no era el error que parecia. Las dos regiones EFECTIVAS no cambian: lo que
    // cambia es que ya no dependen del orden de las claves de un objeto.
    //
    // POR ESO LA ASERCION AHORA ES UNIVERSAL, y no "estos dos quedaron bien": lo que garantiza que la
    // region de un paciente no la decida un orden de iteracion es que no haya duplicados, NINGUNO.
    const donde: Record<string, string[]> = {};
    for (const [r, l] of Object.entries(REGION_CIUDADES))
      for (const c of l) (donde[c] ??= []).push(r);
    expect(Object.entries(donde).filter(([, rs]) => rs.length > 1)).toEqual([]);
    expect(regionDe("Tumaco")).toBe("pacifica");
    expect(regionDe("Cartago")).toBe("andina_antioquia");
  });

  it("la coincidencia es EXACTA por nombre: el homonimo del exterior recibe la lista completa", () => {
    // Su advertencia textual, y su propio caso de prueba: "Madrid resuelve a Cundiboyacense y Madrid España
    // no resuelve a ninguna region y recibe los 350. Es deliberado. Si alguna vez se ablanda esa
    // comparacion para que tolere variantes, ese es el caso que hay que probar primero."
    expect(regionDe("Madrid")).toBe("andina_cundiboyacense");
    expect(regionDe("Madrid España")).toBeNull();
    expect(listaIntercambioPaciente("Madrid España")).toHaveLength(
      INTER_TABLA_B.length,
    );
  });

  it("sin ciudad no se recorta: mas vale una lista larga que una a la que le falte lo que come", () => {
    for (const v of ["", "   ", null, undefined]) {
      expect(regionDe(v)).toBeNull();
      expect(listaIntercambioPaciente(v)).toHaveLength(INTER_TABLA_B.length);
    }
  });

  it("acentos y mayusculas no cambian la region: el nombre se normaliza", () => {
    expect(regionDe("bogota")).toBe("andina_cundiboyacense");
    expect(regionDe("MEDELLIN")).toBe("andina_antioquia");
    expect(regionDe("  Cúcuta  ")).toBe("andina_santanderes");
  });

  it("las diez regiones cubren los NUEVE grupos que la prescripcion necesita", () => {
    // Su afirmacion: "Las diez regiones tienen alimentos en los nueve grupos que la prescripción necesita;
    // se verificó por código, no a ojo". Medido: son nueve o diez segun la region, y los que faltan en
    // TODAS son G10 (azucares y dulces) y G11 (mecato), que es coherente con "los que la prescripcion
    // necesita" (esos dos son discrecionales).
    const grDe = new Map(INTER_TABLA_A.map((r) => [r.sub, r.gr]));
    for (const r of Object.keys(REGION_NOMBRE) as RegionKey[]) {
      const grupos = new Set(
        listaIntercambioPaciente(REGION_CIUDADES[r][0]).map((f) =>
          grDe.get(f.sub),
        ),
      );
      expect(
        grupos.size,
        `${r} cubre menos de nueve grupos`,
      ).toBeGreaterThanOrEqual(9);
    }
  });

  it("PERO seis a ocho subgrupos quedan SIN alimento, y su render los imprime vacios", () => {
    // LO QUE SU CODIGO HACE HOY, fijado tal cual y preguntado (ronda del 2026-09-04, P-101).
    //
    // Su lista impresa recorre INTER_GRUPOS -> subgrupos de INTER_TABLA_A -> alimentos de la zona, y NO
    // filtra el subgrupo vacio: sale el rotulo en negrita y detras no hay nada. En el documento que recibe
    // el paciente eso se lee como una lista rota, no como una ausencia deliberada.
    //
    // NO SE ARREGLA POR NUESTRA CUENTA, y el motivo es el de siempre: suprimir el rotulo vacio es un
    // arreglo de FORMA que taparia un hueco de CONTENIDO (que su nucleo no traiga ningun lacteo descremado
    // no es lo mismo que que el mecato este fuera a proposito). Se porta fiel y se pregunta.
    const vacios = (ciudad: string) =>
      INTER_GRUPOS.flatMap((g) =>
        INTER_TABLA_A.filter((x) => x.gr === g.id)
          .filter(
            (r) =>
              !listaIntercambioPaciente(ciudad).some((f) => f.sub === r.sub),
          )
          .map((r) => `${g.id}/${r.sub}`),
      );
    // LOS DOS QUE SALIERON DE ESTA LISTA (2026-09-04) son los que su punto 7 arreglo: "G8/Nueces" y
    // "G10/Azúcares y dulces". Eran los unicos dos que el plan PRESCRIBE, o sea los que convertian el
    // documento en una contradiccion; ver el caso siguiente, que es el que lo mide.
    //
    // LOS SEIS QUE QUEDAN SIGUEN VACIOS Y LA PREGUNTA SIGUE ABIERTA (P-101), pero ya no son un defecto
    // clinico: ninguno de los seis se prescribe, asi que al paciente no se le pide elegir de una lista
    // vacia. Lo que queda es de FORMA: su render imprime el rotulo en negrita con nada detras.
    expect(vacios("Bogotá")).toEqual([
      "G4/Leche descremada",
      "G6/Carnes altas en lípidos",
      "G8/Semillas",
      "G9/Reducidos en grasa",
      "G11/Mecato",
      "G12/Bebidas alcohólicas",
    ]);
    // Los tres que faltan en TODAS las regiones. "Azúcares y dulces" salio de este grupo el 4-sep.
    for (const r of Object.keys(REGION_NOMBRE) as RegionKey[]) {
      expect(vacios(REGION_CIUDADES[r][0]), `${r}`).toEqual(
        expect.arrayContaining([
          "G9/Reducidos en grasa",
          "G11/Mecato",
          "G12/Bebidas alcohólicas",
        ]),
      );
    }
    // La lista COMPLETA (ciudad sin region) no tiene ese hueco: confirma que es del recorte y no de
    // INTER_TABLA_B, que es la distincion que la pregunta necesita para que el pueda contestarla.
    expect(vacios("Madrid España")).toEqual([]);
  });

  it("NINGUN grupo prescrito se queda sin lista (su punto 7, 2026-09-04)", () => {
    // ESTE CASO SE DIO LA VUELTA Y ES EL MEJOR CIERRE DEL PORTE, porque mide su arreglo por el EFECTO en
    // el paciente y no por el conteo de alimentos que agrego.
    //
    // Lo que afirmaba hasta el 3-sep: en el MISMO documento, la tabla de "Cómo repartir tus porciones en
    // el día" decia "Azúcares y dulces: 1" y tres paginas mas abajo la lista de intercambio decia
    // "Azúcares y dulces:" y no habia nada detras. Al paciente se le prescribia una porcion de un grupo y
    // se le entregaba una lista vacia para elegirla. Medido entonces: pasaba SIEMPRE en las diez regiones,
    // y "Nueces" en siete de las diez. Salio de mirar los dos PDF que Santiago exporto, no de leer codigo.
    //
    // Lo arreglo en su entrega del 4 (punto 7) metiendo diez alimentos al nucleo nacional: seis azucares y
    // cuatro nueces. La asercion se invierte y se hace UNIVERSAL, que es lo que la vuelve util: no dice
    // "los dos que reporte quedaron cubiertos", dice que NINGUN grupo con porciones > 0 se queda sin
    // alimentos, en ninguna region y en ningun objetivo calorico. Si manana entra un subgrupo nuevo al
    // reparto sin lista regional, este caso lo caza aunque nadie se acuerde de esta ronda.
    const prescritosSinLista = (ciudad: string, kcal: number) => {
      const zona = listaIntercambioPaciente(ciudad);
      return computeIntercambio(kcal)
        .filter((a) => a.porciones > 0 && !zona.some((f) => f.sub === a.sub))
        .map((a) => a.sub);
    };
    for (const r of Object.keys(REGION_NOMBRE) as RegionKey[]) {
      const ciudad = REGION_CIUDADES[r][0];
      // Los cinco objetivos cubren el rango que la cadena produce, no solo los tres que se reportaron.
      for (const kcal of [1200, 1529, 1800, 2200, 2800]) {
        expect(prescritosSinLista(ciudad, kcal), `${r} a ${kcal} kcal`).toEqual(
          [],
        );
      }
    }
    // CONTROL: sin el, la asercion de arriba pasaria verde tambien si `prescritosSinLista` estuviera rota
    // y devolviera [] siempre. Un subgrupo que no existe en ninguna lista regional tiene que salir.
    const zona = listaIntercambioPaciente("Bogotá");
    expect(zona.some((f) => f.sub === "Mecato")).toBe(false);
  });
});
