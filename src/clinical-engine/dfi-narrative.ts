// Resumen funcional (parrafo) + meta terapeutica por profesion (metas) del DFI.
//
// PORTE FIEL, MODULO DERIVADO (pieza 1a.1, 2026-08-22). En el prototipo de Gildardo esto vive DENTRO de
// computeDFI (ATLAS_v8.html 2026-08-19, L12955-13010: _seg1.._seg5, _acts, _parrafo, _OBJ, _metaDe, _metas).
// El frozen `engine.dfi.js` porto SOLO domains/riesgo/veto/rutas y dejo parrafo/metas fuera con un comentario
// ("es feature de Tratamiento"). Aqui se completan SIN tocar el frozen: este modulo CONSUME la salida del DFI
// (que el frozen ya produce) + las categorias de indicadores del snapshot, y reconstruye parrafo/metas. El
// frozen queda byte-identico (cero riesgo de DIFF-dfi); la paridad se prueba con un GOLDEN DIFERENCIAL contra
// la propia funcion de Gildardo (computeDFIFromData de atlas-dfi.js), no contra una lectura del codigo.
//
// EQUIVALENCIA DE REFERENCIA (cuidado a, verificado 2026-08-22): el atlas-dfi.js de la carpeta gildardo-2026-07
// es del 07-23, pero su seccion narrativa (_seg*, _parrafo, _OBJ, _metaDe, _metas) es BYTE-IDENTICA a la del
// v8 vigente (08-19); lo unico que difiere en computeDFI entre ambas fechas es la linea de PABU en dom1.items
// (display), que NO alimenta parrafo/metas. Por eso el 07-23 sirve de referencia para este golden. Si Gildardo
// cambia la narrativa en el futuro, se re-porta desde el v8 y se re-verifica el diff.
//
// Texto USER-FACING (lo lee el profesional): las tildes y enes van correctas, verbatim de la fuente.

import type { EngineOutput } from "./types";

// Lo que la narrativa necesita, explicito (para que el golden alimente exactamente esto y no una abstraccion).
// domSev: severidad 0..3 por dominio d1..d5; dom4Veto: veto conductual (senal dura); veto: veto global del DFI.
export type DfiNarrativeInput = {
  // `null` = el dominio NO SE MIDIO (CA-6, Gildardo 2026-08-30 §4). No es 0: 0 es optimo, y en prosa
  // un dominio no medido leido como 0 sale como "entorno favorable" o "funcion celular optima", que es
  // la misma lectura favorable de un vacio, dicha en palabras en vez de en un vertice.
  domSev: { d1: number | null; d2: number | null; d3: number | null; d4: number; d5: number | null };
  dom4Veto: boolean;
  veto: boolean;
  nivelLabel: string; // NIV[nivel].l -> "BAJO"|"MEDIO"|"ALTO"|"CRITICO" (== dfi.riesgo.nivel)
  ifcL: string; // classifications.ifc.label
  ircL: string; // classifications.irc.label
  iehhL: string | null; // classifications.iehh.label (null si IEHH no computable)
  iscmL: string | null; // classifications.iscm.label
  fen: string; // structural.nombre (fenotipo estructural)
  aeL: string | null; // classifications.iae.label
  iae: number | null; // indicators.iae (anos)
};

export type DfiMetas = {
  nutricion: string;
  medicina: string;
  ejercicio: string;
  psicologia: string;
};

export type DfiNarrative = {
  parrafo: string;
  metas: DfiMetas;
};

type Rol = keyof DfiMetas;

