// ══════════════════════════════════════════════════════════════════════════════════════════════════
// TRAER TODAS LAS FILAS, NO LAS PRIMERAS MIL, Y CADA UNA UNA VEZ
//
// ═══ EL PRIMER DEFECTO QUE CIERRA (2026-10-25) ═══
//
// Un script de verificacion reconstruyo la cohorte de investigacion y dio 136 autorizadas donde la
// pantalla dice 316. La causa no era la consulta: era que `patient_consents` tiene mas de mil filas y
// **PostgREST devuelve mil y no dice nada**. El `error` viene vacio y el arreglo llega completo a su manera.
//
// ═══ EL SEGUNDO, AL DIA SIGUIENTE, Y ES DE ESTE ARCHIVO (2026-10-26) ═══
//
// La primera version paginaba con `.range()` **sin ordenar**, y eso no define nada: Postgres puede
// devolver las filas en otro orden entre una pagina y la siguiente, asi que una fila cae en las dos
// paginas y otra en ninguna. Se vio al contar los percentiles del QC: **451 valores de talla sobre 352
// mediciones**, que es imposible.
//
// Y ES PEOR QUE EL PRIMERO, porque el primero daba de MENOS (sospechoso) y este da de MAS y de MENOS a la
// vez: un percentil calculado encima sale plausible y esta mal, y nada lo delata.
//
// ═══ LAS DOS COSAS QUE LO CIERRAN, Y LA SEGUNDA ES LA QUE IMPORTA ═══
//
//   1. SE ORDENA SIEMPRE por una columna estable (`id` por defecto, o la que el llamador nombre). Con
//      orden, las paginas son disjuntas y completas.
//   2. SE VERIFICA CONTRA EL CONTEO EXACTO de la propia base, con los mismos filtros, y si no coincide se
//      LANZA. Porque un orden mal elegido (una columna no unica) vuelve a abrir el agujero en silencio, y
//      aqui ya aprendimos que lo que no se verifica es lo que sale plausible y falso.
//
// COMO SE USA:
//   const filas = await todasLasFilas(db, "patient_consents", "patient_id, consent_type, revoked_at");
//   const crudos = await todasLasFilas(db, "bis_raw_values", "measurement_id, value", (q) =>
//     q.in("variable_name", VARIABLES), { orden: "measurement_id,variable_name" });
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Tamano de pagina. Mil es el tope por defecto de PostgREST, asi que se pide justo eso. */
const PAGINA = 1000;

/**
 * Lee una tabla COMPLETA por paginas, ordenada y verificada contra el conteo de la base.
 *
 * @param db       cliente de supabase-js.
 * @param tabla    nombre de la tabla o vista.
 * @param columnas lo que va en el `select`.
 * @param afinar   opcional: recibe el query para agregar filtros (`(q) => q.is("deleted_at", null)`). Se
 *                 aplica TAMBIEN al conteo, o la verificacion compararia dos universos distintos.
 * @param opciones `orden`: columna(s) por las que paginar, separadas por coma. Por defecto `id`. Tienen
 *                 que ser ESTABLES; si no son unicas, la verificacion lo delata.
 */
export async function todasLasFilas(db, tabla, columnas, afinar, opciones = {}) {
  const orden = (opciones.orden ?? "id").split(",").map((c) => c.trim());

  // EL CONTEO PRIMERO, con los mismos filtros. `head: true` no trae filas: solo el total.
  let conteo = db.from(tabla).select(columnas, { count: "exact", head: true });
  if (afinar) conteo = afinar(conteo);
  const { count, error: errorConteo } = await conteo;
  if (errorConteo) throw new Error(`contando ${tabla}: ${errorConteo.message}`);

  const todas = [];
  for (let desde = 0; ; desde += PAGINA) {
    let q = db.from(tabla).select(columnas);
    if (afinar) q = afinar(q);
    for (const col of orden) q = q.order(col, { ascending: true });
    q = q.range(desde, desde + PAGINA - 1);
    const { data, error } = await q;
    if (error) throw new Error(`leyendo ${tabla}: ${error.message}`);
    todas.push(...data);
    // MENOS DE UNA PAGINA = era la ultima. Y si viene exacta, se pide otra: parar aqui dejaria fuera
    // justo la tabla cuyo tamano es multiplo de mil, que es el caso que nadie prueba.
    if (data.length < PAGINA) break;
  }

  if (count != null && todas.length !== count) {
    throw new Error(
      `leyendo ${tabla}: la base dice ${count} filas y la paginacion trajo ${todas.length}. ` +
        `Revisa el orden ("${orden.join(", ")}"): si no es estable, las paginas se solapan.`,
    );
  }
  return todas;
}
