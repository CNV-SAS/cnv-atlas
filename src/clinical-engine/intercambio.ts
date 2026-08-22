// Lista de intercambio (CP1 del plan alimentario): reparto de porciones por grupo de alimentos desde el
// objetivo calorico. Es el cimiento de la grilla; CP2 (tiempos) y CP3 (validacion) consumen estas porciones.
//
// PORTE FIEL, MODULO DERIVADO (2026-08-22). Transcripcion VERBATIM de INTER_TABLA_A (tabla de alimentos con
// nutrientes) + INTER_GRUPOS + la logica PASO 3 (repartoGr, subTipo) del prototipo de Gildardo (ATLAS_v8.html
// 2026-08-19, L15707-15743 y L16892-16898). No toca el frozen. La data se extrajo verbatim del v8 (no se
// tecleo); su paridad se prueba con golden diferencial contra la funcion del v8 (fixtures/reference/
// intercambio-vigente.js) + un candado de transcripcion celda a celda.
//
// PASO 3 (Gildardo): porciones[grupo] = round(objetivo * repartoGr[grupo] / kcalPorcion[subDefault]). Verduras
// se fija en 2 porciones (excepcion hardcodeada del v8). El objetivo es el UNICO insumo (de la cadena); no lee
// encuesta ni macros (los macros entran en CP3, la validacion).

// Una fila de la tabla de alimentos: kcal + 26 nutrientes por porcion. Numeros USER-FACING indirectos (via el
// plan): verbatim del v8, sin redondear.
export type FoodRow = {
  gr: string; sub: string; kcal: number; prot: number; gras: number; ags: number; agm: number; agp: number;
  col: number; cho: number; fib: number; ca: number; p: number; fe: number; na: number; k: number; mg: number;
  zn: number; cu: number; mn: number; va: number; tiam: number; ribo: number; niac: number; apan: number;
  pirid: number; fol: number; b12: number; vc: number;
};

