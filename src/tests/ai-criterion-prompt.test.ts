import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

// Para leer `lecturaDelIndicador` del lector (server-only) sin servidor.
vi.mock("server-only", () => ({}));

import {
  buildCriterionPrompt,
  CAMPOS,
  CLAVES_PERMITIDAS,
  CRITERION_PROMPT_KEY,
  CRITERION_PROMPT_VERSION,
  CRITERION_SYSTEM_PROMPT,
  NUNCA_VIAJAN,
  type CriterionPromptInput,
} from "@/modules/diagnoses/ai/prompts/criterion.v2";

// CANDADOS DEL PROMPT DEL BORRADOR DE CRITERIO.
//
// Cubren tres cosas que se pisan si se miran por separado:
//   · la BARRERA PII, que desde el porte del paso 4 es una LISTA BLANCA de field_keys (regla dura 15);
//   · el PUNTO 9 de su cotejo: ningun marcador de laboratorio viaja al modelo;
//   · y el PORTE del paso 4 (punto 8): que el esqueleto de los cinco dominios llegue de verdad.
//
// SE PRUEBA SOBRE EL PROMPT COMPLETO, con un paciente realista, no sobre un fixture minimo: el porte
// multiplico por diez lo que viaja, y un candado que mire un prompt de tres lineas ya no mide nada.

// Un paciente completo: diagnosticos, medicamentos y sintomas, que es donde puede colarse un analito.
const ENCUESTA: CriterionPromptInput["encuesta"] = [
  { fieldKey: "d5_38", pregunta: "¿Antecedentes familiares?", valor: "Diabetes, HTA" },
  { fieldKey: "d5_39", pregunta: "¿Diagnósticos personales?", valor: "Diabetes tipo 2, Dislipidemia" },
  // METFORMINA: el caso que este candado tiene que dejar PASAR. Es un farmaco que el paciente declaro,
  // no un resultado que nadie midio, y su prompt manda los medicamentos. Un candado que lo bloqueara
  // estaria prohibiendo lo que el pidio enviar.
  { fieldKey: "d5_40", pregunta: "¿Qué medicamentos toma actualmente?", valor: "Metformina, Estatinas" },
  { fieldKey: "d5_36", pregunta: "¿Le han diagnosticado hipertensión?", valor: "Sí" },
  { fieldKey: "d1_1_i", pregunta: "Verduras y hortalizas (frecuencia de consumo)", valor: "3 a 4 veces/semana" },
  { fieldKey: "d3_29", pregunta: "Nivel de estrés percibido", valor: "7" },
  { fieldKey: "d7_agua", pregunta: "Agua (vasos de 200 ml por día)", valor: "4" },
  { fieldKey: "d6_45", pregunta: "Hinchazón abdominal", valor: "A veces" },
  // NO esta en la lista blanca: no puede aparecer en el prompt aunque venga aqui.
  { fieldKey: "d9_etnia", pregunta: "¿Con cuál grupo étnico se identifica?", valor: "Afrodescendiente" },
];

