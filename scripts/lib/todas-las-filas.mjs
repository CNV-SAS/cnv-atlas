// ══════════════════════════════════════════════════════════════════════════════════════════════════
// TRAER TODAS LAS FILAS, NO LAS PRIMERAS MIL
//
// ═══ EL DEFECTO QUE CIERRA (2026-10-25) ═══
//
// Un script de verificacion reconstruyo la cohorte de investigacion y dio 136 autorizadas donde la
// pantalla dice 316. La causa no era la consulta: era que `patient_consents` tiene mas de mil filas y
// **PostgREST devuelve mil y no dice nada**. El `error` viene vacio, el arreglo llega completo a su
// manera, y todo lo que se calcule encima sale mal por lo bajo.
//
// LO PELIGROSO ES QUE EL RESULTADO PARECE RAZONABLE. 136 de 513 es un numero creible; sin un total que
// comparar, se habria reportado como hallazgo ("faltan 180 autorizaciones") y se habria investigado un
// problema que no existe. Lo que lo atrapo fue imprimir los totales al lado de los que la pantalla ya
// mostraba, antes de desglosar nada.
//
// ES LA MISMA FAMILIA que el `.in()` demasiado largo que devuelve "URI too long" y deja la suma en cero:
// un limite de la API que nadie leyo. La diferencia es que ese SI daba error.
//
// COMO SE USA:
//   const filas = await todasLasFilas(db, "patient_consents", "patient_id, consent_type, revoked_at");
// ══════════════════════════════════════════════════════════════════════════════════════════════════

/** Tamano de pagina. Mil es el tope por defecto de PostgREST, asi que se pide justo eso. */
const PAGINA = 1000;

/**
 * Lee una tabla COMPLETA por paginas.
 *
 * @param db       cliente de supabase-js.
 * @param tabla    nombre de la tabla o vista.
 * @param columnas lo que va en el `select`.
 * @param afinar   opcional: recibe el query para agregar filtros (`(q) => q.is("deleted_at", null)`).
 */
export async function todasLasFilas(db, tabla, columnas, afinar) {
  const todas = [];
  for (let desde = 0; ; desde += PAGINA) {
    let q = db.from(tabla).select(columnas).range(desde, desde + PAGINA - 1);
    if (afinar) q = afinar(q);
    const { data, error } = await q;
    if (error) throw new Error(`leyendo ${tabla}: ${error.message}`);
    todas.push(...data);
    // MENOS DE UNA PAGINA = era la ultima. Y si viene exacta, se pide otra: parar aqui dejaria fuera
    // justo la tabla cuyo tamano es multiplo de mil, que es el caso que nadie prueba.
    if (data.length < PAGINA) return todas;
  }
}
