// Clasificacion antropometrica por UMBRALES MEDICOS ESTANDAR (OMS/WHO). NO es ciencia congelada
// ANI-BIS-E ni output del motor: son cutoffs universales publicados, que se usan como REFERENCIA
// DE DISPLAY. La UI debe rotularlos como referencia OMS, no como diagnostico del modelo.
//
// Fuentes:
//   - IMC (kg/m2): OMS clasificacion de peso (18.5 / 25 / 30 / 35 / 40).
//   - Circunferencia de cintura (cm): OMS riesgo cardiovascular (H 94/102 · M 80/88).
//   - Indice cintura-talla (ICT): 0.4 / 0.5 / 0.6.
// sev: 0 optimo · 1 leve/vigilar · 2 alerta · 3 alto (para la capa de color clinica de BRAND).

export type AnthroClass = { label: string; sev: number };

export function clasificarIMC(imc: number | null): AnthroClass | null {
  if (imc == null) return null;
  if (imc < 18.5) return { label: "Bajo peso", sev: 1 };
  if (imc < 25) return { label: "Normal", sev: 0 };
  if (imc < 30) return { label: "Sobrepeso", sev: 1 };
  if (imc < 35) return { label: "Obesidad I", sev: 2 };
  if (imc < 40) return { label: "Obesidad II", sev: 3 };
  return { label: "Obesidad III", sev: 3 };
}

// sexoM: true si masculino. Los umbrales de cintura difieren por sexo.
export function clasificarCintura(cc: number | null, sexoM: boolean): AnthroClass | null {
  if (cc == null) return null;
  if (cc < (sexoM ? 94 : 80)) return { label: "Sin riesgo CV", sev: 0 };
  if (cc < (sexoM ? 102 : 88)) return { label: "Riesgo CV aumentado", sev: 1 };
  return { label: "Riesgo CV elevado", sev: 2 };
}

export function clasificarICT(ict: number | null): AnthroClass | null {
  if (ict == null) return null;
  if (ict < 0.4) return { label: "Delgadez", sev: 1 };
  if (ict < 0.5) return { label: "Saludable", sev: 0 };
  if (ict < 0.6) return { label: "Exceso, riesgo moderado", sev: 1 };
  return { label: "Riesgo alto", sev: 2 };
}