// _OBJ verbatim (ATLAS_v8.html L12978-12985): objetivo por ruta x profesion.
const OBJ: Record<string, Record<Rol, string>> = {
  R1: {
    nutricion:
      "aportar densidad nutricional y proteína suficiente por sexo para superar la disfunción celular y reducir el riesgo celular, corrigiendo déficits",
    medicina:
      "descartar y tratar la causa subyacente del deterioro celular y corregir los déficits de micronutrientes",
    ejercicio:
      "instaurar entrenamiento de fuerza progresivo para mejorar la función celular y preservar la masa magra",
    psicologia: "asegurar la adherencia al plan y manejar el estrés que sostiene el deterioro",
  },
  R2: {
    nutricion:
      "instaurar un patrón antiinflamatorio con un timing adecuado para reducir la susceptibilidad cardiometabólica",
    medicina: "evaluar y tratar los factores de riesgo cardiometabólico",
    ejercicio:
      "combinar fuerza y trabajo aeróbico o interválico tolerado para mejorar el perfil cardiometabólico",
    psicologia: "consolidar hábitos y manejar el estrés asociado al riesgo",
  },
  R3: {
    nutricion:
      "acompañar la normalización de la alimentación sin restricción ni control del peso, reforzando una relación funcional con la comida",
    medicina: "valorar la evaluación psiquiátrica y descartar complicaciones",
    ejercicio: "suspender el ejercicio excesivo o compensatorio",
    psicologia:
      "iniciar terapia cognitivo-conductual para la imagen corporal y las conductas alimentarias de riesgo, con derivación a evaluación psiquiátrica si hay conductas compensatorias",
  },
  R4: {
    nutricion:
      "asegurar proteína alta por sexo y un patrón antiinflamatorio para desacelerar el envejecimiento biológico",
    medicina: "descartar y tratar comorbilidades y valorar la derivación a geriatría",
    ejercicio: "priorizar el entrenamiento de fuerza para prevenir o revertir la sarcopenia",
    psicologia: "sostener hábitos, sueño y manejo del estrés",
  },
  R5: {
    nutricion: "educar y resolver las barreras de acceso para mejorar la carga contextual",
    medicina: "controlar la presión arterial y tamizar los factores del estilo de vida",
    ejercicio: "prescribir actividad física accesible y sostenible",
    psicologia: "trabajar el sueño, el estrés y los determinantes sociales",
  },
  R6: {
    nutricion:
      "sostener el estado óptimo alcanzado y mantener la trayectoria del PABU cercana a phi (1,618)",
    medicina: "sostener el estado óptimo alcanzado y vigilar la trayectoria clínica",
    ejercicio: "sostener el estado óptimo alcanzado en su ámbito",
    psicologia: "sostener los hábitos y el bienestar alcanzados",
  },
};

// _ROLN verbatim (L12986): nombre de la profesion en el texto de la meta.
const ROLN: Record<Rol, string> = {
  nutricion: "nutrición",
  medicina: "medicina",
  ejercicio: "ejercicio",
  psicologia: "psicología",
};

// _iscmW map (L12959).
const ISCM_W: Record<string, string> = { Bajo: "baja", Leve: "leve", Moderado: "intermedia", Alto: "elevada" };

type Act = { k: string; pr: number; nom: string };

// _prW verbatim (L12974).
function prW(p: number): string {
  return p === 0 ? "crítica" : p === 1 ? "prioritaria" : p === 2 ? "complementaria" : "de mantenimiento";
}

// Severidad para COMPARAR. Un dominio sin dato no activa ruta ni meta, que es la misma conducta que
// ya tiene el motor (`dom3.sev>=2` con null es false). El -1 lo hace explicito en vez de depender de
// como compara JavaScript un null, que es de las cosas que se leen mal al revisar.
const sv = (x: number | null): number => x ?? -1;

// _acts verbatim (L12966-12973): rutas activas con prioridad, ordenadas.
function buildActs(i: DfiNarrativeInput): Act[] {
  const { d1, d2, d3, d4, d5 } = i.domSev;
  const acts: Act[] = [];
  if (sv(d1) >= 2) acts.push({ k: "R1", pr: d1 === 3 ? 1 : 2, nom: "Ruta 1 (Restauración Celular)" });
  if (sv(d2) >= 2) acts.push({ k: "R2", pr: d2 === 3 ? 1 : 2, nom: "Ruta 2 (Reducción Cardiometabólica)" });
  if (i.dom4Veto || d4 === 3) acts.push({ k: "R3", pr: i.veto ? 0 : 1, nom: "Ruta 3 (Conductual)" });
  if (sv(d3) >= 2) acts.push({ k: "R4", pr: d3 === 3 ? 1 : 2, nom: "Ruta 4 (Desaceleración del Envejecimiento)" });
  if (sv(d5) >= 2) acts.push({ k: "R5", pr: 2, nom: "Ruta 5 (Contextual)" });
  if (!acts.length) acts.push({ k: "R6", pr: 3, nom: "Ruta 6 (Mantenimiento)" });
  acts.sort((a, b) => a.pr - b.pr);
  return acts;
}

