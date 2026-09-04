import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { computeIntercambio, INTER_GRUPOS, INTER_TABLA_A } from "@/clinical-engine/intercambio";
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
//   2. ORACULO EXTERNO. Las diez ciudades con su conteo que el publico en RESPUESTA_GILDARDO_2026-09-03 §2.
//      Es la unica capa que puede decir que el CONTENIDO es el que el verifico, y no solo que lo copiamos.
//   3. INTEGRIDAD REFERENCIAL contra INTER_TABLA_B. Es la que ataca el fallo silencioso de arriba.
//   4. COHERENCIA INTERNA. Conteos, cobertura por grupo y la regla del homonimo que el mismo señalo.

const suyo = () => readFileSync(HTML_VIGENTE, "utf8").replace(/\r\n/g, "\n");
const nuestro = () =>
  readFileSync("src/clinical-engine/intercambio-region.ts", "utf8").replace(/\r\n/g, "\n");

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
    linea: "export function regionDe(ciudad: string | null | undefined): RegionKey | null {",
    porque: "firma tipada; el cuerpo es suyo byte a byte",
  },
  {
    linea: "  for (const r of Object.keys(REGION_CIUDADES) as RegionKey[]) {",
    porque: "`for...in` sobre un Record no estrecha la clave en TypeScript strict",
  },
  {
    linea:
      "export function listaIntercambioPaciente(ciudad: string | null | undefined): AlimentoConcreto[] {",
    porque: "firma tipada; el cuerpo es suyo byte a byte",
  },
  { linea: "  const mas: Record<RegionKey, string[]> = {", porque: "tipo del mapa de la ampliacion" },
  { linea: "  for (const r of Object.keys(mas) as RegionKey[]) {", porque: "mismo motivo que el de arriba" },
  { linea: "    mas[r].forEach(function (c) {", porque: "solo el formato del formateador (un espacio)" },
  {
    linea: "      if (REGION_CIUDADES[r].indexOf(c) < 0) REGION_CIUDADES[r].push(c);",
    porque: "solo el formato: su linea es la misma en una sola linea con el forEach",
  },
];

/** La tabla que el publico en RESPUESTA_GILDARDO_2026-09-03 §2, verificada por el "por codigo, no a ojo". */
const SU_TABLA: [string, RegionKey, number][] = [
  ["Barranquilla", "caribe", 83],
  ["Bogotá", "andina_cundiboyacense", 82],
  ["Medellín", "andina_antioquia", 80],
  ["Quibdó", "pacifica", 71],
  ["Cali", "andina_valle", 70],
  ["Pasto", "andina_narino", 69],
  ["San Andrés", "insular", 67],
  ["Cúcuta", "andina_santanderes", 65],
  ["Leticia", "amazonia", 65],
  ["Villavicencio", "orinoquia", 62],
];

describe("1 · procedencia: el port viene de su archivo, no de una transcripcion", () => {
  it("cada linea del cuerpo esta verbatim en su entrega vigente, salvo las ocho declaradas", () => {
    const html = suyo();
    const cuerpo = nuestro()
      .split("\n")
      .slice(nuestro().split("\n").findIndex((l) => l.startsWith("export const REGION_NOMBRE")));
    const declaradas = new Set(ADAPTADAS.map((a) => a.linea));
    const fuera = cuerpo.filter(
      (l) => l.trim() && !declaradas.has(l) && !html.includes(l.replace(/^export /, "")),
    );
    expect(fuera, "lineas nuestras que su archivo no tiene (¿se transcribio un dato a mano?)").toEqual([]);
  });

  it("y las ocho declaradas siguen siendo necesarias: ninguna sobra", () => {
    // CONTROL EN LA OTRA DIRECCION. Sin esto, la lista de arriba podria crecer sin limite y el candado
    // quedaria certificando cualquier cosa con solo agregarle una excepcion mas.
    const texto = nuestro();
    for (const { linea, porque } of ADAPTADAS) {
      expect(texto, `sobra la excepcion "${porque}": esa linea ya no esta en el port`).toContain(linea);
    }
  });
});

