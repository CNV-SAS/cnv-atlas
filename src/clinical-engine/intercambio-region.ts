// LISTA DE INTERCAMBIO RECORTADA POR REGION · su contenido, dato puro.
//
// PORTE FIEL de su entrega del 2026-09-03, EXTRAIDO POR SCRIPT del HTML vigente y no transcrito: una lista
// de 224 municipios copiada a mano tiene un error de tilde garantizado, y un municipio mal escrito no da
// error en ninguna parte (`regionDe` devuelve null y el paciente recibe los 350 alimentos, en silencio).
//
// LA HISTORIA, porque explica por que llego tarde: el bloque existia desde el 2 de septiembre, en
// `lista_intercambio_por_region.js`, SUELTO en la carpeta de la entrega. Su documento dijo que iba dentro
// del HTML, y ni el ni nosotros lo buscamos fuera de los .html y los .md. El 3 lo integro al HTML y lo
// conecto a la vista. Su frase: "cuando un bloque va en archivo aparte, se dice en el documento".
//
// LAS DOS ETAPAS SE PORTAN POR SEPARADO, como en su archivo: las diez regiones y sus alimentos son del
// 2 de septiembre y no se tocan; la ampliacion de 111 a 224 municipios es del 3 y va en su propio bloque.
// Asi, una entrega que solo agregue municipios se diferencia limpio contra este archivo.
//
// LA REGLA DE LA CIUDAD DESCONOCIDA, suya y deliberada: la coincidencia es EXACTA por nombre. Sin region
// no se recorta y el paciente recibe la lista completa, porque "mas vale una lista larga que una lista a
// la que le falte lo que la persona come". Hay municipios colombianos homonimos de ciudades del exterior:
// "Madrid" resuelve a Cundiboyacense y "Madrid España" no resuelve a ninguna region. Si algun dia se
// ablanda esa comparacion, ese es el caso que hay que probar primero.
//
// CANDADO: intercambio-region.test.ts. No compara solo nuestra copia contra la suya (dos copias del mismo
// error coinciden): verifica ademas la tabla de DIEZ CIUDADES CON SU CONTEO que el publico, que es un
// oraculo externo, y la integridad referencial contra INTER_TABLA_B, donde un nombre con otra tilde no
// rompe nada: el alimento solo desaparece de la lista del paciente.

import { INTER_TABLA_B, type AlimentoConcreto } from "./intercambio-alimentos";

/** Las diez regiones del modelo. Las claves son las suyas; no se traducen ni se reordenan. */
export type RegionKey =
  | "caribe"
  | "pacifica"
  | "andina_antioquia"
  | "andina_cundiboyacense"
  | "andina_santanderes"
  | "andina_valle"
  | "andina_narino"
  | "orinoquia"
  | "amazonia"
  | "insular";

export const REGION_NOMBRE = {
  "caribe": "Caribe",
  "pacifica": "Pacífica",
  "andina_antioquia": "Antioquia y Eje Cafetero",
  "andina_cundiboyacense": "Cundiboyacense",
  "andina_santanderes": "Santanderes",
  "andina_valle": "Valle y Cauca",
  "andina_narino": "Nariño y alta montaña",
  "orinoquia": "Orinoquía y Llanos",
  "amazonia": "Amazonía",
  "insular": "Insular"
};

export const REGION_CIUDADES: Record<RegionKey, string[]> = {
  caribe: ["Barranquilla", "Cartagena", "Santa Marta", "Montería", "Valledupar", "Sincelejo", "Riohacha", "Soledad", "Magangué", "Turbaco", "Maicao", "Ciénaga", "Lorica", "Sahagún", "Corozal", "El Carmen de Bolívar"],
  pacifica: ["Quibdó", "Buenaventura", "Tumaco", "Guapi", "Istmina", "Bahía Solano", "López de Micay", "Timbiquí"],
  andina_antioquia: ["Medellín", "Bello", "Itagüí", "Envigado", "Rionegro", "Apartadó", "Turbo", "Sabaneta", "Caldas", "Copacabana", "La Estrella", "Pereira", "Manizales", "Armenia", "Dosquebradas", "Cartago", "Chinchiná", "Calarcá", "Santa Rosa de Cabal"],
  andina_cundiboyacense: ["Bogotá", "Soacha", "Zipaquirá", "Chía", "Facatativá", "Fusagasugá", "Girardot", "Tunja", "Duitama", "Sogamoso", "Chiquinquirá", "Ubaté", "Mosquera", "Madrid", "Funza", "Cajicá"],
  andina_santanderes: ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil", "Socorro", "Barbosa", "Cúcuta", "Ocaña", "Pamplona", "Villa del Rosario", "Los Patios"],
  andina_valle: ["Cali", "Palmira", "Buga", "Tuluá", "Jamundí", "Yumbo", "Popayán", "Santander de Quilichao", "Florida", "Candelaria", "Puerto Tejada"],
  andina_narino: ["Pasto", "Ipiales", "Túquerres", "La Unión", "Sandoná"],
  orinoquia: ["Villavicencio", "Yopal", "Arauca", "Puerto Carreño", "Acacías", "Granada", "Puerto López", "Tame", "Saravena", "Aguazul"],
  amazonia: ["Leticia", "Florencia", "Mocoa", "San José del Guaviare", "Puerto Asís", "Inírida", "Mitú", "Puerto Leguízamo"],
  insular: ["San Andrés", "Providencia", "Santa Catalina"]
};

