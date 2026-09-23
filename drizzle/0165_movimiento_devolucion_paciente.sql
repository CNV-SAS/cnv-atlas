-- Movimiento `devolucion_paciente` (devolucion fisica, 3b sesion 2): la unidad vuelve del paciente y entra a cuarentena (+), ligada a la LINEA de venta.
-- UN SOLO ENUNCIADO por archivo: `ALTER TYPE ... ADD VALUE` no corre dentro de una transaccion.
ALTER TYPE "nutraceutical_movement_type" ADD VALUE IF NOT EXISTS 'devolucion_paciente';
