// ═══ QUE SIGNIFICA "PROFESIONAL DE PRUEBA" (0199, 2026-09-30) ═══
//
// MODULO NEUTRO, y existe por la misma razon que su gemelo de pacientes: el significado vive en UN sitio.
// La regla es la misma de `modules/patients/de-prueba.ts`, y aqui no se reescribe, se apunta.
//
// MARCAR SOLO EXCLUYE DONDE ALGUIEN ESCRIBIO QUE EXCLUYA. Con los pacientes, `is_test` existia desde antes
// y se respetaba en UN SOLO sitio: en todo lo demas contaban igual que uno real. El trabajo nunca es la
// casilla, es el barrido, y su candado es `profesional-de-prueba-barrido`.
//
// ── LAS TRES CAPAS ──
//
//   1 · FUERA DE LAS CIFRAS de resumen de la organizacion: el bruto, el ingreso de CNV, las comisiones, lo
//       que se deshizo y los insights.
//   2 · FUERA DE LO QUE SALE hacia afuera (investigacion).
//   3 · VISIBLE DONDE SE TRABAJA, MARCADO. Sigue en la lista de usuarios con su rotulo. Esconderlo seria
//       la forma de que alguien lo confunda con uno real, y ademas dejaria a Demo sin poder demostrar.
//
// ── LAS DOS COSAS QUE NO HACE, Y SON DECISIONES ──
//
// NO SACA SU INVENTARIO DE LA VITRINA. Un saldo no es un flujo: las unidades que Demo tiene son unidades
// REALES que CNV le entrego, y estan ahi. Sacarlas daria un numero que no cuadra con ningun conteo fisico.
// Es la misma linea que trazo la fecha de arranque. (Un PRODUCTO de prueba si se excluye: esas unidades son
// ficticias, y son dos cosas distintas aunque compartan el nombre de la columna.)
//
// NO DECIDE SI SE FACTURA. Eso lo decide el PACIENTE, y tiene que seguir siendo asi: un profesional de
// prueba que le venda a un paciente REAL tiene que emitir su factura igual, porque la venta ocurrio y la
// ley no pregunta quien la registro. La propuesta decia que "convenia que valiera lo mismo"; al mirarlo de
// cerca no conviene, porque el caso malo no es una factura de mas, es una venta real sin factura.
//
// Y SU TABLERO DE INICIO SI LE MUESTRA LO SUYO. Esa pantalla responde "¿como voy yo?", no "¿cuanto opera
// CNV?", y vaciarsela le quitaria justo lo que tiene que poder demostrar.

/** Rotulo en una superficie de trabajo. Corto a proposito: acompaña, no grita. */
export const ROTULO_PROFESIONAL_DE_PRUEBA = "De demostración";

/** Lo que se le dice a quien mira la lista de usuarios, en una linea. */
export function leyendaDeProfesionalDePrueba(esDePrueba: boolean): string | null {
  return esDePrueba
    ? `${ROTULO_PROFESIONAL_DE_PRUEBA}. Lo suyo no cuenta en las cifras de la organización; su inventario y sus facturas sí son reales.`
    : null;
}

/**
 * El filtro, en SQL, para una consulta que ya tiene la venta como `t`.
 *
 * ES UNA CADENA Y NO UN HELPER QUE ARME LA CONSULTA, y es deliberado: un helper que nadie llama mas que su
 * propio test es un guard sin superficie que lo alcance, que es la forma de hacer creer que una regla se
 * aplica. Lo que de verdad la aplica es este texto escrito en cada lectura mas el candado que falla si una
 * cifra nueva se escribe sin el.
 */
export const SQL_SIN_PROFESIONAL_DE_PRUEBA =
  "not exists (select 1 from professional_profiles pp where pp.id = t.professional_id and pp.is_test)";
