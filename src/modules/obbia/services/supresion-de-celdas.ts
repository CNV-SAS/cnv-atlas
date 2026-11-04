// ══════════════════════════════════════════════════════════════════════════════════════════════════
// LA SUPRESION DE CELDAS PEQUEÑAS  ·  k-ANONIMATO, k >= 5
//
// ═══ DE DONDE SALE, Y AHORA ES CONDICION JURIDICA ═══
//
// `DATA_GOVERNANCE.md` lo tenia escrito desde el principio: *"Supresión de celdas bajo el umbral
// (obligatoria, no opcional). Una categoría con pocos individuos identifica a la persona por la categoría
// sola"*, con k-anonimato k >= 5 como estandar. Y su ejemplo es el que lo explica mejor que ningun
// argumento: hay menos de TRES MIL personas Rrom en toda Colombia, asi que un paciente Rrom en una
// cohorte queda identificado POR LA CATEGORIA, aunque se hayan quitado el nombre y el documento.
//
// EL 2026-11-03 dejo de ser una politica pendiente: la consulta legal fija **k >= 5 y supresion de celdas
// pequeñas aplicados TECNICAMENTE en toda salida comercializable, antes de la primera venta**.
//
// ═══ Y EL CSV DE HOY YA LAS LLEVA (Santiago) ═══
//
// *"hoy trae celdas de 1 paciente (Maracaibo, 51 años). Eso no se puede descargar asi."* Y tiene razon:
// una fila que dice "Maracaibo · 1 consulta · 1 paciente · edad media 51,0" no es una cifra agregada, es
// UNA PERSONA descrita por su ciudad y su edad. El rotulo del archivo dice "agregado"; esa fila lo
// desmiente.
//
// ═══ QUE HACE, Y POR QUE NO BORRA ═══
//
// Las filas por debajo del umbral NO desaparecen: se REUNEN en una sola, "Otros (celdas suprimidas)", con
// la suma de sus consultas y de sus pacientes. Borrarlas sin mas rompe la propiedad que hace util una
// tabla de caracterizacion: que las columnas SUMEN el total. Un revisor que no cuadra una tabla no sabe
// si falta una categoria o si el dato esta mal.
//
// Y LA EDAD MEDIA DE LA FILA REUNIDA NO SE CALCULA: se deja vacia. Promediar promedios de grupos de
// tamaños distintos da un numero falso, y aqui ademas seria un numero sobre personas que precisamente se
// estan protegiendo. Un hueco rotulado es mejor que una cifra que nadie puede reproducir.
//
// ═══ EL UMBRAL SE MIDE SOBRE PACIENTES, NO SOBRE CONSULTAS ═══
//
// Una persona con cinco consultas es UNA persona: contar cinco la daria por protegida cuando esta sola en
// su celda. El k-anonimato habla de individuos.
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** El umbral. `DATA_GOVERNANCE.md` y la consulta legal del 2026-11-03: k >= 5. */
export const K_ANONIMATO = 5;

/** El rotulo de la fila que reune lo suprimido. Se nombra lo que paso, no se deja un hueco mudo. */
export const ROTULO_SUPRIMIDO = "Otros (celdas suprimidas por k-anonimato)";

/** Lo minimo que una fila necesita para poder suprimirse: su grupo y cuantas personas distintas hay. */
export type CeldaConPacientes = {
  grupo: string;
  consultas: number;
  pacientes: number;
};

/**
 * Aplica la supresion a una tabla de consolidado.
 *
 * Devuelve las filas que superan el umbral MAS, si hubo alguna por debajo, una sola fila que las reune.
 * Las cifras se conservan: lo que se pierde es a QUE categoria pertenecia cada una, que es exactamente lo
 * que reidentifica.
 */
export function conCeldasSuprimidas<T extends CeldaConPacientes>(
  filas: readonly T[],
  k: number = K_ANONIMATO,
): { visibles: T[]; suprimida: CeldaConPacientes | null; cuantasSeSuprimieron: number } {
  const visibles = filas.filter((f) => f.pacientes >= k);
  const bajo = filas.filter((f) => f.pacientes < k);
  if (bajo.length === 0) return { visibles: [...visibles], suprimida: null, cuantasSeSuprimieron: 0 };
  return {
    visibles: [...visibles],
    suprimida: {
      grupo: ROTULO_SUPRIMIDO,
      consultas: bajo.reduce((n, f) => n + f.consultas, 0),
      pacientes: bajo.reduce((n, f) => n + f.pacientes, 0),
    },
    cuantasSeSuprimieron: bajo.length,
  };
}

/**
 * ¿Esta salida cumple el umbral? Para poder AFIRMARLO en el registro de la entrega, y para el candado.
 *
 * Una salida cumple cuando ninguna de sus filas describe a menos de `k` personas. La fila reunida cuenta
 * como cualquier otra: si al juntar tres celdas de uno quedan tres personas, sigue por debajo del umbral
 * y la tabla no se puede publicar.
 */
export function cumpleElUmbral(filas: readonly CeldaConPacientes[], k: number = K_ANONIMATO): boolean {
  return filas.every((f) => f.pacientes >= k);
}