const input: CriterionPromptInput = {
  sexo: "Masculino",
  // Las que el motor emite para ESTE paciente (DM2 + bebidas azucaradas, y estrés alto + azúcares). Se
  // escriben aquí como las devuelve `alertasDisponibles`: nivel, título y dominio, sin el texto.
  alertas: [
    { nivel: "crítico", titulo: "Riesgo glucémico crítico", dominio: "D1+D5" },
    { nivel: "moderado", titulo: "Estrés alto + azúcares elevados", dominio: "D3+D1" },
  ],
  // v5: vacías por defecto; los casos que las usan las ponen ellos.
  respuestasEnRojo: [],
  direccionPabu: null,
  edad: 61,
  ocupacion: "Docente",
  estadoCivil: "Separado",
  estrato: "3",
  peso: 108.4,
  talla: 168,
  cintura: 112,
  cadera: 108,
  riesgoIntegrado: "Alto",
  riesgoScore: 68,
  riesgoDescripcion: "Compromiso funcional en tres dominios",
  dominios: [
    { nombre: "Celular-Eléctrico", severidad: "Moderado", clasif: "Disfunción de membrana", lectura: "El IFC está por debajo del umbral.", items: ["IFC 3,42", "IRC 2,34"] },
    { nombre: "Metabólico-Estructural", severidad: "Crítico", clasif: "Obesidad clínica", lectura: "FMI elevado con FFMI conservado.", items: ["FMI 15,49"] },
    { nombre: "Envejecimiento", severidad: "Moderado", clasif: "Acelerado", lectura: "La edad bioeléctrica supera la cronológica.", items: ["IAE +4,4"] },
    { nombre: "Conductual-Perceptual", severidad: "Vigilancia", clasif: "Insatisfacción corporal", lectura: "Se autopercibe con exceso de peso.", items: [] },
    { nombre: "Epigenético-Contextual", severidad: "Moderado", clasif: "Carga contextual", lectura: "Antecedentes familiares y sedentarismo.", items: ["ICEC 42"] },
  ],
  veto: false,
  rutas: ["Ruta metabólica", "Ruta de actividad física"],
  encuesta: ENCUESTA,
  composicion: [
    { etiqueta: "IMC (kg/m²)", valor: "38,4" },
    { etiqueta: "Masa grasa (kg)", valor: "43,72" },
    { etiqueta: "Ángulo de fase (°)", valor: "5,5" },
  ],
  estadoEfr: "Obesidad sarcopénica avanzada",
  fenotipoEstructural: "Fenotipo fuerte-adiposo",
  fenotipoMccb: "F2 · Obesidad clínica clásica",
  sectorFuncional: "Disfunción con bajo riesgo",
  mecanismo: "Estrés oxidativo mitocondrial, disfunción mitocondrial muscular, RI",
  riesgos: "Insuficiencia funcional progresiva; mayor riesgo eventos CV",
  indicadores: [
    { nombre: "Índice de Función Celular", valor: "3,42", clasificacion: "Disfunción celular" },
    { nombre: "Índice de Riesgo Celular", valor: "2,34", clasificacion: "Alto riesgo celular" },
  ],
  cortes: ["IFC: óptima >6,68 · alerta 4,12–6,68 · disfunción <4,12"],
};

function rendered(): string {
  return buildCriterionPrompt(input)
    .map((m) => m.content)
    .join("\n");
}

// EL MENSAJE DE USUARIO SOLO. Es la distincion que se me paso al escribir estos candados: el texto de
// SISTEMA nombra los analitos A PROPOSITO, porque es la regla que los prohibe. La veda es sobre lo que le
// MANDAMOS del paciente, no sobre la instruccion que le dice que no se los invente. Un candado sobre los
// dos mensajes juntos se pone rojo por su propia prohibicion.
function mensajeUsuario(): string {
  return buildCriterionPrompt(input)[1].content;
}

// CANDADO DEL PUNTO 9 · NINGUN MARCADOR DE LABORATORIO VIAJA AL MODELO.
//
// EL DEFECTO: el prompt llevaba el campo `bio` de su tabla de estados EFR ("PCR arriba, HOMA-IR arriba,
// ferritina arriba..."), que es una HIPOTESIS suya (que laboratorios pedir), no una medicion. Sin marco,
// el modelo escribio "hay evidencia de PCR elevada" sobre un paciente sin analitica. Textual suyo: *"eso
// no se puede poner porque nos pone en riesgo, sin haber hecho pruebas de laboratorio"*.
//
// SE PRUEBA POR EL CONTENIDO, NO POR EL NOMBRE DEL CAMPO. Fijar que no existe `input.biomarcadores`
// dejaria pasar el mismo texto entrando por `mecanismo`, por una respuesta de encuesta o por un campo
// nuevo. Con el porte del paso 4 eso dejo de ser hipotetico: ahora viajan diagnosticos y medicamentos.
const MARCADORES_DE_LABORATORIO = [
  "PCR",
  "HOMA",
  "ferritina",
  "albúmina",
  "albumina",
  "prealbúmina",
  "creatinina",
  "glucemia",
  "glucosa",
  "hemograma",
  "linfopenia",
  "adiponectina",
  "triglicéridos",
  "ALT",
  "AST",
  "CK",
];

