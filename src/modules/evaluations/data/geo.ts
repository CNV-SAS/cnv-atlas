// Datos geograficos para los desplegables del intake (paises + ciudades de Colombia). INCLUIDOS en el
// proyecto: es una superficie publica (la encuesta), no puede depender de un servicio externo.
//
// - COUNTRIES: lista amplia, para un <select>. Colombia es el default (es donde estan los integrantes).
// - COLOMBIA_CITIES_GEO: lista CURADA de ciudades de Colombia, cada una con su departamento, region
//   natural y ALTITUD (msnm). La altitud y la region se DERIVAN de la ciudad al leer (`cityGeo`), NO se le
//   preguntan al paciente ni se persisten por evaluacion: son un dato de la ciudad, no del paciente. Si se
//   corrige una altitud, todas las lecturas se corrigen solas (RESPUESTA_GILDARDO 2026-08-15 §3: la altitud
//   entra al observatorio como caracterizacion; el efecto fisiologico es de la altura de residencia).
//   El selector de ciudad es un dropdown fijo por esta lista + "Otra" -> texto libre (la ciudad libre y los
//   paises distintos de Colombia NO tienen altitud derivada: cityGeo devuelve null, no se inventa).
//
// FUENTE de las altitudes: altitud de la CABECERA MUNICIPAL segun IGAC / DANE (dominio publico),
// consolidadas en las fichas municipales de Wikipedia (que citan la fuente oficial). Valores redondeados a
// msnm. Verificadas contra fuente las capitales departamentales; las cabeceras no capitales usan el mismo
// dato oficial de cabecera. Si el observatorio va a segmentar por altitud, la deriva de aqui (una sola
// fuente), no de una columna por paciente.

export const DEFAULT_COUNTRY = "Colombia";

// Paises del selector de identidad: los 14 del archivo de Gildardo (RESPUESTA_GILDARDO 2026-08-20 v2 §1),
// en su orden. El desplegable agrega "Otro" -> 15 opciones, con texto libre de pais (y ciudad libre). ESPANA
// NO esta aca a proposito: Gildardo la deja en CXPAIS (mapa de ciudades) pero FUERA de esta lista, asi que sus
// ciudades quedan inalcanzables por ahora; el decide si Espana entra o sale (su nota del 20). Brasil y Guatemala
// SI estan (sin lista de ciudades: ciudad a mano). Un pais sin lista en CXPAIS cae a ciudad de texto libre.
export const COUNTRIES: readonly string[] = [
  "Colombia", "México", "Argentina", "Chile", "Perú", "Ecuador", "Venezuela",
  "Bolivia", "Uruguay", "Paraguay", "Brasil", "Costa Rica", "Panamá", "Guatemala",
];

// Las 5 regiones naturales de Colombia + Insular (San Andrés). Correlaciona con altitud (Andina alta,
// Caribe/Pacifica bajas); ambas van al observatorio como caracterizacion, NUNCA como coeficiente de
// correccion de ningun indice (DATA_GOVERNANCE, decision 2026-08-15).
export type NaturalRegion = "Andina" | "Caribe" | "Pacífica" | "Orinoquía" | "Amazonía" | "Insular";

export type ColombiaCity = {
  ciudad: string;
  departamento: string;
  region: NaturalRegion;
  altitudMsnm: number; // altitud de la cabecera municipal (IGAC/DANE)
};