describe("2 · oraculo externo: las diez ciudades que el publico, con su conteo", () => {
  it.each(SU_TABLA)("%s resuelve a %s y recibe %i alimentos", (ciudad, region, n) => {
    expect(regionDe(ciudad)).toBe(region);
    expect(listaIntercambioPaciente(ciudad)).toHaveLength(n);
  });

  it("y el recorte es real: ninguna region entrega la tabla nacional entera", () => {
    // CONTROL. Los diez conteos de arriba pasarian igual si el filtro devolviera siempre lo mismo por otra
    // via; esto afirma que lo que hace es RECORTAR, que es el proposito del bloque.
    for (const [ciudad] of SU_TABLA) {
      expect(listaIntercambioPaciente(ciudad).length).toBeLessThan(INTER_TABLA_B.length);
    }
  });
});

describe("3 · integridad referencial: un nombre con otra tilde no rompe, DESAPARECE", () => {
  it("todo alimento del nucleo y de las regiones existe en INTER_TABLA_B", () => {
    const enTabla = new Set(INTER_TABLA_B.map((f) => f.al));
    const huerfanos: string[] = [];
    for (const n of ALIMENTOS_NUCLEO) if (!enTabla.has(n)) huerfanos.push(`NUCLEO: ${n}`);
    for (const [r, lista] of Object.entries(ALIMENTOS_REGION))
      for (const n of lista) if (!enTabla.has(n)) huerfanos.push(`${r}: ${n}`);
    expect(huerfanos, "nombran un alimento que INTER_TABLA_B no tiene: se cae de la lista en silencio").toEqual(
      [],
    );
  });
});