describe("ningún marcador de laboratorio llega al modelo", () => {
  it("el control: el prompt SÍ se construye y lleva el esqueleto entero", () => {
    // Sin control, un prompt vacío pasaría todas las aserciones negativas de abajo. Y se exige el
    // esqueleto, no solo longitud: es lo que distingue un prompt completo de uno truncado.
    const text = rendered();
    expect(text.length, "el prompt viene vacío: lo de abajo no compararía nada").toBeGreaterThan(1500);
    expect(text).toContain("ESQUELETO OBLIGATORIO");
    expect(text).toContain("ANTECEDENTES:");
  });

  it("no nombra ningún marcador bioquímico, venga del campo que venga", () => {
    const text = mensajeUsuario();
    for (const m of MARCADORES_DE_LABORATORIO) {
      const re = new RegExp("(^|[^\\p{L}])" + m + "([^\\p{L}]|$)", "iu");
      expect(text, `el mensaje de usuario nombra "${m}": el modelo lo va a afirmar como hallazgo`).not.toMatch(re);
    }
  });

  it("PERO la Metformina SÍ viaja: es un fármaco declarado, no un análisis", () => {
    // La otra mitad, y sin ella el candado se convertiría en "mandar menos por si acaso". Su prompt manda
    // los medicamentos y los diagnósticos: son lo que el paciente respondió, no un resultado que nadie
    // midió. Un candado que los bloqueara estaría prohibiendo justo lo que él pidió enviar.
    const text = rendered();
    expect(text).toContain("Metformina");
    expect(text).toContain("Diabetes tipo 2");
    expect(text).toContain("Dislipidemia");
  });

  it("y el texto de sistema PROHÍBE nombrarlos, que es la otra guarda", () => {
    // El filtro de entrada evita que le demos un analito; esta regla evita que se lo invente. Hacen falta
    // las dos, igual que con el markdown: un prompt baja la frecuencia, no la lleva a cero.
    const system = buildCriterionPrompt(input)[0].content;
    expect(system).toContain("NINGÚN RESULTADO DE LABORATORIO");
    expect(system).toContain("PCR");
    expect(system, "la regla tiene que permitir explícitamente los fármacos declarados").toContain(
      "Los medicamentos y los diagnósticos que el paciente declaró SÍ se nombran",
    );
  });
});

describe("la barrera PII es una lista blanca de field_keys", () => {
  it("no contiene NINGUNA PII", () => {
    const text = mensajeUsuario().toLowerCase();
    for (const pii of ["juan", "perez", "cedula", "correo", "telefono", "@"]) {
      expect(text, `el prompt no debe contener "${pii}"`).not.toContain(pii);
    }
    // ANTES ESTO BUSCABA LA PALABRA "celular" y era un falso positivo esperando: el primer dominio del DFI
    // se llama "Celular-Eléctrico", y hay masa celular activa y salud celular. La heuristica chocaba con
    // el vocabulario clinico. Se cambia por lo que de verdad intentaba atrapar, un TELEFONO: una tirada
    // larga de digitos seguidos. Las cifras clinicas llevan coma o punto y no pasan de cinco digitos.
    expect(text, "una tirada larga de dígitos parece un teléfono o un documento").not.toMatch(
      /\d{7,}/,
    );
  });

  it("una respuesta FUERA de la lista blanca no viaja, aunque venga en el insumo", () => {
    // El caso que de verdad importa, y por eso el fixture trae una pregunta de etnia: el reader trae la
    // encuesta ENTERA a propósito, y lo único que decide qué sale es esta lista.
    expect(CLAVES_PERMITIDAS.has("d9_etnia"), "la etnia no puede estar en la lista blanca").toBe(false);
    expect(rendered(), "una clave fuera de la lista blanca llegó al modelo").not.toContain(
      "Afrodescendiente",
    );
  });

  it("y la lista blanca sale de la suya, con la aritmética escrita", () => {
    // SU BLOQUE manda 58 campos de encuesta (medido sobre su entrega vigente). La nuestra son 59, y la
    // diferencia es de tres piezas, no de criterio:
    //   −1  `d5_40_otro`: en Atlas el texto libre de "Otros" viaja DENTRO de la respuesta de d5_40
    //   +1  `d5_40`:     que es esa misma pregunta, entera
    //   +1  `d6_qx`:     la cirugía digestiva, pregunta NUESTRA que su archivo no tiene
    // 58 − 1 + 1 + 1 = 59. Si el número cambia sin que cambie esta cuenta, alguien coló o quitó un campo.
    expect(CLAVES_PERMITIDAS.size, "cambió la lista blanca sin actualizar la aritmética").toBe(59);
    expect(CLAVES_PERMITIDAS.has("d5_40_otro"), "no existe como campo en Atlas").toBe(false);
    expect(CLAVES_PERMITIDAS.has("d5_40"), "la pregunta de medicamentos sí viaja").toBe(true);
    expect(CLAVES_PERMITIDAS.has("d6_qx"), "la cirugía es nuestra y sí viaja").toBe(true);
  });

  it("las exclusiones están escritas, para que un candado pueda citarlas", () => {
    expect([...NUNCA_VIAJAN]).toContain("etnia");
    expect([...NUNCA_VIAJAN]).toContain("ascendencia");
    expect([...NUNCA_VIAJAN]).toContain("fecha de nacimiento");
  });
});