export const ALIMENTOS_NUCLEO = [
  // Azucares y dulces + Nueces: el reparto prescribe 1 porcion de cada uno y siete
  // regiones no los surtian, dejando la lista vacia. Al nucleo entra un conjunto corto
  // -endulzantes, dos postres y las nueces de consumo nacional-; las bebidas azucaradas
  // y la confiteria quedan fuera a proposito (4-sep-2026).
  "Azúcar blanca granulada",
  "Miel de abejas",
  "Panela en polvo",
  "Jarabe de maple",
  "Postre gelatina-leche",
  "Helado de vainilla",
  "Maní sin sal",
  "Almendras tostadas sin sal",
  "Marañón tostado sin sal",
  "Nuez del nogal",
  "Leche de vaca entera pasteurizada",
  "Leche de vaca semidescremada en polvo",
  "Yogurt regular de leche entera",
  "Cuajada de leche de vaca",
  "Queso Campesino (fresco semiduro, graso)",
  "Quesito",
  "Huevo de gallina crudo",
  "Pechuga de pollo, carne sin piel",
  "Muslo de pollo, carne sin piel",
  "Contramuslo de pollo, carne sin piel",
  "Carne de res todos los cortes magra",
  "Carne de cerdo lomo o cañón magro",
  "Atún enlatado en agua, sólidos",
  "Lenteja con guiso**",
  "Garbanzo con guiso**",
  "Arveja seca cocida",
  "Arroz blanco, cocido",
  "Arroz integral, cocido",
  "Pan blanco",
  "Pan integral",
  "Avena en hojuelas fortificada",
  "Espaguetis de trigo, cocidos",
  "Pasta corta cocida",
  "Galletas Saltinas",
  "Harina de trigo enriquecida",
  "Arepa redonda de maíz blanco trillado",
  "Harina de maíz blanco trillado",
  "Papa común",
  "Yuca blanca",
  "Plátano verde",
  "Plátano hartón maduro",
  "Banano común",
  "Naranja",
  "Mango",
  "Papaya",
  "Guayaba criolla",
  "Piña manzana",
  "Manzana con cáscara toda variedad",
  "Mora",
  "Maracuyá",
  "Tomate chonto",
  "Cebolla blanca cruda",
  "Cebolla roja",
  "Zanahoria",
  "Habichuela",
  "Auyama",
  "Remolacha, cocida",
  "Arveja verde",
  "Aceite de oliva",
  "Aceite de canola",
  "Aceite de girasol",
  "Aguacate común",
  "Aguacate Hass",
  "Mantequilla sin sal",
  "Café instantáneo en polvo",
  "Chocolate granulado con panela"
];