// Ciudades de Colombia con departamento, region natural y altitud (msnm). Ordenadas alfabeticamente.
export const COLOMBIA_CITIES_GEO: readonly ColombiaCity[] = [
  { ciudad: "Arauca", departamento: "Arauca", region: "Orinoquía", altitudMsnm: 125 },
  { ciudad: "Armenia", departamento: "Quindío", region: "Andina", altitudMsnm: 1483 },
  { ciudad: "Barrancabermeja", departamento: "Santander", region: "Andina", altitudMsnm: 76 },
  { ciudad: "Barranquilla", departamento: "Atlántico", region: "Caribe", altitudMsnm: 18 },
  { ciudad: "Bello", departamento: "Antioquia", region: "Andina", altitudMsnm: 1450 },
  { ciudad: "Bogotá", departamento: "Bogotá D.C.", region: "Andina", altitudMsnm: 2640 },
  { ciudad: "Bucaramanga", departamento: "Santander", region: "Andina", altitudMsnm: 959 },
  { ciudad: "Buenaventura", departamento: "Valle del Cauca", region: "Pacífica", altitudMsnm: 7 },
  { ciudad: "Buga", departamento: "Valle del Cauca", region: "Andina", altitudMsnm: 969 },
  { ciudad: "Cali", departamento: "Valle del Cauca", region: "Andina", altitudMsnm: 1018 },
  { ciudad: "Cartagena", departamento: "Bolívar", region: "Caribe", altitudMsnm: 2 },
  { ciudad: "Cartago", departamento: "Valle del Cauca", region: "Andina", altitudMsnm: 917 },
  { ciudad: "Cúcuta", departamento: "Norte de Santander", region: "Andina", altitudMsnm: 320 },
  { ciudad: "Chía", departamento: "Cundinamarca", region: "Andina", altitudMsnm: 2564 },
  { ciudad: "Ciénaga", departamento: "Magdalena", region: "Caribe", altitudMsnm: 3 },
  { ciudad: "Dosquebradas", departamento: "Risaralda", region: "Andina", altitudMsnm: 1400 },
  { ciudad: "Duitama", departamento: "Boyacá", region: "Andina", altitudMsnm: 2530 },
  { ciudad: "Envigado", departamento: "Antioquia", region: "Andina", altitudMsnm: 1575 },
  { ciudad: "Facatativá", departamento: "Cundinamarca", region: "Andina", altitudMsnm: 2586 },
  { ciudad: "Florencia", departamento: "Caquetá", region: "Amazonía", altitudMsnm: 242 },
  { ciudad: "Floridablanca", departamento: "Santander", region: "Andina", altitudMsnm: 925 },
  { ciudad: "Fusagasugá", departamento: "Cundinamarca", region: "Andina", altitudMsnm: 1728 },
  { ciudad: "Girardot", departamento: "Cundinamarca", region: "Andina", altitudMsnm: 289 },
  { ciudad: "Girón", departamento: "Santander", region: "Andina", altitudMsnm: 777 },
  { ciudad: "Ibagué", departamento: "Tolima", region: "Andina", altitudMsnm: 1285 },
  { ciudad: "Inírida", departamento: "Guainía", region: "Amazonía", altitudMsnm: 100 },
  { ciudad: "Ipiales", departamento: "Nariño", region: "Andina", altitudMsnm: 2897 },
  { ciudad: "Itagüí", departamento: "Antioquia", region: "Andina", altitudMsnm: 1550 },
  { ciudad: "Jamundí", departamento: "Valle del Cauca", region: "Andina", altitudMsnm: 975 },
  { ciudad: "La Dorada", departamento: "Caldas", region: "Andina", altitudMsnm: 178 },
  { ciudad: "Leticia", departamento: "Amazonas", region: "Amazonía", altitudMsnm: 96 },
  { ciudad: "Lorica", departamento: "Córdoba", region: "Caribe", altitudMsnm: 8 },
  { ciudad: "Magangué", departamento: "Bolívar", region: "Caribe", altitudMsnm: 20 },
  { ciudad: "Maicao", departamento: "La Guajira", region: "Caribe", altitudMsnm: 50 },
  { ciudad: "Malambo", departamento: "Atlántico", region: "Caribe", altitudMsnm: 10 },
  { ciudad: "Manizales", departamento: "Caldas", region: "Andina", altitudMsnm: 2160 },
  { ciudad: "Medellín", departamento: "Antioquia", region: "Andina", altitudMsnm: 1495 },
  { ciudad: "Mitú", departamento: "Vaupés", region: "Amazonía", altitudMsnm: 200 },
  { ciudad: "Mocoa", departamento: "Putumayo", region: "Amazonía", altitudMsnm: 594 },
  { ciudad: "Montería", departamento: "Córdoba", region: "Caribe", altitudMsnm: 18 },
  { ciudad: "Neiva", departamento: "Huila", region: "Andina", altitudMsnm: 442 },
  { ciudad: "Ocaña", departamento: "Norte de Santander", region: "Andina", altitudMsnm: 1202 },
  { ciudad: "Palmira", departamento: "Valle del Cauca", region: "Andina", altitudMsnm: 1001 },
  { ciudad: "Pasto", departamento: "Nariño", region: "Andina", altitudMsnm: 2527 },
  { ciudad: "Pereira", departamento: "Risaralda", region: "Andina", altitudMsnm: 1411 },
  { ciudad: "Piedecuesta", departamento: "Santander", region: "Andina", altitudMsnm: 1005 },
  { ciudad: "Pitalito", departamento: "Huila", region: "Andina", altitudMsnm: 1318 },
  { ciudad: "Popayán", departamento: "Cauca", region: "Andina", altitudMsnm: 1738 },
  { ciudad: "Puerto Carreño", departamento: "Vichada", region: "Orinoquía", altitudMsnm: 51 },
  { ciudad: "Quibdó", departamento: "Chocó", region: "Pacífica", altitudMsnm: 43 },
  { ciudad: "Riohacha", departamento: "La Guajira", region: "Caribe", altitudMsnm: 3 },
  { ciudad: "Rionegro", departamento: "Antioquia", region: "Andina", altitudMsnm: 2125 },
  { ciudad: "Sabanalarga", departamento: "Atlántico", region: "Caribe", altitudMsnm: 100 },
  { ciudad: "Sahagún", departamento: "Córdoba", region: "Caribe", altitudMsnm: 60 },
  { ciudad: "San Andrés", departamento: "San Andrés y Providencia", region: "Insular", altitudMsnm: 1 },
  { ciudad: "San José del Guaviare", departamento: "Guaviare", region: "Amazonía", altitudMsnm: 175 },
  { ciudad: "Santa Marta", departamento: "Magdalena", region: "Caribe", altitudMsnm: 6 },
  { ciudad: "Sincelejo", departamento: "Sucre", region: "Caribe", altitudMsnm: 213 },
  { ciudad: "Soacha", departamento: "Cundinamarca", region: "Andina", altitudMsnm: 2565 },
  { ciudad: "Sogamoso", departamento: "Boyacá", region: "Andina", altitudMsnm: 2569 },
  { ciudad: "Soledad", departamento: "Atlántico", region: "Caribe", altitudMsnm: 10 },
  { ciudad: "Tuluá", departamento: "Valle del Cauca", region: "Andina", altitudMsnm: 973 },
  { ciudad: "Tumaco", departamento: "Nariño", region: "Pacífica", altitudMsnm: 2 },
  { ciudad: "Tunja", departamento: "Boyacá", region: "Andina", altitudMsnm: 2820 },
  { ciudad: "Turbo", departamento: "Antioquia", region: "Caribe", altitudMsnm: 2 },
  { ciudad: "Valledupar", departamento: "Cesar", region: "Caribe", altitudMsnm: 168 },
  { ciudad: "Villavicencio", departamento: "Meta", region: "Orinoquía", altitudMsnm: 467 },
  { ciudad: "Yopal", departamento: "Casanare", region: "Orinoquía", altitudMsnm: 350 },
  { ciudad: "Yumbo", departamento: "Valle del Cauca", region: "Andina", altitudMsnm: 1021 },
  { ciudad: "Zipaquirá", departamento: "Cundinamarca", region: "Andina", altitudMsnm: 2650 },
];