// INTER_TABLA_A verbatim (L15722-15742): 21 alimentos across 12 grupos.
export const INTER_TABLA_A: FoodRow[] = [
  {gr:"G1", sub:"Cereales", kcal:87, prot:2.3, gras:1.1, ags:0.2, agm:0.35, agp:0.37, col:1, cho:17.4, fib:1, ca:23, p:47, fe:1.1, na:99, k:49, mg:13, zn:0.42, cu:0.05, mn:0.22, va:34, tiam:0.12, ribo:0.09, niac:1.2, apan:0.17, pirid:0.11, fol:33, b12:0, vc:2},
  {gr:"G1", sub:"Raíces, tubérculos y plátanos", kcal:94, prot:1.5, gras:0.1, ags:0.06, agm:0.01, agp:0.06, col:0, cho:22.6, fib:2, ca:11, p:41, fe:0.6, na:6, k:354, mg:20, zn:0.18, cu:0.13, mn:0.27, va:156, tiam:0.06, ribo:0.04, niac:0.9, apan:0.32, pirid:0.23, fol:13, b12:0, vc:28},
  {gr:"G2", sub:"Verduras y hortalizas", kcal:25, prot:1.3, gras:0.3, ags:0.04, agm:0.02, agp:0.11, col:0, cho:5.3, fib:1.6, ca:18, p:36, fe:0.7, na:75, k:191, mg:13, zn:0.33, cu:0.11, mn:0.17, va:160, tiam:0.05, ribo:0.08, niac:0.8, apan:0.38, pirid:0.09, fol:33, b12:0, vc:21},
  {gr:"G3", sub:"Frutas", kcal:54, prot:1, gras:0.3, ags:0.06, agm:0.08, agp:0.14, col:0, cho:13.5, fib:3, ca:22, p:25, fe:0.5, na:3, k:230, mg:18, zn:0.12, cu:0.08, mn:0.26, va:74, tiam:0.06, ribo:0.06, niac:1, apan:0.25, pirid:0.1, fol:22, b12:0, vc:55},
  {gr:"G4", sub:"Leche entera", kcal:134, prot:6.7, gras:6.2, ags:3.67, agm:2, agp:0.22, col:23, cho:13.3, fib:0, ca:236, p:173, fe:0.2, na:97, k:342, mg:25, zn:0.85, cu:0.04, mn:0.01, va:73, tiam:0.08, ribo:0.28, niac:0.2, apan:0.47, pirid:0.06, fol:9, b12:0.61, vc:3},
  {gr:"G4", sub:"Leche semidescremada", kcal:100, prot:5.3, gras:2.4, ags:1.15, agm:0.96, agp:0.63, col:8, cho:14.9, fib:0.8, ca:177, p:122, fe:0.5, na:72, k:240, mg:25, zn:0.69, cu:0.07, mn:0.09, va:36, tiam:0.07, ribo:0.26, niac:1.1, apan:0.33, pirid:0, fol:8, b12:0.49, vc:1},
  {gr:"G4", sub:"Leche descremada", kcal:74, prot:6.4, gras:0.1, ags:0.09, agm:0.04, agp:0.01, col:5, cho:11.3, fib:0, ca:230, p:180, fe:0.1, na:101, k:281, mg:19, zn:0.73, cu:0.01, mn:0, va:80, tiam:0.06, ribo:0.29, niac:0.2, apan:0.67, pirid:0.07, fol:9, b12:0.79, vc:1},
  {gr:"G5", sub:"Sustitutos (embutidos, quesos, huevo)", kcal:77, prot:5.3, gras:5.4, ags:2.79, agm:1.84, agp:0.49, col:40, cho:1.4, fib:0, ca:92, p:89, fe:1.1, na:215, k:48, mg:6, zn:0.68, cu:0.04, mn:0.01, va:40, tiam:0.05, ribo:0.12, niac:0.5, apan:0.18, pirid:0.05, fol:5, b12:0.31, vc:0},
  {gr:"G6", sub:"Carnes magras", kcal:112, prot:19.1, gras:3.1, ags:0.98, agm:1.1, agp:0.58, col:49, cho:1, fib:0.3, ca:23, p:193, fe:1.4, na:73, k:335, mg:29, zn:1.8, cu:0.09, mn:0.08, va:10, tiam:0.19, ribo:0.17, niac:5.8, apan:0.7, pirid:0.36, fol:15, b12:1.85, vc:1},
  {gr:"G6", sub:"Carnes altas en lípidos", kcal:143, prot:15.7, gras:7.9, ags:2.59, agm:3.06, agp:1.31, col:143, cho:1.3, fib:0, ca:37, p:190, fe:2.5, na:107, k:241, mg:20, zn:1.97, cu:0.54, mn:0.1, va:1515, tiam:0.07, ribo:0.53, niac:4.4, apan:1.83, pirid:0.3, fol:96, b12:11.49, vc:6},
  {gr:"G7", sub:"Leguminosas", kcal:151, prot:9, gras:1.8, ags:0.31, agm:0.35, agp:0.96, col:0, cho:24.6, fib:7.4, ca:49, p:168, fe:3.3, na:10, k:452, mg:56, zn:1.2, cu:0.26, mn:0.63, va:18, tiam:0.21, ribo:0.09, niac:0.9, apan:0.34, pirid:0.03, fol:143, b12:0, vc:6},
  {gr:"G8", sub:"Nueces", kcal:53, prot:1.3, gras:4.8, ags:1.15, agm:2.37, agp:1.03, col:0, cho:2, fib:0.7, ca:8, p:35, fe:0.3, na:6, k:55, mg:16, zn:0.29, cu:0.11, mn:0.19, va:1, tiam:0.03, ribo:0.02, niac:0.2, apan:0.08, pirid:0.04, fol:5, b12:0, vc:0},
  {gr:"G8", sub:"Semillas", kcal:54, prot:2.4, gras:3.9, ags:0.47, agm:0.9, agp:2.35, col:0, cho:3.4, fib:1.8, ca:52, p:71, fe:0.7, na:2, k:90, mg:30, zn:0.69, cu:0.2, mn:0.37, va:0, tiam:0.07, ribo:0.03, niac:0.3, apan:0.18, pirid:0.04, fol:12, b12:0, vc:0},
  {gr:"G9", sub:"Monoinsaturadas", kcal:46, prot:0.5, gras:4.6, ags:0.63, agm:2.95, agp:0.77, col:0, cho:1.1, fib:0.5, ca:9, p:7, fe:0.3, na:51, k:47, mg:5, zn:0.07, cu:0.03, mn:0.02, va:32, tiam:0.01, ribo:0.01, niac:0.3, apan:0.07, pirid:0.02, fol:4, b12:0, vc:1},
  {gr:"G9", sub:"Poliinsaturadas", kcal:45, prot:0, gras:4.9, ags:0.69, agm:1.3, agp:2.71, col:1, cho:0.4, fib:0, ca:0, p:3, fe:0, na:28, k:2, mg:0, zn:0.01, cu:0, mn:0, va:1, tiam:0, ribo:0, niac:0, apan:0.01, pirid:0.01, fol:0, b12:0, vc:0},
  {gr:"G9", sub:"Saturadas", kcal:45, prot:0.3, gras:4.8, ags:2.66, agm:1.57, agp:0.28, col:10, cho:0.3, fib:0, ca:8, p:7, fe:0, na:9, k:10, mg:1, zn:0.03, cu:0, mn:0, va:31, tiam:0, ribo:0.01, niac:0, apan:0.03, pirid:0, fol:1, b12:0.03, vc:0},
  {gr:"G9", sub:"Reducidos en grasa", kcal:45, prot:0.9, gras:4.3, ags:1.88, agm:0.99, agp:1.73, col:22, cho:0.7, fib:0, ca:22, p:37, fe:0, na:99, k:17, mg:2, zn:0.07, cu:0, mn:0, va:144, tiam:0, ribo:0.02, niac:0, apan:0.04, pirid:0, fol:3, b12:0.06, vc:0},
  {gr:"G10", sub:"Azúcares y dulces", kcal:87, prot:0.9, gras:1, ags:0.71, agm:0.22, agp:0.04, col:2, cho:19.6, fib:0.5, ca:21, p:22, fe:0.4, na:19, k:34, mg:9, zn:0.22, cu:0.07, mn:0.23, va:22, tiam:0.04, ribo:0.07, niac:0.3, apan:0.09, pirid:0.02, fol:2, b12:0.02, vc:2},
  {gr:"G11", sub:"Mecato", kcal:137.5, prot:1.69, gras:6.51, ags:1.03, agm:0.6, agp:0.1, col:2.5, cho:17.98, fib:0.35, ca:0.77, p:0.0, fe:0.04, na:123.12, k:16.85, mg:0.0, zn:0.0, cu:0.0, mn:0.0, va:0.0, tiam:0.0, ribo:0.01, niac:0.05, apan:0.0, pirid:0.0, fol:0.92, b12:0.0, vc:0.0},
  {gr:"G12", sub:"Bebidas alcohólicas", kcal:126.42, prot:0.23, gras:0.18, ags:0.07, agm:0.01, agp:0.04, col:0.0, cho:8.57, fib:0.08, ca:9.0, p:14.58, fe:0.59, na:5.37, k:30.84, mg:4.37, zn:0.05, cu:0.03, mn:0.11, va:0.0, tiam:0.01, ribo:0.02, niac:0.2, apan:0.03, pirid:0.02, fol:2.68, b12:0.01, vc:0.68},
  {gr:"G12", sub:"Bebidas no alcohólicas", kcal:68.83, prot:0.75, gras:2.32, ags:0.95, agm:0.25, agp:0.03, col:0.0, cho:11.68, fib:0.83, ca:21.0, p:34.33, fe:0.68, na:4.83, k:61.17, mg:13.5, zn:0.81, cu:0.04, mn:0.19, va:50.33, tiam:0.08, ribo:0.06, niac:1.12, apan:0.06, pirid:0.11, fol:10.17, b12:0.0, vc:4.0}
];