// _metaDe verbatim (L12987-13008): meta por profesion, con la rama especial de veto conductual.
function metaDe(rol: Rol, i: DfiNarrativeInput, acts: Act[]): string {
  const { d1, d3 } = i.domSev;
  let ph: string[] = acts.map((a) => OBJ[a.k] && OBJ[a.k][rol]).filter(Boolean) as string[];
  if (i.veto) {
    if (rol === "nutricion") {
      ph = [OBJ.R3.nutricion];
      if (sv(d1) >= 2) ph.push("aportando la densidad nutricional y la proteína necesarias para superar la disfunción celular");
      if (sv(d3) >= 2) ph.push("y asegurando proteína alta para desacelerar el envejecimiento");
    } else {
      const r3 = OBJ.R3[rol];
      if (r3) ph = [r3].concat(ph.filter((x) => x !== r3));
    }
  }
  if (!ph.length) ph = [OBJ.R6[rol]];
  let txt = "Meta de " + ROLN[rol] + ": " + ph.join("; ") + ".";
  if (rol === "nutricion" || rol === "ejercicio") {
    const med: string[] = [];
    if (sv(d1) >= 2 && i.ifcL === "Bajo") med.push("mejora del IFC de al menos 0,5 unidades y salida del rango de disfunción");
    if (sv(d3) >= 2) med.push("reducción del IAE de al menos 2 años");
    if (med.length) txt += " Meta a 24 semanas: " + med.join(" y ") + ".";
  }
  if (i.veto && rol === "nutricion")
    txt += " Dado que coexiste una alteración conductual, la intervención se realiza sin restricción ni control del peso.";
  return txt;
}

// Reconstruye parrafo + metas del DFI (transcripcion fiel de L12955-13010, sin tocar el frozen).
export function dfiNarrative(i: DfiNarrativeInput): DfiNarrative {
  const { d1, d2, d3, d4, d5 } = i.domSev;
  const iehhAlt = i.iehhL === "Moderado" || i.iehhL === "Alto";
  const iae = i.iae ?? 0;

  // Los cuatro segmentos con dominio anulable abren con el caso "no medido". Va PRIMERO en cada uno,
  // antes de mirar etiquetas: sin datos, `ifcL` e `iscmL` llegan vacios y las cadenas caen a la rama
  // por defecto ("muestra disfuncion celular", "susceptibilidad intermedia"), afirmando sobre nada.
  const seg1 =
    d1 == null
      ? "no se evaluó el dominio celular-eléctrico: faltan sus índices"
      : "El paciente " +
        (i.ifcL === "Alto"
      ? "conserva una función celular óptima"
      : i.ifcL === "Normal"
        ? "presenta una función celular en rango normal"
          : "muestra disfunción celular") +
        " " +
        (i.ircL === "Bajo"
      ? "con riesgo celular bajo"
      : i.ircL === "Normal"
        ? "con riesgo celular en rango normal"
        : "con riesgo celular elevado, compatible con inflamación de bajo grado") +
    (iehhAlt ? " y signos de alteración del espectro de hidratación (expansión extracelular)" : "");

  const iscmW = ISCM_W[i.iscmL ?? ""] || "intermedia";
  const seg2 =
    d2 == null
      ? "el dominio metabólico-estructural no se evaluó: falta el ISCM"
      : "en el dominio metabólico-estructural presenta susceptibilidad cardiometabólica " +
        iscmW +
        (i.fen ? " con un fenotipo estructural de " + String(i.fen).replace(/^Fenotipo\s+/i, "").toLowerCase() : "");

  const seg3 =
    d3 == null
      ? "su ritmo de envejecimiento no se evaluó: falta la edad biológica"
      : i.aeL === "Enlentecido"
        ? "su ritmo de envejecimiento es más lento que su edad cronológica"
        : sv(d3) >= 2
          ? "su envejecimiento biológico está acelerado (" + Math.round(Math.abs(iae)) + " años por encima de lo esperado)"
          : "su ritmo de envejecimiento es acorde con su edad cronológica";

  const seg4 =
    "en lo conductual-perceptual " +
    (d4 >= 3
      ? "hay distorsión marcada de la imagen corporal y conductas alimentarias de riesgo"
      : d4 === 2
        ? "hay preocupación moderada por la imagen corporal"
        : d4 === 1
          ? "hay preocupación leve por la imagen corporal"
          : "no hay distorsión de la imagen corporal");

  const seg5 =
    d5 == null
      ? "y la carga contextual y de estilo de vida no se evaluó: falta el ICEC"
      : "y la carga contextual y de estilo de vida es " +
        (d5 <= 0 ? "baja (entorno favorable)" : d5 === 1 ? "moderada" : "alta (determinantes desfavorables)");

  const acts = buildActs(i);
  const rutasTxt = acts.map((a) => a.nom + ", " + prW(a.pr)).join("; ");
  const nivelW = String(i.nivelLabel || "").toLowerCase();

  const parrafo =
    seg1 +
    "; " +
    seg2 +
    "; " +
    seg3 +
    "; " +
    seg4 +
    "; " +
    seg5 +
    ". El perfil configura un riesgo integrado " +
    nivelW +
    ", que activa las siguientes rutas de atención: " +
    rutasTxt +
    ".";

  return {
    parrafo,
    metas: {
      nutricion: metaDe("nutricion", i, acts),
      medicina: metaDe("medicina", i, acts),
      ejercicio: metaDe("ejercicio", i, acts),
      psicologia: metaDe("psicologia", i, acts),
    },
  };
}