describe("el porte del paso 4 llega entero", () => {
  it("el esqueleto de los CINCO dominios, en su orden y con su severidad", () => {
    const text = rendered();
    for (const d of input.dominios) expect(text).toContain(d.nombre);
    expect(text).toContain("Dominio 1 · Celular-Eléctrico [Moderado]");
    expect(text).toContain("Dominio 5 · Epigenético-Contextual");
    expect(text).toContain("Riesgo funcional integrado: Alto · índice 68/100");
    expect(text).toContain("Rutas de Atención derivadas:");
  });

  it("y las secciones de datos crudos, en el orden de su prompt", () => {
    const text = rendered();
    const orden = CAMPOS.map((s) => s.seccion).filter((s) => text.includes(`${s}:`));
    expect(orden.length, "no salió ninguna sección de encuesta").toBeGreaterThan(3);
    const posiciones = orden.map((s) => text.indexOf(`${s}:`));
    expect(posiciones, "las secciones salieron desordenadas").toEqual([...posiciones].sort((a, b) => a - b));
  });

  it("el veto conductual sale SOLO cuando está activo", () => {
    expect(rendered()).not.toContain("VETO CONDUCTUAL ACTIVO");
    const conVeto = buildCriterionPrompt({ ...input, veto: true })
      .map((m) => m.content)
      .join("\n");
    expect(conVeto).toContain("VETO CONDUCTUAL ACTIVO");
  });

  it("y los cortes van por SEXO, con su prohibición en el sistema", () => {
    const [system, user] = buildCriterionPrompt(input).map((m) => m.content);
    expect(user).toContain("CORTES DEL SEXO DE ESTE PACIENTE");
    expect(system).toContain("Está prohibido usar los cortes históricos únicos");
  });

  it("maneja campos ausentes sin romper", () => {
    const vacio = buildCriterionPrompt({
      ...input,
      mecanismo: null,
      riesgos: null,
      encuesta: [],
      composicion: [],
      indicadores: [],
      cortes: [],
    })
      .map((m) => m.content)
      .join("\n");
    expect(vacio).toContain("—");
    expect(vacio).toContain("ESQUELETO OBLIGATORIO");
  });

  it("expone clave y versión del prompt (versionado, regla 9)", () => {
    expect(CRITERION_PROMPT_KEY).toBe("criterio.generate");
    expect(CRITERION_PROMPT_VERSION).toBe(2);
  });
});

describe("el texto de sistema canónico es el v14", () => {
  it("y el seed publica esa misma versión", () => {
    // Los dos canales del prompt: el JSON que consume la app y la version que el seed (y su migracion)
    // publican. Si divergen, local y nube corren textos distintos sin que nada de error.
    const modulo = readFileSync("src/modules/diagnoses/ai/prompts/criterion.system.ts", "utf8");
    expect(modulo).toContain("criterion.system.v14.json");
    const seed = readFileSync("supabase/seed.ts", "utf8");
    expect(seed).toContain("criterion.system.v14.json");
    expect(seed).toContain('{ prompt_key: "criterio.generate", version: 14 },');
  });

  it("y las versiones anteriores NO se borran", () => {
    // Los borradores ya generados apuntan a su version en la procedencia. Borrar el texto deja registros
    // que dicen "generado con la v3" sin que exista la v3. Misma disciplina que las versiones de motor.
    for (const v of ["v1", "v2", "v3", "v4", "v5", "v6", "v7", "v8", "v9", "v10", "v11", "v12", "v13"]) {
      expect(
        existsSync(`src/modules/diagnoses/ai/prompts/criterion.system.${v}.json`),
        `se borró el texto de la ${v}`,
      ).toBe(true);
    }
  });
});

