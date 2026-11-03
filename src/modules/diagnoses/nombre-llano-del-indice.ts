// ══════════════════════════════════════════════════════════════════════════════════════════════════
// EL NOMBRE LLANO DE CADA INDICE ANI-BIS-E  ·  UNA SOLA FUENTE PARA LA HC Y LA PANTALLA
//
// ═══ DE DONDE SALE (Santiago, 2026-11-03) ═══
//
// Mirando la HC descargada: *"en los indicadores anibise de dicha tabla se muestran «Hidro-Homeostasis
// IEHH», «PABU», «Desviación de φ ICA-BIS». Entonces propongo que los cambiemos a definiciones que los
// pacientes puedan entender y justo debajo se coloca el nombre del indicador, así como tenemos a
// «Aceleración del Envejecimiento IAE», que me parece muy bien hecho... No estamos cambiando los
// indicadores, solo la forma en como mostramos la info al paciente para que pueda entenderlo."*
//
// Y ESA DISTINCION ES LA QUE SOSTIENE ESTE MODULO. La ciencia, los codigos y los nombres oficiales son de
// Gildardo y viven donde siempre: `clinical-engine/registry-data.ts` los fija (su §10 del 2026-08-09, "uno
// solo por indicador, en todas las vistas") y la BD los sirve desde `indicator_definitions`. Aqui no se
// toca ninguno. Lo que hay aqui es la capa de PRESENTACION: como se nombra ese mismo indice para alguien
// que no lo conoce, con su sigla al lado para que siga siendo identificable.
//
// VA AL DOCUMENTO DE DUDAS COMO "APLICADO, CONFIRMA", porque aunque sea presentacion, nombra sus indices.
//
// ═══ POR QUE UN MODULO Y NO TRES ROTULOS ═══
//
// Porque los tres sitios que los pintan ya se habian desincronizado una vez: la HC usaba los nombres de SU
// tabla de HC ("Hidro-Homeostasis"), la pantalla de resultados el nombre oficial de la BD ("Índice del
// Estado de Hidratación Humana") y el informe del paciente NO LOS NOMBRA (su §7.1 lo prohibe y un candado
// lo sostiene). Dos vocabularios para el mismo indice es lo que hace que un profesional y un paciente
// hablen de cosas distintas creyendo que hablan de la misma.
//
// ═══ LAS TRES DECISIONES DE ROTULO, UNA POR UNA ═══
//
//   IEHH   "Hidro-Homeostasis" -> "Equilibrio hídrico". Es literalmente lo que su nombre oficial dice
//          ("Índice del Estado de Hidratación Humana") en palabras de todos los dias.
//
//   PABU   sin nombre -> "Proporción bioeléctrica". Su fila de la HC no trae nombre, y hasta hoy se dejaba
//          vacia a proposito ("no se inventa uno para un documento clinico"). Santiago pide uno; se pone
//          el mas corto que es cierto, porque su nombre oficial ("Proporción Áurea Bioeléctrica de Uribe")
//          no se puede abreviar sin perder a su autor.
//
//   ICA-BIS "Desviación de φ" -> "Desviación bioeléctrica", Y NO "Coherencia bioeléctrica".
//
//          ES LA UNICA DONDE ME APARTO DE LO QUE SE PIDIO, y la razon es la cifra que va al lado: este
//          numero ES una desviacion, y su columna de referencia dice "0.00-0.15 Zona φ", o sea que CUANTO
//          MAS PEQUEÑO, MEJOR. Rotular "Coherencia bioeléctrica" encima de un valor donde lo bueno es lo
//          bajo invierte la lectura: un 0,15 se leeria como poca coherencia cuando es justo la zona buena.
//          "Desviación bioeléctrica" (que es la propia primera propuesta de Santiago) conserva el nombre
//          llano y la direccion del numero. Va al documento de dudas con las dos opciones.
//
// Las otras cinco filas NO SE TOCAN: sus nombres de la HC ya son llanos y son los de su archivo ("Función
// Celular", "Riesgo Celular", "Síndrome Celular", "Aceleración del Envejecimiento") o los fijo su tabla 3
// ("Edad biológica estimada"). Cambiarlos seria mover lo que ya se entiende.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * Nombre llano por codigo de indice. Solo los que CAMBIAN respecto al nombre que ya traia su fila: lo que
 * no esta aqui conserva el suyo, y asi este mapa no puede quedarse desactualizado respecto a su archivo.
 */
const NOMBRE_LLANO: Record<string, string> = {
  IEHH: "Equilibrio hídrico",
  PABU: "Proporción bioeléctrica",
  "ICA-BIS": "Desviación bioeléctrica",
};

/**
 * El nombre llano de un indice, o `null` si su rotulo no cambia.
 *
 * Devuelve null en vez del nombre oficial A PROPOSITO: quien llama decide con que se queda cuando no hay
 * traduccion, y asi la HC conserva el nombre de su archivo y la pantalla el oficial de la BD sin que este
 * modulo tenga que conocer las dos reglas.
 */
export function nombreLlanoDelIndice(codigo: string): string | null {
  return NOMBRE_LLANO[codigo] ?? null;
}

/** Los codigos que llevan nombre llano propio. Para los candados, que no lo escriban a mano. */
export const CODIGOS_CON_NOMBRE_LLANO = Object.keys(NOMBRE_LLANO);