// Adaptador para la app: arma el input desde el EngineOutput sellado.
//
// FUENTE DE LAS CATEGORIAS (critico): la narrativa usa el vocabulario del `idx` INTERNO del frozen
// (IFC/IRC ∈ {Alto,Normal,Bajo}, ISCM ∈ {Bajo,Leve,Moderado,Alto}, IAE ∈ {Enlentecido,Concordante,...}),
// NO el de `o.classifications` (que trae etiquetas ricas: "Alerta funcional", "ISCM-1 Bajo riesgo"). Ese
// vocabulario interno solo queda expuesto en las CADENAS de los dominios del frozen (dom.clasif/items), que
// son su salida literal. Se parsean de ahi para NO divergir del motor (parsear su propia salida no puede
// driftar; re-clasificar por fuera si). `fen` (idx.structL, "Fenotipo cFMI/cFFMI" u "Obesidad sarcopénica")
// tampoco es `structural.nombre`: vive en dom2.items[1] = "Fenotipo: {structL}".

const DOMS = (o: EngineOutput) => {
  const by = (id: string) => o.dfi.domains.find((d) => d.id === id);
  return { d1: by("d1"), d2: by("d2"), d3: by("d3"), d4: by("d4"), d5: by("d5") };
};

// Etiqueta dentro del primer parentesis, hasta el " — corte ..." (08-19) o el cierre: "IFC 5,37 (Normal — ...)" -> "Normal".
function labelInParens(s: string | undefined): string | null {
  const m = (s ?? "").match(/\(([^—)]+?)\s*(?:—|\))/);
  const l = m?.[1]?.trim();
  return l && l !== "-" ? l : null;
}

// structL de dom2.items[1] = "Fenotipo: {structL}". El frozen pone "N/C" cuando viene vacio; la narrativa espera "".
function fenFromDom2(d2?: EngineOutput["dfi"]["domains"][number]): string {
  const raw = (d2?.items?.[1] ?? "").replace(/^Fenotipo:\s*/, "");
  return raw === "N/C" ? "" : raw;
}

// Categorias del idx del frozen, parseadas de sus cadenas de dominio (su vocabulario literal).
export function dfiCategoriesFromOutput(o: EngineOutput): {
  ifcL: string;
  ircL: string;
  iehhL: string | null;
  iscmL: string | null;
  aeL: string | null;
  fen: string;
} {
  const { d1, d2, d3 } = DOMS(o);
  const iehhItem = (d1?.items ?? []).find((it) => it.startsWith("IEHH"));
  // dom2.clasif = "ISCM {iscmL} · {fen}"; dom3.clasif = "IAE {signed} años · {aeL}".
  const iscmM = (d2?.clasif ?? "").match(/^ISCM\s+(.+?)\s+·/);
  const aeM = (d3?.clasif ?? "").match(/·\s*(.+?)\s*$/);
  const norm = (x: string | null | undefined) => (x && x !== "-" ? x : null);
  return {
    ifcL: labelInParens(d1?.items?.[0]) ?? "",
    ircL: labelInParens(d1?.items?.[1]) ?? "",
    iehhL: labelInParens(iehhItem),
    iscmL: norm(iscmM?.[1]),
    aeL: norm(aeM?.[1]),
    fen: fenFromDom2(d2),
  };
}

export function dfiNarrativeFromOutput(o: EngineOutput): DfiNarrative {
  const { d1, d2, d3, d4, d5 } = DOMS(o);
  const cat = dfiCategoriesFromOutput(o);
  return dfiNarrative({
    // El `?? 0` se conserva SOLO para el dominio ausente del snapshot (forma vieja); la severidad null
    // del dominio no medido viaja tal cual, para que la prosa pueda decirlo.
    domSev: {
      d1: d1 ? d1.sev : 0,
      d2: d2 ? d2.sev : 0,
      d3: d3 ? d3.sev : 0,
      d4: d4?.sev ?? 0,
      d5: d5 ? d5.sev : 0,
    },
    dom4Veto: Boolean(d4?.veto),
    veto: o.dfi.veto,
    nivelLabel: o.dfi.riesgo.nivel,
    ifcL: cat.ifcL,
    ircL: cat.ircL,
    iehhL: cat.iehhL,
    iscmL: cat.iscmL,
    fen: cat.fen,
    aeL: cat.aeL,
    iae: o.indicators.iae,
  });
}
