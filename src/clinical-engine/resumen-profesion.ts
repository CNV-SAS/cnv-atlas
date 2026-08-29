// Párrafos del Resumen Clínico POR PROFESIÓN (médico, entrenador, psicólogo).
//
// PORTE FIEL, módulo derivado. Transcripción de `_resumenMedicoParrafo`, `_resumenEjercicioParrafo` y
// `_resumenPsicoParrafo` del ATLAS_v8.html vigente. Hermano de `resumen-dieta.ts`, que porta el cuarto
// (`_resumenNutriParrafo`, el del nutricionista): mismo patrón, mismo tipo de golden diferencial.
//
// POR QUE APARECEN AHORA, y no es que él los acabara de entregar: llevan meses en su archivo. Atlas
// portó solo el del nutricionista y las otras tres profesiones veían "su resumen todavía no se ha
// portado", una frase honesta que hacía parecer trabajo de él lo que era trabajo NUESTRO. Salió al
// separar los dos resúmenes (su §11c): sin estos tres, la subpestaña del médico, la del entrenador y la
// del psicólogo quedaban VACÍAS, que es peor que antes de separar.
//
// FORMA DEL `enc` (crítico, y es donde estos portes fallan MUDOS): `_resDietaCoarse` lee los campos de
// frecuencia como ÍNDICE 0-4, pero Atlas guarda el TEXTO de la opción. El reader convierte con la misma
// canon del motor de patrón, igual que en `resumen-dieta.ts`. Sin convertir, `num()` daría null, TODOS
// los grupos se saltarían y el párrafo saldría incompleto sin avisar.
//
// Texto USER-FACING (lo lee el profesional): tildes y eñes correctas, verbatim de la fuente.

// Módulos congelados en JS; `allowJs` los resuelve.
import { cFFMI, cFMI } from "./frozen/engine.core.derived.js";
import { FREQ_GROUPS } from "./frozen/engine.patron.js";

type Enc = Record<string, unknown>;
type Bis = Record<string, unknown>;

// --- Helpers, verbatim de los suyos (`_resArr`, `_resLista`, `_resLower`, `_resNum`, `_resSuj`) ---

function arr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  // Su lista de descartes: una respuesta "Ninguna" no es un dato que se narre.
  const q = ["ninguno", "ninguna", "no", "—", ""];
  return v.filter((x) => x && q.indexOf(String(x).toLowerCase()) < 0).map(String);
}

function lista(a: string[]): string {
  if (a.length <= 1) return a[0] || "";
  return a.slice(0, -1).join(", ") + " y " + a[a.length - 1];
}

const lower = (a: string[]): string[] => a.map((x) => String(x).toLowerCase());

function num(v: unknown): number | null {
  const n = Number(v);
  return v != null && v !== "" && !isNaN(n) ? n : null;
}

function sujeto(enc: Enc): string {
  return String(enc.sexo ?? "").toLowerCase().charAt(0) === "f" ? "La paciente" : "El paciente";
}

function sexoM(enc: Enc, bis: Bis): "M" | "F" {
  const v = String(enc?.sexo ?? bis?.sexo ?? "");
  return v.charAt(0).toUpperCase() === "M" ? "M" : "F";
}

function ffmiCat(enc: Enc, bis: Bis): number | null {
  const FFMI = Number(bis?.FFMI ?? bis?.ffmi ?? enc?.FFMI ?? enc?.ffmi) || 0;
  if (FFMI <= 0) return null;
  return (cFFMI as (v: number, s: string) => { k: number })(FFMI, sexoM(enc, bis)).k;
}

function fmiCat(enc: Enc, bis: Bis): number | null {
  const FMI = Number(bis?.FMI ?? bis?.fmi ?? enc?.FMI ?? enc?.fmi) || 0;
  if (FMI <= 0) return null;
  return (cFMI as (v: number, s: string) => { k: number })(FMI, sexoM(enc, bis)).k;
}