// INTER_GRUPOS verbatim (L15708-15719): los 12 grupos.
export const INTER_GRUPOS: { id: string; nom: string }[] = [
  {id:"G1", nom:"Harinas (cereales, raíces, tubérculos y plátanos)"},
  {id:"G2", nom:"Verduras y hortalizas"},
  {id:"G3", nom:"Frutas"},
  {id:"G4", nom:"Lácteos"},
  {id:"G5", nom:"Sustitutos"},
  {id:"G6", nom:"Carnes"},
  {id:"G7", nom:"Leguminosas"},
  {id:"G8", nom:"Nueces y semillas"},
  {id:"G9", nom:"Grasas"},
  {id:"G10", nom:"Azúcares y dulces"},
  {id:"G11", nom:"Mecato"},
  {id:"G12", nom:"Bebidas"}
];

// repartoGr (L16892): fraccion del objetivo calorico por grupo (suma 1). subTipo (L16893): alimento por defecto
// de cada grupo (el nutricionista puede cambiarlo por el desplegable; el default computa la porcion).
const REPARTO_GR: Record<string, number> = { G1:0.30, G2:0.06, G3:0.10, G4:0.10, G5:0.02, G6:0.12, G7:0.08, G8:0.03, G9:0.11, G10:0.04, G11:0.02, G12:0.02 };
const SUB_TIPO: Record<string, string> = { G1:"Cereales", G2:"Verduras y hortalizas", G3:"Frutas", G4:"Leche semidescremada", G5:"Sustitutos (embutidos, quesos, huevo)", G6:"Carnes magras", G7:"Leguminosas", G8:"Nueces", G9:"Monoinsaturadas", G10:"Azúcares y dulces", G11:"Mecato", G12:"Bebidas no alcohólicas" };

