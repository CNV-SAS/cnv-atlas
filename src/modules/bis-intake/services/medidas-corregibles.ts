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
