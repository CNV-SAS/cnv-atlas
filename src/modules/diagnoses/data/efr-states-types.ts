// Tipo NEUTRO (sin server-only) del contenido de referencia de un estado EFR. Vive aparte del reader
// server-only para que un componente cliente lo importe sin arrastrar el reader al boundary de cliente
// (hazard RSC latente; ver client-import-server-only-rompe-prod). El reader lo reexporta para el server.
export type EfrStateRef = {
  stateNumber: number;
  diagnosisName: string;
  mechanism: string | null;
  biomarkers: string | null;
  risks: string | null;
  suggestedNutraceuticals: string | null;
};

/**
 * Rotulo del quinto campo clinico del estado EFR, PORTADO de su archivo (2026-09-09).
 *
 * VIVE AQUI, en el modulo neutro, porque lo pintan DOS superficies que se leen juntas: la ficha del
 * paciente y el panel del estado explorado, lado a lado al comparar. Escrito dos veces es como se
 * consigue que el mismo campo parezca dos cosas distintas en dos columnas contiguas. Y el candado
 * `diana-bloque-sin-repetir` lo lee de aqui en vez de llevar una tercera copia.
 *
 * DOS PUNTOS Y NO RAYA (Santiago, 2026-09-09). Su archivo lo escribe con em-dash y yo lo porte verbatim,
 * que era portar tambien una infraccion de nuestra propia regla (CLAUDE.md: nunca em-dash, en ningun
 * sitio). Los dos puntos dicen lo mismo (la linea, y lo que la linea es) y respetan la regla.
 *
 * ANTES DECIA "Nutracéuticos sugeridos", por una excepcion de negocio nuestra ("a futuro puede haber
 * otras lineas"). Santiago la revierte con una razon que es del CONTENIDO y no de la marca: no es un
 * producto que se venda por vender, es parte del TRATAMIENTO derivado del estado, y "sugeridos" lo dejaba
 * sonando a recomendacion suelta.
 */
export const ROTULO_NUTRACEUTICOS = "VITACELLEBIS: Nutracéuticos indicados para este estado";
