import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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

describe("el texto de sistema canónico es el v4", () => {
  it("y el seed publica esa misma versión", () => {
    // Los dos canales del prompt: el JSON que consume la app y la version que el seed (y su migracion)
    // publican. Si divergen, local y nube corren textos distintos sin que nada de error.
    const modulo = readFileSync("src/modules/diagnoses/ai/prompts/criterion.system.ts", "utf8");
    expect(modulo).toContain("criterion.system.v4.json");
    const seed = readFileSync("supabase/seed.ts", "utf8");
    expect(seed).toContain("criterion.system.v4.json");
    expect(seed).toContain('{ prompt_key: "criterio.generate", version: 4 },');
  });

  it("y las versiones anteriores NO se borran", () => {
    // Los borradores ya generados apuntan a su version en la procedencia. Borrar el texto deja registros
    // que dicen "generado con la v3" sin que exista la v3. Misma disciplina que las versiones de motor.
    for (const v of ["v1", "v2", "v3"]) {
      expect(
        existsSync(`src/modules/diagnoses/ai/prompts/criterion.system.${v}.json`),
        `se borró el texto de la ${v}`,
      ).toBe(true);
    }
  });
});

describe("las alertas clínicas viajan al resumen (v4, instrucción de Gildardo 2026-09-10)", () => {
  // SU INSTRUCCION: que el resumen de IA mencione las alertas "en el párrafo inmediato después de la
  // presentación del paciente". Eso es el prompt, no mover un bloque: hasta la v3 las alertas NO viajaban.
  //
  // LO QUE SI VIAJABA son sus INSUMOS CRUDOS (ítem 21, diagnósticos, azúcares, agua, estrés), o sea que el
  // modelo tenía los datos y no los veredictos. De ahí la regla de no inventarlas.

  // El bloque de alertas va en el mensaje de USUARIO (es un dato del paciente), no en el de sistema.
  const armar = (i: CriterionPromptInput) =>
    buildCriterionPrompt(i)
      .filter((m) => m.role === "user")
      .map((m) => m.content)
      .join("\n");
  const texto = () => armar(input);

  it("van con nivel, título y dominio", () => {
    expect(texto()).toContain("[crítico] Riesgo glucémico crítico (dominio D1+D5)");
  });

  it("y NO viaja el texto de la alerta, que lleva la conducta dentro", () => {
    // "Derivación urgente a psicología/psiquiatría" es una INDICACIÓN, y este mismo prompt le prohíbe
    // prescribir. Mandarle la instrucción y prohibirle repetirla es pedirle dos cosas contrarias.
    const conTca = armar({
      ...input,
      alertas: [{ nivel: "crítico", titulo: "TCA activo detectado", dominio: "D2" }],
    });
    expect(conTca).toContain("TCA activo detectado");
    expect(conTca, "viajó la conducta dentro del texto de la alerta").not.toContain("Derivación urgente");
  });

  it("el bloque se escribe también cuando NO hay ninguna", () => {
    // Sin la línea que lo dice, el modelo no distingue "no hay alertas" de "no me las mandaron", y ante la
    // duda las deduce de los datos crudos, que son los mismos insumos de las reglas.
    const sinAlertas = armar({ ...input, alertas: [] });
    expect(sinAlertas).toContain("ALERTAS CLÍNICAS DE LA ENCUESTA: ninguna");
    expect(sinAlertas).toContain("No escribas ese párrafo");
  });

  it("el bloque de sistema pide el párrafo donde él lo pidió, y acota qué puede hacer con él", () => {
    expect(CRITERION_SYSTEM_PROMPT).toContain("INMEDIATAMENTE POSTERIOR a la presentación del paciente");
    expect(CRITERION_SYSTEM_PROMPT).toContain("No inventes alertas");
    expect(CRITERION_SYSTEM_PROMPT).toContain("NO INDIQUES QUÉ HACER CON UNA ALERTA");
  });

  it("y el resto de la estructura sigue en pie: los dominios y el cierre solo se renumeran", () => {
    // CONTROL: si al insertar el paso nuevo se hubiera comido uno de los otros, el diagnóstico perdería su
    // esqueleto y este candado sería el único que podría verlo.
    expect(CRITERION_SYSTEM_PROMPT).toContain("3) Un párrafo por cada dominio funcional");
    expect(CRITERION_SYSTEM_PROMPT).toContain("4) Cierre: las RUTAS DE ATENCIÓN");
  });

  it("las alertas son las MISMAS que ve el profesional: la misma función, sobre las mismas respuestas", () => {
    // Dos fuentes del mismo dato sin nada que las compare es como el resumen acaba hablando de una alerta
    // que la pantalla no muestra. Aquí no hay dos: hay una función y dos sitios de llamada.
    const reader = readFileSync("src/modules/diagnoses/data/criterion-input-reader.ts", "utf8");
    expect(reader).toContain("alertasDisponibles(");
    expect(reader).toContain("encDesdeRespuestas(");
  });
});
