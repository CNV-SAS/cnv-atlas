// ═══ LAS RESPUESTAS DE LA ENCUESTA, EN COLORES (porte del ATLAS_v9, 2026-09-21) ═══
//
// QUE ES: el cambio 1 de su v9. De D2 a D8 cada respuesta se muestra en una pastilla de color, con los
// mismos colores que ya usaba D1 (verde adecuado, ambar vigilar, rojo atencion). Su clasificador es
// `_encClf(campo, valor)` dentro de `ModDiagnostico` (ATLAS_v9.html), y esto lo porta VERBATIM: mismos
// campos, mismas opciones, mismo orden de las ramas.
//
// NINGUN PUNTO DE CORTE ES NUESTRO, ni suyo nuevo: su guia lo declara y se comprobo. Cada regla sale de
// algo que su archivo ya usaba (el LE8 para actividad fisica, sueño y tabaco; los avisos del motor para la
// perdida de control al comer, el estres y la orina; la propia encuesta para las conductas de riesgo de la
// pregunta 21; y el orden que declaran las opciones, como "Nunca ... Siempre").
//
// EL GRIS NO ES "NORMAL", y es la regla que mas cuesta sostener: *"Gris no significa normal: significa que
// ATLAS registra el dato pero no emite juicio sobre el"* (su guia). Todo campo que no esta en su lista cae
// en `informativo`, no en `adecuado`. Percepcion corporal, comidas al dia, patron alimentario, suplementos,
// medicamentos... quedan sin juicio porque el no les puso criterio, y ponerles uno por defecto seria
// inventar contenido clinico (Regla 0).
//
// PURO: sin app, sin React, sin Supabase (regla dura 12). Recibe el valor ya leido.

export type NivelRespuesta = "adecuado" | "vigilar" | "atencion" | "informativo" | "sin_dato";

/** Un valor de la encuesta: una opcion, varias (multiple) o un numero. */
export type ValorEncuesta = string | number | string[] | null | undefined;

const texto = (v: ValorEncuesta): string =>
  Array.isArray(v) ? v.join(", ") : v == null ? "" : String(v);

// Su tabla de minutos por sesion, verbatim: el punto medio de cada rango, para multiplicar por los dias.
const MINUTOS_POR_SESION: Record<string, number> = {
  "0 minutos a la semana": 0,
  "Menos de 15": 10,
  "15–30 min": 22,
  "30–45 min": 37,
  "45–60 min": 52,
  "Más de 60 min": 75,
};

/**
 * El nivel de una respuesta de D2 a D8.
 *
 * @param campo   El `field_key` de la pregunta (`d3_26`).
 * @param valor   Su respuesta.
 * @param encuesta Todas las respuestas, por `field_key`: la actividad fisica (`d3_23`, `d3_24`) se juzga
 *                con las dos juntas, dias por minutos, igual que en su archivo.
 */
export function nivelDeRespuesta(
  campo: string,
  valor: ValorEncuesta,
  encuesta: Record<string, ValorEncuesta>,
): NivelRespuesta {
  if (!texto(valor).trim()) return "sin_dato";
  const es = (...opciones: string[]): boolean =>
    Array.isArray(valor) ? opciones.some((o) => valor.includes(o)) : opciones.includes(String(valor));

  switch (campo) {
    case "d2_21":
      return es("Laxantes", "Vómito", "Ejercicio excesivo") ? "atencion" : es("Ninguno") ? "adecuado" : "informativo";
    case "d2_22":
      return es("Nunca", "Rara vez") ? "adecuado" : es("A veces") ? "vigilar" : "atencion";
    case "d3_23":
    case "d3_24": {
      const minutos =
        (parseInt(String(encuesta.d3_23 ?? ""), 10) || 0) * (MINUTOS_POR_SESION[String(encuesta.d3_24 ?? "")] || 0);
      return minutos >= 150 ? "adecuado" : minutos > 0 ? "vigilar" : "atencion";
    }
    case "d3_25":
      return es("Ninguna") && (!Array.isArray(valor) || valor.length === 1) ? "atencion" : "adecuado";
    case "d3_26":
      return es("7–8 horas") ? "adecuado" : es("6–7 horas", "5–6 horas") ? "vigilar" : "atencion";
    case "d3_27":
      return es("Buena", "Muy buena") ? "adecuado" : es("Regular") ? "vigilar" : "atencion";
    case "d3_28":
      return es("No") ? "adecuado" : "vigilar";
    case "d3_29": {
      const n = Number(valor);
      if (!Number.isFinite(n) || n <= 0) return "sin_dato";
      return n <= 3 ? "adecuado" : n <= 6 ? "vigilar" : "atencion";
    }
    case "d3_30":
      return es("Nunca he fumado", "Dejé hace 5 años o más")
        ? "adecuado"
        : es("Dejé hace menos de 5 años", "Exposición pasiva")
          ? "vigilar"
          : "atencion";
    case "d3_31":
      return es("Nunca", "1–2 veces al mes") ? "adecuado" : es("1–2 veces a la semana") ? "vigilar" : "atencion";
    case "d4_33":
      return es("Siempre", "Casi siempre") ? "adecuado" : es("A veces") ? "vigilar" : "atencion";
    case "d5_36":
      return es("No") ? "adecuado" : es("No sé") ? "vigilar" : "atencion";
    case "d5_37":
      return es("No") ? "adecuado" : "vigilar";
    case "d5_42":
      return es("Ninguna") ? "adecuado" : "vigilar";
    case "d6_43":
    case "d6_44":
      return es("Ninguna") ? "adecuado" : "vigilar";
    case "d6_45":
    case "d6_46":
    case "d6_47":
    case "d6_48":
    case "d6_49":
    case "d6_50":
    case "d6_51":
      return es("Nunca") ? "adecuado" : es("A veces") ? "vigilar" : "atencion";
    case "d7_57":
      return es("Nunca", "Rara vez") ? "adecuado" : es("A veces") ? "vigilar" : "atencion";
    case "d7_58":
      return es("Transparente", "Amarillo claro") ? "adecuado" : es("Amarillo") ? "vigilar" : "atencion";
    case "d8_60":
      return es("Nunca", "1–2 veces/semana") ? "adecuado" : es("3–4 veces/semana") ? "vigilar" : "atencion";
    case "d8_61":
      return es("Sí, siempre") ? "adecuado" : es("A veces es difícil") ? "vigilar" : "atencion";
    case "d8_62":
      return es("No, nunca") ? "adecuado" : es("A veces") ? "vigilar" : "atencion";
    default:
      return "informativo";
  }
}

/**
 * Sus colores, verbatim (`ENC_OK`, `ENC_MED`, `ENC_ALT`, `ENC_INFO`, `ENC_NA`). Son los mismos tres de D1
 * mas los dos grises. Se exportan con el nivel para que la pantalla no decida el color por su cuenta.
 */
export const COLOR_DE_NIVEL: Record<NivelRespuesta, string> = {
  adecuado: "#059669",
  vigilar: "#d97706",
  atencion: "#dc2626",
  informativo: "#64748b",
  sin_dato: "#94a3b8",
};