// ═══ LAS ALERTAS: EL MODELO LAS VE, ATLAS ESCRIBE SU PARRAFO (v8, 2026-09-21) ═══
//
// Desde la v4 el modelo escribia el parrafo de alertas; en tres pruebas de Santiago (v5, v6, v7) omitio o
// invento algo en esa lista, y en las dos ultimas se comio la alerta critica de TCA. Desde la v8 el parrafo
// lo compone Atlas (`services/parrafo-de-alertas`) y el modelo solo las usa para leer cada dominio.
describe("las alertas: el modelo las ve y Atlas escribe su párrafo (v8)", () => {
  const armar = (i: CriterionPromptInput) =>
    buildCriterionPrompt(i)
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");

  it("las alertas y las rojas viajan como contexto, con nivel, título y dominio", () => {
    const texto = armar({
      ...input,
      respuestasEnRojo: [{ dominio: "D3 · Hábitos de Vida", pregunta: "¿Cuántas horas duerme por noche?", respuesta: "Menos de 5h" }],
    });
    expect(texto).toContain("[crítico] Riesgo glucémico crítico (dominio D1+D5)");
    expect(texto).toContain("Atlas las presenta en el segundo párrafo: NO las enumeres");
    expect(texto).toContain("D3 · Hábitos de Vida (1): ¿Cuántas horas duerme por noche?: Menos de 5h");
  });

  it("y NO viaja el texto de la alerta, que lleva la conducta dentro", () => {
    const conTca = armar({ ...input, alertas: [{ nivel: "crítico", titulo: "TCA activo detectado", dominio: "D2" }] });
    expect(conTca).toContain("TCA activo detectado");
    expect(conTca, "viajó la conducta dentro del texto de la alerta").not.toContain("Derivación urgente");
  });

  it("sin alertas, el bloque lo dice y no pide nada", () => {
    const sin = armar({ ...input, alertas: [], respuestasEnRojo: [] });
    expect(sin).toContain("ALERTAS CLÍNICAS DE LA ENCUESTA: ninguna. No comentes su ausencia.");
  });

  it("el sistema le dice que ese párrafo no lo escribe, y conserva el resto de la estructura", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("ESE PÁRRAFO NO LO ESCRIBES TÚ");
    expect(CRITERION_SYSTEM_PROMPT).toContain("No inventes alertas");
    expect(CRITERION_SYSTEM_PROMPT).toContain("NO INDIQUES QUÉ HACER CON UNA ALERTA");
    expect(CRITERION_SYSTEM_PROMPT).toContain("3) Un párrafo por cada dominio funcional");
    expect(CRITERION_SYSTEM_PROMPT).toContain("4) Cierre: ESE PÁRRAFO TAMPOCO LO ESCRIBES TÚ");
  });

  it("las alertas son las MISMAS que ve el SOAP: la misma fuente", () => {
    const reader = readFileSync("src/modules/diagnoses/data/criterion-input-reader.ts", "utf8");
    expect(reader).toContain("alertasDeLaConsulta(");
  });
});

describe("lo que la v6 y la v7 corrigieron, y sigue en pie", () => {
  it("las causas solo entre hallazgos dados, también como hipótesis", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("CADA CAUSA Y CADA EFECTO TIENEN QUE ESTAR EN LOS DATOS QUE TE DOY");
    expect(CRITERION_SYSTEM_PROMPT).toContain("conectando causas entre dominios");
  });

  it("el cierre ya no lo escribe el modelo (v10): no nombra rutas", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("No nombres las rutas de atención en ningún párrafo");
  });

  it("los índices con el nombre que se le da, sin abreviar", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain('"Índice del Estado de Hidratación Humana"');
  });
});

describe("v8: más largo con datos, no con interpretación", () => {
  it("le pide citar los datos de cada dominio, también cuando está bien", () => {
    // El HTML de Gildardo cita IMC, ICC, ICT, masa muscular, ASMI, MCA, estrato... y los datos ya le llegaban.
    expect(CRITERION_SYSTEM_PROMPT).toContain("EN CADA DOMINIO, CITA LOS DATOS QUE LO SUSTENTAN");
    expect(CRITERION_SYSTEM_PROMPT).toContain("Más largo con datos, nunca con interpretación");
  });

  it("la dirección de la PABU le llega resuelta, y se le dice que la use", () => {
    // En la tercera prueba dijo "PABU 1,20 por encima de φ": leyó el "+" de "desviación de φ +0,42".
    const texto = buildCriterionPrompt({ ...input, direccionPabu: "la PABU (1,202) está por debajo de φ = 1,618" })
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");
    // v10: "dila con tus palabras, sin comillas": Gemini pego la cadena entre comillas con "úsala tal cual".
    expect(texto).toContain("LECTURA DE LA PABU (ya resuelta; dila con tus palabras, sin comillas): la PABU (1,202)");
    expect(CRITERION_SYSTEM_PROMPT).toContain("El signo que acompaña a la");
  });
});

