// Parrafo de dieta del Resumen Clinico (patron alimentario, de la encuesta).
//
// PORTE FIEL, MODULO DERIVADO (pieza 1b, 2026-08-22). Transcripcion verbatim de _resumenNutriParrafo del
// prototipo de Gildardo (ATLAS_v8.html 2026-08-19, L13013-13057). Es el PRIMERO de los dos parrafos del
// Resumen Clinico; el segundo (funcional) lo porto dfi-narrative (1a.1). No toca el frozen; su paridad se
// prueba con un GOLDEN DIFERENCIAL contra la propia funcion de Gildardo (fixtures/reference/resumen-dieta-vigente.js).
//
// FORMA DEL `enc` (critico): la funcion lee los campos de FRECUENCIA como INDICE 0-4 (toNum), pero Atlas
// guarda el TEXTO de la opcion. El reader convierte texto->ordinal con la MISMA CANON del motor de patron
// (FREQ_OPC / FREQ_SUP), que ya tiene acoplamiento probado char-by-char: una sola tabla, no dos que puedan
// divergir. Los campos de CONTEXTO (d8_59/60/61/62) se leen por TEXTO crudo; los contadores (d7_agua/55/56)
// por numero. Si no se convirtiera el texto de frecuencia a ordinal, toNum daria null y TODOS los grupos se
// saltarian EN SILENCIO (el parrafo saldria incompleto sin avisar): por eso el reader lo hace y hay candado.
//
// Texto USER-FACING (lo lee el profesional): tildes y enes correctas, verbatim de la fuente.

import { FREQ_GROUPS } from "./frozen/engine.patron.js";

type FreqGroup = { n: number | string; cat: string; label: string };

function toNum(v: unknown): number | null {
  const n = Number(v);
  return v != null && v !== "" && !isNaN(n) ? n : null;
}

function listar(a: string[]): string {
  if (a.length <= 1) return a[0] || "";
  return a.slice(0, -1).join(", ") + " y " + a[a.length - 1];
}

const PREP_MAP: Record<string, string> = {
  "Yo mismo/a": "sus alimentos los prepara la propia persona",
  "Un familiar": "sus alimentos los prepara un familiar",
  "Restaurante o fonda": "se alimenta principalmente de restaurante o fonda",
  "Cafetería / comedor": "se alimenta principalmente de cafetería o comedor",
};
const CF_MAP: Record<string, string> = {
  Nunca: "no come fuera de casa",
  "1–2 veces/semana": "come fuera de casa 1 a 2 veces por semana",
  "3–4 veces/semana": "come fuera de casa 3 a 4 veces por semana",
  "Todos los días": "come fuera de casa todos los días",
};
const DES_MAP = ["desayuna todos los días", "desayuna solo a veces (3 a 4 días)", "rara vez o nunca desayuna"];
const CENA_MAP = [
  "cena antes de las 7 pm",
  "cena entre las 7 y las 8 pm",
  "cena entre las 8 y las 9 pm",
  "cena después de las 9 pm",
];

// Textos de opcion que el parrafo RECONOCE por campo de contexto (d8_*), leidos por TEXTO crudo. Es el
// ACOPLAMIENTO que el candado (resumen-dieta-coupling.test) verifica contra el seed: si manana cambia un
// texto de opcion en la encuesta y aqui no, el campo deja de reconocerse y el parrafo sale incompleto EN
// SILENCIO. Los de frecuencia (d1_N_i, d1f_*) no van aqui: los cubre la CANON del patron (FREQ_OPC/FREQ_SUP),
// que ya tiene su candado compartido. "Otra" (d8_59) no se lista: es texto libre, sin frase canonica.
export const DIET_CONTEXT_TEXTS: Record<string, string[]> = {
  d8_59: Object.keys(PREP_MAP),
  d8_60: Object.keys(CF_MAP),
  d8_61: ["Sí, siempre", "A veces es difícil", "Generalmente es difícil"],
  d8_62: ["No, nunca", "A veces", "Frecuentemente"],
};

// Reconstruye el parrafo de dieta desde `enc` (frecuencia como ordinal, contexto como texto, contadores como
// numero). Devuelve "" cuando no hay NADA que decir (ninguna respuesta legible): el llamador NO debe mostrar
// el parrafo en ese caso (mejor omitirlo que mostrar uno vacio/roto).
export function resumenDietaParrafo(enc: Record<string, unknown>): string {
  const suj = String(enc.sexo ?? "").toLowerCase().charAt(0) === "f" ? "La paciente" : "El paciente";
  const defic: string[] = [];
  const riesgo: string[] = [];
  for (const g of FREQ_GROUPS as FreqGroup[]) {
    const val = toNum(enc["d1_" + g.n + "_i"]);
    if (val === null) continue;
    if (g.cat === "protector" && val <= 1) defic.push(g.label.toLowerCase());
    else if (g.cat === "riesgo" && val >= 3) riesgo.push(g.label.toLowerCase());
  }
  const dietParts: string[] = [];
  if (defic.length) dietParts.push("bajo consumo de " + listar(defic));
  if (riesgo.length) dietParts.push("consumo elevado de " + listar(riesgo));

  const prep = String(enc.d8_59 ?? "");
  const cf = String(enc.d8_60 ?? "");
  const des = toNum(enc.d1f_des_i);
  const cena = toNum(enc.d1f_noche_i);
  const sal = toNum(enc.d1f_sal_i);
  const ins = String(enc.d8_62 ?? "");
  const acc = String(enc.d8_61 ?? "");
  const agua = toNum(enc.d7_agua);
  const gas = toNum(enc.d7_55);
  const ener = toNum(enc.d7_56);

  const otros: string[] = [];
  if (PREP_MAP[prep]) otros.push(PREP_MAP[prep]);
  if (CF_MAP[cf]) otros.push(CF_MAP[cf]);
  if (des !== null && DES_MAP[des]) otros.push(DES_MAP[des]);
  if (cena !== null && CENA_MAP[cena]) otros.push(CENA_MAP[cena]);
  if (sal !== null && sal >= 2) otros.push("añade sal extra a la comida ya servida");
  if (ins === "No, nunca") otros.push("no presenta inseguridad alimentaria");
  else if (ins === "A veces") otros.push("presenta inseguridad alimentaria ocasional");
  else if (ins === "Frecuentemente") otros.push("presenta inseguridad alimentaria frecuente");
  if (acc === "Sí, siempre") otros.push("con acceso fácil a alimentos frescos y saludables");
  else if (acc === "A veces es difícil") otros.push("con acceso a veces difícil a alimentos frescos");
  else if (acc === "Generalmente es difícil") otros.push("con acceso generalmente difícil a alimentos frescos");
  if (agua !== null) {
    let liq =
      agua >= 6
        ? "mantiene un buen consumo de líquidos (" + agua + " vasos de agua al día)"
        : "tiene un consumo insuficiente de líquidos (" + agua + " vaso" + (agua === 1 ? "" : "s") + " de agua al día)";
    if ((gas && gas > 0) || (ener && ener > 0)) liq += " y consume bebidas azucaradas o energéticas";
    otros.push(liq);
  }

  const cl: string[] = [];
  if (dietParts.length) cl.push("evidencia " + dietParts.join(", y "));
  else if (otros.length) cl.push("no muestra grupos de alimentos claramente deficitarios ni en exceso");
  cl.push(...otros);
  if (!cl.length) return "";
  return suj + " " + cl.join("; ") + ".";
}