// Nombres de las ciudades de la tabla geo (Colombia). Derivado de la lista geo: una sola fuente. Es la lista
// COMPLETA de altitudes conocidas (72). Los desplegables de la UI (ciudad actual y residencia) usan CXPAIS por
// pais, NO esta lista; queda como fuente de altitud/derivacion (cityGeo) y para el candado del test.
export const COLOMBIA_CITIES: readonly string[] = COLOMBIA_CITIES_GEO.map((c) => c.ciudad);

// CXPAIS: mapa PAIS -> ciudades curadas para el selector de ciudad ACTUAL (RESPUESTA_GILDARDO 2026-08-20 §1,
// restituye el diseño del archivo). Es LATINOAMERICANO por decision de producto: una lista de solo-Colombia
// estrecha el alcance a un pais; la lista cerrada por pais es la que sostiene la comparabilidad de la cohorte
// ("Pereira" es siempre el mismo estrato) y la regla de altitud ("Otra"/fuera de lista -> sin altitud, no se
// inventa) solo tiene sentido con un conjunto cerrado. Cada pais cierra con "Otra" -> texto libre en la UI.
// ALTITUDES: hoy solo las 11 ciudades de Colombia resuelven altitud (via COLOMBIA_CITIES_GEO/cityGeo); las de
// los otros doce paises caen sin altitud (= "Otra" para altitud) hasta que se porten sus altitudes. Brasil y
// Guatemala estan en COUNTRIES pero NO aca (a proposito): sus listas las propone el equipo y Gildardo aprueba.
export const CXPAIS: Record<string, readonly string[]> = {
  Colombia: ["Bogotá", "Medellín", "Barranquilla", "Cali", "Pereira", "Bucaramanga", "Manizales", "Cúcuta", "Ibagué", "Riohacha", "Santa Marta"],
  México: ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "León", "Juárez", "Mérida"],
  Argentina: ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "Mar del Plata"],
  Chile: ["Santiago", "Valparaíso", "Concepción", "Antofagasta", "Viña del Mar"],
  Perú: ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura"],
  Ecuador: ["Quito", "Guayaquil", "Cuenca", "Ambato"],
  Venezuela: ["Caracas", "Maracaibo", "Valencia", "Barquisimeto"],
  Bolivia: ["La Paz", "Santa Cruz", "Cochabamba"],
  Paraguay: ["Asunción", "Ciudad del Este"],
  Uruguay: ["Montevideo", "Salto"],
  "Costa Rica": ["San José"],
  Panamá: ["Ciudad de Panamá"],
  España: ["Madrid", "Barcelona", "Valencia", "Sevilla"],
};

// Ciudades curadas del pais elegido, o null si el pais no tiene lista (cae a texto libre): Brasil, Guatemala,
// o cualquier pais fuera de los trece. La UI muestra el desplegable cuando hay lista, texto libre cuando no.
export function citiesForCountry(country: string | null | undefined): readonly string[] | null {
  if (!country) return null;
  return CXPAIS[country] ?? null;
}

// Indice para la derivacion al leer (normalizado sin acentos ni mayusculas, para tolerar como se guardo).
const CITY_INDEX: Map<string, ColombiaCity> = new Map(
  COLOMBIA_CITIES_GEO.map((c) => [normalizeCity(c.ciudad), c]),
);
function normalizeCity(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // quita diacriticos combinantes
}

// Deriva departamento, region y altitud desde la ciudad guardada. null si la ciudad no esta en la lista
// (texto libre "Otra", o pais distinto de Colombia): NO se inventa altitud. Es la unica via de altitud/region;
// no hay columna por paciente (derivar al leer, decision 2026-08-15 §3).
export function cityGeo(ciudad: string | null | undefined): ColombiaCity | null {
  if (!ciudad) return null;
  return CITY_INDEX.get(normalizeCity(ciudad)) ?? null;
}