// Grupos NUCLEARES (aporte energetico/nutricional base): que uno de estos quede en 0 SI es anomalia (objetivo
// implausiblemente bajo). Los DISCRECIONALES (sustitutos, nueces, grasas anadidas, azucares, mecato, bebidas)
// en 0 es NORMAL y saludable (p. ej. mecato queda en 0 aun a 2200 kcal, por su fraccion baja y kcal/porcion
// alta): marcarlos seria ruido. G2 (verduras) va aparte, fijo en 2. Decision de CP1 (2026-08-22).
//
// DIVERGENCIA DELIBERADA (DIV-10): el v8 NO señala el 0 (lo muestra plano en intercambio y lo filtra de la
// grilla de tiempos). La marca es mejora NUESTRA (leccion del reparto de macros); la distincion nuclear/
// discrecional tambien. La PORCION es fiel a PASO 3 byte a byte; el aviso NO la cambia. Ver docs/DIVERGENCIAS.md.
const GRUPOS_NUCLEARES = new Set(["G1", "G3", "G4", "G6", "G7"]);

// Porcion sugerida de un grupo. `avisoSinPorcion` es NUESTRO (no del v8): marca cuando un grupo NUCLEAR queda en
// 0 (el objetivo no alcanza para el), para no mostrar un 0 mudo (leccion del reparto de macros). NO cambia la
// porcion (la porcion es fiel a PASO 3). Un discrecional en 0 NO se marca: es un default sano.
export type IntercambioGrupo = {
  id: string; nom: string; sub: string; kcal: number; porciones: number; avisoSinPorcion: boolean;
};

// Reparto de porciones por grupo desde el objetivo calorico. Transcripcion de PASO 3.
export function computeIntercambio(kcalObj: number): IntercambioGrupo[] {
  return INTER_GRUPOS.map((g) => {
    const sub = SUB_TIPO[g.id];
    const row = INTER_TABLA_A.find((r) => r.sub === sub);
    // Verduras (G2): excepcion del v8, 2 porciones fijas (nx["Verduras y hortalizas"]=2), no computadas.
    const porciones =
      g.id === "G2" ? 2 : row ? Math.max(0, Math.round(((kcalObj || 0) * (REPARTO_GR[g.id] || 0)) / row.kcal)) : 0;
    return {
      id: g.id,
      nom: g.nom,
      sub,
      kcal: row?.kcal ?? 0,
      porciones,
      avisoSinPorcion: porciones === 0 && GRUPOS_NUCLEARES.has(g.id),
    };
  });
}
