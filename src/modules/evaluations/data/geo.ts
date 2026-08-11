// Datos geograficos para los desplegables del intake (paises + ciudades de Colombia). INCLUIDOS en el
// proyecto: es una superficie publica (la encuesta), no puede depender de un servicio externo.
//
// - COUNTRIES: lista amplia, para un <select>. Colombia es el default (es donde estan los integrantes).
// - COLOMBIA_CITIES: lista CURADA (capitales de departamento + ciudades principales) para un <datalist>.
//   NO es exhaustiva a proposito: el campo de ciudad acepta texto libre, asi que un municipio o
//   corregimiento que no este en la lista se escribe igual y se guarda en el mismo campo (no hay "Otra"
//   que llene otro lado). Para paises distintos de Colombia, la ciudad va como texto libre (sin datalist).

export const DEFAULT_COUNTRY = "Colombia";

export const COUNTRIES: readonly string[] = [
  "Afganistán", "Albania", "Alemania", "Andorra", "Angola", "Antigua y Barbuda", "Arabia Saudita",
  "Argelia", "Argentina", "Armenia", "Australia", "Austria", "Azerbaiyán", "Bahamas", "Bangladés",
  "Barbados", "Baréin", "Bélgica", "Belice", "Benín", "Bielorrusia", "Bolivia", "Bosnia y Herzegovina",
  "Botsuana", "Brasil", "Brunéi", "Bulgaria", "Burkina Faso", "Burundi", "Bután", "Cabo Verde",
  "Camboya", "Camerún", "Canadá", "Catar", "Chad", "Chile", "China", "Chipre", "Colombia", "Comoras",
  "Corea del Norte", "Corea del Sur", "Costa de Marfil", "Costa Rica", "Croacia", "Cuba", "Dinamarca",
  "Dominica", "Ecuador", "Egipto", "El Salvador", "Emiratos Árabes Unidos", "Eritrea", "Eslovaquia",
  "Eslovenia", "España", "Estados Unidos", "Estonia", "Etiopía", "Filipinas", "Finlandia", "Fiyi",
  "Francia", "Gabón", "Gambia", "Georgia", "Ghana", "Granada", "Grecia", "Guatemala", "Guinea",
  "Guinea-Bisáu", "Guinea Ecuatorial", "Guyana", "Haití", "Honduras", "Hungría", "India", "Indonesia",
  "Irak", "Irán", "Irlanda", "Islandia", "Islas Marshall", "Islas Salomón", "Israel", "Italia",
  "Jamaica", "Japón", "Jordania", "Kazajistán", "Kenia", "Kirguistán", "Kiribati", "Kuwait", "Laos",
  "Lesoto", "Letonia", "Líbano", "Liberia", "Libia", "Liechtenstein", "Lituania", "Luxemburgo",
  "Madagascar", "Malasia", "Malaui", "Maldivas", "Malí", "Malta", "Marruecos", "Mauricio", "Mauritania",
  "México", "Micronesia", "Moldavia", "Mónaco", "Mongolia", "Montenegro", "Mozambique", "Namibia",
  "Nauru", "Nepal", "Nicaragua", "Níger", "Nigeria", "Noruega", "Nueva Zelanda", "Omán", "Países Bajos",
  "Pakistán", "Palaos", "Palestina", "Panamá", "Papúa Nueva Guinea", "Paraguay", "Perú", "Polonia",
  "Portugal", "Reino Unido", "República Centroafricana", "República Checa", "República del Congo",
  "República Democrática del Congo", "República Dominicana", "Ruanda", "Rumanía", "Rusia", "Samoa",
  "San Cristóbal y Nieves", "San Marino", "San Vicente y las Granadinas", "Santa Lucía",
  "Santo Tomé y Príncipe", "Senegal", "Serbia", "Seychelles", "Sierra Leona", "Singapur", "Siria",
  "Somalia", "Sri Lanka", "Suazilandia", "Sudáfrica", "Sudán", "Sudán del Sur", "Suecia", "Suiza",
  "Surinam", "Tailandia", "Tanzania", "Tayikistán", "Timor Oriental", "Togo", "Tonga", "Trinidad y Tobago",
  "Túnez", "Turkmenistán", "Turquía", "Tuvalu", "Ucrania", "Uganda", "Uruguay", "Uzbekistán", "Vanuatu",
  "Venezuela", "Vietnam", "Yemen", "Yibuti", "Zambia", "Zimbabue",
];

export const COLOMBIA_CITIES: readonly string[] = [
  "Arauca", "Armenia", "Barrancabermeja", "Barranquilla", "Bello", "Bogotá", "Bucaramanga",
  "Buenaventura", "Buga", "Cali", "Cartagena", "Cartago", "Cúcuta", "Chía", "Ciénaga", "Dosquebradas",
  "Duitama", "Envigado", "Facatativá", "Florencia", "Floridablanca", "Fusagasugá", "Girardot", "Girón",
  "Ibagué", "Inírida", "Ipiales", "Itagüí", "Jamundí", "La Dorada", "Leticia", "Lorica", "Magangué",
  "Maicao", "Malambo", "Manizales", "Medellín", "Mitú", "Mocoa", "Montería", "Neiva", "Ocaña", "Palmira",
  "Pasto", "Pereira", "Piedecuesta", "Pitalito", "Popayán", "Puerto Carreño", "Quibdó", "Riohacha",
  "Rionegro", "Sabanalarga", "Sahagún", "San Andrés", "San José del Guaviare", "Santa Marta", "Sincelejo",
  "Soacha", "Sogamoso", "Soledad", "Tuluá", "Tumaco", "Tunja", "Turbo", "Valledupar", "Villavicencio",
  "Yopal", "Yumbo", "Zipaquirá",
];
