// Peso meta y su DEFAULT (fórmula de Lorentz) — ciencia de Gildardo, portada FIEL de
// docs/entregas/gildardo-2026-07/atlas-motores-tratamiento.js (motorTratNutri, L16-18). TS puro.
//
// Nota 3 de Gildardo (respuesta 2026-08-09, D-002): el peso meta tiene un DEFAULT que, si el
// profesional no lo fija, se usa SIN QUE NADIE LO NOTE; y como la proteína se calcula sobre ese peso
// (protG = protKg × pesoMeta), la prescripción cambia en silencio. Por eso Atlas lo hace VISIBLE
// (superficie de tratamiento) y lo computa aquí, no oculto en el cálculo.
//
// pesoAjust (L17 del motor: `imc>=25 ? PI+0.25*(pesoAct-PI) : pesoAct`) es código muerto en el
// motorTratNutri de Gildardo (protG usa pesoMeta), así que NO se porta AQUÍ. OJO (C2, 2026-08-11): en el
// motorProtocolo congelado de Atlas SÍ está vivo, es el `pesoCalculo` sobre el que hoy se prescribe a todo
// IMC≥25. La sub-tarea 2 del re-port lo retira y cablea este default de Lorentz en su lugar (gated por la
// confirmación C2 de Gildardo). No confundir: acá se porta el DEFAULT del peso meta, no el pesoAjust.

// Peso ideal de Lorentz (kg), por sexo. talla en cm. Verbatim del motor (L16).
export function pesoIdealLorentz(tallaCm: number, sexoM: boolean): number {
  return sexoM
    ? tallaCm - 100 - (tallaCm - 150) / 4
    : tallaCm - 100 - (tallaCm - 150) / 2.5;
}

export type PesoMetaDefault = {
  valor: number; // el peso meta por defecto (kg)
  fuente: "lorentz" | "peso_actual"; // de dónde salió, para poder DECIRLO en pantalla
  imc: number;
};

// Default del peso meta cuando el profesional no registró uno (motorTratNutri L18): si el IMC está
// FUERA de 18.5-25 usa el peso ideal de Lorentz (redondeado, mínimo 1); dentro del rango usa el peso
// actual. Devuelve además la fuente para que la UI diga "calculado, porque no se registró uno".
export function pesoMetaDefault(pesoActKg: number, tallaCm: number, sexoM: boolean): PesoMetaDefault {
  const tallaM = tallaCm / 100;
  const imc = tallaM > 0 ? pesoActKg / (tallaM * tallaM) : 0;
  if (imc >= 25 || imc < 18.5) {
    return { valor: Math.max(1, Math.round(pesoIdealLorentz(tallaCm, sexoM))), fuente: "lorentz", imc };
  }
  return { valor: pesoActKg, fuente: "peso_actual", imc };
}
