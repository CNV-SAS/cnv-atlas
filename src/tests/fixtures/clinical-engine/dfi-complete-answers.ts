// Fuente UNICA de un juego de respuestas que deja dfi.complete = true. Alineado al perfil documentado
// que el golden del DFI empareja con el BIS de la semilla (encuesta-sintetica.json: "hombre 54a, IMC
// 27.5, sobrepeso leve, sedentario moderado, sin TCA, 1 antecedente familiar"), pero expresado con las
// OPCIONES REALES de la encuesta, elegidas por indice/texto sobre las opciones ya sembradas, para que
// el acoplamiento caracter-por-caracter con el motor no dependa de reescribir cadenas con en-dash.
// multi = se guarda como JSON de option_text, como el intake real.
//
// COMPARTIDA a proposito: la consumen golden-path.seed (perfil completo) y el test del flujo de
// correccion (completar una pregunta con field_key y ver moverse dfi.complete). Tener DOS copias del
// mapa duplicaria el acoplamiento fragil que `frozen-survey-texts.ts` advierte (un texto editado en un
// lado apagaria un flag en silencio). Una sola fuente.
export type Pick = { multi: boolean; idx?: number; text?: string };

export const DFI_COMPLETE_ANSWERS: Record<string, Pick> = {
  d2_19: { multi: false, idx: 3 }, // percepcion corporal: Sobrepeso (coherente con IMC 27.5)
  d2_20: { multi: false, idx: 1 }, // satisfaccion con el peso: Insatisfecho/a
  d2_21: { multi: true, text: "Ninguno" }, // metodos para cambiar peso: ninguno (sin conducta de riesgo)
  d2_22: { multi: false, idx: 1 }, // pierde control al comer: Rara vez
  d3_23: { multi: false, idx: 2 }, // dias de actividad fisica: 2 (sedentario moderado)
  d3_24: { multi: false, idx: 2 }, // duracion de la sesion: 30-45 min
  d3_26: { multi: false, idx: 2 }, // horas de sueno: 6-7 horas
  d3_30: { multi: false, idx: 0 }, // tabaco: Nunca he fumado
  d3_31: { multi: false, idx: 1 }, // alcohol: 1-2 veces al mes (ocasional)
  d5_36: { multi: false, idx: 1 }, // HTA diagnosticada: No
  d5_38: { multi: true, text: "DM2 (diabetes)" }, // 1 antecedente familiar: DM2
  d5_39: { multi: true, text: "Ninguna" }, // diagnosticos personales: Ninguna
  d8_61: { multi: false, idx: 0 }, // acceso a alimentos frescos: Si, siempre
  d8_62: { multi: false, idx: 0 }, // suficiente comida en el hogar: No, nunca

  // Patron alimentario (C9): los 15 grupos (idx sobre FREQ_OPC: 0=Nunca .. 4=Todos los dias) + 3
  // horarios. Alimentan el DISPLAY del patron (used_in_diagnosis=false); NO mueven dfi.complete ni el
  // golden del DFI (calcLE8 no lee d1_N_i). Perfil COHERENTE con el paciente demo (hombre 54a, IMC 27.5
  // sobrepeso leve, sedentario, con acceso a alimentos, insatisfecho con su peso): dieta moderada en
  // todo, con carne roja y dulces frecuentes, para que la pantalla muestre un patron realista a mejorar.
  d1_1_i: { multi: false, idx: 2 }, // Verduras: 3-4 d/sem
  d1_2_i: { multi: false, idx: 2 }, // Frutas: 3-4 d/sem
  d1_3_i: { multi: false, idx: 2 }, // Leguminosas: 3-4 d/sem
  d1_4_i: { multi: false, idx: 1 }, // Pescado: 1-2 d/sem
  d1_5_i: { multi: false, idx: 2 }, // Grasas saludables: 3-4 d/sem
  d1_6_i: { multi: false, idx: 2 }, // Lacteos y fermentados: 3-4 d/sem
  d1_7_i: { multi: false, idx: 3 }, // Huevos: 5-6 d/sem
  d1_8_i: { multi: false, idx: 2 }, // Cereales integrales: 3-4 d/sem
  d1_9_i: { multi: false, idx: 3 }, // Tuberculos: 5-6 d/sem
  d1_10_i: { multi: false, idx: 2 }, // Carnes blancas: 3-4 d/sem
  d1_15_i: { multi: false, idx: 3 }, // Carnes rojas: 5-6 d/sem (aparece en la grilla; ver inconsistencia Moderados)
  d1_11_i: { multi: false, idx: 2 }, // Cereales refinados: 3-4 d/sem
  d1_12_i: { multi: false, idx: 2 }, // Carnes procesadas: 3-4 d/sem
  d1_13_i: { multi: false, idx: 3 }, // Azucares y dulces: 5-6 d/sem
  d1_14_i: { multi: false, idx: 2 }, // Ultraprocesados: 3-4 d/sem
  d1f_sal_i: { multi: false, idx: 1 }, // Sal extra: Rara vez
  d1f_des_i: { multi: false, idx: 0 }, // Desayuna: Si, todos los dias
  d1f_noche_i: { multi: false, idx: 2 }, // Cena: entre 8 y 9 pm
};

// Resuelve el value a guardar (option_text, o JSON de [option_text] si es multi) dado el catalogo de
// textos de la pregunta. Lanza si la opcion elegida no existe (desalineacion semilla <-> fixture).
export function resolveAnswerValue(texts: string[], pick: Pick): string {
  const chosen = pick.text ?? texts[pick.idx ?? 0];
  if (!texts.includes(chosen)) {
    throw new Error(`dfi-complete-answers: opcion no encontrada: ${chosen}`);
  }
  return pick.multi ? JSON.stringify([chosen]) : chosen;
}

// Respuesta valida POR DEFECTO para una pregunta que no tiene pick especifico. El gate ahora exige las 64
// respondidas (Gildardo §1), asi que un fixture "completo" debe cubrir TODAS, no solo las del diagnostico.
// Para las que no importan al motor, cualquier respuesta valida sirve; esto simula un intake completo.
export function defaultAnswerFor(type: string, texts: string[]): string {
  if (type === "contador") return "0"; // 0 explicito (como el boton "Ninguno" del intake)
  if (type === "escala") return "5";
  if (type === "opcion_multiple") {
    const ninguna = texts.find((t) => /^ningun[ao]$/i.test(t));
    return JSON.stringify([ninguna ?? texts[0] ?? "Ninguna"]);
  }
  if (type === "opcion") return texts[0] ?? "";
  return "n/a"; // texto
}
