// ═══ EL MINIMO DE WOMPI (smoke del Bloque 3, 2026-09-14) ═══
//
// Wompi rechaza todo cobro por debajo de $1.500 ("El monto minimo de una transaccion es $1,500 exceptuando
// impuestos"; soporte de Wompi: "Agregador: desde $1.500"). No es del sandbox: aplica igual en produccion. El
// rechazo ocurre DENTRO de la pagina de Wompi, con el paciente delante, y el link queda sin pagar.
//
// Se compara contra el TOTAL que se cobra. El mensaje de Wompi dice "exceptuando impuestos" y Atlas no le manda
// los impuestos por separado, asi que un total entre 1.500 y 1.785 (base por debajo de 1.500) no esta
// verificado. Ningun producto real se acerca: el mas barato cuesta 90.000.
//
// Modulo NEUTRO: lo usan el servicio (la regla) y las dos pantallas de cobro (el aviso antes de pulsar).
export const WOMPI_MONTO_MINIMO = 1500;

export const MENSAJE_MINIMO_WOMPI = "Wompi no acepta cobros de menos de $1.500. Cóbralo en efectivo.";