export const ALIMENTOS_REGION = {
  caribe: [
    "Ñame",
    "Batata",
    "Yuca blanca",
    "Plátano verde",
    "Plátano hartón maduro",
    "Plátano colí o guineo",
    "Fríjol cabecita negra con guiso**",
    "Fríjol zaragoza con guiso**",
    "Fríjol caraota con guiso**",
    "Carne de cabra o chivo",
    "Pargo especies mezcladas",
    "Sardina enlatada en salsa de tomate",
    "Camarón especies mezcladas",
    "Langostino especies mezcladas",
    "Bagre carne y piel",
    "Queso Costeño rallado",
    "Butifarra",
    "Mango",
    "Papaya",
    "Guayaba criolla",
    "Guayaba manzana",
    "Sandía Baby",
    "Melón",
    "Guanábana",
    "Maracuyá",
    "Zapote sin semilla",
    "Auyama",
    "Coco fresco rallado",
    "Coco deshidratado",
    "Arepa delgada de maíz blanco trillado",
    "Harina de maíz blanco trillado"
  ],
  pacifica: [
    "Chontaduro",
    "Borojó",
    "Murrapo",
    "Guanábana",
    "Papaya",
    "Banano común",
    "Plátano verde",
    "Plátano hartón maduro",
    "Yuca blanca",
    "Ñame",
    "Pargo especies mezcladas",
    "Bagre carne y piel",
    "Camarón especies mezcladas",
    "Langostino especies mezcladas",
    "Coco fresco rallado",
    "Coco deshidratado",
    "Aceite de palma",
    "Piña manzana",
    "Chirimoya"
  ],
  andina_antioquia: [
    "Mazamorra Antioqueña (maíz cocido)",
    "Arepa redonda de maíz blanco trillado",
    "Pandequeso",
    "Pandeyuca",
    "Almojábana",
    "Fríjol cargamanto rosado con plátano verde*",
    "Fríjol cargamanto blanco con plátano verde*",
    "Fríjol bola roja con plátano verde*",
    "Papa común",
    "Papa criolla",
    "Yuca blanca",
    "Plátano hartón maduro",
    "Plátano verde",
    "Arracacha",
    "Carne de cerdo lomo o cañón magro",
    "Chuleta de cerdo magra",
    "Morcilla",
    "Quesito",
    "Cuajada de leche de vaca",
    "Mango",
    "Banano común",
    "Tomate árbol común",
    "Tomate árbol rojo",
    "Granadilla",
    "Mora",
    "Lulo",
    "Lulo jugo",
    "Curuba",
    "Uchuva",
    "Feijoa",
    "Guayaba criolla",
    "Aguacate común",
    "Aguacate Hass",
    "Chocolate granulado con panela",
    "Tomate chonto",
    "Habichuela",
    "Zanahoria"
  ],
  andina_cundiboyacense: [
    "Cuchuco de cebada",
    "Cebada perlada cocida",
    "Almojábana",
    "Arepa delgada de maíz blanco trillado",
    "Papa común",
    "Papa criolla",
    "Cubios",
    "Chuguas u ollucos",
    "Arracacha",
    "Arveja seca cocida",
    "Arveja verde",
    "Fríjol blanquillo con guiso**",
    "Garbanzo con guiso**",
    "Lenteja con guiso**",
    "Curuba",
    "Feijoa",
    "Uchuva",
    "Mora",
    "Tomate árbol común",
    "Papayuela",
    "Granadilla",
    "Pera",
    "Ciruela común",
    "Ciruela claudia",
    "Cidrayota",
    "Habichuela",
    "Brócoli crudo sin hojas, ni tallos",
    "Coliflor",
    "Remolacha, cocida",
    "Cebolla puerro",
    "Cuajada de leche de vaca",
    "Queso Campesino (fresco semiduro, graso)",
    "Chocolate con azúcar",
    "Chocolate granulado con panela"
  ],
  andina_santanderes: [
    "Arepa redonda de maíz blanco trillado",
    "Harina de maíz blanco trillado",
    "Yuca blanca",
    "Plátano verde",
    "Carne de cabra o chivo",
    "Carne de res todos los cortes magra",
    "Hígado de res",
    "Callo o panza",
    "Lengua de res",
    "Fríjol cargamanto rosado con plátano verde*",
    "Garbanzo con guiso**",
    "Piña manzana",
    "Guayaba criolla",
    "Mango",
    "Naranja",
    "Naranja valencia",
    "Aguacate común",
    "Auyama"
  ],
  andina_valle: [
    "Pandeyuca",
    "Pandequeso",
    "Arroz blanco, cocido",
    "Plátano verde",
    "Plátano hartón maduro",
    "Yuca blanca",
    "Papa común",
    "Chontaduro",
    "Borojó",
    "Lulo",
    "Lulo jugo",
    "Maracuyá",
    "Guanábana",
    "Papaya",
    "Zapote sin semilla",
    "Mango",
    "Piña manzana",
    "Fríjol cargamanto rosado con plátano verde*",
    "Carne de cerdo lomo o cañón magro",
    "Pargo especies mezcladas",
    "Aceite de palma"
  ],
  andina_narino: [
    "Carne de cuy",
    "Trucha arcoíris",
    "Papa común",
    "Papa criolla",
    "Cubios",
    "Chuguas u ollucos",
    "Arracacha",
    "Chirimoya",
    "Lulo",
    "Mora",
    "Curuba",
    "Uchuva",
    "Feijoa",
    "Arveja verde",
    "Arveja seca cocida",
    "Habichuela",
    "Cuajada de leche de vaca"
  ],
  orinoquia: [
    "Carne de res todos los cortes magra",
    "Carne de ternera diferentes cortes magra",
    "Hígado de res",
    "Lengua de res",
    "Arroz blanco, cocido",
    "Yuca blanca",
    "Plátano verde",
    "Plátano hartón maduro",
    "Plátano colí o guineo",
    "Mango",
    "Papaya",
    "Guayaba criolla",
    "Maracuyá",
    "Piña manzana",
    "Auyama",
    "Queso Campesino (fresco semiduro, graso)"
  ],
  amazonia: [
    "Yuca blanca",
    "Plátano verde",
    "Plátano hartón maduro",
    "Bagre carne y piel",
    "Pargo especies mezcladas",
    "Trucha arcoíris",
    "Chontaduro",
    "Borojó",
    "Guanábana",
    "Piña manzana",
    "Papaya",
    "Aceite de palma"
  ],
  insular: [
    "Yuca blanca",
    "Ñame",
    "Batata",
    "Plátano verde",
    "Plátano hartón maduro",
    "Arroz blanco, cocido",
    "Pargo especies mezcladas",
    "Camarón especies mezcladas",
    "Langostino especies mezcladas",
    "Atún enlatado en agua, sólidos",
    "Coco fresco rallado",
    "Coco deshidratado",
    "Mango",
    "Papaya",
    "Guanábana",
    "Sandía Baby",
    "Piña manzana"
  ]
};

