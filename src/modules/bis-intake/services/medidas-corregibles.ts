import { BIODY_COLUMNS } from "@/clinical-engine";
import { MEASURED_HIPS_HEADER, MEASURED_WAIST_HEADER, normalizeHeader } from "@/modules/bis/services/header-map";

// LAS MEDIDAS QUE EL PROFESIONAL PUEDE CORREGIR, y su traduccion al nombre con el que viven en
// `bis_raw_values`. **Este es el UNICO sitio donde se hace esa traduccion.**
//
// POR QUE IMPORTA TANTO: los crudos NO se guardan como "cintura" ni "peso", sino con el encabezado
// NORMALIZADO del export del Biody ("Waist Size cm", "Peso kg"). Escribir una correccion con el nombre
// corto la deja sin coincidir con nada: se guarda, no la lee nadie, y la pantalla muestra el valor
// viejo como si no hubiera pasado nada. Eso paso (smoke del 2026-08-27) y es un fallo mudo.
//
// LA CINTURA Y LA CADERA NO SALEN DE BIODY_COLUMNS: usan la circunferencia MEDIDA plana del export
// (Waist/Hips Size cm), no el umbral de referencia. Confundirlas es la familia del bug de cintura que
// ya esta anotada en composition-map.
//
// El candado (medidas-corregibles.test.ts) comprueba que CADA campo editable resuelve a un header no
// vacio: agregar uno nuevo sin su equivalente pone el test en rojo en vez de fallar en silencio.
export const MEDIDAS_CORREGIBLES = {
  peso: BIODY_COLUMNS.peso?.header ?? "",
  talla: BIODY_COLUMNS.talla?.header ?? "",
  cintura: MEASURED_WAIST_HEADER,
  cadera: MEASURED_HIPS_HEADER,
} as const;

/**
 * EL RANGO DE CADA MEDIDA, CON SU PISO (2026-09-25).
 *
 * El schema de la correccion tenia `positive().max(400)` y su propio comentario decia para que: "atrapar el
 * dedo gordo: una talla de 1770 o un peso de 8 no son correcciones, son errores de tecleo". Pero solo se puso
 * el TECHO, asi que "1,75" (la estatura en METROS, que es como la dice la gente) se guardaba como una talla
 * de 1,75 cm y entraba al motor: al IMC, al ICT y a todo lo que cuelga de ellos.
 *
 * Los rangos son GENEROSOS a proposito, con el mismo criterio que las circunferencias tecleadas: atrapan una
 * unidad equivocada o un decimal perdido, no rechazan a un paciente real.
 *
 * Y NO SON TOPES CLINICOS: no limitan ningun criterio del profesional (Regla 0, 2026-08-27 §5). Son de
 * plausibilidad de la UNIDAD sobre una medida antropometrica, que es justo lo que el schema ya decia querer.
 */
export const RANGO_CORREGIBLE: Record<MedidaCorregible, { min: number; max: number; unidad: string }> = {
  peso: { min: 20, max: 350, unidad: "kilogramos" },
  talla: { min: 100, max: 230, unidad: "centímetros" },
  cintura: { min: 21, max: 249, unidad: "centímetros" },
  cadera: { min: 21, max: 249, unidad: "centímetros" },
};

export type MedidaCorregible = keyof typeof MEDIDAS_CORREGIBLES;
export const CORREGIBLES = Object.keys(MEDIDAS_CORREGIBLES) as MedidaCorregible[];

/**
 * El nombre con el que esa medida vive en `bis_raw_values`. Lanza si el campo no tiene equivalente:
 * escribir una correccion que no coincide con ningun crudo es peor que no escribirla, porque queda
 * guardada y no la consume nadie.
 */
export function variableCruda(medida: MedidaCorregible): string {
  const header = MEDIDAS_CORREGIBLES[medida];
  if (!header) {
    throw new Error(
      `medidas-corregibles: "${medida}" no tiene encabezado del Biody. Sin el, la correccion se guardaria ` +
        `con un nombre que no lee nadie. Agrega su equivalente en MEDIDAS_CORREGIBLES.`,
    );
  }
  return normalizeHeader(header);
}