describe("v9: el cierre en prosa, sin futuro y con la PABU leída", () => {
  it("no anticipa consecuencias, y relee antes de entregar", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("NO ANTICIPES EL FUTURO DEL PACIENTE");
    expect(CRITERION_SYSTEM_PROMPT).toContain("ANTES DE ENTREGAR, RELEE TU TEXTO");
    // Su estructura pide conectar causas entre dominios, y eso sigue en pie.
    expect(CRITERION_SYSTEM_PROMPT).toContain("conectando causas entre dominios");
  });

  it("la PABU: 'por exceso' no se mezcla con 'déficit'", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("no la mezcles con \"déficit\" en la misma frase");
  });
});

describe("v10: el cierre lo escribe Atlas y las lecturas llegan hechas", () => {
  it("las clasificaciones se repiten, no se matizan, y no se recomienda", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("LA CLASIFICACIÓN QUE ACOMPAÑA A CADA CIFRA");
    expect(CRITERION_SYSTEM_PROMPT).toContain("no \"roza el sobrepeso\"");
    expect(CRITERION_SYSTEM_PROMPT).toContain("NO RECOMIENDES NI GRADÚES LA URGENCIA");
  });

  it("la composición viaja con su clasificación", () => {
    const texto = buildCriterionPrompt({
      ...input,
      composicion: [{ etiqueta: "IMC", valor: "25,7 kg/m²", clasificacion: "Sobrepeso" }],
    })
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");
    expect(texto).toContain("IMC: 25,7 kg/m² (Sobrepeso)");
  });

  it("el lector la toma de la misma función que la historia clínica", () => {
    const reader = readFileSync("src/modules/diagnoses/data/criterion-input-reader.ts", "utf8");
    expect(reader).toContain("composicionClasificada(composicion, snap.sexo === \"M\")");
    expect(reader).toContain("dfiNarrativeFromOutput(snap).rutasActivadas");
  });
});

describe("v11: la alerta no es diagnóstico, y dos lecturas más llegan hechas", () => {
  it("una alerta se nombra como alerta, y los digestivos no son evidencia de un dominio", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("UNA ALERTA SE NOMBRA COMO ALERTA, NUNCA COMO DIAGNÓSTICO");
    expect(CRITERION_SYSTEM_PROMPT).toContain("Los síntomas digestivos no forman parte de ninguno de los cinco dominios del DFI");
  });

  it("la lactancia llega dicha como afirmación, con las opciones de su encuesta", () => {
    // Con "¿Fue amamantado/a en su infancia?: No", Gemini escribió "es amamantado".
    const texto = buildCriterionPrompt({
      ...input,
      encuesta: [{ fieldKey: "d5_41", pregunta: "¿Fue amamantado/a en su infancia?", valor: "No" }],
    })[1].content;
    expect(texto).toContain("¿Fue amamantado/a en su infancia?: No (es decir, no fue amamantado/a)");
  });

  it("el IEHH llega con lo que gradúa, que no es la deshidratación", async () => {
    const { lecturaDelIndicador } = await import("@/modules/diagnoses/data/criterion-input-reader");
    expect(lecturaDelIndicador("IEHH", "Leve")).toBe(
      "Leve: alteración leve del equilibrio hídrico",
    );
    expect(lecturaDelIndicador("IFC", "Alto")).toBe("Alto");
  });
});

describe("v12: las respuestas van sin comillas", () => {
  it("la regla de la PABU se extiende a toda respuesta y dato", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("LAS RESPUESTAS DEL PACIENTE VAN SIN COMILLAS");
  });
});

describe("v13: sin electrolitos, y la lectura como dato", () => {
  it("los electrolitos son laboratorio, y una cifra sin clasificación no recibe una", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("CK, electrolitos o cualquier otro analito");
    expect(CRITERION_SYSTEM_PROMPT).toContain("Y si una cifra NO trae clasificación, no le pongas una");
  });

  it("el IEHH y el ICEC llegan con su lectura como hallazgo, no como explicación", async () => {
    const { lecturaDelIndicador } = await import("@/modules/diagnoses/data/criterion-input-reader");
    expect(lecturaDelIndicador("IEHH", "Óptimo")).toBe("Óptimo: equilibrio hídrico óptimo");
    expect(lecturaDelIndicador("ICEC", "Bajo")).toBe("Bajo: carga epigenético-contextual alta, porque en LE8 un puntaje bajo es peor");
    expect(lecturaDelIndicador("IEHH", "Leve")).not.toContain("no la deshidratación");
  });
});