/** Lectura GRUESA del patrón alimentario, la que usan los tres párrafos (`_resDietaCoarse`). */
function dietaCoarse(enc: Enc): string {
  let probs = 0;
  let any = false;
  for (const g of FREQ_GROUPS as { n: number; cat: string }[]) {
    const v = num(enc[`d1_${g.n}_i`]);
    if (v === null) continue;
    any = true;
    if (g.cat === "protector" && v <= 1) probs++;
    else if (g.cat === "riesgo" && v >= 3) probs++;
  }
  if (!any) return "";
  return probs === 0
    ? "una alimentación adecuada"
    : probs <= 2
      ? "una alimentación con aspectos por mejorar"
      : "una alimentación deficiente";
}

// --- Los tres párrafos ---

/** Párrafo del MÉDICO: antecedentes, diagnósticos, medicación y hábitos. */
// Recibe `bis` sin usarlo para que las TRES tengan la misma firma: el reader elige la funcion por
// profesion y la llama igual, sin tener que saber cual necesita la composicion. En su archivo tambien la
// recibe. Quitarlo obligaria al llamador a distinguir, que es donde se cuelan los errores de cableado.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function resumenMedicoParrafo(enc: Enc, _bis: Bis = {}): string {
  const pres: string[] = [];
  const af = arr(enc.d5_38);
  if (af.length) pres.push("antecedentes familiares de " + lista(lower(af)));

  const dx = arr(enc.d5_39);
  // La HTA declarada aparte (d5_36) se suma a los diagnósticos, pero solo si no venía ya en la lista:
  // duplicarla la haría aparecer dos veces en la misma frase.
  if (String(enc.d5_36 ?? "") === "Sí" && !dx.some((x) => /hiperten|hta/i.test(x))) {
    dx.push("hipertensión arterial");
  }
  if (dx.length) pres.push("diagnósticos de " + lista(lower(dx)));

  const qx = String(enc.d6_qx ?? "");
  if (qx && qx.toLowerCase().indexOf("ninguna") < 0) {
    pres.push("antecedente quirúrgico de " + qx.toLowerCase());
  }
  const alg = arr(enc.d6_43);
  if (alg.length) pres.push("alergia a " + lista(lower(alg)));
  const intol = arr(enc.d6_44);
  if (intol.length) pres.push("intolerancia a " + lista(lower(intol)));

  const cl: string[] = [];
  if (pres.length) cl.push("presenta " + lista(pres));
  const med = arr(enc.d5_40);
  if (med.length) cl.push("toma " + lista(lower(med)));

  const naf = num(enc.d3_23);
  if (naf !== null) {
    cl.push(
      naf <= 0
        ? "no realiza actividad física"
        : "realiza actividad física " + naf + (naf === 1 ? " día" : " días") + " por semana",
    );
  }
  const tab = String(enc.d3_30 ?? "").toLowerCase();
  if (tab.indexOf("fumo") >= 0 || tab.indexOf("vapeo") >= 0) cl.push("consume tabaco o nicotina");
  const alc = String(enc.d3_31 ?? "").toLowerCase();
  if (alc.indexOf("semana") >= 0 || alc.indexOf("todos") >= 0) {
    cl.push("consume alcohol con frecuencia");
  }
  const est = num(enc.d3_29);
  if (est !== null && est >= 7) cl.push("refiere estrés elevado (" + est + "/10)");
  const sue = String(enc.d3_26 ?? "");
  if (sue === "Menos de 5h" || sue === "5–6 horas") {
    cl.push("duerme de forma insuficiente (" + sue.toLowerCase() + ")");
  }
  const dieta = dietaCoarse(enc);
  if (dieta) cl.push("mantiene " + dieta);

  if (!cl.length) return "";
  return sujeto(enc) + " " + cl.join("; ") + ".";
}