// Región a partir de la ciudad del paciente. Sin coincidencia no se recorta:
// más vale una lista larga que una lista a la que le falte lo que la persona come.
export function regionDe(ciudad: string | null | undefined): RegionKey | null {
  const c = String(ciudad || '').trim().toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (!c) return null;
  for (const r of Object.keys(REGION_CIUDADES) as RegionKey[]) {
    if (REGION_CIUDADES[r].some(x => x.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'') === c)) return r;
  }
  return null;
}

// La lista que recibe el paciente: su región más el núcleo nacional.
export function listaIntercambioPaciente(ciudad: string | null | undefined): AlimentoConcreto[] {
  const r = regionDe(ciudad);
  if (!r) return INTER_TABLA_B;                       // sin región: la lista completa
  const permitidos = new Set([...ALIMENTOS_NUCLEO, ...ALIMENTOS_REGION[r]]);
  return INTER_TABLA_B.filter(f => permitidos.has(f.al));
}

// ── Ampliación de cobertura municipal (3-sep-2026) ──────────────────────────
// Las diez regiones y sus alimentos son los del 2 de septiembre y no se tocan.
// Esto solo agrega municipios que faltaban, para que más pacientes resuelvan a
// su región. Una ciudad ausente no rompe nada: recibe la lista completa.
// La coincidencia es EXACTA por nombre, así que "Madrid" resuelve a
// Cundiboyacense y "Madrid España" no resuelve a ninguna región. Es deliberado:
// hay municipios colombianos homónimos de ciudades del exterior.
{
  const mas: Record<RegionKey, string[]> = {
    caribe: ["Malambo","Sabanalarga","Baranoa","Galapa","Puerto Colombia","Arjona","Turbaná",
      "Fundación","Aracataca","El Banco","Plato","Aguachica","Codazzi","Chiriguaná",
      "La Jagua de Ibirico","Cereté","Montelíbano","Planeta Rica","Ayapel","Sincé","Tolú",
      "Coveñas","Uribia","Manaure","Fonseca","San Juan del Cesar"],
    pacifica: ["Condoto","Nuquí","Acandí","Barbacoas","Francisco Pizarro"],
    andina_antioquia: ["Marinilla","La Ceja","El Retiro","Guarne","Girardota","Barbosa Antioquia",
      "Chigorodó","Caucasia","Puerto Berrío","Villamaría","La Dorada","Anserma","La Virginia",
      "Montenegro","Quimbaya","La Tebaida","Circasia","Riosucio"],
    andina_cundiboyacense: ["Cota","Tenjo","Tabio","Sopó","La Calera","Villeta","La Mesa","Anapoima",
      "Tocancipá","Gachancipá","Sibaté","Paipa","Villa de Leyva","Moniquirá","Puerto Boyacá",
      "Garagoa","Samacá","Nobsa"],
    andina_santanderes: ["Málaga","Vélez","San Vicente de Chucurí","Chinácota","Ábrego","Tibú"],
    andina_valle: ["Zarzal","Roldanillo","Sevilla","Caicedonia","Pradera","Piendamó","Ibagué",
      "Espinal","Melgar","Honda","Líbano","Chaparral","Mariquita","Neiva","Pitalito","Garzón",
      "La Plata","Campoalegre","Gigante"],
    andina_narino: ["Samaniego","Sibundoy","Colón","Santiago"],
    orinoquia: ["San Martín","Restrepo","Cumaral","Tauramena","Villanueva","Monterrey",
      "Puerto Gaitán","Arauquita","La Primavera"],
    amazonia: ["Puerto Nariño","San Vicente del Caguán","Belén de los Andaquíes","El Retorno",
      "Calamar","Orito","Valle del Guamuez","La Hormiga"],
    insular: []
  };
  for (const r of Object.keys(mas) as RegionKey[]) {
    if (!REGION_CIUDADES[r]) continue;
    mas[r].forEach(function (c) {
      if (REGION_CIUDADES[r].indexOf(c) < 0) REGION_CIUDADES[r].push(c);
    });
  }
}