describe("4 · coherencia interna", () => {
  it("diez regiones, 56 alimentos de nucleo, 224 municipios", () => {
    expect(Object.keys(REGION_NOMBRE)).toHaveLength(10);
    expect(Object.keys(ALIMENTOS_REGION)).toHaveLength(10);
    expect(ALIMENTOS_NUCLEO).toHaveLength(56);
    expect(Object.values(REGION_CIUDADES).flat()).toHaveLength(224);
  });

  it("DOS municipios estan en dos regiones, y la region la decide el orden de las claves", () => {
    // ESTO NO ES LO DESEADO: ES LO QUE SU DATO HACE HOY, y se fija asi a proposito. Un candado escrito
    // sobre lo que nos parece correcto convierte nuestra suposicion en regla; lo que se afirma aqui es el
    // COMPORTAMIENTO REAL, con la pregunta citada al lado.
    //
    // "Tumaco" esta en `pacifica` y en `andina_narino`; "Cartago" en `andina_antioquia` y en `andina_valle`.
    // `regionDe` recorre el objeto y devuelve el primero que coincide, asi que la region de esos dos
    // pacientes la decide el ORDEN DE LAS CLAVES del objeto, no un criterio clinico. Cartago es municipio
    // del Valle del Cauca y hoy resuelve a Antioquia y Eje Cafetero.
    //
    // PREGUNTADO en la ronda del 2026-09-04 (P-100). Cuando responda, este caso se pone rojo y ahi se
    // porta lo que decida. Mientras tanto NO se corrige por nuestra cuenta: la asignacion de un municipio
    // a una region es contenido suyo (Regla 0).
    const donde: Record<string, string[]> = {};
    for (const [r, l] of Object.entries(REGION_CIUDADES)) for (const c of l) (donde[c] ??= []).push(r);
    const dobles = Object.entries(donde).filter(([, rs]) => rs.length > 1);
    expect(dobles.map(([c]) => c).sort()).toEqual(["Cartago", "Tumaco"]);
    expect(regionDe("Tumaco")).toBe("pacifica");
    expect(regionDe("Cartago")).toBe("andina_antioquia");
  });

  it("la coincidencia es EXACTA por nombre: el homonimo del exterior recibe la lista completa", () => {
    // Su advertencia textual, y su propio caso de prueba: "Madrid resuelve a Cundiboyacense y Madrid España
    // no resuelve a ninguna region y recibe los 350. Es deliberado. Si alguna vez se ablanda esa
    // comparacion para que tolere variantes, ese es el caso que hay que probar primero."
    expect(regionDe("Madrid")).toBe("andina_cundiboyacense");
    expect(regionDe("Madrid España")).toBeNull();
    expect(listaIntercambioPaciente("Madrid España")).toHaveLength(INTER_TABLA_B.length);
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
        listaIntercambioPaciente(REGION_CIUDADES[r][0]).map((f) => grDe.get(f.sub)),
      );
      expect(grupos.size, `${r} cubre menos de nueve grupos`).toBeGreaterThanOrEqual(9);
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
          .filter((r) => !listaIntercambioPaciente(ciudad).some((f) => f.sub === r.sub))
          .map((r) => `${g.id}/${r.sub}`),
      );
    expect(vacios("Bogotá")).toEqual([
      "G4/Leche descremada",
      "G6/Carnes altas en lípidos",
      "G8/Nueces",
      "G8/Semillas",
      "G9/Reducidos en grasa",
      "G10/Azúcares y dulces",
      "G11/Mecato",
      "G12/Bebidas alcohólicas",
    ]);
    // Y los tres que faltan en TODAS las regiones, que son los que mas se notan en el documento impreso.
    for (const r of Object.keys(REGION_NOMBRE) as RegionKey[]) {
      expect(vacios(REGION_CIUDADES[r][0]), `${r}`).toEqual(
        expect.arrayContaining(["G10/Azúcares y dulces", "G11/Mecato", "G12/Bebidas alcohólicas"]),
      );
    }
    // La lista COMPLETA (ciudad sin region) no tiene ese hueco: confirma que es del recorte y no de
    // INTER_TABLA_B, que es la distincion que la pregunta necesita para que el pueda contestarla.
    expect(vacios("Madrid España")).toEqual([]);
  });

  it("y DOS de esos vacíos son grupos que el plan SÍ prescribe: el documento se contradice", () => {
    // ESTO ES LO QUE CONVIERTE EL PUNTO EN UN DEFECTO Y NO EN UNA RAREZA, y salió de mirar los dos PDF
    // que Santiago exportó el 2026-09-04, no de leer el código.
    //
    // En el MISMO documento, la tabla de "Cómo repartir tus porciones en el día" dice "Azúcares y dulces:
    // 1" y tres páginas más abajo la lista de intercambio dice "Azúcares y dulces:" y no hay nada detrás.
    // Al paciente se le prescribe una porción de un grupo y se le entrega una lista vacía para elegirla.
    //
    // Y NO ES DE UN PACIENTE NI DE UNA REGIÓN: medido sobre los tres objetivos calóricos y las diez
    // regiones, "Azúcares y dulces" sale prescrito y vacío SIEMPRE, y "Nueces" en siete de las diez.
    //
    // Se fija lo que pasa HOY, con la pregunta citada (ronda del 2026-09-04, P-101). Cuando responda, este
    // caso se pone rojo, que es la señal de portar su decisión.
    const prescritosSinLista = (ciudad: string, kcal: number) => {
      const zona = listaIntercambioPaciente(ciudad);
      return computeIntercambio(kcal)
        .filter((a) => a.porciones > 0 && !zona.some((f) => f.sub === a.sub))
        .map((a) => a.sub);
    };
    for (const r of Object.keys(REGION_NOMBRE) as RegionKey[]) {
      const ciudad = REGION_CIUDADES[r][0];
      for (const kcal of [1529, 1800, 2200]) {
        expect(prescritosSinLista(ciudad, kcal), `${r} a ${kcal} kcal`).toContain("Azúcares y dulces");
      }
    }
    // Y el segundo, que NO es de todas: en el Caribe, el Pacífico y la Insular sí hay nueces.
    expect(prescritosSinLista("Medellín", 1529)).toContain("Nueces");
    expect(prescritosSinLista("Barranquilla", 1529)).not.toContain("Nueces");
  });
});