/** Párrafo del ENTRENADOR: actividad, masa magra, hidratación y estrés. */
export function resumenEjercicioParrafo(enc: Enc, bis: Bis = {}): string {
  const cl: string[] = [];
  const naf = num(enc.d3_23);
  if (naf === null) {
    // Sin dato: no se afirma nada sobre su actividad. (Su comentario: `/* sin dato */`.)
  } else if (naf <= 0) {
    cl.push("no realiza actividad física actualmente");
  } else {
    let base = "realiza actividad física " + naf + (naf === 1 ? " día" : " días") + " por semana";
    const dur = String(enc.d3_24 ?? "");
    if (dur) base += ", con sesiones de " + dur.toLowerCase();
    cl.push(base);
    const tipos = arr(enc.d3_25);
    if (tipos.length) cl.push("de tipo " + lista(lower(tipos)));
  }
  const ffk = ffmiCat(enc, bis);
  if (ffk === 1) cl.push("con masa magra baja, a vigilar en la prescripción");

  const agua = num(enc.d7_agua);
  if (agua !== null) {
    cl.push(
      agua >= 6
        ? "buen consumo de líquidos (" + agua + " vasos de agua al día)"
        : "consumo insuficiente de líquidos (" +
            agua +
            " vaso" +
            (agua === 1 ? "" : "s") +
            " de agua al día)",
    );
  }
  const est = num(enc.d3_29);
  if (est !== null && est >= 7) {
    cl.push("estrés elevado (" + est + "/10) que puede afectar la recuperación");
  }
  const dieta = dietaCoarse(enc);
  if (dieta) cl.push("y mantiene " + dieta);

  if (!cl.length) return "";
  return sujeto(enc) + " " + cl.join("; ") + ".";
}

/** Párrafo del PSICÓLOGO: percepción corporal contra la composición objetiva, y conducta. */
export function resumenPsicoParrafo(enc: Enc, bis: Bis = {}): string {
  const cl: string[] = [];
  const perc = String(enc.d2_19 ?? "");
  const percMap: Record<string, string> = {
    "Muy delgado/a": "bajo",
    "Delgado/a": "bajo",
    Normal: "normal",
    Sobrepeso: "exceso",
    Obesidad: "exceso",
  };
  const objK = fmiCat(enc, bis);
  const objTxt: Record<number, string> = {
    1: "grasa corporal baja",
    2: "grasa corporal normal",
    3: "grasa corporal en exceso",
  };
  // La pieza clínica del párrafo: la DISCORDANCIA entre cómo se ve el paciente y lo que mide el equipo.
  if (perc && percMap[perc] !== undefined && objK !== null) {
    const pc = percMap[perc];
    const oc = objK === 1 ? "bajo" : objK === 2 ? "normal" : "exceso";
    if (pc !== oc) {
      cl.push(
        "presenta una discordancia entre su percepción corporal (se percibe con " +
          perc.toLowerCase() +
          ") y la composición corporal objetiva (" +
          objTxt[objK] +
          ")",
      );
    } else {
      cl.push(
        "presenta una percepción corporal congruente con su composición corporal objetiva (" +
          objTxt[objK] +
          ")",
      );
    }
  } else if (objK !== null) {
    cl.push("presenta " + objTxt[objK] + " en la composición corporal objetiva");
  }

  const sat = String(enc.d2_20 ?? "");
  if (sat === "Muy insatisfecho/a" || sat === "Insatisfecho/a") {
    cl.push("con insatisfacción respecto a su peso");
  }
  const ctrl = String(enc.d2_22 ?? "");
  if (ctrl === "A veces" || ctrl === "Frecuentemente" || ctrl === "Siempre") {
    cl.push("con episodios de pérdida de control al comer");
  }
  const met = arr(enc.d2_21).filter(
    (x) =>
      ["ayunos", "saltar comidas", "laxantes", "vómito", "ejercicio excesivo"].indexOf(
        String(x).toLowerCase(),
      ) >= 0,
  );
  if (met.length) cl.push("con conductas de riesgo (" + lista(lower(met)) + ")");

  const est = num(enc.d3_29);
  if (est !== null) {
    cl.push(
      "con un nivel de estrés " +
        (est <= 3 ? "bajo" : est <= 6 ? "moderado" : "alto") +
        " (" +
        est +
        "/10)",
    );
  }
  const sq = String(enc.d3_27 ?? "");
  if (sq === "Muy mala" || sq === "Mala") cl.push("y mala calidad del sueño");

  if (!cl.length) return "";
  return sujeto(enc) + " " + cl.join("; ") + ".";
}
